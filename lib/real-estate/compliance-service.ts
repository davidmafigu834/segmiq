import { createAdminClient } from "@/lib/supabase/admin";
import { listingLabel } from "@/lib/real-estate/helpers";
import { isRealEstate } from "@/lib/terminology";
import {
  generateComplianceDocKey,
  generatePresignedDownloadUrl,
  isR2Configured,
  putObject,
} from "@/lib/storage/r2";
import {
  agentNextDocumentAction,
  canCollectCompliance,
  canReviewCompliance,
  canSeeInternalComplianceNotes,
  canTransitionCompliance,
  canViewComplianceCase,
  checklistCompleteness,
  complianceStatusLabel,
  DEFAULT_COMPLIANCE_SETTINGS,
  deriveComplianceAttention,
  documentTypeLabel,
  evaluateComplianceGate,
  parseComplianceSettings,
  requiredDocsForEntity,
  riskChangeRequiresReason,
  type CddProfile,
  type ComplianceActor,
  type ComplianceEntityType,
  type ComplianceEventType,
  type ComplianceRiskLevel,
  type ComplianceSettings,
  type ComplianceStatus,
  type ComplianceGateResult,
} from "@/lib/real-estate/compliance";

type Actor = {
  id: string;
  name: string;
  role: string;
  clientId: string | null;
  canReviewCompliance: boolean;
};

export type ComplianceListTab =
  | "attention"
  | "under_review"
  | "edd"
  | "approved"
  | "restricted"
  | "all";

function toActor(a: Actor): ComplianceActor {
  return {
    role: a.role,
    userId: a.id,
    userClientId: a.clientId,
    canReviewCompliance: a.canReviewCompliance,
  };
}

export async function loadComplianceActor(session: {
  userId: string;
  role: string;
  clientId?: string | null;
  user?: { name?: string | null };
}): Promise<Actor> {
  const supabase = createAdminClient();
  const { data: user } = await supabase
    .from("users")
    .select("name, can_review_compliance")
    .eq("id", session.userId)
    .maybeSingle();
  return {
    id: session.userId,
    name: user?.name || session.user?.name || "User",
    role: session.role,
    clientId: session.clientId ?? null,
    canReviewCompliance: Boolean(user?.can_review_compliance),
  };
}

export async function loadComplianceSettings(clientId: string): Promise<ComplianceSettings> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("clients")
    .select("compliance_settings")
    .eq("id", clientId)
    .maybeSingle();
  return parseComplianceSettings(data?.compliance_settings);
}

async function appendEvent(opts: {
  clientId: string;
  caseId: string;
  type: ComplianceEventType;
  summary: string;
  createdBy: string | null;
  before?: string | null;
  after?: string | null;
}) {
  const supabase = createAdminClient();
  await supabase.from("compliance_case_events").insert({
    client_id: opts.clientId,
    compliance_case_id: opts.caseId,
    event_type: opts.type,
    summary: opts.summary,
    before_value: opts.before ?? null,
    after_value: opts.after ?? null,
    created_by: opts.createdBy,
  });
}

async function notifyUsers(opts: {
  userIds: string[];
  message: string;
  leadId?: string | null;
}) {
  const ids = [...new Set(opts.userIds.filter(Boolean))];
  if (ids.length === 0) return;
  const supabase = createAdminClient();
  await supabase.from("notifications").insert(
    ids.map((user_id) => ({
      user_id,
      type: "COMPLIANCE_ALERT",
      message: opts.message,
      read: false,
      lead_id: opts.leadId ?? null,
    }))
  );
}

async function seedChecklist(caseId: string, clientId: string, entity: ComplianceEntityType, settings: ComplianceSettings) {
  const supabase = createAdminClient();
  const types = requiredDocsForEntity(entity, settings);
  const { data: existing } = await supabase
    .from("compliance_document_requirements")
    .select("document_type")
    .eq("compliance_case_id", caseId)
    .eq("client_id", clientId);
  const have = new Set((existing ?? []).map((r) => r.document_type as string));
  const rows = types
    .filter((t) => !have.has(t))
    .map((document_type) => ({
      client_id: clientId,
      compliance_case_id: caseId,
      document_type,
      required: true,
      status: "missing",
    }));
  if (rows.length) await supabase.from("compliance_document_requirements").insert(rows);
}

