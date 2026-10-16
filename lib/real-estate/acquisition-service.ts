import { createAdminClient } from "@/lib/supabase/admin";
import { createSubjectActivity } from "@/lib/activities/subject-activity";
import { syncClassification } from "@/lib/real-estate/foundation-sync";
import { assertRealEstateClient } from "@/lib/real-estate/offer-service";
import { asPropertyCategory } from "@/lib/real-estate/buyer-match";
import { readAllPages } from "@/lib/real-estate/paging";
import {
  assertStageChange,
  canAccessAcquisition,
  canRecordProfessionalValuation,
  canReviewMandate,
  conversionDecision,
  duplicateContactCandidates,
  isMandateCurrentlyValid,
  mandateApprovalConflict,
  mandateRenewalError,
  mandateRevocationError,
  quickOpportunityReady,
  valuationEvidenceError,
  type AcquisitionSource,
  type AcquisitionStage,
  type PriceType,
} from "@/lib/real-estate/acquisition-plan";

export type AcquisitionActor = {
  id: string;
  name: string;
  role: string;
  clientId: string | null;
};

type Fail = { ok: false; error: string; status: number };

function denied(): Fail {
  return { ok: false, error: "Forbidden", status: 403 };
}

async function event(input: {
  clientId: string;
  opportunityId: string;
  eventType: string;
  actorId: string;
  fromValue?: string | null;
  toValue?: string | null;
  note?: string | null;
}) {
  const supabase = createAdminClient();
  await supabase.from("real_estate_acquisition_events").insert({
    client_id: input.clientId,
    opportunity_id: input.opportunityId,
    event_type: input.eventType,
    actor_id: input.actorId,
    from_value: input.fromValue ?? null,
    to_value: input.toValue ?? null,
    note: input.note ?? null,
  });
}

async function loadOpportunity(clientId: string, opportunityId: string) {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("real_estate_acquisition_opportunities")
    .select("*")
    .eq("id", opportunityId)
    .eq("client_id", clientId)
    .maybeSingle();
  return data;
}

function guard(actor: AcquisitionActor, row: {
  client_id: string;
  assigned_agent_id?: string | null;
  sourced_by_agent_id?: string | null;
}): Fail | null {
  if (
    !canAccessAcquisition({
      role: actor.role,
      userId: actor.id,
      userClientId: actor.clientId,
      resourceClientId: row.client_id,
      assignedAgentId: row.assigned_agent_id,
      sourcedByAgentId: row.sourced_by_agent_id,
    })
  ) {
    return denied();
  }
  return null;
}

export async function createAcquisitionOpportunity(input: {
  clientId: string;
  actor: AcquisitionActor;
  contactId?: string | null;
  ownerName?: string | null;
  ownerPhone?: string | null;
  suburb?: string | null;
  city?: string | null;
  address?: string | null;
  locationNotes?: string | null;
  intent?: "sale" | "rent" | "unknown";
  source?: AcquisitionSource;
  referralDetails?: string | null;
  notes?: string | null;
  nextActionAt?: string | null;
  propertyType?: string | null;
  propertyCategory?: string | null;
  leadId?: string | null;
  idempotencyKey?: string | null;
  confirmNewContact?: boolean;
}): Promise<{ ok: true; opportunity: Record<string, unknown>; duplicateWarning?: boolean } | Fail | { ok: false; error: string; status: 409; duplicates: Array<{ id: string; name: string | null; phone: string | null }> }> {
  if (!(await assertRealEstateClient(input.clientId))) {
    return { ok: false, error: "Property acquisition is only available for real estate organisations.", status: 403 };
  }
  if (input.actor.role !== "SUPER_ADMIN" && input.actor.clientId !== input.clientId) return denied();
  const ready = quickOpportunityReady(input);
  if (!ready.ok) return { ok: false, error: ready.error, status: 400 };

  const supabase = createAdminClient();
  if (input.idempotencyKey) {
    const { data: existing } = await supabase
      .from("real_estate_acquisition_opportunities")
      .select("*")
      .eq("client_id", input.clientId)
      .eq("idempotency_key", input.idempotencyKey)
      .maybeSingle();
    if (existing) return { ok: true, opportunity: existing };
  }

  let contactId = input.contactId ?? null;
  if (contactId) {
    const { data: contact } = await supabase
      .from("contacts")
      .select("id")
      .eq("id", contactId)
      .eq("client_id", input.clientId)
      .maybeSingle();
    if (!contact) return { ok: false, error: "Contact was not found in this organisation.", status: 404 };
  } else if (input.ownerPhone || input.ownerName) {
    const { data: contacts } = await supabase
      .from("contacts")
      .select("id, name, phone")
      .eq("client_id", input.clientId)
      .limit(200);
    const duplicates = duplicateContactCandidates(contacts ?? [], input.ownerPhone, input.ownerName);
    if (duplicates.length && !input.confirmNewContact && !input.contactId) {
      return {
        ok: false,
        error: "A similar contact already exists. Select them or confirm a new contact.",
        status: 409,
        duplicates: duplicates.slice(0, 5).map((row) => ({
          id: row.id,
          name: row.name,
          phone: row.phone,
        })),
      };
    }
    if (!duplicates.length || input.confirmNewContact) {
      const { data: created, error } = await supabase
        .from("contacts")
        .insert({
          client_id: input.clientId,
          name: input.ownerName?.trim() || "Property owner",
          phone: input.ownerPhone?.trim() || null,
        })
        .select("id")
        .single();
      if (error || !created) return { ok: false, error: error?.message ?? "Could not create contact.", status: 500 };
      contactId = created.id as string;
    }
  }

  if (input.leadId) {
    const { data: lead } = await supabase
      .from("leads")
      .select("id")
      .eq("id", input.leadId)
      .eq("client_id", input.clientId)
      .maybeSingle();
    if (!lead) return { ok: false, error: "Conversation was not found in this organisation.", status: 404 };
  }

  const reference = `AQ-${Date.now().toString(36).toUpperCase()}`;
  const intent = input.intent ?? "unknown";
  const { data, error } = await supabase
    .from("real_estate_acquisition_opportunities")
    .insert({
      client_id: input.clientId,
      contact_id: contactId,
      lead_id: input.leadId ?? null,
      reference_number: reference,
      assigned_agent_id: input.actor.id,
      sourced_by_agent_id: input.actor.id,
      created_by: input.actor.id,
      source: input.source ?? "other",
      referral_details: input.referralDetails ?? null,
      owner_name: input.ownerName?.trim() || null,
      owner_phone: input.ownerPhone?.trim() || null,
      property_intent: intent,
      property_type: input.propertyType ?? null,
      ...(asPropertyCategory(input.propertyCategory) ? { property_category: asPropertyCategory(input.propertyCategory) } : {}),
      suburb: input.suburb?.trim() || null,
      city: input.city?.trim() || null,
      address: input.address?.trim() || null,
      location_notes: input.locationNotes?.trim() || null,
      notes: input.notes?.trim() || null,
      next_action_at: input.nextActionAt ?? null,
      idempotency_key: input.idempotencyKey ?? null,
    })
    .select("*")
    .single();
  if (error || !data) return { ok: false, error: error?.message ?? "Could not create opportunity.", status: 500 };

  await event({
    clientId: input.clientId,
    opportunityId: data.id as string,
    eventType: "opportunity_created",
    actorId: input.actor.id,
    toValue: "new_opportunity",
  });

  if (contactId && (intent === "sale" || intent === "rent")) {
    await syncClassification({
      clientId: input.clientId,
      contactId,
      dealSide: intent === "rent" ? "landlord_side" : "sell_side",
    });
  }
  return { ok: true, opportunity: data };
}

