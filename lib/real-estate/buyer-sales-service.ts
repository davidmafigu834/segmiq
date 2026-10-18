import { createAdminClient } from "@/lib/supabase/admin";
import { createSubjectActivity } from "@/lib/activities/subject-activity";
import { phonesMatchLoose } from "@/lib/real-estate/helpers";
import { createScheduledViewing } from "@/lib/real-estate/viewing-service";
import {
  type InterestRecord,
  type InterestState,
  type MatchListing,
  type MatchSearch,
  type RejectionReason,
  type SearchStage,
  MATCH_PAGE_SIZE,
  MATCH_SCAN_CEILING,
  SEARCH_STAGES,
  asPropertyCategories,
  asPropertyCategory,
  canLinkEnquiry,
  canSeeBuyerContact,
  coarseStatusForStage,
  demandGaps,
  effectiveStage,
  explainSearchListing,
  isDuplicateViewing,
  isRejectionReset,
  listingCandidateFilter,
  listingFingerprint,
  matchListingsForSearch,
  matchSearchesForListing,
  nextDepositStatus,
  notificationKey,
  notificationPlan,
  rejectedListingsForSearch,
  searchCandidateFilter,
  searchFieldChanges,
  viewingOverlapWarning,
  wantedCategories,
  agentPriorities,
  type SearchSnapshot,
} from "@/lib/real-estate/buyer-match";
import { isListingLive } from "@/lib/real-estate/listings";
import { reviewerWaitingCopy } from "@/lib/real-estate/buyer-introduction-review";
import {
  notifyIntroductionRequested,
  reviewBuyerIntroduction as decideBuyerIntroduction,
} from "@/lib/real-estate/buyer-introduction-service";
import { readAllPages, type PageFetcher } from "@/lib/real-estate/paging";
import { viewingTransitionError } from "@/lib/real-estate/viewing-access";

export type BuyerActor = {
  id: string;
  name: string;
  role: string;
  clientId: string | null;
};

function missing(error: { message?: string; code?: string } | null): boolean {
  const message = error?.message ?? "";
  return error?.code === "42P01" || /does not exist|schema cache/i.test(message);
}

function sameOrg(actor: BuyerActor, clientId: string): boolean {
  if (actor.role === "SUPER_ADMIN") return true;
  return actor.clientId === clientId;
}

function isManager(role: string): boolean {
  return role === "CLIENT_MANAGER" || role === "SUPER_ADMIN";
}

