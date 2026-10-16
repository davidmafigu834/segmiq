import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { canAccessClient } from "@/lib/auth/permissions";
import { createAdminClient } from "@/lib/supabase/admin";
import { createScheduledViewing } from "@/lib/real-estate/viewing-service";
import { logReActivity } from "@/lib/lead-events";
import {
  notifyViewingFeedbackRequest,
} from "@/lib/real-estate/notifications";
import { background } from "@/lib/background";
import {
  FOLLOW_UP_UNCHANGED,
  missingFollowUpMessage,
  validateActiveLeadFollowUp,
} from "@/lib/real-estate/follow-up-discipline";
import { chunk, readAllPages, type PageFetcher } from "@/lib/real-estate/paging";
import {
  canChangeViewing,
  maskViewingContact,
  viewingAccess,
  viewingTransitionError,
  type ViewingAccess,
} from "@/lib/real-estate/viewing-access";
import { viewingOverlapWarning } from "@/lib/real-estate/buyer-match";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  contact_id: z.string().uuid(),
  listing_id: z.string().uuid(),
  agent_id: z.string().uuid().nullable().optional(),
  scheduled_at: z.string().min(1),
});

const patchSchema = z.object({
  status: z.enum(["scheduled", "completed", "cancelled", "no_show"]).optional(),
  scheduled_at: z.string().optional(),
  feedback_text: z.string().max(5000).nullable().optional(),
  feedback_sentiment: z.enum(["positive", "neutral", "negative"]).nullable().optional(),
  agent_id: z.string().uuid().nullable().optional(),
  /** Required when completing a viewing for an active RE inquiry without an existing follow-up. */
  follow_up_date: z.string().nullable().optional(),
  confirmation_status: z.enum(["awaiting_confirmation", "confirmed"]).optional(),
  cancel_reason: z.string().max(1000).nullable().optional(),
  follow_up_at: z.string().nullable().optional(),
  confirm_overlap: z.boolean().optional(),
});

const EXTENDED_VIEWING_COLUMNS = ["previous_scheduled_at", "reschedule_count", "cancel_reason", "follow_up_at"];

type ViewingScope = {
  manager: boolean;
  listingAgent: Map<string, string | null>;
  searchAgent: Map<string, string | null>;
  collaboratorListings: Set<string>;
};

async function viewingScope(clientId: string, actorId: string, role: string, rows: Array<Record<string, unknown>>): Promise<ViewingScope> {
  const manager = role === "SUPER_ADMIN" || role === "CLIENT_MANAGER";
  const scope: ViewingScope = { manager, listingAgent: new Map(), searchAgent: new Map(), collaboratorListings: new Set() };
  if (manager || rows.length === 0) return scope;
  const supabase = createAdminClient();
  const listingIds = [...new Set(rows.map((row) => row.listing_id as string).filter(Boolean))];
  const searchIds = [...new Set(rows.map((row) => row.buyer_search_id as string | null).filter((id): id is string => Boolean(id)))];
  for (const ids of chunk(listingIds, 200)) {
    const { data } = await supabase.from("listings").select("id, agent_id").eq("client_id", clientId).in("id", ids);
    for (const row of data ?? []) scope.listingAgent.set(row.id as string, (row.agent_id as string | null) ?? null);
    const { data: participants } = await supabase
      .from("real_estate_deal_participants")
      .select("listing_id")
      .eq("client_id", clientId)
      .eq("user_id", actorId)
      .eq("access_status", "active")
      .is("ended_at", null)
      .in("listing_id", ids);
    for (const row of participants ?? []) if (row.listing_id) scope.collaboratorListings.add(row.listing_id as string);
  }
  for (const ids of chunk(searchIds, 200)) {
    const { data } = await supabase.from("real_estate_buyer_searches").select("id, assigned_agent_id").eq("client_id", clientId).in("id", ids);
    for (const row of data ?? []) scope.searchAgent.set(row.id as string, (row.assigned_agent_id as string | null) ?? null);
  }
  return scope;
}