export async function startOrGetComplianceCase(opts: {
  clientId: string;
  actor: Actor;
  contactId: string;
  leadId?: string | null;
  offerId?: string | null;
  listingId?: string | null;
  entityType?: ComplianceEntityType;
}): Promise<{ ok: true; case: Record<string, unknown>; created: boolean } | { ok: false; error: string; status: number }> {
  const settings = await loadComplianceSettings(opts.clientId);
  const supabase = createAdminClient();

  const { data: contact } = await supabase
    .from("contacts")
    .select("id, client_id, name")
    .eq("id", opts.contactId)
    .eq("client_id", opts.clientId)
    .maybeSingle();
  if (!contact) return { ok: false, error: "Contact not found.", status: 404 };

  let buyerAgentId: string | null = null;
  let listingId = opts.listingId ?? null;
  let leadId = opts.leadId ?? null;

  if (opts.offerId) {
    const { data: offer } = await supabase
      .from("real_estate_offers")
      .select("id, client_id, listing_id, lead_id, contact_id, buyer_agent_id")
      .eq("id", opts.offerId)
      .eq("client_id", opts.clientId)
      .maybeSingle();
    if (!offer) return { ok: false, error: "Offer not found.", status: 404 };
    if (offer.contact_id !== opts.contactId) {
      return { ok: false, error: "Contact does not match this offer.", status: 400 };
    }
    buyerAgentId = (offer.buyer_agent_id as string | null) ?? null;
    listingId = listingId ?? ((offer.listing_id as string | null) ?? null);
    leadId = leadId ?? ((offer.lead_id as string | null) ?? null);

    const { data: existing } = await supabase
      .from("compliance_cases")
      .select("*")
      .eq("client_id", opts.clientId)
      .eq("offer_id", opts.offerId)
      .maybeSingle();
    if (existing) return { ok: true, case: existing, created: false };
  }

  if (leadId) {
    const existingLeadQuery = supabase
      .from("compliance_cases")
      .select("*")
      .eq("client_id", opts.clientId)
      .eq("lead_id", leadId)
      .order("updated_at", { ascending: false })
      .limit(1);
    const { data: leadCases } = opts.offerId
      ? await existingLeadQuery.is("offer_id", null)
      : await existingLeadQuery;
    const existingLead = leadCases?.[0];
    if (existingLead) {
      if (opts.offerId && !existingLead.offer_id) {
        const { data: linked } = await supabase
          .from("compliance_cases")
          .update({
            offer_id: opts.offerId,
            listing_id: listingId ?? existingLead.listing_id,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existingLead.id)
          .eq("client_id", opts.clientId)
          .select("*")
          .maybeSingle();
        return { ok: true, case: linked ?? existingLead, created: false };
      }
      if (!opts.offerId) return { ok: true, case: existingLead, created: false };
    }
  }

  if (opts.listingId) {
    const { data: listing } = await supabase
      .from("listings")
      .select("id, client_id")
      .eq("id", opts.listingId)
      .eq("client_id", opts.clientId)
      .maybeSingle();
    if (!listing) return { ok: false, error: "Listing not found.", status: 404 };
  }

  if (leadId) {
    const { data: lead } = await supabase
      .from("leads")
      .select("id, client_id, assigned_to_id, contact_id")
      .eq("id", leadId)
      .eq("client_id", opts.clientId)
      .maybeSingle();
    if (!lead) return { ok: false, error: "Inquiry not found.", status: 404 };
    buyerAgentId = buyerAgentId ?? ((lead.assigned_to_id as string | null) ?? null);
  }

  if (
    !canCollectCompliance(toActor(opts.actor), settings, {
      caseClientId: opts.clientId,
      buyerAgentId,
    })
  ) {
    return { ok: false, error: "Forbidden.", status: 403 };
  }

  const entity = opts.entityType ?? "individual";
  const { data: created, error } = await supabase
    .from("compliance_cases")
    .insert({
      client_id: opts.clientId,
      contact_id: opts.contactId,
      lead_id: leadId,
      offer_id: opts.offerId ?? null,
      listing_id: listingId,
      entity_type: entity,
      status: "in_progress",
      created_by: opts.actor.id,
      buyer_agent_id: buyerAgentId ?? (opts.actor.role === "SALESPERSON" ? opts.actor.id : null),
      cdd_profile: entity === "individual" ? { legal_name: contact.name } : { registered_name: contact.name },
    })
    .select("*")
    .maybeSingle();

  if (error || !created) {
    if (opts.offerId) {
      const { data: raced } = await supabase
        .from("compliance_cases")
        .select("*")
        .eq("client_id", opts.clientId)
        .eq("offer_id", opts.offerId)
        .maybeSingle();
      if (raced) return { ok: true, case: raced, created: false };
    }
    return { ok: false, error: error?.message ?? "Could not create case.", status: 500 };
  }

  await seedChecklist(created.id as string, opts.clientId, entity, settings);
  await appendEvent({
    clientId: opts.clientId,
    caseId: created.id as string,
    type: "CASE_CREATED",
    summary: "Compliance case created",
    createdBy: opts.actor.id,
  });
  return { ok: true, case: created, created: true };
}

function tabStatuses(tab: ComplianceListTab): ComplianceStatus[] | null {
  if (tab === "attention") {
    return ["ready_for_review", "awaiting_documents", "more_information_required", "edd_required", "in_progress"];
  }
  if (tab === "under_review") return ["ready_for_review", "under_review"];
  if (tab === "edd") return ["edd_required"];
  if (tab === "approved") return ["approved"];
  if (tab === "restricted") return ["restricted", "rejected"];
  return null;
}

export async function listComplianceCases(opts: {
  clientId: string;
  actor: Actor;
  tab?: ComplianceListTab;
  q?: string | null;
  agentId?: string | null;
  reviewerId?: string | null;
  risk?: string | null;
  entityType?: string | null;
  status?: string | null;
  offerId?: string | null;
  leadId?: string | null;
  scopeOwn?: boolean;
}) {
  const supabase = createAdminClient();
  const settings = await loadComplianceSettings(opts.clientId);
  let q = supabase.from("compliance_cases").select("*").eq("client_id", opts.clientId);
  if (opts.scopeOwn || opts.actor.role === "SALESPERSON") q = q.eq("buyer_agent_id", opts.actor.id);
  const statuses = opts.status
    ? [opts.status]
    : tabStatuses(opts.tab ?? "attention");
  if (statuses) q = q.in("status", statuses);
  if (opts.agentId) q = q.eq("buyer_agent_id", opts.agentId);
  if (opts.offerId) q = q.eq("offer_id", opts.offerId);
  if (opts.leadId) q = q.eq("lead_id", opts.leadId);
  if (opts.reviewerId) q = q.eq("assigned_compliance_user_id", opts.reviewerId);
  if (opts.risk) q = q.eq("risk_level", opts.risk);
  if (opts.entityType) q = q.eq("entity_type", opts.entityType);

  const { data: rows } = await q.order("updated_at", { ascending: false }).limit(300);
  const all = rows ?? [];

  const contactIds = [...new Set(all.map((r) => r.contact_id as string))];
  const listingIds = [...new Set(all.map((r) => r.listing_id as string | null).filter(Boolean))] as string[];
  const userIds = [
    ...new Set(
      all.flatMap((r) => [r.buyer_agent_id, r.assigned_compliance_user_id, r.approved_by]).filter(Boolean)
    ),
  ] as string[];
  const caseIds = all.map((r) => r.id as string);

  const [{ data: contacts }, { data: listings }, { data: users }, { data: docs }] = await Promise.all([
    contactIds.length
      ? supabase.from("contacts").select("id, name").eq("client_id", opts.clientId).in("id", contactIds)
      : Promise.resolve({ data: [] as Array<Record<string, unknown>> }),
    listingIds.length
      ? supabase
          .from("listings")
          .select("id, address, suburb")
          .eq("client_id", opts.clientId)
          .in("id", listingIds)
      : Promise.resolve({ data: [] as Array<Record<string, unknown>> }),
    userIds.length
      ? supabase.from("users").select("id, name").in("id", userIds)
      : Promise.resolve({ data: [] as Array<Record<string, unknown>> }),
    caseIds.length
      ? supabase
          .from("compliance_document_requirements")
          .select("compliance_case_id, document_type, required, status")
          .eq("client_id", opts.clientId)
          .in("compliance_case_id", caseIds)
      : Promise.resolve({ data: [] as Array<Record<string, unknown>> }),
  ]);

  const contactById = new Map((contacts ?? []).map((c) => [c.id as string, c]));
  const listingById = new Map((listings ?? []).map((l) => [l.id as string, l]));
  const userById = new Map((users ?? []).map((u) => [u.id as string, u.name as string | null]));
  const docsByCase = new Map<string, Array<{ document_type: string; required: boolean; status: string }>>();
  for (const d of docs ?? []) {
    const id = d.compliance_case_id as string;
    const list = docsByCase.get(id) ?? [];
    list.push({
      document_type: d.document_type as string,
      required: Boolean(d.required),
      status: d.status as string,
    });
    docsByCase.set(id, list);
  }

  const qstr = (opts.q ?? "").trim().toLowerCase();
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const mapped = all.map((row) => {
    const listing = row.listing_id ? listingById.get(row.listing_id as string) : null;
    const docsFor = docsByCase.get(row.id as string) ?? [];
    const required = docsFor.filter((d) => d.required);
    const received = required.filter((d) => ["received", "under_review", "accepted"].includes(d.status));
    return {
      id: row.id as string,
      contactId: row.contact_id as string,
      contactName: (contactById.get(row.contact_id as string)?.name as string | null) ?? "Client",
      entityType: row.entity_type as string,
      propertyLabel: listing ? listingLabel(listing) : null,
      listingId: (row.listing_id as string | null) ?? null,
      offerId: (row.offer_id as string | null) ?? null,
      leadId: (row.lead_id as string | null) ?? null,
      agentId: (row.buyer_agent_id as string | null) ?? null,
      agentName: row.buyer_agent_id ? userById.get(row.buyer_agent_id as string) ?? null : null,
      reviewerName: row.assigned_compliance_user_id
        ? userById.get(row.assigned_compliance_user_id as string) ?? null
        : null,
      docsReceived: received.length,
      docsRequired: required.length,
      riskLevel: row.risk_level as string,
      status: row.status as ComplianceStatus,
      statusLabel: complianceStatusLabel(row.status as string),
      submittedAt: (row.submitted_for_review_at as string | null) ?? null,
      updatedAt: row.updated_at as string,
      approvedAt: (row.approved_at as string | null) ?? null,
    };
  });

  const filtered = qstr
    ? mapped.filter(
        (r) =>
          r.contactName.toLowerCase().includes(qstr) ||
          (r.propertyLabel ?? "").toLowerCase().includes(qstr) ||
          (r.agentName ?? "").toLowerCase().includes(qstr)
      )
    : mapped;

  const summarySource = mapped;
  return {
    cases: filtered,
    settings,
    summary: {
      needsReview: summarySource.filter((r) => r.status === "ready_for_review" || r.status === "under_review").length,
      awaitingDocuments: summarySource.filter((r) =>
        ["awaiting_documents", "in_progress", "not_started", "more_information_required"].includes(r.status)
      ).length,
      enhancedReview: summarySource.filter((r) => r.status === "edd_required").length,
      restricted: summarySource.filter((r) => r.status === "restricted").length,
      approvedThisMonth: all.filter((r) => {
        const at = r.approved_at as string | null;
        return at && new Date(at) >= monthStart && r.status === "approved";
      }).length,
    },
    canReview: canReviewCompliance(toActor(opts.actor), settings),
  };
}

export async function getComplianceCaseDetail(opts: {
  clientId: string;
  caseId: string;
  actor: Actor;
}) {
  const supabase = createAdminClient();
  const settings = await loadComplianceSettings(opts.clientId);
  const { data: row } = await supabase
    .from("compliance_cases")
    .select("*")
    .eq("id", opts.caseId)
    .eq("client_id", opts.clientId)
    .maybeSingle();
  if (!row) return { ok: false as const, error: "Case not found.", status: 404 };

  const actor = toActor(opts.actor);
  if (
    !canViewComplianceCase(actor, {
      caseClientId: opts.clientId,
      buyerAgentId: (row.buyer_agent_id as string | null) ?? null,
    })
  ) {
    return { ok: false as const, error: "Forbidden.", status: 403 };
  }

  const seeInternal = canSeeInternalComplianceNotes(actor, settings);

  const [{ data: contact }, { data: listing }, { data: offer }, { data: docs }, { data: parties }, { data: events }, { data: users }, { data: prior }] =
    await Promise.all([
      supabase
        .from("contacts")
        .select("id, name, phone, email")
        .eq("id", row.contact_id as string)
        .eq("client_id", opts.clientId)
        .maybeSingle(),
      row.listing_id
        ? supabase
            .from("listings")
            .select("id, address, suburb, price, status")
            .eq("id", row.listing_id as string)
            .eq("client_id", opts.clientId)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      row.offer_id
        ? supabase
            .from("real_estate_offers")
            .select("id, current_offer_amount, currency, status, original_offer_amount")
            .eq("id", row.offer_id as string)
            .eq("client_id", opts.clientId)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      supabase
        .from("compliance_document_requirements")
        .select("*")
        .eq("compliance_case_id", opts.caseId)
        .eq("client_id", opts.clientId)
        .order("created_at", { ascending: true }),
      supabase
        .from("compliance_related_parties")
        .select("*")
        .eq("compliance_case_id", opts.caseId)
        .eq("client_id", opts.clientId)
        .order("created_at", { ascending: true }),
      supabase
        .from("compliance_case_events")
        .select("*")
        .eq("compliance_case_id", opts.caseId)
        .eq("client_id", opts.clientId)
        .order("created_at", { ascending: true }),
      supabase
        .from("users")
        .select("id, name")
        .in(
          "id",
          [row.buyer_agent_id, row.assigned_compliance_user_id, row.approved_by, row.created_by].filter(Boolean) as string[]
        ),
      supabase
        .from("compliance_cases")
        .select("id, status, approved_at, created_at")
        .eq("client_id", opts.clientId)
        .eq("contact_id", row.contact_id as string)
        .neq("id", opts.caseId)
        .eq("status", "approved")
        .order("approved_at", { ascending: false })
        .limit(3),
    ]);

  const userById = new Map((users ?? []).map((u) => [u.id as string, u.name as string | null]));
  const partyRows = parties ?? [];
  const completeness = checklistCompleteness({
    entity: row.entity_type as ComplianceEntityType,
    settings,
    profile: (row.cdd_profile as CddProfile) ?? {},
    docs: (docs ?? []).map((d) => ({
      document_type: d.document_type as string,
      required: Boolean(d.required),
      status: d.status as string,
    })),
    partyCount: {
      directors: partyRows.filter((p) => p.relationship_type === "director").length,
      beneficialOwners: partyRows.filter((p) => p.relationship_type === "beneficial_owner").length,
    },
  });

  const publicDocs = (docs ?? []).map((d) => ({
    id: d.id as string,
    documentType: d.document_type as string,
    label: documentTypeLabel(d.document_type as string),
    status: d.status as string,
    required: Boolean(d.required),
    originalFilename: (d.original_filename as string | null) ?? null,
    uploadedAt: (d.uploaded_at as string | null) ?? null,
    uploadedByName: d.uploaded_by ? userById.get(d.uploaded_by as string) ?? null : null,
    expiryDate: (d.expiry_date as string | null) ?? null,
    hasFile: Boolean(d.storage_key),
    reviewNotes: seeInternal ? ((d.review_notes as string | null) ?? null) : null,
  }));

  return {
    ok: true as const,
    settings,
    canCollect: canCollectCompliance(actor, settings, {
      caseClientId: opts.clientId,
      buyerAgentId: (row.buyer_agent_id as string | null) ?? null,
    }),
    canReview: canReviewCompliance(actor, settings),
    seeInternal,
    completeness,
    nextUpload: agentNextDocumentAction(
      (docs ?? []).map((d) => ({
        document_type: d.document_type as string,
        required: Boolean(d.required),
        status: d.status as string,
      }))
    ),
    case: {
      ...row,
      status_label: complianceStatusLabel(row.status as string, !seeInternal),
      buyer_agent_name: row.buyer_agent_id ? userById.get(row.buyer_agent_id as string) ?? null : null,
      reviewer_name: row.assigned_compliance_user_id
        ? userById.get(row.assigned_compliance_user_id as string) ?? null
        : null,
      approved_by_name: row.approved_by ? userById.get(row.approved_by as string) ?? null : null,
      internal_notes: seeInternal ? row.internal_notes : null,
      review_notes: seeInternal ? row.review_notes : null,
      restriction_reason: seeInternal ? row.restriction_reason : null,
      rejection_reason: seeInternal ? row.rejection_reason : null,
      edd_reason: seeInternal ? row.edd_reason : (row.status === "edd_required" ? "Additional review is required." : null),
      agent_request_message: row.agent_request_message,
    },
    contact: contact ?? null,
    listing: listing ?? null,
    listingLabel: listing ? listingLabel(listing) : null,
    offer: offer ?? null,
    documents: publicDocs,
    parties: partyRows,
    events: (events ?? []).map((ev) => ({
      id: ev.id as string,
      eventType: ev.event_type as string,
      summary: ev.summary as string | null,
      before: seeInternal ? (ev.before_value as string | null) : null,
      after: seeInternal ? (ev.after_value as string | null) : null,
      createdAt: ev.created_at as string,
      createdByName: ev.created_by ? userById.get(ev.created_by as string) ?? null : null,
    })),
    priorApproved: (prior ?? []).map((p) => ({
      id: p.id as string,
      approvedAt: p.approved_at as string | null,
    })),
  };
}

export async function mutateComplianceCase(opts: {
  clientId: string;
  caseId: string;
  actor: Actor;
  action: string;
  payload?: Record<string, unknown>;
}): Promise<{ ok: true; case: Record<string, unknown> } | { ok: false; error: string; status: number }> {
  const supabase = createAdminClient();
  const settings = await loadComplianceSettings(opts.clientId);
  const { data: row } = await supabase
    .from("compliance_cases")
    .select("*")
    .eq("id", opts.caseId)
    .eq("client_id", opts.clientId)
    .maybeSingle();
  if (!row) return { ok: false, error: "Case not found.", status: 404 };

  const actor = toActor(opts.actor);
  const collect = canCollectCompliance(actor, settings, {
    caseClientId: opts.clientId,
    buyerAgentId: (row.buyer_agent_id as string | null) ?? null,
  });
  const review = canReviewCompliance(actor, settings);
  const payload = opts.payload ?? {};
  const now = new Date().toISOString();
  const patch: Record<string, unknown> = {};
  let eventType: ComplianceEventType = "NOTE_ADDED";
  let summary = "";
  let before: string | null = null;
  let after: string | null = null;
  let notifyAgent = false;
  let notifyReviewers = false;
  let notifyMsg = "";

  async function loadCompleteness() {
    const [{ data: docs }, { data: parties }] = await Promise.all([
      supabase
        .from("compliance_document_requirements")
        .select("document_type, required, status")
        .eq("compliance_case_id", opts.caseId)
        .eq("client_id", opts.clientId),
      supabase
        .from("compliance_related_parties")
        .select("relationship_type")
        .eq("compliance_case_id", opts.caseId)
        .eq("client_id", opts.clientId),
    ]);
    return checklistCompleteness({
      entity: (patch.entity_type as ComplianceEntityType) ?? (row.entity_type as ComplianceEntityType),
      settings,
      profile: ((patch.cdd_profile as CddProfile) ?? (row.cdd_profile as CddProfile)) || {},
      docs: (docs ?? []).map((d) => ({
        document_type: d.document_type as string,
        required: Boolean(d.required),
        status: d.status as string,
      })),
      partyCount: {
        directors: (parties ?? []).filter((p) => p.relationship_type === "director").length,
        beneficialOwners: (parties ?? []).filter((p) => p.relationship_type === "beneficial_owner").length,
      },
    });
  }

  if (opts.action === "update_profile") {
    if (!collect) return { ok: false, error: "Forbidden.", status: 403 };
    const entity = payload.entity_type as ComplianceEntityType | undefined;
    if (entity && entity !== row.entity_type) {
      patch.entity_type = entity;
      await seedChecklist(opts.caseId, opts.clientId, entity, settings);
    }
    patch.cdd_profile = { ...((row.cdd_profile as object) ?? {}), ...((payload.cdd_profile as object) ?? {}) };
    if (row.status === "not_started") patch.status = "in_progress";
    eventType = "INFORMATION_UPDATED";
    summary = "CDD information updated";
  } else if (opts.action === "add_party") {
    if (!collect) return { ok: false, error: "Forbidden.", status: 403 };
    const name = String(payload.full_name ?? "").trim();
    const type = String(payload.relationship_type ?? "");
    if (!name || !["director", "beneficial_owner", "authorised_representative", "other"].includes(type)) {
      return { ok: false, error: "Name and relationship type are required.", status: 400 };
    }
    await supabase.from("compliance_related_parties").insert({
      client_id: opts.clientId,
      compliance_case_id: opts.caseId,
      full_name: name,
      relationship_type: type,
      notes: payload.notes ? String(payload.notes) : null,
    });
    eventType = "PARTY_ADDED";
    summary = `Added ${type.replace(/_/g, " ")}: ${name}`;
  } else if (opts.action === "remove_party") {
    if (!collect) return { ok: false, error: "Forbidden.", status: 403 };
    await supabase
      .from("compliance_related_parties")
      .delete()
      .eq("id", String(payload.party_id))
      .eq("client_id", opts.clientId)
      .eq("compliance_case_id", opts.caseId);
    eventType = "PARTY_REMOVED";
    summary = "Related party removed";
  } else if (opts.action === "submit_review") {
    if (!collect) return { ok: false, error: "Forbidden.", status: 403 };
    const completeness = await loadCompleteness();
    if (!completeness.readyForReview) {
      return {
        ok: false,
        error: "All required items must be complete before submitting for review.",
        status: 409,
      };
    }
    if (!canTransitionCompliance(row.status as ComplianceStatus, "ready_for_review")) {
      return { ok: false, error: "This case cannot be submitted for review.", status: 409 };
    }
    patch.status = "ready_for_review";
    patch.submitted_for_review_at = now;
    eventType = "SUBMITTED_FOR_REVIEW";
    summary = "Submitted for review";
    notifyReviewers = true;
    notifyMsg = "A CDD case is ready for review.";
  } else if (opts.action === "start_review") {
    if (!review) return { ok: false, error: "Forbidden.", status: 403 };
    if (!canTransitionCompliance(row.status as ComplianceStatus, "under_review")) {
      return { ok: false, error: "Review cannot be started from this status.", status: 409 };
    }
    patch.status = "under_review";
    patch.review_started_at = now;
    patch.assigned_compliance_user_id = opts.actor.id;
    patch.last_reviewed_at = now;
    eventType = "REVIEW_STARTED";
    summary = "Review started";
  } else if (opts.action === "request_info") {
    if (!review) return { ok: false, error: "Forbidden.", status: 403 };
    const reason = String(payload.reason ?? "").trim();
    if (!reason) return { ok: false, error: "A reason is required.", status: 400 };
    patch.status = "more_information_required";
    patch.agent_request_message = reason;
    patch.last_reviewed_at = now;
    eventType = "MORE_INFO_REQUESTED";
    summary = "More information requested";
    after = reason;
    notifyAgent = true;
    notifyMsg = `Compliance needs additional information. ${reason}`;
  } else if (opts.action === "require_edd") {
    if (!review) return { ok: false, error: "Forbidden.", status: 403 };
    const reason = String(payload.reason ?? "").trim();
    if (!reason) return { ok: false, error: "A reason is required.", status: 400 };
    patch.status = "edd_required";
    patch.edd_reason = reason;
    patch.last_reviewed_at = now;
    eventType = "EDD_REQUIRED";
    summary = "Enhanced review required";
    after = reason;
  } else if (opts.action === "set_risk") {
    if (!review) return { ok: false, error: "Forbidden.", status: 403 };
    const to = String(payload.risk_level ?? "") as ComplianceRiskLevel;
    if (!["low", "medium", "high", "unclassified"].includes(to)) {
      return { ok: false, error: "Invalid risk level.", status: 400 };
    }
    const from = row.risk_level as ComplianceRiskLevel;
    const reason = String(payload.reason ?? "").trim();
    if (riskChangeRequiresReason(from, to) && !reason) {
      return { ok: false, error: "A reason is required for this risk change.", status: 400 };
    }
    patch.risk_level = to;
    patch.last_reviewed_at = now;
    if (payload.factors) patch.risk_factors = payload.factors;
    eventType = "RISK_CHANGED";
    summary = `Risk classification set to ${to}`;
    before = from;
    after = reason ? `${to}: ${reason}` : to;
  } else if (opts.action === "approve") {
    if (!review) return { ok: false, error: "Forbidden.", status: 403 };
    if (opts.actor.role === "SALESPERSON") return { ok: false, error: "Forbidden.", status: 403 };
    const completeness = await loadCompleteness();
    if (!completeness.readyForReview && row.status !== "edd_required" && row.status !== "under_review") {
      return { ok: false, error: "Required items are not complete.", status: 409 };
    }
    if (!canTransitionCompliance(row.status as ComplianceStatus, "approved")) {
      return { ok: false, error: "This case cannot be approved from the current status.", status: 409 };
    }
    patch.status = "approved";
    patch.approved_at = now;
    patch.approved_by = opts.actor.id;
    patch.last_reviewed_at = now;
    eventType = "APPROVED";
    summary = "CDD approved";
    notifyAgent = true;
    notifyMsg = "Compliance has approved this case.";
  } else if (opts.action === "restrict") {
    if (!review) return { ok: false, error: "Forbidden.", status: 403 };
    const reason = String(payload.reason ?? "").trim();
    if (!reason) return { ok: false, error: "A reason is required.", status: 400 };
    patch.status = "restricted";
    patch.restricted_at = now;
    patch.restricted_by = opts.actor.id;
    patch.restriction_reason = reason;
    patch.last_reviewed_at = now;
    eventType = "RESTRICTED";
    summary = "Case restricted";
    after = reason;
    notifyAgent = true;
    notifyMsg = "Compliance review required before this transaction can proceed.";
  } else if (opts.action === "reject") {
    if (!review) return { ok: false, error: "Forbidden.", status: 403 };
    const reason = String(payload.reason ?? "").trim();
    if (!reason) return { ok: false, error: "A reason is required.", status: 400 };
    patch.status = "rejected";
    patch.rejected_at = now;
    patch.rejected_by = opts.actor.id;
    patch.rejection_reason = reason;
    patch.last_reviewed_at = now;
    eventType = "REJECTED";
    summary = "Case not approved";
    after = reason;
    notifyAgent = true;
    notifyMsg = "Compliance review required before this transaction can proceed.";
  } else if (opts.action === "review_document") {
    if (!review) return { ok: false, error: "Forbidden.", status: 403 };
    const docId = String(payload.document_id ?? "");
    const decision = String(payload.decision ?? "");
    if (decision !== "accepted" && decision !== "rejected") {
      return { ok: false, error: "Decision must be accepted or rejected.", status: 400 };
    }
    await supabase
      .from("compliance_document_requirements")
      .update({
        status: decision,
        reviewed_at: now,
        reviewed_by: opts.actor.id,
        review_notes: payload.notes ? String(payload.notes) : null,
      })
      .eq("id", docId)
      .eq("client_id", opts.clientId)
      .eq("compliance_case_id", opts.caseId);
    eventType = decision === "accepted" ? "DOCUMENT_ACCEPTED" : "DOCUMENT_REJECTED";
    summary = `Document ${decision}`;
  } else if (opts.action === "reopen") {
    if (!review) return { ok: false, error: "Forbidden.", status: 403 };
    if (!canTransitionCompliance(row.status as ComplianceStatus, "in_progress") &&
        !canTransitionCompliance(row.status as ComplianceStatus, "under_review")) {
      return { ok: false, error: "This case cannot be reopened.", status: 409 };
    }
    patch.status = "in_progress";
    eventType = "CASE_REOPENED";
    summary = "Case reopened";
  } else if (opts.action === "note") {
    if (!review && !collect) return { ok: false, error: "Forbidden.", status: 403 };
    const note = String(payload.note ?? "").trim();
    if (!note) return { ok: false, error: "A note is required.", status: 400 };
    if (review && payload.internal === true) {
      patch.internal_notes = note;
    }
    eventType = "NOTE_ADDED";
    summary = note;
  } else {
    return { ok: false, error: "Unknown action.", status: 400 };
  }

  if (Object.keys(patch).length > 0) {
    const { error } = await supabase
      .from("compliance_cases")
      .update(patch)
      .eq("id", opts.caseId)
      .eq("client_id", opts.clientId);
    if (error) return { ok: false, error: error.message, status: 500 };
  }

  await appendEvent({
    clientId: opts.clientId,
    caseId: opts.caseId,
    type: eventType,
    summary,
    createdBy: opts.actor.id,
    before,
    after,
  });

  const { data: updated } = await supabase
    .from("compliance_cases")
    .select("*")
    .eq("id", opts.caseId)
    .eq("client_id", opts.clientId)
    .maybeSingle();

  if (notifyAgent && row.buyer_agent_id) {
    await notifyUsers({
      userIds: [row.buyer_agent_id as string],
      message: notifyMsg,
      leadId: (row.lead_id as string | null) ?? null,
    });
  }
  if (notifyReviewers) {
    const { data: reviewers } = await supabase
      .from("users")
      .select("id")
      .eq("client_id", opts.clientId)
      .eq("role", "CLIENT_MANAGER")
      .eq("is_active", true);
    await notifyUsers({
      userIds: (reviewers ?? []).map((u) => u.id as string),
      message: notifyMsg,
      leadId: (row.lead_id as string | null) ?? null,
    });
  }

  return { ok: true, case: updated ?? row };
}

export async function uploadComplianceDocument(opts: {
  clientId: string;
  caseId: string;
  documentId: string;
  actor: Actor;
  file: { buffer: Buffer; filename: string; contentType: string };
  reuseStorageKey?: string | null;
}) {
  const supabase = createAdminClient();
  const settings = await loadComplianceSettings(opts.clientId);
  const { data: row } = await supabase
    .from("compliance_cases")
    .select("id, buyer_agent_id, status")
    .eq("id", opts.caseId)
    .eq("client_id", opts.clientId)
    .maybeSingle();
  if (!row) return { ok: false as const, error: "Case not found.", status: 404 };
  if (
    !canCollectCompliance(toActor(opts.actor), settings, {
      caseClientId: opts.clientId,
      buyerAgentId: (row.buyer_agent_id as string | null) ?? null,
    })
  ) {
    return { ok: false as const, error: "Forbidden.", status: 403 };
  }

  const { data: doc } = await supabase
    .from("compliance_document_requirements")
    .select("*")
    .eq("id", opts.documentId)
    .eq("compliance_case_id", opts.caseId)
    .eq("client_id", opts.clientId)
    .maybeSingle();
  if (!doc) return { ok: false as const, error: "Document requirement not found.", status: 404 };

  let storageKey = opts.reuseStorageKey ?? null;
  if (storageKey) {
    const { data: prior } = await supabase
      .from("compliance_document_requirements")
      .select("id")
      .eq("client_id", opts.clientId)
      .eq("storage_key", storageKey)
      .limit(1)
      .maybeSingle();
    if (!prior) return { ok: false as const, error: "Document is not available to reuse.", status: 404 };
  } else {
    if (!isR2Configured()) {
      return { ok: false as const, error: "Secure document storage is not configured.", status: 503 };
    }
    storageKey = generateComplianceDocKey(opts.clientId, opts.caseId, opts.file.filename);
    await putObject(storageKey, opts.file.buffer, opts.file.contentType, {
      contentDisposition: `attachment; filename="${opts.file.filename.replace(/["\\]/g, "")}"`,
      cacheControl: "private, max-age=0",
    });
  }

  await supabase
    .from("compliance_document_requirements")
    .update({
      storage_key: storageKey,
      original_filename: opts.file.filename,
      content_type: opts.file.contentType,
      uploaded_at: new Date().toISOString(),
      uploaded_by: opts.actor.id,
      status: "received",
    })
    .eq("id", opts.documentId)
    .eq("client_id", opts.clientId);

  if (row.status === "not_started" || row.status === "in_progress" || row.status === "more_information_required") {
    await supabase
      .from("compliance_cases")
      .update({ status: "awaiting_documents" })
      .eq("id", opts.caseId)
      .eq("client_id", opts.clientId)
      .in("status", ["not_started", "in_progress", "more_information_required"]);
  }

  await appendEvent({
    clientId: opts.clientId,
    caseId: opts.caseId,
    type: "DOCUMENT_UPLOADED",
    summary: `Uploaded ${documentTypeLabel(doc.document_type as string)}`,
    createdBy: opts.actor.id,
  });

  return { ok: true as const };
}

export async function signComplianceDocument(opts: {
  clientId: string;
  caseId: string;
  documentId: string;
  actor: Actor;
}) {
  const supabase = createAdminClient();
  const { data: row } = await supabase
    .from("compliance_cases")
    .select("buyer_agent_id")
    .eq("id", opts.caseId)
    .eq("client_id", opts.clientId)
    .maybeSingle();
  if (!row) return { ok: false as const, error: "Case not found.", status: 404 };
  if (
    !canViewComplianceCase(toActor(opts.actor), {
      caseClientId: opts.clientId,
      buyerAgentId: (row.buyer_agent_id as string | null) ?? null,
    })
  ) {
    return { ok: false as const, error: "Forbidden.", status: 403 };
  }
  const { data: doc } = await supabase
    .from("compliance_document_requirements")
    .select("storage_key, original_filename, content_type")
    .eq("id", opts.documentId)
    .eq("compliance_case_id", opts.caseId)
    .eq("client_id", opts.clientId)
    .maybeSingle();
  if (!doc?.storage_key) return { ok: false as const, error: "File not found.", status: 404 };
  if (!String(doc.storage_key).startsWith(`clients/${opts.clientId}/compliance/`)) {
    return { ok: false as const, error: "Forbidden.", status: 403 };
  }
  const url = await generatePresignedDownloadUrl(
    doc.storage_key as string,
    (doc.original_filename as string) || "document",
    (doc.content_type as string) || "application/octet-stream"
  );
  return { ok: true as const, url };
}

export async function assertComplianceProgressAllowed(opts: {
  clientId: string;
  listingId?: string | null;
  leadId?: string | null;
}): Promise<ComplianceGateResult> {
  const supabase = createAdminClient();
  const { data: client } = await supabase
    .from("clients")
    .select("business_type, compliance_settings")
    .eq("id", opts.clientId)
    .maybeSingle();
  if (!isRealEstate(client?.business_type)) return { ok: true };
  const settings = parseComplianceSettings(client?.compliance_settings);

  let hasAcceptedOffer = false;
  let caseStatus: ComplianceStatus | null = null;

  if (opts.listingId) {
    const { data: offers } = await supabase
      .from("real_estate_offers")
      .select("id, status")
      .eq("client_id", opts.clientId)
      .eq("listing_id", opts.listingId)
      .eq("status", "accepted")
      .limit(5);
    hasAcceptedOffer = (offers ?? []).length > 0;
    const { data: cases } = await supabase
      .from("compliance_cases")
      .select("status")
      .eq("client_id", opts.clientId)
      .eq("listing_id", opts.listingId)
      .order("updated_at", { ascending: false })
      .limit(1);
    caseStatus = (cases?.[0]?.status as ComplianceStatus) ?? null;
  }

  if (opts.leadId) {
    const { data: offers } = await supabase
      .from("real_estate_offers")
      .select("id, status")
      .eq("client_id", opts.clientId)
      .eq("lead_id", opts.leadId)
      .eq("status", "accepted")
      .limit(5);
    if ((offers ?? []).length > 0) hasAcceptedOffer = true;
    const { data: cases } = await supabase
      .from("compliance_cases")
      .select("status")
      .eq("client_id", opts.clientId)
      .eq("lead_id", opts.leadId)
      .order("updated_at", { ascending: false })
      .limit(1);
    if (cases?.[0]) caseStatus = cases[0].status as ComplianceStatus;
  }

  return evaluateComplianceGate({
    isRealEstate: true,
    settings,
    hasAcceptedOffer,
    caseStatus,
  });
}

export async function listAgentComplianceActions(opts: { clientId: string; userId: string }) {
  const supabase = createAdminClient();
  const { data: rows } = await supabase
    .from("compliance_cases")
    .select("id, contact_id, listing_id, status, agent_request_message, buyer_agent_id")
    .eq("client_id", opts.clientId)
    .eq("buyer_agent_id", opts.userId)
    .in("status", ["awaiting_documents", "in_progress", "more_information_required", "not_started"])
    .order("updated_at", { ascending: false })
    .limit(20);

  const list = rows ?? [];
  if (list.length === 0) return [];
  const contactIds = [...new Set(list.map((r) => r.contact_id as string))];
  const caseIds = list.map((r) => r.id as string);
  const [{ data: contacts }, { data: docs }] = await Promise.all([
    supabase.from("contacts").select("id, name").eq("client_id", opts.clientId).in("id", contactIds),
    supabase
      .from("compliance_document_requirements")
      .select("compliance_case_id, document_type, required, status")
      .eq("client_id", opts.clientId)
      .in("compliance_case_id", caseIds),
  ]);
  const nameBy = new Map((contacts ?? []).map((c) => [c.id as string, c.name as string | null]));
  return list.map((row) => {
    const d = (docs ?? []).filter((x) => x.compliance_case_id === row.id);
    const next = agentNextDocumentAction(
      d.map((x) => ({
        document_type: x.document_type as string,
        required: Boolean(x.required),
        status: x.status as string,
      }))
    );
    const att = deriveComplianceAttention(row.status as ComplianceStatus);
    return {
      id: row.id as string,
      contactName: nameBy.get(row.contact_id as string) ?? "Client",
      why: (row.agent_request_message as string | null) || att?.why || next?.label || "Action required",
      nextLabel: next?.label ?? "Open case",
    };
  });
}