function num(value: unknown): number | null {
  if (value == null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function asSearch(row: Record<string, unknown>): MatchSearch {
  return {
    id: String(row.id),
    clientId: String(row.client_id),
    contactId: String(row.contact_id),
    intent: row.intent === "rental" ? "rental" : "purchase",
    status: String(row.status ?? "needs_review"),
    pipelineStage: (row.pipeline_stage as string | null) ?? null,
    propertyType: (row.property_type as string | null) ?? null,
    propertyCategories: asPropertyCategories(row.property_categories),
    budgetMin: num(row.budget_min),
    budgetMax: num(row.budget_max),
    locations: Array.isArray(row.locations) ? (row.locations as string[]) : [],
    bedrooms: num(row.bedrooms),
    bathrooms: num(row.bathrooms),
    allowAboveBudget: Boolean(row.allow_above_budget),
    allowAlternateLocations: row.allow_alternate_locations !== false,
    assignedAgentId: (row.assigned_agent_id as string | null) ?? null,
  };
}

function asListing(row: Record<string, unknown>): MatchListing {
  return {
    id: String(row.id),
    clientId: String(row.client_id),
    transactionType: String(row.transaction_type ?? ""),
    status: (row.status as string | null) ?? null,
    approvalStatus: (row.approval_status as string | null) ?? "approved",
    price: num(row.price),
    suburb: (row.suburb as string | null) ?? null,
    bedrooms: num(row.bedrooms),
    bathrooms: num(row.bathrooms),
    sizeSqm: num(row.size_sqm),
    propertyType: null,
    propertyCategory: asPropertyCategory(row.property_category),
    agentId: (row.agent_id as string | null) ?? null,
  };
}

async function recordEvent(input: {
  clientId: string;
  searchId: string;
  eventType: string;
  field?: string | null;
  from?: string | null;
  to?: string | null;
  note?: string | null;
  actorId?: string | null;
}) {
  const supabase = createAdminClient();
  const { error } = await supabase.from("real_estate_buyer_search_events").insert({
    client_id: input.clientId,
    search_id: input.searchId,
    event_type: input.eventType,
    field_name: input.field ?? null,
    from_value: input.from ?? null,
    to_value: input.to ?? null,
    note: input.note ?? null,
    actor_id: input.actorId ?? null,
  });
  if (error && !missing(error)) console.error("[buyer-search-event]", error.message);
}

export async function createBuyerSearch(input: {
  clientId: string;
  actor: BuyerActor;
  contactId?: string | null;
  name?: string | null;
  phone?: string | null;
  confirmNewContact?: boolean;
  intent: "purchase" | "rental";
  propertyType?: string | null;
  propertyCategories?: string[] | null;
  locations?: string[] | null;
  budgetMin?: number | null;
  budgetMax?: number | null;
  currency?: string | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  landSize?: string | null;
  buildingSize?: string | null;
  features?: string | null;
  amenities?: string | null;
  timeframe?: string | null;
  readiness?: string | null;
  leaseMonths?: number | null;
  moveInDate?: string | null;
  notes?: string | null;
  nextActionAt?: string | null;
  nextActionNote?: string | null;
  allowAboveBudget?: boolean;
  leadId?: string | null;
}): Promise<
  | { ok: true; search: Record<string, unknown> }
  | { ok: false; error: string; status: number; duplicates?: Array<{ id: string; name: string | null }> }
> {
  if (!sameOrg(input.actor, input.clientId)) return { ok: false, error: "Forbidden.", status: 403 };
  if (input.intent !== "purchase" && input.intent !== "rental") {
    return { ok: false, error: "Choose buy or rent.", status: 400 };
  }
  const supabase = createAdminClient();
  let contactId = input.contactId ?? null;

  if (!contactId) {
    const name = input.name?.trim();
    if (!name) return { ok: false, error: "Customer name is required.", status: 400 };
    if (input.phone?.trim()) {
      const { data: existing } = await supabase
        .from("contacts")
        .select("id, name, phone")
        .eq("client_id", input.clientId)
        .limit(200);
      const duplicates = (existing ?? []).filter((row) => phonesMatchLoose(row.phone as string, input.phone));
      if (duplicates.length && !input.confirmNewContact) {
        return {
          ok: false,
          error: "A contact with a similar phone already exists.",
          status: 409,
          duplicates: duplicates.map((row) => ({ id: row.id as string, name: (row.name as string | null) ?? null })),
        };
      }
    }
    const created = await supabase
      .from("contacts")
      .insert({ client_id: input.clientId, name, phone: input.phone?.trim() || null })
      .select("id")
      .single();
    if (created.error || !created.data) {
      return { ok: false, error: created.error?.message ?? "Could not create the contact.", status: 500 };
    }
    contactId = created.data.id as string;
  } else {
    const { data: contact } = await supabase
      .from("contacts")
      .select("id")
      .eq("id", contactId)
      .eq("client_id", input.clientId)
      .maybeSingle();
    if (!contact) return { ok: false, error: "Contact not found.", status: 404 };
  }

  const stage: SearchStage = "new_enquiry";
  const categories = asPropertyCategories(input.propertyCategories ?? []);
  const inserted = await supabase
    .from("real_estate_buyer_searches")
    .insert({
      ...(categories.length ? { property_categories: categories } : {}),
      client_id: input.clientId,
      contact_id: contactId,
      assigned_agent_id: input.actor.role === "SALESPERSON" ? input.actor.id : input.actor.id,
      intent: input.intent,
      property_type: input.propertyType?.trim() || null,
      budget_min: input.budgetMin ?? null,
      budget_max: input.budgetMax ?? null,
      currency: (input.currency || "USD").toUpperCase(),
      locations: (input.locations ?? []).map((item) => item.trim()).filter(Boolean),
      bedrooms: input.bedrooms ?? null,
      bathrooms: input.bathrooms ?? null,
      land_size: input.landSize?.trim() || null,
      building_size: input.buildingSize?.trim() || null,
      features: input.features?.trim() || null,
      amenities: input.amenities?.trim() || null,
      other_requirements: input.notes?.trim() || null,
      timeframe: input.timeframe?.trim() || null,
      readiness: input.readiness?.trim() || null,
      lease_months: input.leaseMonths ?? null,
      move_in_date: input.moveInDate || null,
      allow_above_budget: Boolean(input.allowAboveBudget),
      allow_alternate_locations: true,
      pipeline_stage: stage,
      status: coarseStatusForStage(stage),
      next_action_at: input.nextActionAt || null,
      next_action_note: input.nextActionNote?.trim() || null,
      provenance: "agent",
    })
    .select("*")
    .single();
  if (inserted.error && categoryColumnMissing(inserted.error)) {
    return {
      ok: false,
      error: "Property type categories need the final corrections migration. Clear the property type or apply the migration.",
      status: 503,
    };
  }

  if (inserted.error || !inserted.data) {
    if (missing(inserted.error)) {
      return { ok: false, error: "Buyer searches are not available until the Phase 3 migration is applied.", status: 503 };
    }
    return { ok: false, error: inserted.error?.message ?? "Could not create the search.", status: 500 };
  }

  const search = inserted.data;
  await supabase.from("real_estate_contact_roles").upsert(
    {
      client_id: input.clientId,
      contact_id: contactId,
      role: input.intent === "rental" ? "tenant" : "buyer",
      verification_status: "unverified",
      source: "buyer_search",
    },
    { onConflict: "client_id,contact_id,role" }
  );
  await recordEvent({
    clientId: input.clientId,
    searchId: search.id as string,
    eventType: "search_created",
    to: stage,
    actorId: input.actor.id,
  });

  if (input.leadId) {
    const { data: lead } = await supabase
      .from("leads")
      .select("id, client_id, contact_id")
      .eq("id", input.leadId)
      .eq("client_id", input.clientId)
      .maybeSingle();
    if (
      lead &&
      canLinkEnquiry({
        leadClientId: lead.client_id as string,
        searchClientId: input.clientId,
        leadContactId: (lead.contact_id as string | null) ?? null,
        searchContactId: contactId,
      })
    ) {
      await supabase
        .from("leads")
        .update({
          buyer_search_id: search.id,
          deal_side: input.intent === "rental" ? "tenant_side" : "buy_side",
        })
        .eq("id", lead.id)
        .eq("client_id", input.clientId);
    }
  }

  if (input.nextActionAt) {
    await createSubjectActivity({
      clientId: input.clientId,
      subjectType: "buyer_search",
      subjectId: search.id as string,
      title: input.nextActionNote?.trim() || "Follow up on this search",
      dueAt: input.nextActionAt,
      assignedToId: input.actor.id,
      createdBy: input.actor.id,
    });
  }

  return { ok: true, search };
}

export async function listBuyerSearches(input: {
  clientId: string;
  actor: BuyerActor;
  q?: string | null;
  intent?: string | null;
  stage?: string | null;
  status?: string | null;
  agentId?: string | null;
  location?: string | null;
  propertyType?: string | null;
  followUp?: string | null;
  contactId?: string | null;
  page?: number;
  pageSize?: number;
}) {
  if (!sameOrg(input.actor, input.clientId)) return { ok: false as const, error: "Forbidden.", status: 403 };
  const supabase = createAdminClient();
  const page = Math.max(1, input.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, input.pageSize ?? 25));
  let query = supabase
    .from("real_estate_buyer_searches")
    .select(
      "id, contact_id, assigned_agent_id, intent, property_type, budget_min, budget_max, currency, locations, bedrooms, bathrooms, pipeline_stage, status, next_action_at, next_action_note, updated_at, created_at",
      { count: "exact" }
    )
    .eq("client_id", input.clientId)
    .order("updated_at", { ascending: false });

  if (input.actor.role === "SALESPERSON") query = query.eq("assigned_agent_id", input.actor.id);
  else if (input.agentId) query = query.eq("assigned_agent_id", input.agentId);
  if (input.contactId) query = query.eq("contact_id", input.contactId);
  if (input.intent === "purchase" || input.intent === "rental") query = query.eq("intent", input.intent);
  if (input.status) query = query.eq("status", input.status);
  if (input.stage && (SEARCH_STAGES as readonly string[]).includes(input.stage)) query = query.eq("pipeline_stage", input.stage);
  if (input.propertyType) query = query.ilike("property_type", `%${input.propertyType}%`);
  if (input.followUp === "due") query = query.lte("next_action_at", new Date().toISOString()).eq("status", "active");
  if (input.location?.trim()) query = query.contains("locations", [input.location.trim()]);

  const { data, error, count } = await query.range((page - 1) * pageSize, page * pageSize - 1);
  if (error) {
    if (missing(error)) return { ok: false as const, error: "Apply the Phase 3 migration before using buyer searches.", status: 503 };
    return { ok: false as const, error: error.message, status: 500 };
  }

  const rows = data ?? [];
  const contactIds = [...new Set(rows.map((row) => row.contact_id as string))];
  const agentIds = [...new Set(rows.map((row) => row.assigned_agent_id as string).filter(Boolean))];
  const [{ data: contacts }, { data: agents }] = await Promise.all([
    contactIds.length
      ? supabase.from("contacts").select("id, name, phone").eq("client_id", input.clientId).in("id", contactIds)
      : Promise.resolve({ data: [] as Array<Record<string, unknown>> }),
    agentIds.length
      ? supabase.from("users").select("id, name").in("id", agentIds)
      : Promise.resolve({ data: [] as Array<Record<string, unknown>> }),
  ]);
  const contactById = new Map((contacts ?? []).map((row) => [row.id as string, row]));
  const agentById = new Map((agents ?? []).map((row) => [row.id as string, row.name as string]));
  const needle = input.q?.trim().toLowerCase() ?? "";
  const searches = rows
    .map((row) => {
      const contact = contactById.get(row.contact_id as string);
      const phone = isManager(input.actor.role) || row.assigned_agent_id === input.actor.id ? (contact?.phone as string | null) ?? null : null;
      return {
        ...row,
        contact_name: (contact?.name as string | null) ?? "Customer",
        phone,
        agent_name: agentById.get(row.assigned_agent_id as string) ?? null,
        stage_label: effectiveStage(asSearch(row as Record<string, unknown>)),
      };
    })
    .filter((row) => {
      if (!needle) return true;
      return (
        row.contact_name.toLowerCase().includes(needle) ||
        (row.phone ?? "").toLowerCase().includes(needle)
      );
    });

  return { ok: true as const, searches, page, pageSize, total: count ?? searches.length };
}

export async function buyerSearchMetrics(clientId: string, actor: BuyerActor) {
  if (!sameOrg(actor, clientId)) return { ok: false as const, error: "Forbidden.", status: 403 };
  const supabase = createAdminClient();
  const agent = actor.role === "SALESPERSON";
  const paged = await readAllPages(
    (from, to) => {
      let base = supabase
        .from("real_estate_buyer_searches")
        .select("id, contact_id, intent, status, next_action_at, created_at")
        .eq("client_id", clientId);
      if (agent) base = base.eq("assigned_agent_id", actor.id);
      return base.order("id", { ascending: true }).range(from, to);
    },
    { pageSize: 1000, ceiling: 50_000 }
  );
  if (paged.error) {
    if (missing(paged.error)) return { ok: false as const, error: "Apply the Phase 3 migration before using buyer searches.", status: 503 };
    return { ok: false as const, error: paged.error.message ?? "Could not load searches.", status: 500 };
  }
  const rows = paged.rows;
  const active = rows.filter((row) => row.status === "active");
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const now = new Date().toISOString();
  let viewingQuery = supabase
    .from("viewings")
    .select("id", { count: "exact", head: true })
    .eq("client_id", clientId)
    .eq("status", "scheduled");
  let offerQuery = supabase
    .from("real_estate_offers")
    .select("id", { count: "exact", head: true })
    .eq("client_id", clientId)
    .in("status", ["submitted", "countered", "negotiating"]);
  if (agent) {
    viewingQuery = viewingQuery.eq("agent_id", actor.id);
    offerQuery = offerQuery.or(`buyer_agent_id.eq.${actor.id},listing_agent_id.eq.${actor.id}`);
  }
  const [{ count: viewings }, { count: offers }] = await Promise.all([viewingQuery, offerQuery]);
  return {
    ok: true as const,
    incomplete: paged.incomplete,
    metrics: {
      activeBuyers: new Set(active.filter((row) => row.intent === "purchase").map((row) => row.contact_id)).size,
      activeTenants: new Set(active.filter((row) => row.intent === "rental").map((row) => row.contact_id)).size,
      newSearches: rows.filter((row) => new Date(row.created_at as string).getTime() >= weekAgo).length,
      viewingsScheduled: viewings ?? 0,
      offersInProgress: offers ?? 0,
      followUpDue: active.filter((row) => row.next_action_at && String(row.next_action_at) <= now).length,
      countsArePeople: "activeBuyers and activeTenants count distinct contacts. newSearches counts searches.",
    },
  };
}

async function loadOwnedSearch(clientId: string, searchId: string, actor: BuyerActor) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("real_estate_buyer_searches")
    .select("*")
    .eq("id", searchId)
    .eq("client_id", clientId)
    .maybeSingle();
  if (error) return { ok: false as const, error: error.message, status: missing(error) ? 503 : 500 };
  if (!data) return { ok: false as const, error: "Search not found.", status: 404 };
  if (!sameOrg(actor, clientId)) return { ok: false as const, error: "Forbidden.", status: 403 };
  if (actor.role === "SALESPERSON" && data.assigned_agent_id !== actor.id) {
    return { ok: false as const, error: "Forbidden.", status: 403 };
  }
  return { ok: true as const, search: data as Record<string, unknown> };
}

