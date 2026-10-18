import { createAdminClient } from "@/lib/supabase/admin";
import { explainSearchListing, type MatchListing, type MatchSearch } from "@/lib/real-estate/buyer-match";
import { canViewBuyerOnListing, type BuyerSearchAccessFact } from "@/lib/real-estate/buyer-contact-access";
import {
  canReviewIntroduction,
  introductionEligibility,
  introductionNotifyUserIds,
  isIntroductionManager,
  reviewerWaitingCopy,
  type IntroductionDecision,
} from "@/lib/real-estate/buyer-introduction-review";
type IntroductionActor = { id: string; name: string; role: string; clientId: string | null };

function missingColumn(error: { message?: string; code?: string } | null): boolean {
  const message = error?.message ?? "";
  return error?.code === "42703" || /decided_by|decided_at|decision_reason|introduction_id|schema cache/i.test(message);
}

function num(value: unknown): number | null {
  if (value == null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

type ReviewContext = {
  row: Record<string, unknown>;
  search: Record<string, unknown> | null;
  listing: Record<string, unknown> | null;
  requesterActive: boolean;
  assigneeActive: boolean;
  currentAssigneeId: string | null;
};

async function loadReviewContext(clientId: string, introductionId: string): Promise<ReviewContext | null> {
  const supabase = createAdminClient();
  const { data: row } = await supabase
    .from("real_estate_buyer_introductions")
    .select("*")
    .eq("id", introductionId)
    .eq("client_id", clientId)
    .maybeSingle();
  if (!row) return null;
  const searchId = row.search_id as string;
  const listingId = row.listing_id as string;
  const requesterId = (row.requesting_agent_id as string | null) ?? null;
  const [{ data: search }, { data: listing }, requester] = await Promise.all([
    supabase.from("real_estate_buyer_searches").select("*").eq("id", searchId).eq("client_id", clientId).maybeSingle(),
    supabase
      .from("listings")
      .select("id, client_id, status, approval_status, suburb, address, price, bedrooms, bathrooms, transaction_type, size_sqm")
      .eq("id", listingId)
      .eq("client_id", clientId)
      .maybeSingle(),
    requesterId
      ? supabase.from("users").select("id, is_active").eq("id", requesterId).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  const currentAssigneeId = (search?.assigned_agent_id as string | null) ?? null;
  const assignee = currentAssigneeId
    ? await supabase.from("users").select("id, is_active").eq("id", currentAssigneeId).maybeSingle()
    : { data: null };
  return {
    row: row as Record<string, unknown>,
    search: (search as Record<string, unknown> | null) ?? null,
    listing: (listing as Record<string, unknown> | null) ?? null,
    requesterActive: requesterId ? Boolean(requester.data?.is_active) : false,
    assigneeActive: currentAssigneeId ? Boolean(assignee.data?.is_active) : false,
    currentAssigneeId,
  };
}

export async function notifyIntroductionRequested(input: { clientId: string; introductionId: string; requesterId: string }) {
  const supabase = createAdminClient();
  const context = await loadReviewContext(input.clientId, input.introductionId);
  if (!context) return;
  const { data: managers } = await supabase
    .from("users")
    .select("id")
    .eq("client_id", input.clientId)
    .eq("role", "CLIENT_MANAGER")
    .eq("is_active", true);
  const recipients = introductionNotifyUserIds({
    requesterId: input.requesterId,
    currentAssigneeId: context.currentAssigneeId,
    assigneeActive: context.assigneeActive,
    activeManagerIds: (managers ?? []).map((row) => row.id as string),
  });
  const place = (context.listing?.suburb as string | null) || (context.listing?.address as string | null) || "a property";
  const message = `Introduction requested for a matched buyer at ${place}.`;
  for (const userId of recipients) {
    const existing = await supabase
      .from("notifications")
      .select("id")
      .eq("user_id", userId)
      .eq("type", "BUYER_INTRODUCTION")
      .eq("introduction_id", input.introductionId)
      .limit(1);
    if (existing.error) {
      if (!missingColumn(existing.error)) console.error("[introduction-notify]", existing.error.message);
      return;
    }
    if (existing.data?.length) continue;
    const inserted = await supabase.from("notifications").insert({
      user_id: userId,
      client_id: input.clientId,
      type: "BUYER_INTRODUCTION",
      message,
      read: false,
      introduction_id: input.introductionId,
    });
    if (inserted.error && !missingColumn(inserted.error)) console.error("[introduction-notify]", inserted.error.message);
  }
}

export async function notifyIntroductionDecided(input: {
  clientId: string;
  introductionId: string;
  requesterId: string | null;
  decision: IntroductionDecision;
}) {
  if (!input.requesterId) return;
  const supabase = createAdminClient();
  const message =
    input.decision === "accepted"
      ? "Your introduction request was approved. Open it to see the next step."
      : "Your introduction request was declined. Buyer details stay private.";
  const inserted = await supabase.from("notifications").insert({
    user_id: input.requesterId,
    client_id: input.clientId,
    type: "BUYER_INTRODUCTION",
    message,
    read: false,
    introduction_id: input.introductionId,
  });
  if (inserted.error && !missingColumn(inserted.error)) console.error("[introduction-notify]", inserted.error.message);
}

export async function reviewBuyerIntroduction(input: {
  clientId: string;
  actor: IntroductionActor;
  introductionId: string;
  decision: IntroductionDecision;
  decisionReason?: string | null;
}) {
  if (input.actor.role !== "SUPER_ADMIN" && input.actor.clientId !== input.clientId) {
    return { ok: false as const, error: "Forbidden.", status: 403 };
  }
  const context = await loadReviewContext(input.clientId, input.introductionId);
  if (!context) return { ok: false as const, error: "Request not found.", status: 404 };
  const status = String(context.row.status ?? "");
  if (status !== "requested") {
    return { ok: false as const, error: "This request has already been decided.", status: 409 };
  }
  const permission = canReviewIntroduction({
    actorId: input.actor.id,
    actorRole: input.actor.role,
    requesterId: (context.row.requesting_agent_id as string | null) ?? null,
    currentAssigneeId: context.currentAssigneeId,
    assigneeActive: context.assigneeActive,
  });
  if (!permission.ok) return permission;
  const eligibility = introductionEligibility({
    requesterActive: context.requesterActive,
    search: context.search
      ? { status: String(context.search.status ?? ""), pipelineStage: (context.search.pipeline_stage as string | null) ?? null }
      : null,
    listing: context.listing
      ? {
          status: (context.listing.status as string | null) ?? null,
          approvalStatus: (context.listing.approval_status as string | null) ?? null,
        }
      : null,
  });
  if (input.decision === "accepted" && !eligibility.eligible) {
    return { ok: false as const, error: eligibility.reason, status: 409 };
  }
  const reason = input.decisionReason?.trim() || null;
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("real_estate_buyer_introductions")
    .update({
      status: input.decision,
      decided_by: input.actor.id,
      decided_at: new Date().toISOString(),
      decision_reason: input.decision === "declined" ? reason : null,
      owning_agent_id: context.currentAssigneeId,
    })
    .eq("id", input.introductionId)
    .eq("client_id", input.clientId)
    .eq("status", "requested")
    .select("id, status")
    .maybeSingle();
  if (error) {
    if (missingColumn(error)) {
      return {
        ok: false as const,
        error: "Introduction review is waiting for the database update.",
        status: 503,
      };
    }
    return { ok: false as const, error: "Could not update the request.", status: 500 };
  }
  if (!data) return { ok: false as const, error: "This request has already been decided.", status: 409 };
  await notifyIntroductionDecided({
    clientId: input.clientId,
    introductionId: input.introductionId,
    requesterId: (context.row.requesting_agent_id as string | null) ?? null,
    decision: input.decision,
  });
  return { ok: true as const, introduction: data };
}

export type IntroductionQueueItem = {
  id: string;
  status: string;
  createdAt: string;
  decidedAt: string | null;
  legacyDecision: boolean;
  listingId: string;
  listingLabel: string;
  searchId: string;
  requestingAgentName: string;
  responsibleAgentName: string | null;
  unassigned: boolean;
  requirementsSummary: string;
  matchReasons: string[];
  strength: string | null;
  eligible: boolean;
  eligibilityReason: string | null;
  waitingCopy: string;
  canApprove: boolean;
  canDecline: boolean;
  ownRequest: boolean;
  contactName: string | null;
  phone: string | null;
};

function requirementsLine(search: Record<string, unknown> | null): string {
  if (!search) return "Buyer requirements are no longer available.";
  const locations = Array.isArray(search.locations) ? (search.locations as string[]).filter(Boolean).join(", ") : "";
  const budget = search.budget_max != null ? `Up to ${search.budget_max}` : "";
  const beds = search.bedrooms != null ? `${search.bedrooms} bedrooms` : "";
  return [locations, budget, beds].filter(Boolean).join(" · ") || "Requirements not recorded.";
}

function matchFacts(search: Record<string, unknown> | null, listing: Record<string, unknown> | null): { reasons: string[]; strength: string | null } {
  if (!search || !listing) return { reasons: [], strength: null };
  const matchSearch: MatchSearch = {
    id: String(search.id),
    clientId: String(search.client_id),
    contactId: String(search.contact_id),
    intent: search.intent === "rental" ? "rental" : "purchase",
    status: String(search.status ?? ""),
    pipelineStage: (search.pipeline_stage as string | null) ?? null,
    propertyType: (search.property_type as string | null) ?? null,
    budgetMin: num(search.budget_min),
    budgetMax: num(search.budget_max),
    locations: Array.isArray(search.locations) ? (search.locations as string[]) : [],
    bedrooms: num(search.bedrooms),
    bathrooms: num(search.bathrooms),
    allowAboveBudget: Boolean(search.allow_above_budget),
    allowAlternateLocations: search.allow_alternate_locations !== false,
  };
  const matchListing: MatchListing = {
    id: String(listing.id),
    clientId: String(listing.client_id ?? search.client_id),
    transactionType: String(listing.transaction_type ?? "sale"),
    status: (listing.status as string | null) ?? null,
    approvalStatus: (listing.approval_status as string | null) ?? null,
    price: num(listing.price),
    suburb: (listing.suburb as string | null) ?? null,
    bedrooms: num(listing.bedrooms),
    bathrooms: num(listing.bathrooms),
    sizeSqm: num(listing.size_sqm),
    propertyType: null,
  };
  const explanation = explainSearchListing(matchSearch, matchListing, new Set());
  return { reasons: explanation?.reasons ?? [], strength: explanation?.strength ?? null };
}

export async function listBuyerIntroductions(clientId: string, actor: IntroductionActor) {
  if (actor.role !== "SUPER_ADMIN" && actor.clientId !== clientId) {
    return { ok: false as const, error: "Forbidden.", status: 403 };
  }
  const supabase = createAdminClient();
  const { data: rows, error } = await supabase
    .from("real_estate_buyer_introductions")
    .select("*")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) return { ok: false as const, error: "Could not load introduction requests.", status: 500 };
  const introductions = rows ?? [];
  const searchIds = [...new Set(introductions.map((row) => row.search_id as string))];
  const listingIds = [...new Set(introductions.map((row) => row.listing_id as string))];
  const userIds = [
    ...new Set(
      introductions
        .flatMap((row) => [row.requesting_agent_id, row.decided_by])
        .filter((id): id is string => typeof id === "string")
    ),
  ];
  const [{ data: searches }, { data: listings }, { data: users }] = await Promise.all([
    searchIds.length
      ? supabase.from("real_estate_buyer_searches").select("*").eq("client_id", clientId).in("id", searchIds)
      : Promise.resolve({ data: [] }),
    listingIds.length
      ? supabase
          .from("listings")
          .select("id, client_id, status, approval_status, suburb, address, price, bedrooms, bathrooms, transaction_type, size_sqm")
          .eq("client_id", clientId)
          .in("id", listingIds)
      : Promise.resolve({ data: [] }),
    userIds.length
      ? supabase.from("users").select("id, name, is_active").in("id", userIds)
      : Promise.resolve({ data: [] }),
  ]);
  const searchById = new Map((searches ?? []).map((row) => [row.id as string, row as Record<string, unknown>]));
  const assigneeIds = [...new Set((searches ?? []).map((row) => row.assigned_agent_id as string).filter(Boolean))];
  const missingAssignees = assigneeIds.filter((id) => !userIds.includes(id));
  const { data: assignees } = missingAssignees.length
    ? await supabase.from("users").select("id, name, is_active").in("id", missingAssignees)
    : { data: [] };
  const userById = new Map([...(users ?? []), ...(assignees ?? [])].map((row) => [row.id as string, row]));
  const listingById = new Map((listings ?? []).map((row) => [row.id as string, row as Record<string, unknown>]));
  const contactIds = [...new Set((searches ?? []).map((row) => row.contact_id as string).filter(Boolean))];
  const { data: contacts } = contactIds.length
    ? await supabase.from("contacts").select("id, name, phone").eq("client_id", clientId).in("id", contactIds)
    : { data: [] };
  const contactById = new Map((contacts ?? []).map((row) => [row.id as string, row]));

  const items: IntroductionQueueItem[] = [];
  for (const row of introductions) {
    const search = searchById.get(row.search_id as string) ?? null;
    const listing = listingById.get(row.listing_id as string) ?? null;
    const requesterId = (row.requesting_agent_id as string | null) ?? null;
    const ownRequest = requesterId === actor.id;
    const currentAssigneeId = (search?.assigned_agent_id as string | null) ?? null;
    const assignee = currentAssigneeId ? userById.get(currentAssigneeId) : null;
    const assigneeActive = Boolean(assignee?.is_active);
    const incoming = isIntroductionManager(actor.role) || (currentAssigneeId === actor.id && assigneeActive);
    if (!incoming && !ownRequest) continue;
    const requester = requesterId ? userById.get(requesterId) : null;
    const requesterActive = requesterId ? Boolean(requester?.is_active) : false;
    const eligibility = introductionEligibility({
      requesterActive,
      search: search
        ? { status: String(search.status ?? ""), pipelineStage: (search.pipeline_stage as string | null) ?? null }
        : null,
      listing: listing
        ? {
            status: (listing.status as string | null) ?? null,
            approvalStatus: (listing.approval_status as string | null) ?? null,
          }
        : null,
    });
    const permission = canReviewIntroduction({
      actorId: actor.id,
      actorRole: actor.role,
      requesterId,
      currentAssigneeId,
      assigneeActive,
    });
    const facts = matchFacts(search, listing);
    const contact = search ? contactById.get(search.contact_id as string) : null;
    const searchFact: BuyerSearchAccessFact | null = search
      ? {
          id: String(search.id),
          clientId,
          contactId: String(search.contact_id),
          assignedAgentId: currentAssigneeId,
          status: String(search.status ?? ""),
          pipelineStage: (search.pipeline_stage as string | null) ?? null,
        }
      : null;
    const maySeeContact =
      !ownRequest &&
      (isIntroductionManager(actor.role) || currentAssigneeId === actor.id) &&
      Boolean(contact);
    const acceptedForRequester =
      ownRequest &&
      row.status === "accepted" &&
      eligibility.eligible &&
      searchFact &&
      listing &&
      canViewBuyerOnListing({
        actor: { id: actor.id, role: actor.role, clientId: actor.clientId },
        recordClientId: clientId,
        contactId: searchFact.contactId,
        searches: [searchFact],
        listing: {
          id: String(listing.id),
          clientId,
          status: (listing.status as string | null) ?? null,
          approvalStatus: (listing.approval_status as string | null) ?? null,
        },
        introductions: [
          {
            clientId,
            listingId: String(listing.id),
            searchId: searchFact.id,
            requestingAgentId: requesterId,
            status: "accepted",
          },
        ],
      });
    const showContact = maySeeContact || acceptedForRequester;
    const decidedAt = (row.decided_at as string | null) ?? null;
    const decidedBy = (row.decided_by as string | null) ?? null;
    items.push({
      id: row.id as string,
      status: String(row.status),
      createdAt: String(row.created_at),
      decidedAt,
      legacyDecision: String(row.status) !== "requested" && !decidedAt && !decidedBy,
      listingId: row.listing_id as string,
      listingLabel: (listing?.suburb as string) || (listing?.address as string) || "Property",
      searchId: row.search_id as string,
      requestingAgentName: (requester?.name as string | null) || "Former team member",
      responsibleAgentName: assigneeActive ? ((assignee?.name as string | null) ?? "Agent") : null,
      unassigned: !currentAssigneeId || !assigneeActive,
      requirementsSummary: requirementsLine(search),
      matchReasons: facts.reasons,
      strength: facts.strength,
      eligible: eligibility.eligible,
      eligibilityReason: eligibility.eligible ? null : eligibility.reason,
      waitingCopy: reviewerWaitingCopy({
        assigneeName: currentAssigneeId && assigneeActive ? ((assignee?.name as string | null) ?? "the responsible agent") : null,
      }),
      canApprove: String(row.status) === "requested" && permission.ok && eligibility.eligible,
      canDecline: String(row.status) === "requested" && permission.ok,
      ownRequest,
      contactName: showContact ? ((contact?.name as string | null) ?? "Buyer") : null,
      phone: showContact ? ((contact?.phone as string | null) ?? null) : null,
    });
  }
  return { ok: true as const, items };
}