export async function listAcquisitionOpportunities(input: {
  clientId: string;
  actor: AcquisitionActor;
  q?: string | null;
  stage?: string | null;
  intent?: string | null;
  source?: string | null;
  agentId?: string | null;
  overdue?: boolean;
}) {
  if (!(await assertRealEstateClient(input.clientId))) return { ok: false as const, error: "Forbidden", status: 403 };
  if (input.actor.role !== "SUPER_ADMIN" && input.actor.clientId !== input.clientId) return denied();
  const supabase = createAdminClient();
  const paged = await readAllPages(
    (from, to) => {
      let query = supabase
        .from("real_estate_acquisition_opportunities")
        .select("*")
        .eq("client_id", input.clientId)
        .order("updated_at", { ascending: false })
        .order("id", { ascending: true })
        .range(from, to);
      if (input.actor.role === "SALESPERSON") {
        query = query.or(`assigned_agent_id.eq.${input.actor.id},sourced_by_agent_id.eq.${input.actor.id}`);
      }
      if (input.stage) query = query.eq("stage", input.stage);
      if (input.intent) query = query.eq("property_intent", input.intent);
      if (input.source) query = query.eq("source", input.source);
      if (input.agentId && input.actor.role !== "SALESPERSON") query = query.eq("assigned_agent_id", input.agentId);
      return query;
    },
    { pageSize: 500, ceiling: 10_000 }
  );
  if (paged.error) return { ok: false as const, error: paged.error.message ?? "Could not load opportunities.", status: 500 };
  const data = paged.rows;
  const now = Date.now();
  const rows = data.filter((row) => {
    if (!input.q) return true;
    const hay = `${row.owner_name ?? ""} ${row.suburb ?? ""} ${row.city ?? ""} ${row.address ?? ""} ${row.reference_number ?? ""}`.toLowerCase();
    return hay.includes(input.q.toLowerCase());
  }).filter((row) => {
    if (!input.overdue) return true;
    if (!row.next_action_at) return false;
    return new Date(row.next_action_at as string).getTime() < now;
  });
  return { ok: true as const, opportunities: rows, incomplete: paged.incomplete };
}