export async function getBuyerSearchBundle(clientId: string, searchId: string, actor: BuyerActor) {
  const owned = await loadOwnedSearch(clientId, searchId, actor);
  if (!owned.ok) return owned;
  const supabase = createAdminClient();
  const search = owned.search;
  const contactId = search.contact_id as string;
  const [{ data: contact }, { data: roles }, { data: interests }, { data: events }, { data: applications }] = await Promise.all([
    supabase.from("contacts").select("id, name, phone").eq("id", contactId).eq("client_id", clientId).maybeSingle(),
    supabase.from("real_estate_contact_roles").select("role, verification_status").eq("client_id", clientId).eq("contact_id", contactId),
    supabase.from("real_estate_property_interests").select("*").eq("client_id", clientId).eq("contact_id", contactId),
    supabase.from("real_estate_buyer_search_events").select("*").eq("client_id", clientId).eq("search_id", searchId).order("created_at", { ascending: false }).limit(50),
    supabase.from("real_estate_rental_applications").select("*").eq("client_id", clientId).eq("search_id", searchId),
  ]);
  const { data: viewings } = await supabase.from("viewings").select("*").eq("client_id", clientId).eq("buyer_search_id", searchId).order("scheduled_at", { ascending: false }).limit(30);
  const { data: offers } = await supabase.from("real_estate_offers").select("id, listing_id, status, current_offer_amount, currency, buyer_search_id").eq("client_id", clientId).eq("buyer_search_id", searchId);
  const showContact = canSeeBuyerContact({
    requesterId: actor.id,
    ownerAgentId: (search.assigned_agent_id as string | null) ?? null,
    role: actor.role,
    introductionAccepted: true,
  });
  return {
    ok: true as const,
    search,
    contact: contact
      ? {
          id: contact.id,
          name: contact.name,
          phone: showContact ? contact.phone : null,
        }
      : null,
    roles: roles ?? [],
    interests: interests ?? [],
    events: events ?? [],
    viewings: viewings ?? [],
    offers: offers ?? [],
    applications: applications ?? [],
  };
}

export async function updateBuyerSearch(input: {
  clientId: string;
  searchId: string;
  actor: BuyerActor;
  patch: Partial<{
    pipelineStage: SearchStage;
    propertyType: string | null;
    propertyCategories: string[];
    locations: string[];
    budgetMin: number | null;
    budgetMax: number | null;
    bedrooms: number | null;
    bathrooms: number | null;
    timeframe: string | null;
    readiness: string | null;
    notes: string | null;
    features: string | null;
    amenities: string | null;
    leaseMonths: number | null;
    moveInDate: string | null;
    allowAboveBudget: boolean;
    nextActionAt: string | null;
    nextActionNote: string | null;
    closureReason: string | null;
    assignedAgentId: string | null;
  }>;
}) {
  const owned = await loadOwnedSearch(input.clientId, input.searchId, input.actor);
  if (!owned.ok) return owned;
  if (input.patch.assignedAgentId && !isManager(input.actor.role)) {
    return { ok: false as const, error: "Only a manager can reassign a search.", status: 403 };
  }
  if (input.patch.assignedAgentId) {
    const { data: agent } = await createAdminClient()
      .from("users")
      .select("id")
      .eq("id", input.patch.assignedAgentId)
      .eq("client_id", input.clientId)
      .eq("is_active", true)
      .maybeSingle();
    if (!agent) return { ok: false as const, error: "Choose an active member of your team.", status: 400 };
  }
  const before = owned.search;
  const stage = input.patch.pipelineStage;
  if (stage && !(SEARCH_STAGES as readonly string[]).includes(stage)) {
    return { ok: false as const, error: "Unknown search stage.", status: 400 };
  }
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (stage) {
    update.pipeline_stage = stage;
    update.status = coarseStatusForStage(stage);
  }
  if (input.patch.propertyType !== undefined) update.property_type = input.patch.propertyType;
  if (input.patch.propertyCategories !== undefined) {
    update.property_categories = asPropertyCategories(input.patch.propertyCategories);
  }
  if (input.patch.locations) update.locations = input.patch.locations.map((item) => item.trim()).filter(Boolean);
  if (input.patch.budgetMin !== undefined) update.budget_min = input.patch.budgetMin;
  if (input.patch.budgetMax !== undefined) update.budget_max = input.patch.budgetMax;
  if (input.patch.bedrooms !== undefined) update.bedrooms = input.patch.bedrooms;
  if (input.patch.bathrooms !== undefined) update.bathrooms = input.patch.bathrooms;
  if (input.patch.timeframe !== undefined) update.timeframe = input.patch.timeframe;
  if (input.patch.readiness !== undefined) update.readiness = input.patch.readiness;
  if (input.patch.notes !== undefined) update.other_requirements = input.patch.notes;
  if (input.patch.features !== undefined) update.features = input.patch.features;
  if (input.patch.amenities !== undefined) update.amenities = input.patch.amenities;
  if (input.patch.leaseMonths !== undefined) update.lease_months = input.patch.leaseMonths;
  if (input.patch.moveInDate !== undefined) update.move_in_date = input.patch.moveInDate;
  if (input.patch.allowAboveBudget !== undefined) update.allow_above_budget = input.patch.allowAboveBudget;
  if (input.patch.nextActionAt !== undefined) update.next_action_at = input.patch.nextActionAt;
  if (input.patch.nextActionNote !== undefined) update.next_action_note = input.patch.nextActionNote;
  if (input.patch.closureReason !== undefined) update.closure_reason = input.patch.closureReason;
  if (input.patch.assignedAgentId !== undefined) update.assigned_agent_id = input.patch.assignedAgentId;

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("real_estate_buyer_searches")
    .update(update)
    .eq("id", input.searchId)
    .eq("client_id", input.clientId)
    .select("*")
    .single();
  if (error || !data) return { ok: false as const, error: error?.message ?? "Could not update the search.", status: 500 };

  const snapshot = (row: Record<string, unknown>): SearchSnapshot => ({
    budgetMin: num(row.budget_min),
    budgetMax: num(row.budget_max),
    locations: Array.isArray(row.locations) ? (row.locations as string[]) : [],
    propertyType: (row.property_type as string | null) ?? null,
    timeframe: (row.timeframe as string | null) ?? null,
    pipelineStage: (row.pipeline_stage as string | null) ?? null,
    assignedAgentId: (row.assigned_agent_id as string | null) ?? null,
  });
  for (const change of searchFieldChanges(snapshot(before), snapshot(data as Record<string, unknown>))) {
    await recordEvent({
      clientId: input.clientId,
      searchId: input.searchId,
      eventType: "search_updated",
      field: change.field,
      from: change.from,
      to: change.to,
      actorId: input.actor.id,
    });
  }
  if (input.patch.nextActionAt) {
    await createSubjectActivity({
      clientId: input.clientId,
      subjectType: "buyer_search",
      subjectId: input.searchId,
      title: input.patch.nextActionNote?.trim() || "Follow up on this search",
      dueAt: input.patch.nextActionAt,
      assignedToId: (data.assigned_agent_id as string | null) ?? input.actor.id,
      createdBy: input.actor.id,
    });
  }
  return { ok: true as const, search: data };
}