function accessFor(scope: ViewingScope, actorId: string, role: string, row: Record<string, unknown>): ViewingAccess {
  if (scope.manager) return "full";
  return viewingAccess({
    actorId,
    role,
    viewingAgentId: (row.agent_id as string | null) ?? null,
    searchAgentId: row.buyer_search_id ? scope.searchAgent.get(row.buyer_search_id as string) ?? null : null,
    listingAgentId: scope.listingAgent.get(row.listing_id as string) ?? null,
    isListingCollaborator: scope.collaboratorListings.has(row.listing_id as string),
  });
}

const MAX_FILTER_IDS = 250;

/**
 * Narrows the query to viewings an agent might see. Returns null when the id lists
 * are too long for a URL; the per-row access check below still applies.
 */
async function agentCandidateFilter(clientId: string, actorId: string): Promise<string | null> {
  const supabase = createAdminClient();
  const [listings, searches, participants] = await Promise.all([
    readAllPages((from, to) => supabase.from("listings").select("id").eq("client_id", clientId).eq("agent_id", actorId).order("id").range(from, to)),
    readAllPages((from, to) =>
      supabase.from("real_estate_buyer_searches").select("id").eq("client_id", clientId).eq("assigned_agent_id", actorId).order("id").range(from, to)
    ),
    readAllPages((from, to) =>
      supabase
        .from("real_estate_deal_participants")
        .select("listing_id")
        .eq("client_id", clientId)
        .eq("user_id", actorId)
        .eq("access_status", "active")
        .is("ended_at", null)
        .not("listing_id", "is", null)
        .order("id")
        .range(from, to)
    ),
  ]);
  const listingIds = new Set([...listings.rows.map((row) => row.id as string), ...participants.rows.map((row) => row.listing_id as string)]);
  const searchIds = searches.rows.map((row) => row.id as string);
  if (listingIds.size + searchIds.length > MAX_FILTER_IDS) return null;
  const parts = [`agent_id.eq.${actorId}`];
  if (listingIds.size) parts.push(`listing_id.in.(${[...listingIds].join(",")})`);
  if (searchIds.length) parts.push(`buyer_search_id.in.(${searchIds.join(",")})`);
  return parts.join(",");
}

