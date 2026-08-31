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
});

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

  const supabase = createAdminClient();

  // Scope viewings to this client's listings
  const { data: clientListings } = await supabase
    .from("listings")
    .select("id")
    .eq("client_id", params.clientId);
  const listingIds = (clientListings ?? []).map((l) => l.id as string);
  if (listingIds.length === 0) {
    return NextResponse.json({ viewings: [] });
  }

  let q = supabase
    .from("viewings")
    .select("*, listing:listings(id, address, suburb, status), contact:contacts(id, name, phone)")
    .in("listing_id", listingIds)
    .order("scheduled_at", { ascending: true });

  if (contactId) q = q.eq("contact_id", contactId);
  if (listingId) q = q.eq("listing_id", listingId);
  if (from) q = q.gte("scheduled_at", from);
  if (to) q = q.lte("scheduled_at", to);

  const { data, error } = await q;
  if (error) {
    const fallback = await supabase
      .from("viewings")
      .select("*")
      .in("listing_id", listingIds)
      .order("scheduled_at", { ascending: true });
    if (fallback.error) {
      return NextResponse.json({ error: fallback.error.message }, { status: 500 });
    }
    return NextResponse.json({ viewings: fallback.data ?? [] });
  }

  return NextResponse.json({ viewings: data ?? [] });
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
  const update: Record<string, unknown> = {};
  if (body.status !== undefined) update.status = body.status;
  if (body.scheduled_at !== undefined) update.scheduled_at = body.scheduled_at;
  if (body.feedback_text !== undefined) update.feedback_text = body.feedback_text;
  if (body.feedback_sentiment !== undefined) update.feedback_sentiment = body.feedback_sentiment;
  if (body.agent_id !== undefined) update.agent_id = body.agent_id;

  const { data: updated, error } = await supabase
    .from("viewings")
    .update(update)
    .eq("id", viewingId)
    .select("*")
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const becameCompleted =
    body.status === "completed" && (viewingRow as { status?: string }).status !== "completed";

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