export async function setPropertyInterest(input: {
  clientId: string;
  actor: BuyerActor;
  searchId: string;
  listingId: string;
  state: InterestState;
  rejectionReason?: RejectionReason | null;
  note?: string | null;
}) {
  const owned = await loadOwnedSearch(input.clientId, input.searchId, input.actor);
  if (!owned.ok) return owned;
  const supabase = createAdminClient();
  const { data: listing } = await supabase
    .from("listings")
    .select("id")
    .eq("id", input.listingId)
    .eq("client_id", input.clientId)
    .maybeSingle();
  if (!listing) return { ok: false as const, error: "Listing not found.", status: 404 };
  if (input.state === "not_interested" && !input.rejectionReason) {
    return { ok: false as const, error: "Record why the customer is not interested.", status: 400 };
  }
  const search = owned.search;
  const now = new Date().toISOString();
  const { data: previous } = await supabase
    .from("real_estate_property_interests")
    .select("*")
    .eq("client_id", input.clientId)
    .eq("search_id", input.searchId)
    .eq("listing_id", input.listingId)
    .maybeSingle();
  const reset = isRejectionReset((previous?.interest_state as string | null) ?? null, input.state);
  const base = {
    client_id: input.clientId,
    search_id: input.searchId,
    contact_id: search.contact_id,
    listing_id: input.listingId,
    agent_id: input.actor.id,
    status: input.state === "not_interested" ? "closed" : "active",
    interest_state: input.state,
    rejection_reason: input.state === "not_interested" ? input.rejectionReason : null,
    rejection_note: input.note ?? null,
    source: "agent",
    updated_at: now,
  };
  let fingerprint: string | null = null;
  if (input.state === "not_interested") {
    const listingRow = await loadMatchListing(input.clientId, input.listingId);
    fingerprint = listingRow ? listingFingerprint(asListing(listingRow)) : null;
  }
  const extended = {
    ...base,
    rejected_at: input.state === "not_interested" ? now : null,
    rejected_fingerprint: fingerprint,
    ...(reset ? { reset_at: now, reset_by: input.actor.id } : {}),
  };
  let saved = await supabase
    .from("real_estate_property_interests")
    .upsert(extended, { onConflict: "client_id,search_id,listing_id" })
    .select("*")
    .single();
  if (saved.error && (saved.error.code === "42P10" || /on conflict|rejected_|reset_/i.test(saved.error.message))) {
    // Before the final corrections migration interests are unique per contact and listing.
    saved = await supabase
      .from("real_estate_property_interests")
      .upsert(base, { onConflict: "client_id,contact_id,listing_id" })
      .select("*")
      .single();
  }
  const { data, error } = saved;
  if (error || !data) return { ok: false as const, error: error?.message ?? "Could not save the interest.", status: 500 };
  await recordEvent({
    clientId: input.clientId,
    searchId: input.searchId,
    eventType: input.state === "not_interested" ? "property_rejected" : reset ? "rejection_reset" : "interest_updated",
    to: input.state,
    note: input.rejectionReason ?? input.note ?? null,
    actorId: input.actor.id,
  });
  return { ok: true as const, interest: data };
}

function pageAll(fetchPage: PageFetcher) {
  return readAllPages(fetchPage, { pageSize: MATCH_PAGE_SIZE, ceiling: MATCH_SCAN_CEILING });
}

const LISTING_MATCH_COLUMNS =
  "id, client_id, transaction_type, status, approval_status, price, suburb, bedrooms, bathrooms, size_sqm, agent_id, address, photos";

function categoryColumnMissing(error: { message?: string } | null): boolean {
  return /property_categor/i.test(error?.message ?? "");
}

/** Approved available listings, filtered in the database for one search when given. */
async function candidateListings(clientId: string, search: MatchSearch | null) {
  const supabase = createAdminClient();
  const categories = search ? wantedCategories(search) : [];
  const run = (withCategory: boolean) =>
    pageAll((from, to) => {
      let query = supabase
        .from("listings")
        .select(withCategory ? `${LISTING_MATCH_COLUMNS}, property_category` : LISTING_MATCH_COLUMNS)
        .eq("client_id", clientId)
        .eq("status", "available")
        .eq("approval_status", "approved");
      if (search) {
        query =
          search.intent === "rental"
            ? query.eq("transaction_type", "rental")
            : query.in("transaction_type", ["sale", "new_development"]);
        const filter = listingCandidateFilter({
          budgetMax: search.budgetMax,
          allowAboveBudget: search.allowAboveBudget,
          categories,
          includeCategory: withCategory,
        });
        if (filter) query = query.or(filter);
      }
      return query.order("id").range(from, to);
    });
  let result = await run(true);
  if (result.error && categoryColumnMissing(result.error)) result = await run(false);
  if (result.error) return { ok: false as const, error: result.error.message ?? "Could not load listings.", listings: [], incomplete: true };
  const listings = result.rows.filter((row) =>
    isListingLive({ status: row.status as string, approval_status: (row.approval_status as string | null) ?? "approved" })
  );
  return { ok: true as const, error: null, listings, incomplete: result.incomplete };
}

/** Active searches that could accept this listing, filtered in the database. */
async function candidateSearches(clientId: string, listing: MatchListing | null) {
  const supabase = createAdminClient();
  if (listing && listing.transactionType !== "rental" && listing.transactionType !== "sale" && listing.transactionType !== "new_development") {
    return { ok: true as const, searches: [] as Record<string, unknown>[], incomplete: false, error: null };
  }
  const result = await pageAll((from, to) => {
    let query = supabase
      .from("real_estate_buyer_searches")
      .select("*")
      .eq("client_id", clientId)
      .eq("status", "active");
    if (listing) {
      query = query.eq("intent", listing.transactionType === "rental" ? "rental" : "purchase");
      const filter = searchCandidateFilter(listing.price);
      if (filter) query = query.or(filter);
    }
    return query.order("id").range(from, to);
  });
  if (result.error) return { ok: false as const, searches: [], incomplete: true, error: result.error.message ?? "Could not load searches." };
  return { ok: true as const, searches: result.rows, incomplete: result.incomplete, error: null };
}

function asInterest(row: Record<string, unknown>): InterestRecord {
  return {
    searchId: (row.search_id as string | null) ?? null,
    listingId: String(row.listing_id),
    state: (row.interest_state as string | null) ?? null,
    rejectionReason: (row.rejection_reason as string | null) ?? null,
    rejectedFingerprint: (row.rejected_fingerprint as string | null) ?? null,
  };
}

async function rejectedIdsForSearch(
  clientId: string,
  searchId: string,
  contactId: string,
  fingerprints: ReadonlyMap<string, string>
) {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("real_estate_property_interests")
    .select("*")
    .eq("client_id", clientId)
    .eq("contact_id", contactId);
  return rejectedListingsForSearch(
    searchId,
    (data ?? []).map((row) => asInterest(row as Record<string, unknown>)),
    fingerprints
  );
}

/** Per-search exclusions for one listing. Interests are scoped to that listing. */
async function rejectedBySearchForListing(
  clientId: string,
  listingId: string,
  searches: Record<string, unknown>[],
  fingerprint: string
) {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("real_estate_property_interests")
    .select("*")
    .eq("client_id", clientId)
    .eq("listing_id", listingId);
  const byContact = new Map<string, InterestRecord[]>();
  for (const row of data ?? []) {
    const contactId = String(row.contact_id);
    const list = byContact.get(contactId) ?? [];
    list.push(asInterest(row as Record<string, unknown>));
    byContact.set(contactId, list);
  }
  const fingerprints = new Map([[listingId, fingerprint]]);
  const rejectedBySearch = new Map<string, Set<string>>();
  for (const search of searches) {
    const interests = byContact.get(String(search.contact_id));
    if (!interests?.length) continue;
    const rejected = rejectedListingsForSearch(String(search.id), interests, fingerprints);
    if (rejected.size) rejectedBySearch.set(String(search.id), rejected);
  }
  return rejectedBySearch;
}