export async function getAcquisitionBundle(clientId: string, opportunityId: string, actor: AcquisitionActor) {
  const row = await loadOpportunity(clientId, opportunityId);
  if (!row) return { ok: false as const, error: "Not found", status: 404 };
  const blocked = guard(actor, row);
  if (blocked) return blocked;
  const supabase = createAdminClient();
  const [events, inspections, prices, mandates, contact] = await Promise.all([
    supabase.from("real_estate_acquisition_events").select("*").eq("opportunity_id", opportunityId).eq("client_id", clientId).order("created_at", { ascending: false }).limit(100),
    supabase.from("real_estate_inspections").select("*").eq("opportunity_id", opportunityId).eq("client_id", clientId).order("created_at", { ascending: false }),
    supabase.from("real_estate_price_discussions").select("*").eq("opportunity_id", opportunityId).eq("client_id", clientId).order("recorded_at", { ascending: false }),
    supabase.from("real_estate_mandates").select("*").eq("opportunity_id", opportunityId).eq("client_id", clientId).order("created_at", { ascending: false }),
    row.contact_id
      ? supabase.from("contacts").select("id, name, phone, email").eq("id", row.contact_id).eq("client_id", clientId).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  const inspectionIds = (inspections.data ?? []).map((item) => item.id as string);
  const photos = inspectionIds.length
    ? await supabase.from("real_estate_inspection_photos").select("*").eq("client_id", clientId).in("inspection_id", inspectionIds)
    : { data: [] };
  return {
    ok: true as const,
    opportunity: row,
    contact: contact.data,
    events: events.data ?? [],
    inspections: inspections.data ?? [],
    photos: photos.data ?? [],
    prices: prices.data ?? [],
    mandates: mandates.data ?? [],
  };
}

async function evidenceFor(clientId: string, opportunityId: string, listingId: string | null) {
  const supabase = createAdminClient();
  const [inspections, mandates, listing] = await Promise.all([
    supabase.from("real_estate_inspections").select("status").eq("client_id", clientId).eq("opportunity_id", opportunityId),
    supabase.from("real_estate_mandates").select("status, expiry_date").eq("client_id", clientId).eq("opportunity_id", opportunityId),
    listingId
      ? supabase.from("listings").select("approval_status").eq("id", listingId).eq("client_id", clientId).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  const inspectionRows = inspections.data ?? [];
  const mandateRows = mandates.data ?? [];
  return {
    hasScheduledInspection: inspectionRows.some((row) =>
      ["scheduled", "confirmed", "rescheduled", "in_progress", "completed"].includes(String(row.status))
    ),
    hasCompletedInspection: inspectionRows.some((row) => row.status === "completed"),
    hasValidMandate: mandateRows.some((row) =>
      isMandateCurrentlyValid({ status: String(row.status), expiryDate: (row.expiry_date as string | null) ?? null })
    ),
    hasListing: Boolean(listingId),
    listingApproval: (listing.data?.approval_status as string | null) ?? null,
  };
}

export async function updateAcquisitionStage(input: {
  clientId: string;
  opportunityId: string;
  actor: AcquisitionActor;
  stage: AcquisitionStage;
}) {
  const row = await loadOpportunity(input.clientId, input.opportunityId);
  if (!row) return { ok: false as const, error: "Not found", status: 404 };
  const blocked = guard(input.actor, row);
  if (blocked) return blocked;
  const evidence = await evidenceFor(input.clientId, input.opportunityId, (row.converted_listing_id as string | null) ?? null);
  const decision = assertStageChange(input.stage, evidence);
  if (!decision.ok) return { ok: false as const, error: decision.error, status: 409 };
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("real_estate_acquisition_opportunities")
    .update({ stage: input.stage, updated_at: new Date().toISOString() })
    .eq("id", input.opportunityId)
    .eq("client_id", input.clientId)
    .select("*")
    .maybeSingle();
  if (error || !data) return { ok: false as const, error: error?.message ?? "Update failed", status: 500 };
  await event({
    clientId: input.clientId,
    opportunityId: input.opportunityId,
    eventType: "stage_changed",
    actorId: input.actor.id,
    fromValue: row.stage as string,
    toValue: input.stage,
  });
  return { ok: true as const, opportunity: data };
}

export async function setAcquisitionOutcome(input: {
  clientId: string;
  opportunityId: string;
  actor: AcquisitionActor;
  status: "on_hold" | "nurturing" | "not_interested" | "lost" | "active";
  reason?: string | null;
}) {
  const row = await loadOpportunity(input.clientId, input.opportunityId);
  if (!row) return { ok: false as const, error: "Not found", status: 404 };
  const blocked = guard(input.actor, row);
  if (blocked) return blocked;
  if (input.status === "lost" && !input.reason?.trim()) {
    return { ok: false as const, error: "A lost reason is required.", status: 400 };
  }
  const patch: Record<string, unknown> = { status: input.status, updated_at: new Date().toISOString() };
  if (input.status === "lost") patch.lost_reason = input.reason?.trim();
  if (input.status === "on_hold") patch.hold_reason = input.reason?.trim() || null;
  if (input.status === "active") {
    patch.lost_reason = null;
    patch.hold_reason = null;
  }
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("real_estate_acquisition_opportunities")
    .update(patch)
    .eq("id", input.opportunityId)
    .eq("client_id", input.clientId)
    .select("*")
    .maybeSingle();
  if (error || !data) return { ok: false as const, error: error?.message ?? "Update failed", status: 500 };
  await event({
    clientId: input.clientId,
    opportunityId: input.opportunityId,
    eventType: input.status === "active" ? "opportunity_reopened" : "opportunity_closed",
    actorId: input.actor.id,
    fromValue: row.status as string,
    toValue: input.status,
    note: input.reason ?? null,
  });
  return { ok: true as const, opportunity: data };
}

export async function reassignAcquisition(input: {
  clientId: string;
  opportunityId: string;
  actor: AcquisitionActor;
  agentId: string;
}) {
  const row = await loadOpportunity(input.clientId, input.opportunityId);
  if (!row) return { ok: false as const, error: "Not found", status: 404 };
  if (!canReviewMandate({
    role: input.actor.role,
    userId: input.actor.id,
    userClientId: input.actor.clientId,
    resourceClientId: input.clientId,
  })) return denied();
  const supabase = createAdminClient();
  const { data: agent } = await supabase.from("users").select("id, client_id").eq("id", input.agentId).maybeSingle();
  if (!agent || agent.client_id !== input.clientId) {
    return { ok: false as const, error: "Agent is not in this organisation.", status: 400 };
  }
  const { data, error } = await supabase
    .from("real_estate_acquisition_opportunities")
    .update({ assigned_agent_id: input.agentId, updated_at: new Date().toISOString() })
    .eq("id", input.opportunityId)
    .eq("client_id", input.clientId)
    .select("*")
    .maybeSingle();
  if (error || !data) return { ok: false as const, error: error?.message ?? "Update failed", status: 500 };
  await event({
    clientId: input.clientId,
    opportunityId: input.opportunityId,
    eventType: "agent_assigned",
    actorId: input.actor.id,
    fromValue: (row.assigned_agent_id as string | null) ?? null,
    toValue: input.agentId,
  });
  return { ok: true as const, opportunity: data };
}

export async function recordOwnerContact(input: {
  clientId: string;
  opportunityId: string;
  actor: AcquisitionActor;
  note?: string | null;
  nextActionAt?: string | null;
  interested?: boolean;
}) {
  const row = await loadOpportunity(input.clientId, input.opportunityId);
  if (!row) return { ok: false as const, error: "Not found", status: 404 };
  const blocked = guard(input.actor, row);
  if (blocked) return blocked;
  const nextStage = input.interested
    ? "owner_interested"
    : row.stage === "new_opportunity"
      ? "owner_contacted"
      : (row.stage as string);
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("real_estate_acquisition_opportunities")
    .update({
      stage: nextStage,
      last_contacted_at: new Date().toISOString(),
      next_action_at: input.nextActionAt ?? row.next_action_at,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.opportunityId)
    .eq("client_id", input.clientId)
    .select("*")
    .maybeSingle();
  await event({
    clientId: input.clientId,
    opportunityId: input.opportunityId,
    eventType: "owner_contacted",
    actorId: input.actor.id,
    note: input.note ?? null,
    fromValue: row.stage as string,
    toValue: nextStage,
  });
  if (input.nextActionAt) {
    await createSubjectActivity({
      clientId: input.clientId,
      subjectType: "acquisition",
      subjectId: input.opportunityId,
      title: "Call owner",
      dueAt: input.nextActionAt,
      notes: input.note ?? null,
      assignedToId: (row.assigned_agent_id as string | null) ?? input.actor.id,
      createdBy: input.actor.id,
      leadId: (row.lead_id as string | null) ?? null,
    });
  }
  return { ok: true as const, opportunity: data };
}

export async function addPriceDiscussion(input: {
  clientId: string;
  opportunityId: string;
  actor: AcquisitionActor;
  amount: number;
  currency?: string;
  priceType: PriceType;
  notes?: string | null;
  documentId?: string | null;
  verificationReference?: string | null;
}) {
  const row = await loadOpportunity(input.clientId, input.opportunityId);
  if (!row) return { ok: false as const, error: "Not found", status: 404 };
  const blocked = guard(input.actor, row);
  if (blocked) return blocked;
  if (input.priceType === "professional_valuation" && !canRecordProfessionalValuation(input.actor.role)) {
    return { ok: false as const, error: "Only a manager can record a professional valuation.", status: 403 };
  }
  const evidenceError = valuationEvidenceError({
    priceType: input.priceType,
    documentId: input.documentId,
    verificationReference: input.verificationReference,
  });
  if (evidenceError) return { ok: false as const, error: evidenceError, status: 400 };
  if (!Number.isFinite(input.amount) || input.amount < 0) {
    return { ok: false as const, error: "Enter a valid amount.", status: 400 };
  }
  const supabase = createAdminClient();
  if (input.documentId) {
    const { data: doc } = await supabase.from("documents").select("id").eq("id", input.documentId).eq("client_id", input.clientId).maybeSingle();
    if (!doc) return { ok: false as const, error: "Document was not found in this organisation.", status: 404 };
  }
  const basePrice = {
    client_id: input.clientId,
    opportunity_id: input.opportunityId,
    amount: input.amount,
    currency: input.currency || (row.currency as string) || "USD",
    price_type: input.priceType,
    notes: input.notes ?? null,
    document_id: input.documentId ?? null,
    recorded_by: input.actor.id,
  };
  const reference = input.verificationReference?.trim() || null;
  let inserted = await supabase
    .from("real_estate_price_discussions")
    .insert({
      ...basePrice,
      verification_reference: reference,
      verified_by: input.priceType === "professional_valuation" ? input.actor.id : null,
      verified_at: input.priceType === "professional_valuation" ? new Date().toISOString() : null,
    })
    .select("*")
    .single();
  if (inserted.error && (inserted.error.code === "42703" || /schema cache/i.test(inserted.error.message))) {
    if (reference && !input.documentId) {
      return { ok: false as const, error: "Valuation references need the final corrections migration. Attach the report instead.", status: 503 };
    }
    inserted = await supabase.from("real_estate_price_discussions").insert(basePrice).select("*").single();
  }
  const { data, error } = inserted;
  if (error || !data) return { ok: false as const, error: error?.message ?? "Could not record price.", status: 500 };
  const patch: Record<string, unknown> = {
    expected_price: input.amount,
    currency: input.currency || row.currency,
    updated_at: new Date().toISOString(),
  };
  if (row.stage === "inspection_completed" || row.stage === "owner_interested") patch.stage = "pricing_discussion";
  await supabase.from("real_estate_acquisition_opportunities").update(patch).eq("id", input.opportunityId).eq("client_id", input.clientId);
  await event({
    clientId: input.clientId,
    opportunityId: input.opportunityId,
    eventType: "pricing_recorded",
    actorId: input.actor.id,
    toValue: String(input.amount),
    note: input.priceType,
  });
  return { ok: true as const, price: data };
}

export async function saveInspection(input: {
  clientId: string;
  opportunityId: string;
  actor: AcquisitionActor;
  inspectionId?: string | null;
  patch: Record<string, unknown>;
}) {
  const row = await loadOpportunity(input.clientId, input.opportunityId);
  if (!row) return { ok: false as const, error: "Not found", status: 404 };
  const blocked = guard(input.actor, row);
  if (blocked) return blocked;
  const supabase = createAdminClient();
  const allowed = [
    "status", "scheduled_at", "property_type", "address", "suburb", "city", "location_notes",
    "property_usage", "bedrooms", "bathrooms", "garages", "parking", "land_size", "building_size",
    "floors", "amenities", "utilities", "condition", "documentation", "notes", "unresolved_questions",
  ] as const;
  const body: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const key of allowed) {
    if (input.patch[key] !== undefined) body[key] = input.patch[key];
  }
  if (input.patch.property_category !== undefined) {
    const category = input.patch.property_category === null ? null : asPropertyCategory(input.patch.property_category);
    if (input.patch.property_category !== null && !category) {
      return { ok: false as const, error: "Choose a listed property type.", status: 400 };
    }
    body.property_category = category;
  }
  if (body.status === "completed") body.completed_at = new Date().toISOString();
  let saved: Record<string, unknown> | null = null;
  if (input.inspectionId) {
    const { data, error } = await supabase
      .from("real_estate_inspections")
      .update(body)
      .eq("id", input.inspectionId)
      .eq("client_id", input.clientId)
      .eq("opportunity_id", input.opportunityId)
      .select("*")
      .maybeSingle();
    if (error || !data) return { ok: false as const, error: error?.message ?? "Inspection not found", status: 404 };
    saved = data;
  } else {
    const { data, error } = await supabase
      .from("real_estate_inspections")
      .insert({
        ...body,
        client_id: input.clientId,
        opportunity_id: input.opportunityId,
        contact_id: row.contact_id,
        listing_id: row.converted_listing_id,
        agent_id: input.actor.id,
        status: body.status ?? (body.scheduled_at ? "scheduled" : "draft"),
      })
      .select("*")
      .single();
    if (error || !data) return { ok: false as const, error: error?.message ?? "Could not save inspection", status: 500 };
    saved = data;
  }
  if (!saved) return { ok: false as const, error: "Could not save inspection", status: 500 };
  const status = String(saved.status ?? "");
  if (status === "scheduled" || status === "confirmed" || status === "rescheduled") {
    if (row.stage === "new_opportunity" || row.stage === "owner_contacted" || row.stage === "owner_interested") {
      await supabase.from("real_estate_acquisition_opportunities").update({ stage: "inspection_scheduled", updated_at: new Date().toISOString() }).eq("id", input.opportunityId).eq("client_id", input.clientId);
    }
  }
  if (status === "completed") {
    await supabase.from("real_estate_acquisition_opportunities").update({ stage: "inspection_completed", updated_at: new Date().toISOString() }).eq("id", input.opportunityId).eq("client_id", input.clientId);
  }
  await event({
    clientId: input.clientId,
    opportunityId: input.opportunityId,
    eventType: status === "completed" ? "inspection_completed" : "inspection_saved",
    actorId: input.actor.id,
    toValue: status,
  });
  return { ok: true as const, inspection: saved };
}

export async function attachInspectionPhoto(input: {
  clientId: string;
  inspectionId: string;
  actor: AcquisitionActor;
  documentId?: string | null;
  storageKey?: string | null;
  caption?: string | null;
}) {
  const supabase = createAdminClient();
  const { data: inspection } = await supabase
    .from("real_estate_inspections")
    .select("id, client_id, opportunity_id")
    .eq("id", input.inspectionId)
    .eq("client_id", input.clientId)
    .maybeSingle();
  if (!inspection) return { ok: false as const, error: "Inspection not found", status: 404 };
  const opportunity = await loadOpportunity(input.clientId, inspection.opportunity_id as string);
  if (!opportunity) return { ok: false as const, error: "Not found", status: 404 };
  const blocked = guard(input.actor, opportunity);
  if (blocked) return blocked;
  if (!input.documentId && !input.storageKey) {
    return { ok: false as const, error: "Attach a document from this organisation.", status: 400 };
  }
  if (input.documentId) {
    const { data: doc } = await supabase.from("documents").select("id").eq("id", input.documentId).eq("client_id", input.clientId).maybeSingle();
    if (!doc) return { ok: false as const, error: "Document was not found in this organisation.", status: 404 };
  }
  if (input.storageKey && !input.storageKey.includes(input.clientId)) {
    return { ok: false as const, error: "Storage key is outside this organisation.", status: 403 };
  }
  const { data, error } = await supabase
    .from("real_estate_inspection_photos")
    .insert({
      client_id: input.clientId,
      inspection_id: input.inspectionId,
      document_id: input.documentId ?? null,
      storage_key: input.storageKey ?? null,
      caption: input.caption ?? null,
      created_by: input.actor.id,
    })
    .select("*")
    .single();
  if (error || !data) return { ok: false as const, error: error?.message ?? "Could not attach photo", status: 500 };
  return { ok: true as const, photo: data };
}

export async function saveMandate(input: {
  clientId: string;
  opportunityId: string;
  actor: AcquisitionActor;
  mandateId?: string | null;
  mandateType?: "sole" | "joint" | "open" | null;
  startDate?: string | null;
  expiryDate?: string | null;
  documentId?: string | null;
  evidenceStatus?: string | null;
  submit?: boolean;
}) {
  const row = await loadOpportunity(input.clientId, input.opportunityId);
  if (!row) return { ok: false as const, error: "Not found", status: 404 };
  const blocked = guard(input.actor, row);
  if (blocked) return blocked;
  const supabase = createAdminClient();
  if (input.documentId) {
    const { data: doc } = await supabase.from("documents").select("id").eq("id", input.documentId).eq("client_id", input.clientId).maybeSingle();
    if (!doc) return { ok: false as const, error: "Document was not found in this organisation.", status: 404 };
  }
  const status = input.submit ? "submitted" : input.documentId ? "awaiting_evidence" : "draft";
  const payload = {
    mandate_type: input.mandateType ?? null,
    start_date: input.startDate ?? null,
    expiry_date: input.expiryDate ?? null,
    document_id: input.documentId ?? null,
    evidence_status: input.evidenceStatus ?? (input.documentId ? "provided" : "not_provided"),
    status,
    responsible_agent_id: row.assigned_agent_id,
    updated_at: new Date().toISOString(),
  };
  const saved = input.mandateId
    ? await supabase.from("real_estate_mandates").update(payload).eq("id", input.mandateId).eq("client_id", input.clientId).eq("opportunity_id", input.opportunityId).select("*").maybeSingle()
    : await supabase.from("real_estate_mandates").insert({
        ...payload,
        client_id: input.clientId,
        opportunity_id: input.opportunityId,
        contact_id: row.contact_id,
        listing_id: row.converted_listing_id,
        provenance: "agent",
      }).select("*").single();
  if (saved.error || !saved.data) return { ok: false as const, error: saved.error?.message ?? "Could not save mandate", status: 500 };
  await supabase.from("real_estate_mandate_events").insert({
    client_id: input.clientId,
    mandate_id: saved.data.id,
    event_type: input.submit ? "submitted" : "saved",
    actor_id: input.actor.id,
    to_status: status,
  });
  if (row.stage === "pricing_discussion" || row.stage === "inspection_completed") {
    await supabase.from("real_estate_acquisition_opportunities").update({ stage: "mandate_negotiation", updated_at: new Date().toISOString() }).eq("id", input.opportunityId).eq("client_id", input.clientId);
  }
  await event({
    clientId: input.clientId,
    opportunityId: input.opportunityId,
    eventType: input.submit ? "mandate_submitted" : "mandate_saved",
    actorId: input.actor.id,
    toValue: status,
  });
  return { ok: true as const, mandate: saved.data };
}

export async function reviewMandate(input: {
  clientId: string;
  mandateId: string;
  actor: AcquisitionActor;
  decision: "approved" | "rejected";
  note?: string | null;
}) {
  if (!canReviewMandate({
    role: input.actor.role,
    userId: input.actor.id,
    userClientId: input.actor.clientId,
    resourceClientId: input.clientId,
  })) return denied();
  if (input.decision === "rejected" && !input.note?.trim()) {
    return { ok: false as const, error: "A rejection reason is required.", status: 400 };
  }
  const supabase = createAdminClient();
  const { data: mandate } = await supabase.from("real_estate_mandates").select("*").eq("id", input.mandateId).eq("client_id", input.clientId).maybeSingle();
  if (!mandate) return { ok: false as const, error: "Not found", status: 404 };
  if (mandate.provenance === "legacy_unverified") {
    return { ok: false as const, error: "Legacy listing mandate fields are not an approval. Record a new mandate.", status: 409 };
  }
  if (mandate.status === input.decision) return { ok: true as const, mandate, idempotent: true };
  if (mandate.status !== "submitted" && mandate.status !== "awaiting_evidence" && mandate.status !== "draft") {
    return { ok: false as const, error: "Only a mandate awaiting review can be approved or rejected.", status: 409 };
  }
  const previousId = (mandate.previous_mandate_id as string | null) ?? null;
  let previousRow: Record<string, unknown> | null = null;
  if (input.decision === "approved") {
    if (mandate.listing_id) {
      const { data: others } = await supabase
        .from("real_estate_mandates")
        .select("id")
        .eq("client_id", input.clientId)
        .eq("listing_id", mandate.listing_id as string)
        .eq("status", "approved")
        .neq("id", input.mandateId);
      const conflict = mandateApprovalConflict({
        previousMandateId: previousId,
        otherApprovedIds: (others ?? []).map((row) => row.id as string),
      });
      if (conflict) return { ok: false as const, error: conflict, status: 409 };
    }
    if (previousId) {
      const { data: previous } = await supabase
        .from("real_estate_mandates")
        .select("*")
        .eq("id", previousId)
        .eq("client_id", input.clientId)
        .maybeSingle();
      if (!previous) return { ok: false as const, error: "The mandate being renewed was not found.", status: 404 };
      if (previous.superseded_by_id && previous.superseded_by_id !== input.mandateId) {
        return { ok: false as const, error: "The previous mandate was already replaced by another renewal.", status: 409 };
      }
      previousRow = previous;
      const superseded = await supabase
        .from("real_estate_mandates")
        .update({ status: "superseded", superseded_by_id: input.mandateId, superseded_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq("id", previousId)
        .eq("client_id", input.clientId);
      if (superseded.error) return { ok: false as const, error: superseded.error.message, status: 500 };
    }
  }
  const { data, error } = await supabase
    .from("real_estate_mandates")
    .update({
      status: input.decision,
      review_note: input.note ?? null,
      reviewed_by: input.actor.id,
      reviewed_at: new Date().toISOString(),
      evidence_status: input.decision === "approved" ? "verified" : mandate.evidence_status,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.mandateId)
    .eq("client_id", input.clientId)
    .select("*")
    .maybeSingle();
  if (error || !data) {
    if (previousRow) {
      await supabase
        .from("real_estate_mandates")
        .update({ status: previousRow.status, superseded_by_id: null, superseded_at: null })
        .eq("id", previousId as string)
        .eq("client_id", input.clientId);
    }
    return { ok: false as const, error: error?.message ?? "Review failed", status: error?.code === "23505" ? 409 : 500 };
  }
  if (previousRow) {
    await supabase.from("real_estate_mandate_events").insert({
      client_id: input.clientId,
      mandate_id: previousId,
      event_type: "superseded",
      actor_id: input.actor.id,
      from_status: previousRow.status as string,
      to_status: "superseded",
      note: `Replaced by renewal ${input.mandateId}`,
    });
  }
  await supabase.from("real_estate_mandate_events").insert({
    client_id: input.clientId,
    mandate_id: input.mandateId,
    event_type: input.decision,
    actor_id: input.actor.id,
    from_status: mandate.status,
    to_status: input.decision,
    note: input.note ?? null,
  });
  if (input.decision === "approved" && mandate.opportunity_id) {
    await supabase.from("real_estate_acquisition_opportunities").update({ stage: "mandate_secured", updated_at: new Date().toISOString() }).eq("id", mandate.opportunity_id).eq("client_id", input.clientId);
    await event({
      clientId: input.clientId,
      opportunityId: mandate.opportunity_id as string,
      eventType: "mandate_approved",
      actorId: input.actor.id,
    });
  }
  return { ok: true as const, mandate: data };
}

async function mandateWriteGuard(clientId: string, actor: AcquisitionActor, mandate: Record<string, unknown>): Promise<Fail | null> {
  if (mandate.opportunity_id) {
    const row = await loadOpportunity(clientId, mandate.opportunity_id as string);
    if (!row) return { ok: false, error: "Not found", status: 404 };
    return guard(actor, row);
  }
  if (canReviewMandate({ role: actor.role, userId: actor.id, userClientId: actor.clientId, resourceClientId: clientId })) return null;
  if (mandate.responsible_agent_id === actor.id) return null;
  if (mandate.listing_id) {
    const supabase = createAdminClient();
    const { data: listing } = await supabase
      .from("listings")
      .select("agent_id")
      .eq("id", mandate.listing_id as string)
      .eq("client_id", clientId)
      .maybeSingle();
    if (listing?.agent_id === actor.id) return null;
  }
  return denied();
}

function isMissingColumn(error: { code?: string; message?: string } | null): boolean {
  return Boolean(error && (error.code === "42703" || /schema cache|does not exist/i.test(error.message ?? "")));
}

/** Creates a renewal linked to the previous mandate. It needs its own evidence and review. */
export async function renewMandate(input: {
  clientId: string;
  actor: AcquisitionActor;
  mandateId: string;
  startDate: string;
  expiryDate: string;
  mandateType?: "sole" | "joint" | "open" | null;
  terms?: string | null;
  documentId?: string | null;
  responsibleAgentId?: string | null;
  submit?: boolean;
}) {
  const supabase = createAdminClient();
  const { data: previous } = await supabase
    .from("real_estate_mandates")
    .select("*")
    .eq("id", input.mandateId)
    .eq("client_id", input.clientId)
    .maybeSingle();
  if (!previous) return { ok: false as const, error: "Not found", status: 404 };
  const blocked = await mandateWriteGuard(input.clientId, input.actor, previous);
  if (blocked) return blocked;
  const { data: openRenewal } = await supabase
    .from("real_estate_mandates")
    .select("id, status")
    .eq("client_id", input.clientId)
    .eq("previous_mandate_id", input.mandateId)
    .in("status", ["draft", "awaiting_evidence", "submitted"])
    .limit(1);
  if ((openRenewal ?? []).length) {
    return { ok: false as const, error: "A renewal for this mandate is already in progress.", status: 409 };
  }
  const invalid = mandateRenewalError({
    previousStatus: String(previous.status),
    previousSupersededById: (previous.superseded_by_id as string | null) ?? null,
    previousRevocationEffectiveDate: (previous.revocation_effective_date as string | null) ?? null,
    startDate: input.startDate,
    expiryDate: input.expiryDate,
    hasEvidence: Boolean(input.documentId),
    submit: Boolean(input.submit),
  });
  if (invalid) return { ok: false as const, error: invalid, status: 400 };
  if (input.documentId) {
    const { data: doc } = await supabase.from("documents").select("id").eq("id", input.documentId).eq("client_id", input.clientId).maybeSingle();
    if (!doc) return { ok: false as const, error: "Document was not found in this organisation.", status: 404 };
  }
  const responsible = input.responsibleAgentId ?? (previous.responsible_agent_id as string | null) ?? input.actor.id;
  if (responsible !== input.actor.id) {
    const { data: agent } = await supabase.from("users").select("id").eq("id", responsible).eq("client_id", input.clientId).eq("is_active", true).maybeSingle();
    if (!agent) return { ok: false as const, error: "Choose an active agent in this organisation.", status: 400 };
  }
  const status = input.submit ? "submitted" : input.documentId ? "awaiting_evidence" : "draft";
  const { data, error } = await supabase
    .from("real_estate_mandates")
    .insert({
      client_id: input.clientId,
      opportunity_id: previous.opportunity_id ?? null,
      listing_id: previous.listing_id ?? null,
      contact_id: previous.contact_id ?? null,
      mandate_type: input.mandateType ?? previous.mandate_type ?? null,
      start_date: input.startDate,
      expiry_date: input.expiryDate,
      document_id: input.documentId ?? null,
      evidence_status: input.documentId ? "provided" : "not_provided",
      status,
      responsible_agent_id: responsible,
      provenance: "agent",
      previous_mandate_id: input.mandateId,
      terms: input.terms ?? null,
      renewal_requested_by: input.actor.id,
    })
    .select("*")
    .single();
  if (error || !data) {
    if (isMissingColumn(error)) return { ok: false as const, error: "Mandate renewal needs the final corrections migration.", status: 503 };
    return { ok: false as const, error: error?.message ?? "Could not save the renewal.", status: 500 };
  }
  await supabase.from("real_estate_mandate_events").insert([
    { client_id: input.clientId, mandate_id: data.id, event_type: "renewal_created", actor_id: input.actor.id, to_status: status, note: `Renews ${input.mandateId}` },
    { client_id: input.clientId, mandate_id: input.mandateId, event_type: "renewal_requested", actor_id: input.actor.id, note: `Renewal ${data.id as string}` },
  ]);
  if (previous.opportunity_id) {
    await event({
      clientId: input.clientId,
      opportunityId: previous.opportunity_id as string,
      eventType: "mandate_renewal_created",
      actorId: input.actor.id,
      toValue: status,
    });
  }
  return { ok: true as const, mandate: data };
}

/** Records a revocation. When it takes effect, the listing leaves the market unless another valid mandate covers it. */
export async function revokeMandate(input: {
  clientId: string;
  actor: AcquisitionActor;
  mandateId: string;
  reason: string;
  effectiveDate: string;
  reference?: string | null;
}) {
  if (!canReviewMandate({
    role: input.actor.role,
    userId: input.actor.id,
    userClientId: input.actor.clientId,
    resourceClientId: input.clientId,
  })) return denied();
  const supabase = createAdminClient();
  const { data: mandate } = await supabase
    .from("real_estate_mandates")
    .select("*")
    .eq("id", input.mandateId)
    .eq("client_id", input.clientId)
    .maybeSingle();
  if (!mandate) return { ok: false as const, error: "Not found", status: 404 };
  const invalid = mandateRevocationError({
    status: String(mandate.status),
    alreadyRevoked: mandate.status === "revoked" || Boolean(mandate.revoked_at),
    reason: input.reason,
    effectiveDate: input.effectiveDate,
    startDate: (mandate.start_date as string | null) ?? null,
  });
  if (invalid) return { ok: false as const, error: invalid, status: mandate.revoked_at ? 409 : 400 };
  const today = new Date().toISOString().slice(0, 10);
  const effectiveNow = input.effectiveDate <= today;
  const nowIso = new Date().toISOString();
  const status = effectiveNow || mandate.status === "submitted" ? "revoked" : "approved";
  const { data, error } = await supabase
    .from("real_estate_mandates")
    .update({
      status,
      revocation_reason: input.reason.trim(),
      revoked_at: nowIso,
      revocation_effective_date: input.effectiveDate,
      revoked_by: input.actor.id,
      revocation_reference: input.reference?.trim() || null,
      updated_at: nowIso,
    })
    .eq("id", input.mandateId)
    .eq("client_id", input.clientId)
    .eq("status", mandate.status as string)
    .select("*")
    .maybeSingle();
  if (error) {
    if (isMissingColumn(error)) return { ok: false as const, error: "Mandate revocation needs the final corrections migration.", status: 503 };
    return { ok: false as const, error: error.message, status: 500 };
  }
  if (!data) return { ok: false as const, error: "This mandate changed while you were working. Refresh and try again.", status: 409 };
  await supabase.from("real_estate_mandate_events").insert({
    client_id: input.clientId,
    mandate_id: input.mandateId,
    event_type: "revoked",
    actor_id: input.actor.id,
    from_status: mandate.status as string,
    to_status: status,
    note: `${input.reason.trim()} (effective ${input.effectiveDate}${input.reference ? `, ref ${input.reference}` : ""})`,
  });
  const listingEffect = effectiveNow ? await reevaluateListingAfterMandateChange(input.clientId, (mandate.listing_id as string | null) ?? null, input.actor) : null;
  return { ok: true as const, mandate: data, effectiveNow, listingEffect };
}

/**
 * A listing stays live only while a valid approved mandate covers it. Listings that
 * never had a mandate record are left alone; this only reacts to a mandate ending.
 */
async function reevaluateListingAfterMandateChange(clientId: string, listingId: string | null, actor: AcquisitionActor) {
  if (!listingId) return null;
  const supabase = createAdminClient();
  const { data: mandates } = await supabase
    .from("real_estate_mandates")
    .select("status, expiry_date, revocation_effective_date")
    .eq("client_id", clientId)
    .eq("listing_id", listingId);
  const stillCovered = (mandates ?? []).some((row) =>
    isMandateCurrentlyValid({
      status: String(row.status),
      expiryDate: (row.expiry_date as string | null) ?? null,
      revocationEffectiveDate: (row.revocation_effective_date as string | null) ?? null,
    })
  );
  if (stillCovered) return { listingId, action: "unchanged" as const };
  const { data: listing } = await supabase
    .from("listings")
    .select("id, approval_status, status")
    .eq("id", listingId)
    .eq("client_id", clientId)
    .maybeSingle();
  if (!listing || listing.approval_status !== "approved") return { listingId, action: "unchanged" as const };
  if (["sold", "let", "rented", "under_management"].includes(String(listing.status))) return { listingId, action: "unchanged" as const };
  await supabase
    .from("listings")
    .update({ approval_status: "pending_approval", updated_at: new Date().toISOString() })
    .eq("id", listingId)
    .eq("client_id", clientId)
    .eq("approval_status", "approved");
  const { invalidateListingMatchNotifications } = await import("@/lib/real-estate/buyer-sales-service");
  await invalidateListingMatchNotifications(clientId, listingId, "mandate_revoked");
  console.info("[mandates] listing returned to approval after mandate revocation", { clientId, listingId, actorId: actor.id });
  return { listingId, action: "returned_to_approval" as const };
}

/** Version chain for one mandate: older and newer linked versions, oldest first. */
export async function mandateHistory(clientId: string, actor: AcquisitionActor, mandateId: string) {
  const supabase = createAdminClient();
  const { data: start } = await supabase.from("real_estate_mandates").select("*").eq("id", mandateId).eq("client_id", clientId).maybeSingle();
  if (!start) return { ok: false as const, error: "Not found", status: 404 };
  const blocked = await mandateWriteGuard(clientId, actor, start);
  if (blocked) return blocked;
  const chain: Array<Record<string, unknown>> = [start];
  const seen = new Set([mandateId]);
  let cursor = start.previous_mandate_id as string | null | undefined;
  while (cursor && !seen.has(cursor) && chain.length < 50) {
    seen.add(cursor);
    const { data } = await supabase.from("real_estate_mandates").select("*").eq("id", cursor).eq("client_id", clientId).maybeSingle();
    if (!data) break;
    chain.unshift(data);
    cursor = data.previous_mandate_id as string | null | undefined;
  }
  cursor = start.superseded_by_id as string | null | undefined;
  while (cursor && !seen.has(cursor) && chain.length < 50) {
    seen.add(cursor);
    const { data } = await supabase.from("real_estate_mandates").select("*").eq("id", cursor).eq("client_id", clientId).maybeSingle();
    if (!data) break;
    chain.push(data);
    cursor = data.superseded_by_id as string | null | undefined;
  }
  const { data: events } = await supabase
    .from("real_estate_mandate_events")
    .select("*")
    .eq("client_id", clientId)
    .in("mandate_id", [...seen])
    .order("created_at", { ascending: true });
  return { ok: true as const, versions: chain, events: events ?? [] };
}

export async function prepareListingFromAcquisition(input: {
  clientId: string;
  opportunityId: string;
  actor: AcquisitionActor;
  managerOverride?: boolean;
}) {
  const row = await loadOpportunity(input.clientId, input.opportunityId);
  if (!row) return { ok: false as const, error: "Not found", status: 404 };
  const blocked = guard(input.actor, row);
  if (blocked) return blocked;
  const evidence = await evidenceFor(input.clientId, input.opportunityId, (row.converted_listing_id as string | null) ?? null);
  const managerOverride = Boolean(input.managerOverride) && canReviewMandate({
    role: input.actor.role,
    userId: input.actor.id,
    userClientId: input.actor.clientId,
    resourceClientId: input.clientId,
  });
  const decision = conversionDecision({
    existingListingId: (row.converted_listing_id as string | null) ?? null,
    hasValidMandate: evidence.hasValidMandate,
    managerOverride,
  });
  if (!decision.ok) return { ok: false as const, error: decision.error, status: 409 };
  if (decision.alreadyConverted) {
    return { ok: true as const, listingId: row.converted_listing_id as string, alreadyConverted: true };
  }
  const supabase = createAdminClient();
  const latestPrice = await supabase
    .from("real_estate_price_discussions")
    .select("amount, price_type")
    .eq("client_id", input.clientId)
    .eq("opportunity_id", input.opportunityId)
    .order("recorded_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const agreed = latestPrice.data?.price_type === "agreed_marketing" ? latestPrice.data.amount : row.expected_price;
  // select("*") so conversion keeps working before property_category exists.
  const inspection = await supabase
    .from("real_estate_inspections")
    .select("*")
    .eq("client_id", input.clientId)
    .eq("opportunity_id", input.opportunityId)
    .eq("status", "completed")
    .order("completed_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const category =
    asPropertyCategory((inspection.data as Record<string, unknown> | null)?.property_category) ??
    asPropertyCategory(row.property_category) ??
    asPropertyCategory(inspection.data?.property_type) ??
    asPropertyCategory(row.property_type);
  const now = new Date().toISOString();
  const { data: listing, error } = await supabase
    .from("listings")
    .insert({
      client_id: input.clientId,
      agent_id: row.assigned_agent_id,
      acquisition_opportunity_id: input.opportunityId,
      transaction_type: row.property_intent === "rent" ? "rental" : "sale",
      status: "reserved",
      approval_status: "draft",
      price: agreed ?? null,
      bedrooms: inspection.data?.bedrooms ?? null,
      bathrooms: inspection.data?.bathrooms ?? null,
      address: (inspection.data?.address as string | null) ?? (row.address as string | null),
      suburb: (inspection.data?.suburb as string | null) ?? (row.suburb as string | null),
      description: (row.property_description as string | null) ?? (inspection.data?.notes as string | null),
      ...(category ? { property_category: category } : {}),
      photos: [],
      created_at: now,
      updated_at: now,
    })
    .select("id")
    .single();
  if (error || !listing) return { ok: false as const, error: error?.message ?? "Could not create listing draft", status: 500 };
  const listingId = listing.id as string;
  const { data: claimed } = await supabase
    .from("real_estate_acquisition_opportunities")
    .update({
      converted_listing_id: listingId,
      stage: "listing_preparation",
      updated_at: now,
    })
    .eq("id", input.opportunityId)
    .eq("client_id", input.clientId)
    .is("converted_listing_id", null)
    .select("id");
  if (!claimed?.length) {
    // A concurrent retry converted first. Remove this draft and return the winner.
    await supabase.from("listings").delete().eq("id", listingId).eq("client_id", input.clientId).eq("approval_status", "draft");
    const { data: winner } = await supabase
      .from("real_estate_acquisition_opportunities")
      .select("converted_listing_id")
      .eq("id", input.opportunityId)
      .eq("client_id", input.clientId)
      .maybeSingle();
    return { ok: true as const, listingId: (winner?.converted_listing_id as string) ?? listingId, alreadyConverted: true };
  }
  if (row.contact_id) {
    await supabase.from("real_estate_listing_parties").upsert({
      client_id: input.clientId,
      listing_id: listingId,
      contact_id: row.contact_id,
      party_role: "owner",
      verification_status: "reported",
      source: "acquisition",
    }, { onConflict: "listing_id,contact_id,party_role" });
  }
  await event({
    clientId: input.clientId,
    opportunityId: input.opportunityId,
    eventType: "listing_draft_created",
    actorId: input.actor.id,
    toValue: listingId,
    note: managerOverride && !evidence.hasValidMandate ? "Manager exception without a verified mandate" : null,
  });
  return { ok: true as const, listingId, alreadyConverted: false };
}

export async function markAcquisitionConvertedFromListing(input: {
  clientId: string;
  listingId: string;
  actorId: string;
  approved: boolean;
}) {
  const supabase = createAdminClient();
  const { data: listing } = await supabase
    .from("listings")
    .select("id, acquisition_opportunity_id, status")
    .eq("id", input.listingId)
    .eq("client_id", input.clientId)
    .maybeSingle();
  const opportunityId = listing?.acquisition_opportunity_id as string | null;
  if (!opportunityId) return;
  if (input.approved && listing?.status === "reserved") {
    await supabase.from("listings").update({ status: "available", updated_at: new Date().toISOString() }).eq("id", input.listingId).eq("client_id", input.clientId).eq("status", "reserved");
  }
  if (!input.approved) {
    await supabase.from("real_estate_acquisition_opportunities").update({ stage: "listing_preparation", updated_at: new Date().toISOString() }).eq("id", opportunityId).eq("client_id", input.clientId);
    return;
  }
  await supabase
    .from("real_estate_acquisition_opportunities")
    .update({ status: "converted", converted_at: new Date().toISOString(), stage: "submitted_for_approval", updated_at: new Date().toISOString() })
    .eq("id", opportunityId)
    .eq("client_id", input.clientId);
  await event({
    clientId: input.clientId,
    opportunityId,
    eventType: "listing_approved",
    actorId: input.actorId,
    toValue: input.listingId,
  });
}

export async function acquisitionOverview(clientId: string, actor: AcquisitionActor) {
  const listed = await listAcquisitionOpportunities({ clientId, actor });
  if (!listed.ok) return listed;
  const rows = listed.opportunities;
  const now = new Date();
  const active = rows.filter((row) => row.status === "active" || row.status === "nurturing");
  return {
    ok: true as const,
    incomplete: listed.incomplete,
    summary: {
      active: active.length,
      inProgress: rows.filter((row) => row.status === "active").length,
      overdue: rows.filter((row) => row.next_action_at && new Date(row.next_action_at as string) < now && row.status !== "lost" && row.status !== "converted").length,
      lost: rows.filter((row) => row.status === "lost").length,
      converted: rows.filter((row) => row.status === "converted").length,
    },
    attention: rows
      .filter((row) => row.status === "active" && (!row.next_action_at || new Date(row.next_action_at as string) < now))
      .slice(0, 20)
      .map((row) => ({
        id: row.id,
        label: (row.suburb as string | null) || (row.owner_name as string | null) || (row.reference_number as string),
        reason: row.next_action_at ? "Overdue follow-up" : "No next step",
      })),
  };
}

export async function listOwnerPortfolio(clientId: string, actor: AcquisitionActor, contactId?: string | null) {
  const listed = await listAcquisitionOpportunities({ clientId, actor });
  if (!listed.ok) return listed;
  const scoped = contactId ? listed.opportunities.filter((row) => row.contact_id === contactId) : listed.opportunities;
  const byContact = new Map<string, { contactId: string; name: string | null; properties: number; active: number }>();
  for (const row of scoped) {
    const id = (row.contact_id as string | null) ?? `unlinked:${row.id}`;
    const current = byContact.get(id) ?? { contactId: id, name: (row.owner_name as string | null) ?? null, properties: 0, active: 0 };
    current.properties += 1;
    if (row.status === "active" || row.status === "nurturing") current.active += 1;
    byContact.set(id, current);
  }
  return { ok: true as const, owners: [...byContact.values()], opportunities: scoped };
}