export async function GET(req: Request, { params }: { params: { clientId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canAccessClient(session.role, session.clientId, params.clientId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const contactId = url.searchParams.get("contact_id");
  const listingId = url.searchParams.get("listing_id");
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  const manager = session.role === "SUPER_ADMIN" || session.role === "CLIENT_MANAGER";

  const supabase = createAdminClient();
  const agentFilter = manager ? null : await agentCandidateFilter(params.clientId, session.userId);

  const fetchPage = (columns: string): PageFetcher => (fromRow, toRow) => {
    let q = supabase.from("viewings").select(columns).eq("client_id", params.clientId);
    if (agentFilter) q = q.or(agentFilter);
    if (contactId) q = q.eq("contact_id", contactId);
    if (listingId) q = q.eq("listing_id", listingId);
    if (from) q = q.gte("scheduled_at", from);
    if (to) q = q.lte("scheduled_at", to);
    return q.order("scheduled_at", { ascending: true }).order("id").range(fromRow, toRow) as unknown as ReturnType<PageFetcher>;
  };

  let result = await readAllPages(
    fetchPage("*, listing:listings(id, address, suburb, status), contact:contacts(id, name, phone)"),
    { pageSize: 500, ceiling: 5000 }
  );
  if (result.error) result = await readAllPages(fetchPage("*"), { pageSize: 500, ceiling: 5000 });
  if (result.error) return NextResponse.json({ error: result.error.message ?? "Could not load viewings." }, { status: 500 });

  const scope = await viewingScope(params.clientId, session.userId, session.role, result.rows);
  const viewings = result.rows
    .map((row) => ({ row, access: accessFor(scope, session.userId, session.role, row) }))
    .filter((item) => item.access !== "none")
    .map(({ row, access }) => ({ ...maskViewingContact(row as { contact?: { id?: string; name?: string | null; phone?: string | null } | null }, access), access }));

  return NextResponse.json({ viewings, incomplete: result.incomplete });
}

export async function POST(req: Request, { params }: { params: { clientId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canAccessClient(session.role, session.clientId, params.clientId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = createSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body", details: parsed.error.flatten() }, { status: 400 });
  }

  const supabase = createAdminClient();
  const body = parsed.data;

  const { data: contact } = await supabase
    .from("contacts")
    .select("id, name, phone, client_id, interested_listing_ids")
    .eq("id", body.contact_id)
    .eq("client_id", params.clientId)
    .maybeSingle();
  if (!contact) return NextResponse.json({ error: "Contact not found" }, { status: 404 });

  const { data: listing } = await supabase
    .from("listings")
    .select("id, address, suburb, client_id")
    .eq("id", body.listing_id)
    .eq("client_id", params.clientId)
    .maybeSingle();
  if (!listing) return NextResponse.json({ error: "Listing not found" }, { status: 404 });

  const agentId = body.agent_id ?? session.userId;
  if (agentId !== session.userId) {
    if (session.role !== "SUPER_ADMIN" && session.role !== "CLIENT_MANAGER") {
      return NextResponse.json({ error: "Only a manager can book a viewing for another agent." }, { status: 403 });
    }
    const { data: agent } = await supabase
      .from("users")
      .select("id")
      .eq("id", agentId)
      .eq("client_id", params.clientId)
      .eq("is_active", true)
      .maybeSingle();
    if (!agent) return NextResponse.json({ error: "Choose an active agent in this organisation." }, { status: 400 });
  }

  const created = await createScheduledViewing({
    clientId: params.clientId,
    contactId: body.contact_id,
    listingId: body.listing_id,
    agentId,
    scheduledAt: body.scheduled_at,
    actor: {
      id: session.userId,
      name: session.user?.name ?? "Agent",
      role: session.role,
    },
    notifyCustomer: true,
  });

  if (!created.ok) {
    return NextResponse.json({ error: created.error }, { status: 500 });
  }

  return NextResponse.json({ viewing: created.viewing }, { status: 201 });
}

async function logViewingActivity(opts: {
  clientId: string;
  contactId: string;
  actor: { id: string; name: string; role: string };
  summary: string;
  kind: "viewing_scheduled" | "viewing_completed";
}) {
  const supabase = createAdminClient();
  const { data: lead } = await supabase
    .from("leads")
    .select("id")
    .eq("client_id", opts.clientId)
    .eq("contact_id", opts.contactId)
    .order("updated_at", { ascending: false })
    .maybeSingle();
  if (!lead) return;
  await logReActivity({
    leadId: lead.id as string,
    clientId: opts.clientId,
    actor: opts.actor,
    summary: opts.summary,
    kind: opts.kind,
  });
}

export async function PATCH(req: Request, { params }: { params: { clientId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canAccessClient(session.role, session.clientId, params.clientId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const viewingId = url.searchParams.get("id");
  if (!viewingId) {
    return NextResponse.json({ error: "Missing viewing id" }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body", details: parsed.error.flatten() }, { status: 400 });
  }

  const supabase = createAdminClient();

  const { data: existing } = await supabase
    .from("viewings")
    .select("*, listing:listings!inner(id, address, suburb, client_id), contact:contacts(id, name, phone)")
    .eq("id", viewingId)
    .maybeSingle();

  // Soft fallback without embeds
  let viewingRow = existing;
  if (!viewingRow) {
    const { data: plain } = await supabase.from("viewings").select("*").eq("id", viewingId).maybeSingle();
    if (!plain) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const { data: listing } = await supabase
      .from("listings")
      .select("id, address, suburb, client_id")
      .eq("id", plain.listing_id)
      .maybeSingle();
    if (!listing || listing.client_id !== params.clientId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const { data: contact } = await supabase
      .from("contacts")
      .select("id, name, phone")
      .eq("id", plain.contact_id)
      .maybeSingle();
    viewingRow = { ...plain, listing, contact };
  } else {
    const listingClientId = (viewingRow as { listing?: { client_id?: string } }).listing?.client_id;
    if (listingClientId && listingClientId !== params.clientId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
  }

  const body = parsed.data;
  const current = viewingRow as Record<string, unknown>;
  if (current.client_id && current.client_id !== params.clientId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const scope = await viewingScope(params.clientId, session.userId, session.role, [current]);
  const access = accessFor(scope, session.userId, session.role, current);
  if (access === "none") return NextResponse.json({ error: "Not found" }, { status: 404 });

  const rescheduling = body.scheduled_at !== undefined && body.scheduled_at !== current.scheduled_at;
  const changes = [
    body.status !== undefined ? "status" : null,
    rescheduling ? "reschedule" : null,
    body.feedback_text !== undefined || body.feedback_sentiment !== undefined ? "feedback" : null,
    body.agent_id !== undefined && body.agent_id !== current.agent_id ? "reassign" : null,
    body.confirmation_status !== undefined ? "confirm" : null,
    body.follow_up_at !== undefined || body.follow_up_date !== undefined ? "follow_up" : null,
  ].filter((change): change is "status" | "reschedule" | "feedback" | "reassign" | "confirm" | "follow_up" => Boolean(change));
  for (const change of changes) {
    if (!canChangeViewing(access, change, session.role)) {
      return NextResponse.json(
        { error: change === "reassign" ? "Only a manager can reassign a viewing." : "You can view this viewing but not change it." },
        { status: 403 }
      );
    }
  }

  const currentStatus = String(current.status ?? "scheduled");
  const nextStatus = body.status ?? (rescheduling ? "scheduled" : currentStatus);
  const transitionError = viewingTransitionError(currentStatus, nextStatus);
  if (transitionError) return NextResponse.json({ error: transitionError }, { status: 409 });

  const effectiveAgentId = (body.agent_id !== undefined ? body.agent_id : (current.agent_id as string | null)) ?? null;
  if (body.agent_id) {
    const { data: agent } = await supabase
      .from("users")
      .select("id")
      .eq("id", body.agent_id)
      .eq("client_id", params.clientId)
      .eq("is_active", true)
      .maybeSingle();
    if (!agent) return NextResponse.json({ error: "Choose an active agent in this organisation." }, { status: 400 });
  }
  if ((rescheduling || body.agent_id) && effectiveAgentId && nextStatus === "scheduled") {
    const when = body.scheduled_at ?? (current.scheduled_at as string);
    const start = new Date(when).getTime();
    if (Number.isFinite(start)) {
      const { data: agentViewings } = await supabase
        .from("viewings")
        .select("id, agent_id, scheduled_at")
        .eq("client_id", params.clientId)
        .eq("agent_id", effectiveAgentId)
        .eq("status", "scheduled")
        .gte("scheduled_at", new Date(start - 3 * 3600_000).toISOString())
        .lte("scheduled_at", new Date(start + 3 * 3600_000).toISOString());
      const warning = viewingOverlapWarning(
        (agentViewings ?? []).map((row) => ({ id: row.id as string, agentId: row.agent_id as string, scheduledAt: row.scheduled_at as string })),
        { agentId: effectiveAgentId, scheduledAt: when, ignoreId: viewingId }
      );
      if (warning && !body.confirm_overlap) return NextResponse.json({ error: warning, warning }, { status: 409 });
    }
  }

  const update: Record<string, unknown> = {};
  if (body.status !== undefined) update.status = body.status;
  if (body.scheduled_at !== undefined) update.scheduled_at = body.scheduled_at;
  if (body.feedback_text !== undefined) update.feedback_text = body.feedback_text;
  if (body.feedback_sentiment !== undefined) update.feedback_sentiment = body.feedback_sentiment;
  if (body.agent_id !== undefined) update.agent_id = body.agent_id;
  if (body.confirmation_status !== undefined) update.confirmation_status = body.confirmation_status;
  if (body.cancel_reason !== undefined) update.cancel_reason = body.cancel_reason;
  if (body.follow_up_at !== undefined) update.follow_up_at = body.follow_up_at;
  if (rescheduling) {
    update.status = "scheduled";
    update.confirmation_status = "rescheduled";
    update.reminder_sent_at = null;
    update.previous_scheduled_at = current.scheduled_at ?? null;
    update.reschedule_count = Number(current.reschedule_count ?? 0) + 1;
  }

  const becameCompleted =
    body.status === "completed" && (viewingRow as { status?: string }).status !== "completed";

  if (becameCompleted) {
    const { data: client } = await supabase
      .from("clients")
      .select("business_type")
      .eq("id", params.clientId)
      .maybeSingle();

    if (client?.business_type === "real_estate") {
      const contactIdPre = (viewingRow as { contact_id?: string }).contact_id ?? null;

      if (contactIdPre) {
        const { data: relatedLead } = await supabase
          .from("leads")
          .select("id, status, follow_up_date")
          .eq("client_id", params.clientId)
          .eq("contact_id", contactIdPre)
          .or("is_archived.is.null,is_archived.eq.false")
          .order("updated_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (relatedLead) {
          const clearingFollowUp =
            body.follow_up_date !== undefined && body.follow_up_date === null;
          const followUpCheck = validateActiveLeadFollowUp({
            businessType: "real_estate",
            previousStatus: relatedLead.status as string | null,
            previousFollowUpDate: relatedLead.follow_up_date as string | null,
            nextFollowUpDate:
              body.follow_up_date === undefined ? FOLLOW_UP_UNCHANGED : body.follow_up_date,
            clearingFollowUp,
            requireIfMissing: true,
          });
          if (!followUpCheck.ok) {
            return NextResponse.json(
              { error: followUpCheck.error || missingFollowUpMessage() },
              { status: 400 }
            );
          }
          if (body.follow_up_date) {
            await supabase
              .from("leads")
              .update({
                follow_up_date: body.follow_up_date,
                follow_up_source: "HUMAN_CREATED",
                updated_at: new Date().toISOString(),
              })
              .eq("id", relatedLead.id as string);
          }
        }
      }
    }
  }

  let saved = await supabase
    .from("viewings")
    .update(update)
    .eq("id", viewingId)
    .eq("client_id", params.clientId)
    .select("*")
    .maybeSingle();
  if (saved.error && (saved.error.code === "42703" || /schema cache|does not exist/i.test(saved.error.message))) {
    const base = Object.fromEntries(Object.entries(update).filter(([key]) => !EXTENDED_VIEWING_COLUMNS.includes(key)));
    saved = await supabase.from("viewings").update(base).eq("id", viewingId).eq("client_id", params.clientId).select("*").maybeSingle();
  }
  const { data: updated, error } = saved;

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (becameCompleted) {
    await logViewingActivity({
      clientId: params.clientId,
      contactId: (updated?.contact_id as string) || (viewingRow as { contact_id?: string }).contact_id || "",
      actor: {
        id: session.userId,
        name: session.user?.name ?? "Agent",
        role: session.role,
      },
      summary: body.feedback_text ? "Viewing completed with feedback" : "Viewing completed",
      kind: "viewing_completed",
    });
    background("viewing-feedback-request", async () => {
      const listing =
        (viewingRow as { listing?: { address?: string; suburb?: string } }).listing ??
        (await supabase
          .from("listings")
          .select("address, suburb")
          .eq("id", updated!.listing_id)
          .maybeSingle()).data;
      const contact =
        (viewingRow as { contact?: { name?: string; phone?: string } }).contact ??
        (await supabase
          .from("contacts")
          .select("name, phone")
          .eq("id", updated!.contact_id)
          .maybeSingle()).data;
      if (listing && contact) {
        await notifyViewingFeedbackRequest({
          clientId: params.clientId,
          to: contact.phone ?? null,
          contactName: contact.name ?? null,
          listing,
        });
      }
    });
  }

  return NextResponse.json({ viewing: updated });
}