export async function matchesForSearch(clientId: string, searchId: string, actor: BuyerActor) {
  const owned = await loadOwnedSearch(clientId, searchId, actor);
  if (!owned.ok) return owned;
  const search = asSearch(owned.search);
  const loaded = await candidateListings(clientId, search);
  if (!loaded.ok) return { ok: false as const, error: loaded.error, status: 500 };
  const listings = loaded.listings.map((row) => asListing(row));
  const fingerprints = new Map(listings.map((listing) => [listing.id, listingFingerprint(listing)]));
  const rejected = await rejectedIdsForSearch(clientId, searchId, search.contactId, fingerprints);
  const explanations = matchListingsForSearch(search, listings, rejected);
  const byId = new Map(loaded.listings.map((row) => [row.id as string, row]));
  return {
    ok: true as const,
    incomplete: loaded.incomplete,
    truncated: loaded.incomplete,
    notice: loaded.incomplete
      ? `Only the first ${MATCH_SCAN_CEILING} candidate listings were checked. Narrow the search to see the rest.`
      : null,
    matches: explanations.map((item) => ({
      ...item,
      listing: byId.get(item.listingId) ?? null,
    })),
  };
}

export async function buyersForListing(clientId: string, listingId: string, actor: BuyerActor) {
  if (!sameOrg(actor, clientId)) return { ok: false as const, error: "Forbidden.", status: 403 };
  const supabase = createAdminClient();
  const listing = await loadMatchListing(clientId, listingId);
  if (!listing) return { ok: false as const, error: "Listing not found.", status: 404 };
  if (!isListingLive({ status: listing.status as string, approval_status: (listing.approval_status as string | null) ?? "approved" })) {
    return { ok: true as const, matches: [], incomplete: false, notice: "Only an approved available listing is matched to buyers." };
  }
  const candidate = asListing(listing);
  const loaded = await candidateSearches(clientId, candidate);
  if (!loaded.ok) return { ok: false as const, error: loaded.error ?? "Could not load searches.", status: 500 };
  const rows = loaded.searches;
  const contactIds = [...new Set(rows.map((row) => row.contact_id as string))];
  const rejectedBySearch = await rejectedBySearchForListing(clientId, listingId, rows, listingFingerprint(candidate));
  const { data: intros } = await supabase
    .from("real_estate_buyer_introductions")
    .select("search_id, status")
    .eq("client_id", clientId)
    .eq("listing_id", listingId)
    .eq("requesting_agent_id", actor.id);
  const introBySearch = new Map((intros ?? []).map((row) => [row.search_id as string, String(row.status)]));
  const accepted = new Set((intros ?? []).filter((row) => row.status === "accepted").map((row) => row.search_id as string));
  const explanations = matchSearchesForListing(candidate, rows.map((row) => asSearch(row as Record<string, unknown>)), rejectedBySearch);
  const searchById = new Map(rows.map((row) => [row.id as string, row]));
  const matchedContactIds = [
    ...new Set(explanations.map((item) => searchById.get(item.searchId)?.contact_id as string).filter(Boolean)),
  ];
  const visibleContactIds = matchedContactIds.filter((contactId) => contactIds.includes(contactId));
  const contacts: Record<string, unknown>[] = [];
  for (let index = 0; index < visibleContactIds.length; index += 200) {
    const { data } = await supabase
      .from("contacts")
      .select("id, name, phone")
      .eq("client_id", clientId)
      .in("id", visibleContactIds.slice(index, index + 200));
    contacts.push(...((data ?? []) as Record<string, unknown>[]));
  }
  const agentIds = [...new Set(rows.map((row) => row.assigned_agent_id as string).filter(Boolean))];
  const { data: agents } = agentIds.length
    ? await supabase.from("users").select("id, name").eq("client_id", clientId).in("id", agentIds)
    : { data: [] };
  const contactById = new Map(contacts.map((row) => [row.id as string, row]));
  const agentById = new Map((agents ?? []).map((row) => [row.id as string, row.name as string]));
  return {
    ok: true as const,
    incomplete: loaded.incomplete,
    notice: loaded.incomplete
      ? `Only the first ${MATCH_SCAN_CEILING} active searches were checked.`
      : null,
    matches: explanations.map((item) => {
      const search = searchById.get(item.searchId);
      const ownerId = (search?.assigned_agent_id as string | null) ?? null;
      const visible = canSeeBuyerContact({
        requesterId: actor.id,
        ownerAgentId: ownerId,
        role: actor.role,
        introductionAccepted: accepted.has(item.searchId),
      });
      const contact = search ? contactById.get(search.contact_id as string) : null;
      const introductionStatus = introBySearch.get(item.searchId) ?? null;
      const managedBy = ownerId ? agentById.get(ownerId) ?? "Another agent" : "Unassigned";
      return {
        ...item,
        managedBy,
        contactName: visible ? (contact?.name as string | null) ?? "Customer" : null,
        phone: visible ? (contact?.phone as string | null) ?? null : null,
        canRequestIntroduction: !visible && !introductionStatus,
        introductionStatus,
        introductionNote:
          introductionStatus === "requested"
            ? reviewerWaitingCopy({ assigneeName: ownerId ? managedBy : null })
            : introductionStatus === "declined"
              ? "Buyer details stay private."
              : introductionStatus === "accepted"
                ? "You can see the contact details authorised for this property."
                : null,
      };
    }),
  };
}

export async function discoverMatchesForListing(input: { clientId: string; listingId: string }) {
  const supabase = createAdminClient();
  const listing = await loadMatchListing(input.clientId, input.listingId);
  if (!listing) return { created: 0, skipped: "missing" as const };
  const candidate = asListing(listing);
  if (!isListingLive({ status: candidate.status, approval_status: candidate.approvalStatus })) {
    await invalidateListingMatchNotifications(input.clientId, input.listingId, `listing_${candidate.status ?? "not_live"}`);
    return { created: 0, skipped: "not_live" as const };
  }
  const loaded = await candidateSearches(input.clientId, candidate);
  if (!loaded.ok) return { created: 0, skipped: "error" as const };
  const rows = loaded.searches;
  const fingerprint = listingFingerprint(candidate);
  const rejectedBySearch = await rejectedBySearchForListing(input.clientId, input.listingId, rows, fingerprint);
  const explanations = matchSearchesForListing(
    candidate,
    rows.map((row) => asSearch(row as Record<string, unknown>)),
    rejectedBySearch
  );
  const existing = await loadNotificationKeys(input.clientId, input.listingId);
  const searchById = new Map(rows.map((row) => [row.id as string, row]));
  const plan = notificationPlan(
    explanations.map((item) => ({
      listingId: input.listingId,
      searchId: item.searchId,
      agentId: (searchById.get(item.searchId)?.assigned_agent_id as string | null) ?? null,
      fingerprint,
    })),
    existing
  );
  if (!plan.insert.length && !plan.revive.length) {
    return { created: 0, skipped: "duplicate" as const, incomplete: loaded.incomplete };
  }
  const reasonBySearch = new Map(explanations.map((item) => [item.searchId, item]));
  if (plan.insert.length) {
    const { error } = await supabase.from("real_estate_match_notifications").insert(
      plan.insert.map((pair) => ({
        client_id: input.clientId,
        listing_id: pair.listingId,
        search_id: pair.searchId,
        agent_id: pair.agentId,
        fingerprint: pair.fingerprint,
        strength: reasonBySearch.get(pair.searchId)?.strength ?? null,
        reasons: reasonBySearch.get(pair.searchId)?.reasons ?? [],
      }))
    );
    if (error && !/duplicate|unique/i.test(error.message) && !missing(error)) {
      console.error("[match-notify]", error.message);
      return { created: 0, skipped: "error" as const };
    }
  }
  for (const pair of plan.revive) {
    await supabase
      .from("real_estate_match_notifications")
      .update({
        invalidated_at: null,
        invalidated_reason: null,
        created_at: new Date().toISOString(),
        agent_id: pair.agentId,
        strength: reasonBySearch.get(pair.searchId)?.strength ?? null,
        reasons: reasonBySearch.get(pair.searchId)?.reasons ?? [],
      })
      .eq("client_id", input.clientId)
      .eq("listing_id", pair.listingId)
      .eq("search_id", pair.searchId)
      .eq("fingerprint", pair.fingerprint);
  }
  return {
    created: plan.insert.length + plan.revive.length,
    channel: "internal" as const,
    incomplete: loaded.incomplete,
  };
}

async function loadMatchListing(clientId: string, listingId: string) {
  const supabase = createAdminClient();
  const base = "id, client_id, transaction_type, status, approval_status, price, suburb, bedrooms, bathrooms, size_sqm, agent_id, address";
  const first = await supabase
    .from("listings")
    .select(`${base}, property_category`)
    .eq("id", listingId)
    .eq("client_id", clientId)
    .maybeSingle();
  if (!first.error) return (first.data as Record<string, unknown> | null) ?? null;
  if (!categoryColumnMissing(first.error)) return null;
  const fallback = await supabase.from("listings").select(base).eq("id", listingId).eq("client_id", clientId).maybeSingle();
  return (fallback.data as Record<string, unknown> | null) ?? null;
}

async function loadNotificationKeys(clientId: string, listingId: string) {
  const supabase = createAdminClient();
  const first = await supabase
    .from("real_estate_match_notifications")
    .select("listing_id, search_id, fingerprint, invalidated_at")
    .eq("client_id", clientId)
    .eq("listing_id", listingId);
  let rows = (first.data ?? []) as Record<string, unknown>[];
  if (first.error) {
    const fallback = await supabase
      .from("real_estate_match_notifications")
      .select("listing_id, search_id, fingerprint")
      .eq("client_id", clientId)
      .eq("listing_id", listingId);
    rows = (fallback.data ?? []) as Record<string, unknown>[];
  }
  return rows.map((row) => ({
    key: notificationKey({
      listingId: String(row.listing_id),
      searchId: String(row.search_id),
      fingerprint: String(row.fingerprint),
    }),
    invalidated: Boolean(row.invalidated_at),
  }));
}

/**
 * Marks internal match notifications stale when a listing leaves the market
 * (sold, let, withdrawn, unapproved). History is kept.
 */
export async function invalidateListingMatchNotifications(clientId: string, listingId: string, reason: string) {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("real_estate_match_notifications")
    .update({ invalidated_at: new Date().toISOString(), invalidated_reason: reason })
    .eq("client_id", clientId)
    .eq("listing_id", listingId)
    .is("invalidated_at", null);
  if (error && !missing(error)) console.error("[match-invalidate]", error.message);
}

export async function requestBuyerIntroduction(input: {
  clientId: string;
  actor: BuyerActor;
  listingId: string;
  searchId: string;
}) {
  if (!sameOrg(input.actor, input.clientId)) return { ok: false as const, error: "Forbidden.", status: 403 };
  const supabase = createAdminClient();
  const { data: search } = await supabase
    .from("real_estate_buyer_searches")
    .select("id, assigned_agent_id, client_id")
    .eq("id", input.searchId)
    .eq("client_id", input.clientId)
    .maybeSingle();
  if (!search) return { ok: false as const, error: "Search not found.", status: 404 };
  if (search.assigned_agent_id === input.actor.id) {
    return { ok: false as const, error: "You already manage this search.", status: 400 };
  }
  const { data: listing } = await supabase
    .from("listings")
    .select("id")
    .eq("id", input.listingId)
    .eq("client_id", input.clientId)
    .maybeSingle();
  if (!listing) return { ok: false as const, error: "Listing not found.", status: 404 };
  const { data: existing } = await supabase
    .from("real_estate_buyer_introductions")
    .select("*")
    .eq("client_id", input.clientId)
    .eq("listing_id", input.listingId)
    .eq("search_id", input.searchId)
    .eq("requesting_agent_id", input.actor.id)
    .maybeSingle();
  if (existing?.status === "requested" || existing?.status === "accepted") {
    return { ok: true as const, introduction: existing };
  }
  if (existing?.status === "declined") {
    return { ok: false as const, error: "This introduction was declined. It cannot be requested again.", status: 409 };
  }
  const { data, error } = await supabase
    .from("real_estate_buyer_introductions")
    .upsert(
      {
        client_id: input.clientId,
        listing_id: input.listingId,
        search_id: input.searchId,
        requesting_agent_id: input.actor.id,
        owning_agent_id: search.assigned_agent_id,
        status: "requested",
      },
      { onConflict: "listing_id,search_id,requesting_agent_id" }
    )
    .select("*")
    .single();
  if (error || !data) return { ok: false as const, error: error?.message ?? "Could not send the request.", status: 500 };
  await notifyIntroductionRequested({
    clientId: input.clientId,
    introductionId: data.id as string,
    requesterId: input.actor.id,
  });
  return { ok: true as const, introduction: data };
}

export async function reviewBuyerIntroduction(input: {
  clientId: string;
  actor: BuyerActor;
  introductionId: string;
  decision: "accepted" | "declined";
  decisionReason?: string | null;
}) {
  return decideBuyerIntroduction(input);
}

export async function scheduleSearchViewing(input: {
  clientId: string;
  actor: BuyerActor;
  searchId: string;
  listingId: string;
  scheduledAt: string;
  agentId?: string | null;
  confirmationStatus?: "tentative" | "awaiting_confirmation" | "confirmed";
  instructions?: string | null;
  confirmOverlap?: boolean;
  idempotencyKey?: string | null;
}) {
  const owned = await loadOwnedSearch(input.clientId, input.searchId, input.actor);
  if (!owned.ok) return owned;
  const supabase = createAdminClient();
  const search = owned.search;
  const agentId = input.agentId || (search.assigned_agent_id as string | null) || input.actor.id;
  if (!Number.isFinite(new Date(input.scheduledAt).getTime())) {
    return { ok: false as const, error: "Choose a valid viewing time.", status: 400 };
  }
  const { data: existing } = await supabase
    .from("viewings")
    .select("id, contact_id, listing_id, agent_id, scheduled_at, status")
    .eq("client_id", input.clientId)
    .eq("listing_id", input.listingId)
    .eq("contact_id", search.contact_id as string)
    .eq("status", "scheduled");
  if (
    isDuplicateViewing(
      (existing ?? []).map((row) => ({
        contactId: row.contact_id as string,
        listingId: row.listing_id as string,
        scheduledAt: row.scheduled_at as string,
      })),
      { contactId: search.contact_id as string, listingId: input.listingId, scheduledAt: input.scheduledAt }
    )
  ) {
    return { ok: false as const, error: "This viewing is already scheduled.", status: 409 };
  }
  const { data: listingRow } = await supabase
    .from("listings")
    .select("id")
    .eq("id", input.listingId)
    .eq("client_id", input.clientId)
    .maybeSingle();
  if (!listingRow) return { ok: false as const, error: "Listing not found.", status: 404 };
  if (agentId !== input.actor.id && agentId !== search.assigned_agent_id && !isManager(input.actor.role)) {
    return { ok: false as const, error: "Only a manager can book a viewing for another agent.", status: 403 };
  }
  const { data: agentViewings } = await supabase
    .from("viewings")
    .select("id, agent_id, scheduled_at")
    .eq("client_id", input.clientId)
    .eq("agent_id", agentId)
    .eq("status", "scheduled")
    .gte("scheduled_at", new Date(new Date(input.scheduledAt).getTime() - 3 * 3600_000).toISOString())
    .lte("scheduled_at", new Date(new Date(input.scheduledAt).getTime() + 3 * 3600_000).toISOString());
  const warning = viewingOverlapWarning(
    (agentViewings ?? []).map((row) => ({ agentId: row.agent_id as string, scheduledAt: row.scheduled_at as string, id: row.id as string })),
    { agentId, scheduledAt: input.scheduledAt }
  );
  if (warning && !input.confirmOverlap) {
    return { ok: false as const, error: warning, status: 409, warning };
  }
  const created = await createScheduledViewing({
    clientId: input.clientId,
    contactId: search.contact_id as string,
    listingId: input.listingId,
    agentId,
    scheduledAt: input.scheduledAt,
    actor: input.actor,
    notifyCustomer: false,
    buyerSearchId: input.searchId,
    confirmationStatus: input.confirmationStatus ?? "awaiting_confirmation",
    instructions: input.instructions,
    idempotencyKey: input.idempotencyKey,
  });
  if (!created.ok) return { ok: false as const, error: created.error, status: 500 };
  await setPropertyInterest({
    clientId: input.clientId,
    actor: input.actor,
    searchId: input.searchId,
    listingId: input.listingId,
    state: "viewing_requested",
  });
  if (search.pipeline_stage === "new_enquiry" || search.pipeline_stage === "requirements_discovery" || search.pipeline_stage === "actively_searching") {
    await updateBuyerSearch({
      clientId: input.clientId,
      searchId: input.searchId,
      actor: input.actor,
      patch: { pipelineStage: "viewings_in_progress" },
    });
  }
  return { ok: true as const, viewing: created.viewing, warning };
}

export async function rescheduleSearchViewing(input: {
  clientId: string;
  actor: BuyerActor;
  viewingId: string;
  scheduledAt: string;
  confirmOverlap?: boolean;
}) {
  const supabase = createAdminClient();
  const { data: viewing } = await supabase
    .from("viewings")
    .select("*")
    .eq("id", input.viewingId)
    .eq("client_id", input.clientId)
    .maybeSingle();
  if (!viewing) return { ok: false as const, error: "Viewing not found.", status: 404 };
  const searchId = viewing.buyer_search_id as string | null;
  if (!searchId) return { ok: false as const, error: "This viewing is not linked to a search.", status: 400 };
  const owned = await loadOwnedSearch(input.clientId, searchId, input.actor);
  if (!owned.ok) return owned;
  const blocked = viewingTransitionError(String(viewing.status ?? "scheduled"), "scheduled");
  if (blocked) return { ok: false as const, error: blocked, status: 409 };
  if (viewing.scheduled_at === input.scheduledAt) return { ok: true as const, warning: null, unchanged: true };
  const start = new Date(input.scheduledAt).getTime();
  if (!Number.isFinite(start)) return { ok: false as const, error: "Choose a valid viewing time.", status: 400 };
  const { data: agentViewings } = await supabase
    .from("viewings")
    .select("id, agent_id, scheduled_at")
    .eq("client_id", input.clientId)
    .eq("agent_id", viewing.agent_id as string)
    .eq("status", "scheduled")
    .gte("scheduled_at", new Date(start - 3 * 3600_000).toISOString())
    .lte("scheduled_at", new Date(start + 3 * 3600_000).toISOString());
  const warning = viewingOverlapWarning(
    (agentViewings ?? []).map((row) => ({ agentId: row.agent_id as string, scheduledAt: row.scheduled_at as string, id: row.id as string })),
    { agentId: viewing.agent_id as string, scheduledAt: input.scheduledAt, ignoreId: input.viewingId }
  );
  if (warning && !input.confirmOverlap) return { ok: false as const, error: warning, status: 409, warning };
  const basePatch = { scheduled_at: input.scheduledAt, confirmation_status: "rescheduled", status: "scheduled", reminder_sent_at: null };
  let { error } = await supabase
    .from("viewings")
    .update({
      ...basePatch,
      previous_scheduled_at: viewing.scheduled_at ?? null,
      reschedule_count: Number(viewing.reschedule_count ?? 0) + 1,
    })
    .eq("id", input.viewingId)
    .eq("client_id", input.clientId);
  if (error && missing(error)) {
    ({ error } = await supabase.from("viewings").update(basePatch).eq("id", input.viewingId).eq("client_id", input.clientId));
  }
  if (error) return { ok: false as const, error: error.message, status: 500 };
  await recordEvent({
    clientId: input.clientId,
    searchId,
    eventType: "viewing_rescheduled",
    to: input.scheduledAt,
    actorId: input.actor.id,
  });
  return { ok: true as const, warning };
}

export async function completeSearchViewing(input: {
  clientId: string;
  actor: BuyerActor;
  viewingId: string;
  outcome: string;
  note?: string | null;
}) {
  const supabase = createAdminClient();
  const { data: viewing } = await supabase
    .from("viewings")
    .select("id, client_id, listing_id, contact_id, buyer_search_id, agent_id, status, outcome")
    .eq("id", input.viewingId)
    .eq("client_id", input.clientId)
    .maybeSingle();
  if (!viewing) return { ok: false as const, error: "Viewing not found.", status: 404 };
  const searchId = viewing.buyer_search_id as string | null;
  if (searchId) {
    const owned = await loadOwnedSearch(input.clientId, searchId, input.actor);
    if (!owned.ok && viewing.agent_id !== input.actor.id) return owned;
  } else if (input.actor.role === "SALESPERSON" && viewing.agent_id !== input.actor.id) {
    return { ok: false as const, error: "Forbidden.", status: 403 };
  }
  const status = input.outcome === "no_show" ? "no_show" : "completed";
  if (viewing.status === status && viewing.outcome === input.outcome) {
    return { ok: true as const, status, outcome: input.outcome, idempotent: true };
  }
  const blocked = viewingTransitionError(String(viewing.status ?? "scheduled"), status);
  if (blocked) return { ok: false as const, error: blocked, status: 409 };
  const { error } = await supabase
    .from("viewings")
    .update({ status, outcome: input.outcome, feedback_text: input.note ?? null })
    .eq("id", input.viewingId)
    .eq("client_id", input.clientId);
  if (error) return { ok: false as const, error: error.message, status: 500 };
  const rejectionByOutcome: Record<string, RejectionReason | undefined> = {
    too_expensive: "above_budget",
    location_unsuitable: "wrong_location",
    condition: "condition",
    not_interested: "other",
  };
  const rejection = rejectionByOutcome[input.outcome];
  if (searchId) {
    await setPropertyInterest({
      clientId: input.clientId,
      actor: input.actor,
      searchId,
      listingId: viewing.listing_id as string,
      state: rejection ? "not_interested" : "viewing_completed",
      rejectionReason: rejection ?? null,
      note: input.note,
    });
    await recordEvent({
      clientId: input.clientId,
      searchId,
      eventType: "viewing_completed",
      to: input.outcome,
      note: input.note,
      actorId: input.actor.id,
    });
  }
  return { ok: true as const, status, outcome: input.outcome };
}

export async function createRentalApplication(input: {
  clientId: string;
  actor: BuyerActor;
  searchId: string;
  listingId: string;
  notes?: string | null;
}) {
  const owned = await loadOwnedSearch(input.clientId, input.searchId, input.actor);
  if (!owned.ok) return owned;
  if (owned.search.intent !== "rental") {
    return { ok: false as const, error: "Rental applications belong on a rental search.", status: 400 };
  }
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("real_estate_rental_applications")
    .insert({
      client_id: input.clientId,
      search_id: input.searchId,
      listing_id: input.listingId,
      contact_id: owned.search.contact_id,
      status: "submitted",
      deposit_status: "expected",
      notes: input.notes ?? null,
      created_by: input.actor.id,
    })
    .select("*")
    .single();
  if (error || !data) return { ok: false as const, error: error?.message ?? "Could not create the application.", status: 500 };
  return { ok: true as const, application: data };
}

export async function updateRentalDeposit(input: {
  clientId: string;
  actor: BuyerActor;
  applicationId: string;
  action: "report" | "verify";
}) {
  const decision = nextDepositStatus({ action: input.action, role: input.actor.role });
  if (!decision.ok) return { ok: false as const, error: decision.error, status: 403 };
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("real_estate_rental_applications")
    .update({ deposit_status: decision.status, updated_at: new Date().toISOString() })
    .eq("id", input.applicationId)
    .eq("client_id", input.clientId)
    .select("*")
    .single();
  if (error || !data) return { ok: false as const, error: error?.message ?? "Application not found.", status: 404 };
  return { ok: true as const, application: data };
}

export async function buyerDemandReport(clientId: string, actor: BuyerActor) {
  if (!sameOrg(actor, clientId)) return { ok: false as const, error: "Forbidden.", status: 403 };
  if (!isManager(actor.role)) return { ok: false as const, error: "Forbidden.", status: 403 };
  const [searches, listings] = await Promise.all([candidateSearches(clientId, null), candidateListings(clientId, null)]);
  if (!searches.ok) return { ok: false as const, error: searches.error ?? "Could not load searches.", status: 500 };
  if (!listings.ok) return { ok: false as const, error: listings.error, status: 500 };
  return {
    ok: true as const,
    definition: "Counts are this agency's active searches and the approved available listings that match them. They are not a market survey.",
    incomplete: searches.incomplete || listings.incomplete,
    gaps: demandGaps(searches.searches.map((row) => asSearch(row)), listings.listings.map((row) => asListing(row))),
  };
}

export async function buyerDailyPriorities(clientId: string, actor: BuyerActor) {
  if (!sameOrg(actor, clientId)) return { ok: false as const, error: "Forbidden.", status: 403 };
  const supabase = createAdminClient();
  let searchesQuery = supabase
    .from("real_estate_buyer_searches")
    .select("id, contact_id, status, pipeline_stage, next_action_at, assigned_agent_id")
    .eq("client_id", clientId)
    .eq("status", "active")
    .limit(200);
  if (actor.role === "SALESPERSON") searchesQuery = searchesQuery.eq("assigned_agent_id", actor.id);
  const { data: searches } = await searchesQuery;
  const rows = searches ?? [];
  const contactIds = [...new Set(rows.map((row) => row.contact_id as string))];
  const { data: contacts } = contactIds.length
    ? await supabase.from("contacts").select("id, name").eq("client_id", clientId).in("id", contactIds)
    : { data: [] };
  const names = new Map((contacts ?? []).map((row) => [row.id as string, (row.name as string | null) ?? "Customer"]));
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  let viewingsQuery = supabase
    .from("viewings")
    .select("id, contact_id, listing_id, scheduled_at, agent_id")
    .eq("client_id", clientId)
    .eq("status", "scheduled")
    .gte("scheduled_at", start.toISOString())
    .lt("scheduled_at", end.toISOString())
    .limit(30);
  if (actor.role === "SALESPERSON") viewingsQuery = viewingsQuery.eq("agent_id", actor.id);
  const { data: viewings } = await viewingsQuery;
  const listingIds = [...new Set((viewings ?? []).map((row) => row.listing_id as string))];
  const { data: listings } = listingIds.length
    ? await supabase.from("listings").select("id, suburb, address").eq("client_id", clientId).in("id", listingIds)
    : { data: [] };
  const listingLabel = new Map((listings ?? []).map((row) => [row.id as string, (row.suburb as string) || (row.address as string) || "Property"]));
  let offersQuery = supabase
    .from("real_estate_offers")
    .select("id, contact_id, status, buyer_agent_id")
    .eq("client_id", clientId)
    .in("status", ["submitted", "countered", "negotiating"])
    .limit(20);
  if (actor.role === "SALESPERSON") offersQuery = offersQuery.eq("buyer_agent_id", actor.id);
  const { data: offers } = await offersQuery;
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const liveNotes = await supabase
    .from("real_estate_match_notifications")
    .select("search_id")
    .eq("client_id", clientId)
    .eq("agent_id", actor.id)
    .is("invalidated_at", null)
    .gte("created_at", since)
    .limit(500);
  const notes = liveNotes.error
    ? (
        await supabase
          .from("real_estate_match_notifications")
          .select("search_id")
          .eq("client_id", clientId)
          .eq("agent_id", actor.id)
          .gte("created_at", since)
          .limit(500)
      ).data
    : liveNotes.data;
  const matchCounts = new Map<string, number>();
  for (const note of notes ?? []) {
    const id = note.search_id as string;
    matchCounts.set(id, (matchCounts.get(id) ?? 0) + 1);
  }
  const offerContactIds = (offers ?? []).map((row) => row.contact_id as string);
  const missingNames = offerContactIds.filter((id) => !names.has(id));
  if (missingNames.length) {
    const { data: more } = await supabase.from("contacts").select("id, name").eq("client_id", clientId).in("id", missingNames);
    for (const row of more ?? []) names.set(row.id as string, (row.name as string | null) ?? "Customer");
  }
  return {
    ok: true as const,
    priorities: agentPriorities({
      now: new Date(),
      searches: rows.map((row) => ({
        id: row.id as string,
        contactName: names.get(row.contact_id as string) ?? "Customer",
        stage: effectiveStage({ status: row.status as string, pipelineStage: row.pipeline_stage as string | null }),
        nextActionAt: (row.next_action_at as string | null) ?? null,
        status: row.status as string,
      })),
      viewingsToday: (viewings ?? []).map((row) => ({
        id: row.id as string,
        contactName: names.get(row.contact_id as string) ?? "Customer",
        listingLabel: listingLabel.get(row.listing_id as string) ?? "Property",
        scheduledAt: row.scheduled_at as string,
      })),
      offersWaiting: (offers ?? []).map((row) => ({
        id: row.id as string,
        contactName: names.get(row.contact_id as string) ?? "Customer",
        status: row.status as string,
      })),
      freshMatches: [...matchCounts.entries()].map(([searchId, count]) => {
        const search = rows.find((row) => row.id === searchId);
        return {
          searchId,
          contactName: search ? names.get(search.contact_id as string) ?? "Customer" : "Customer",
          count,
        };
      }),
    }),
  };
}

export async function buyerOperationsReport(clientId: string, actor: BuyerActor) {
  if (!isManager(actor.role) || !sameOrg(actor, clientId)) return { ok: false as const, error: "Forbidden.", status: 403 };
  const supabase = createAdminClient();
  const paged = await readAllPages(
    (from, to) =>
      supabase
        .from("real_estate_buyer_searches")
        .select("id, contact_id, intent, status, pipeline_stage, assigned_agent_id, next_action_at, created_at")
        .eq("client_id", clientId)
        .order("id", { ascending: true })
        .range(from, to),
    { pageSize: 1000, ceiling: 50_000 }
  );
  const error = paged.error;
  if (error) {
    return {
      ok: false as const,
      error: missing(error) ? "Apply the Phase 3 migration first." : error.message ?? "Could not load searches.",
      status: missing(error) ? 503 : 500,
    };
  }
  const rows = paged.rows;
  const active = rows.filter((row) => row.status === "active");
  const byAgent = new Map<string, { searches: number; overdue: number }>();
  const now = Date.now();
  for (const row of active) {
    const agent = (row.assigned_agent_id as string | null) ?? "unassigned";
    const bucket = byAgent.get(agent) ?? { searches: 0, overdue: 0 };
    bucket.searches += 1;
    if (row.next_action_at && new Date(row.next_action_at as string).getTime() < now) bucket.overdue += 1;
    byAgent.set(agent, bucket);
  }
  return {
    ok: true as const,
    incomplete: paged.incomplete,
    definitions: {
      people: "Distinct contact_id values.",
      searches: "Rows in real_estate_buyer_searches. One person can have several.",
      offers: "Offer rows. A submitted offer is not a completed sale.",
      transactions: "Use the existing transaction report for completed sales and rentals. This report does not treat an accepted offer as revenue.",
    },
    buyers: new Set(rows.filter((row) => row.intent === "purchase").map((row) => row.contact_id)).size,
    tenants: new Set(rows.filter((row) => row.intent === "rental").map((row) => row.contact_id)).size,
    searches: rows.length,
    activeSearches: active.length,
    pausedSearches: rows.filter((row) => row.status === "paused").length,
    completedSearches: rows.filter((row) => row.status === "completed").length,
    closedSearches: rows.filter((row) => row.status === "closed").length,
    searchesWithoutNextAction: active.filter((row) => !row.next_action_at).length,
    agents: [...byAgent.entries()].map(([agentId, stats]) => ({ agentId, ...stats })),
  };
}

export async function linkEnquiryToSearch(input: {
  clientId: string;
  actor: BuyerActor;
  searchId: string;
  leadId: string;
}) {
  const owned = await loadOwnedSearch(input.clientId, input.searchId, input.actor);
  if (!owned.ok) return owned;
  const supabase = createAdminClient();
  const { data: lead } = await supabase
    .from("leads")
    .select("id, client_id, contact_id")
    .eq("id", input.leadId)
    .eq("client_id", input.clientId)
    .maybeSingle();
  if (!lead) return { ok: false as const, error: "Enquiry not found.", status: 404 };
  if (
    !canLinkEnquiry({
      leadClientId: lead.client_id as string,
      searchClientId: input.clientId,
      leadContactId: (lead.contact_id as string | null) ?? null,
      searchContactId: owned.search.contact_id as string,
    })
  ) {
    return { ok: false as const, error: "This enquiry belongs to a different customer.", status: 400 };
  }
  const { error } = await supabase
    .from("leads")
    .update({
      buyer_search_id: input.searchId,
      deal_side: owned.search.intent === "rental" ? "tenant_side" : "buy_side",
    })
    .eq("id", input.leadId)
    .eq("client_id", input.clientId);
  if (error) return { ok: false as const, error: error.message, status: 500 };
  await recordEvent({
    clientId: input.clientId,
    searchId: input.searchId,
    eventType: "enquiry_linked",
    to: input.leadId,
    actorId: input.actor.id,
  });
  return { ok: true as const };
}

export function matchStillCurrent(
  search: MatchSearch,
  listing: MatchListing,
  rejected: ReadonlySet<string>
): boolean {
  return explainSearchListing(search, listing, rejected) != null;
}
