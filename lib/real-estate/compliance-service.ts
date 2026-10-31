import { signPrivateDocument as generatePresignedDownloadUrl, isPrivateDocumentStorageConfigured as isR2Configured, putPrivateDocument as putObject } from "@/lib/real-estate/private-document-storage";
import { createAdminClient } from "@/lib/supabase/admin";
import { listingLabel } from "@/lib/real-estate/helpers";
import { isRealEstate } from "@/lib/terminology";
import { callAtomic } from "@/lib/real-estate/atomic-rpc";
import { hasPermission, P } from "@/lib/auth/rbac";
import type { UserRole } from "@/types";
import {
  generateComplianceDocKey,
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
  complianceCaseMatchesContext,
  deriveComplianceAttention,
  documentTypeLabel,
  evaluateComplianceGate,
  isComplianceSettingsShapeValid,
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
  role: UserRole;
  clientId: string | null;
  canReviewCompliance: boolean;
  supportAccess?: boolean;
  hasComplianceRead: boolean;
  hasComplianceReview: boolean;
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
    supportAccess: a.supportAccess,
    hasComplianceRead: a.hasComplianceRead,
    hasComplianceReview: a.hasComplianceReview,
  };
}

export async function loadComplianceActor(session: {
  userId: string;
  role: UserRole;
  clientId?: string | null;
  user?: { name?: string | null };
}, effectiveClientId?: string | null, supportAccess = false): Promise<Actor> {
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
    clientId: effectiveClientId ?? session.clientId ?? null,
    canReviewCompliance: Boolean(user?.can_review_compliance),
    supportAccess,
    hasComplianceRead: supportAccess || hasPermission({ userId: session.userId, role: session.role, clientId: effectiveClientId ?? session.clientId ?? null }, P.COMPLIANCE_READ),
    hasComplianceReview: !supportAccess && hasPermission({ userId: session.userId, role: session.role, clientId: effectiveClientId ?? session.clientId ?? null }, P.COMPLIANCE_REVIEW),
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
  const { error } = await supabase.from("compliance_case_events").insert({
    client_id: opts.clientId,
    compliance_case_id: opts.caseId,
    event_type: opts.type,
    summary: opts.summary,
    before_value: opts.before ?? null,
    after_value: opts.after ?? null,
    created_by: opts.createdBy,
  });
  if (error) throw new Error(`Compliance audit event failed: ${error.message}`);
}

const SAFE_EVENT_SUMMARIES: Record<string, string> = {
  CASE_CREATED: "Compliance case created",
  INFORMATION_UPDATED: "Customer information updated",
  DOCUMENT_UPLOADED: "Compliance document received",
  DOCUMENT_ACCEPTED: "Compliance document accepted",
  DOCUMENT_REJECTED: "Compliance document needs replacement",
  DOCUMENT_REQUESTED: "Additional customer documents are needed",
  DOCUMENT_ACCESSED: "Compliance document accessed",
  PARTY_ADDED: "Related party added",
  PARTY_REMOVED: "Related party removed",
  RISK_CHANGED: "Compliance risk assessment updated",
  SUBMITTED_FOR_REVIEW: "Compliance case submitted",
  REVIEW_STARTED: "Compliance review started",
  MORE_INFO_REQUESTED: "Additional customer information is needed",
  EDD_REQUIRED: "Additional compliance review required",
  APPROVED: "Compliance case decision available",
  RESTRICTED: "Compliance review required before this transaction can proceed",
  REJECTED: "Compliance review required before this transaction can proceed",
  CASE_REOPENED: "Compliance case reopened",
  NOTE_ADDED: "Compliance case note recorded",
};

export function safeComplianceEventSummary(eventType: string): string {
  return SAFE_EVENT_SUMMARIES[eventType] ?? "Compliance case updated";
}

export function projectComplianceCaseRow(
  row: Record<string, unknown>,
  opts: { seeInternal: boolean; statusLabel: string; buyerAgentName: string | null; reviewerName: string | null; approvedByName: string | null }
): Record<string, unknown> {
  const visible: Record<string, unknown> = {
    id: row.id,
    client_id: row.client_id,
    contact_id: row.contact_id,
    lead_id: row.lead_id,
    offer_id: row.offer_id,
    listing_id: row.listing_id,
    entity_type: row.entity_type,
    status: row.status,
    status_label: opts.statusLabel,
    risk_level: row.risk_level,
    cdd_profile: row.cdd_profile,
    buyer_agent_name: opts.buyerAgentName,
    reviewer_name: opts.reviewerName,
    approved_by_name: opts.approvedByName,
    agent_request_message: row.agent_request_message,
    submitted_for_review_at: row.submitted_for_review_at,
    review_started_at: row.review_started_at,
    approved_at: row.approved_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
  if (opts.seeInternal) {
    Object.assign(visible, {
      assigned_compliance_user_id: row.assigned_compliance_user_id,
      approved_by: row.approved_by,
      risk_factors: row.risk_factors,
      review_notes: row.review_notes,
      internal_notes: row.internal_notes,
      restriction_reason: row.restriction_reason,
      rejection_reason: row.rejection_reason,
      edd_reason: row.edd_reason,
      last_reviewed_at: row.last_reviewed_at,
      submitted_by: row.submitted_by,
    });
  } else if (row.status === "edd_required") {
    visible.edd_reason = "Additional review is required.";
  }
  return visible;
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
    if (opts.listingId && opts.listingId !== offer.listing_id) {
      return { ok: false, error: "Listing does not match this offer.", status: 400 };
    }
    if (opts.leadId && opts.leadId !== offer.lead_id) {
      return { ok: false, error: "Inquiry does not match this offer.", status: 400 };
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
      if (existingLead.contact_id !== opts.contactId || (listingId && existingLead.listing_id && existingLead.listing_id !== listingId)) {
        return { ok: false, error: "Existing compliance case does not match this customer or property.", status: 409 };
      }
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
    if (lead.contact_id && lead.contact_id !== opts.contactId) {
      return { ok: false, error: "Contact does not match this inquiry.", status: 400 };
    }
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
      expiry_date: (d.expiry_date as string | null) ?? null,
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
        expiry_date: (d.expiry_date as string | null) ?? null,
      }))
    ),
    case: projectComplianceCaseRow(row as Record<string, unknown>, {
      seeInternal,
      statusLabel: complianceStatusLabel(row.status as string, !seeInternal),
      buyerAgentName: row.buyer_agent_id ? userById.get(row.buyer_agent_id as string) ?? null : null,
      reviewerName: row.assigned_compliance_user_id ? userById.get(row.assigned_compliance_user_id as string) ?? null : null,
      approvedByName: row.approved_by ? userById.get(row.approved_by as string) ?? null : null,
    }),
    contact: contact ?? null,
    listing: listing ?? null,
    listingLabel: listing ? listingLabel(listing) : null,
    offer: offer ?? null,
    documents: publicDocs,
    parties: partyRows.map((party) => ({
      id: party.id as string,
      full_name: party.full_name as string,
      relationship_type: party.relationship_type as string,
      ...(seeInternal ? { contact_id: party.contact_id, notes: party.notes, created_at: party.created_at } : {}),
    })),
    events: (events ?? []).map((ev) => ({
      id: ev.id as string,
      eventType: ev.event_type as string,
      summary: seeInternal ? (ev.summary as string | null) : safeComplianceEventSummary(ev.event_type as string),
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
  let documentId: string | null = null;
  let documentDecision: "accepted" | "rejected" | null = null;
  let documentReviewNotes: string | null = null;

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
    if (!canTransitionCompliance(row.status as ComplianceStatus, "ready_for_review")) {
      return { ok: false, error: "This case cannot be submitted for review.", status: 409 };
    }
    patch.status = "ready_for_review";
    patch.submitted_for_review_at = now;
    patch.submitted_by = opts.actor.id;
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
    notifyMsg = "Additional customer documents are needed.";
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
    if (row.created_by === opts.actor.id || row.buyer_agent_id === opts.actor.id || row.submitted_by === opts.actor.id) {
      return { ok: false, error: "Independent review is required. You cannot approve a case you created, own or submitted.", status: 409 };
    }
    const completeness = await loadCompleteness();
    if (!completeness.readyForReview) {
      return { ok: false, error: "Required items are not complete.", status: 409 };
    }
    if (row.status === "edd_required" || row.edd_reason) {
      return { ok: false, error: "This case requires enhanced review. Phase 1 does not provide an evidence-backed EDD closure control, so approval is blocked.", status: 409 };
    }
    if (row.risk_level === "unclassified") {
      return { ok: false, error: "Complete the risk assessment before approval.", status: 409 };
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
    const { data: targetDocument } = await supabase
      .from("compliance_document_requirements")
      .select("id, status, storage_key")
      .eq("id", docId)
      .eq("client_id", opts.clientId)
      .eq("compliance_case_id", opts.caseId)
      .maybeSingle();
    if (!targetDocument?.storage_key || !["received", "under_review", "accepted", "rejected"].includes(String(targetDocument.status))) {
      return { ok: false, error: "The document is not available for review.", status: 409 };
    }
    documentId = docId;
    documentDecision = decision as "accepted" | "rejected";
    documentReviewNotes = payload.notes ? String(payload.notes) : null;
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
    summary = payload.internal === true ? "Internal compliance note recorded" : "Compliance case note recorded";
    after = note;
  } else {
    return { ok: false, error: "Unknown action.", status: 400 };
  }

  const atomicActions = new Set([
    "submit_review", "start_review", "request_info", "require_edd", "set_risk",
    "approve", "restrict", "reject", "review_document", "reopen",
  ]);
  const useAtomic = atomicActions.has(opts.action) || (opts.action === "note" && payload.internal === true);
  if (useAtomic) {
    const atomic = await callAtomic<{ case: Record<string, unknown> }>("compliance_apply_mutation_atomic", {
      p_client_id: opts.clientId,
      p_case_id: opts.caseId,
      p_expected_status: row.status,
      p_actor_id: opts.actor.id,
      p_event_type: eventType,
      p_safe_summary: summary,
      p_before_value: before,
      p_after_value: after,
      p_case_patch: patch,
      p_document_id: documentId,
      p_document_status: documentDecision,
      p_document_review_notes: documentReviewNotes,
    });
    if (atomic.kind === "missing") {
      return { ok: false, error: "Compliance safety controls are not deployed. This change is blocked.", status: 503 };
    }
    if (atomic.kind === "error") return { ok: false, error: atomic.error, status: atomic.status };

    if (notifyAgent && row.buyer_agent_id) {
      await notifyUsers({ userIds: [row.buyer_agent_id as string], message: notifyMsg, leadId: (row.lead_id as string | null) ?? null });
    }
    if (notifyReviewers) {
      const { data: reviewers } = await supabase.from("users").select("id").eq("client_id", opts.clientId).eq("role", "CLIENT_MANAGER").eq("is_active", true);
      await notifyUsers({ userIds: (reviewers ?? []).map((u) => u.id as string), message: notifyMsg, leadId: (row.lead_id as string | null) ?? null });
    }
    return { ok: true, case: atomic.data.case };
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
  let storedFilename = opts.file.filename;
  let storedContentType = opts.file.contentType;
  if (storageKey) {
    const { data: prior } = await supabase
      .from("compliance_document_requirements")
      .select("id, compliance_case_id, original_filename, content_type")
      .eq("client_id", opts.clientId)
      .eq("storage_key", storageKey)
      .limit(1)
      .maybeSingle();
    if (!prior) return { ok: false as const, error: "Document is not available to reuse.", status: 404 };
    const { data: sourceCase } = await supabase
      .from("compliance_cases")
      .select("buyer_agent_id")
      .eq("id", prior.compliance_case_id as string)
      .eq("client_id", opts.clientId)
      .maybeSingle();
    if (!sourceCase || !canViewComplianceCase(toActor(opts.actor), {
      caseClientId: opts.clientId,
      buyerAgentId: (sourceCase.buyer_agent_id as string | null) ?? null,
    })) {
      return { ok: false as const, error: "Document is not available to reuse.", status: 404 };
    }
    if (!storageKey.startsWith(`clients/${opts.clientId}/compliance/`) || storageKey.includes("..")) {
      return { ok: false as const, error: "Document is not available to reuse.", status: 404 };
    }
    storedFilename = (prior.original_filename as string | null) ?? "reused-document";
    storedContentType = (prior.content_type as string | null) ?? "application/octet-stream";
  } else {
    if (!isR2Configured()) {
      return { ok: false as const, error: "Secure document storage is not configured.", status: 503 };
    }
    const canonicalExtension: Record<string, string> = {
      "application/pdf": "pdf",
      "image/jpeg": "jpg",
      "image/png": "png",
      "image/webp": "webp",
      "image/heic": "heic",
      "image/heif": "heic",
    };
    const extension = canonicalExtension[opts.file.contentType];
    if (!extension) return { ok: false as const, error: "Unsupported document type.", status: 400 };
    storageKey = generateComplianceDocKey(opts.clientId, opts.caseId, `document.${extension}`);
    await putObject(storageKey, opts.file.buffer, opts.file.contentType, {
      contentDisposition: `attachment; filename="${opts.file.filename.replace(/["\\\r\n\u0000-\u001f\u007f]/g, "").slice(0, 180) || "document"}"`,
      cacheControl: "private, max-age=0",
    });
  }

  await supabase
    .from("compliance_document_requirements")
    .update({
      storage_key: storageKey,
      original_filename: storedFilename,
      content_type: storedContentType,
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
  if (!String(doc.storage_key).startsWith(`clients/${opts.clientId}/compliance/`) || String(doc.storage_key).includes("..")) {
    return { ok: false as const, error: "Forbidden.", status: 403 };
  }
  await appendEvent({
    clientId: opts.clientId,
    caseId: opts.caseId,
    type: "DOCUMENT_ACCESSED",
    summary: "Compliance document accessed",
    createdBy: opts.actor.id,
  });
  if (!isR2Configured()) return {ok:false as const,error:"Private document storage is not configured.",status:503};
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
  offerId?: string | null;
  contactId?: string | null;
  transactionId?: string | null;
  checkpoint?: import("@/lib/real-estate/compliance").ComplianceCheckpoint;
}): Promise<ComplianceGateResult> {
  const supabase = createAdminClient();
  const { data: client, error: clientError } = await supabase
    .from("clients")
    .select("business_type, compliance_settings")
    .eq("id", opts.clientId)
    .maybeSingle();
  const checkpoint = opts.checkpoint ?? "accepted_offer_progression";
  if (clientError || !client) {
    return evaluateComplianceGate({
      isRealEstate: true,
      settings: parseComplianceSettings({}),
      hasAcceptedOffer: true,
      caseStatus: null,
      checkpoint,
      policyValid: false,
    });
  }
  if (!isRealEstate(client.business_type)) {
    return evaluateComplianceGate({ isRealEstate: false, settings: parseComplianceSettings({}), hasAcceptedOffer: false, caseStatus: null, checkpoint });
  }
  const settings = parseComplianceSettings(client?.compliance_settings);
  const policyValid = isComplianceSettingsShapeValid(client.compliance_settings);

  let transaction: Record<string, unknown> | null = null;
  if (opts.transactionId) {
    const result = await supabase.from("real_estate_transactions").select("id, client_id, compliance_case_id, offer_id, contact_id, lead_id, listing_id").eq("id", opts.transactionId).eq("client_id", opts.clientId).maybeSingle();
    if (result.error || !result.data) {
      return evaluateComplianceGate({ isRealEstate: true, settings, hasAcceptedOffer: true, caseStatus: null, checkpoint, policyValid: false });
    }
    transaction = result.data as Record<string, unknown>;
  }

  const offerId = (transaction?.offer_id as string | null) ?? opts.offerId ?? null;
  let offer: Record<string, unknown> | null = null;
  if (offerId) {
    const result = await supabase.from("real_estate_offers").select("id, client_id, contact_id, lead_id, listing_id, status").eq("id", offerId).eq("client_id", opts.clientId).maybeSingle();
    if (result.error) return evaluateComplianceGate({ isRealEstate: true, settings, hasAcceptedOffer: true, caseStatus: null, checkpoint, policyValid: false });
    offer = result.data as Record<string, unknown> | null;
  } else if (opts.listingId || opts.leadId) {
    let query = supabase.from("real_estate_offers").select("id, client_id, contact_id, lead_id, listing_id, status").eq("client_id", opts.clientId).eq("status", "accepted");
    if (opts.listingId) query = query.eq("listing_id", opts.listingId);
    if (opts.leadId) query = query.eq("lead_id", opts.leadId);
    const result = await query.order("updated_at", { ascending: false }).limit(1).maybeSingle();
    if (result.error) return evaluateComplianceGate({ isRealEstate: true, settings, hasAcceptedOffer: true, caseStatus: null, checkpoint, policyValid: false });
    offer = result.data as Record<string, unknown> | null;
  }

  const hasAcceptedOffer = offer?.status === "accepted";
  if (!hasAcceptedOffer) return evaluateComplianceGate({ isRealEstate: true, settings, hasAcceptedOffer: false, caseStatus: null, checkpoint, policyValid });

  const linkedCaseId = (transaction?.compliance_case_id as string | null) ?? null;
  let caseQuery = supabase.from("compliance_cases").select("id, client_id, contact_id, lead_id, offer_id, listing_id, status").eq("client_id", opts.clientId).eq("offer_id", offer!.id as string);
  if (linkedCaseId) caseQuery = caseQuery.eq("id", linkedCaseId);
  const caseResult = await caseQuery.limit(1).maybeSingle();
  if (caseResult.error) return evaluateComplianceGate({ isRealEstate: true, settings, hasAcceptedOffer: true, caseStatus: null, checkpoint, policyValid: false });
  const complianceCase = caseResult.data as Record<string, unknown> | null;
  const expectedContact = (transaction?.contact_id as string | null) ?? opts.contactId ?? (offer?.contact_id as string | null) ?? null;
  const expectedLead = (transaction?.lead_id as string | null) ?? opts.leadId ?? (offer?.lead_id as string | null) ?? null;
  const expectedListing = (transaction?.listing_id as string | null) ?? opts.listingId ?? (offer?.listing_id as string | null) ?? null;
  const contextValid = !complianceCase || complianceCaseMatchesContext({
    caseClientId: complianceCase.client_id as string,
    caseContactId: complianceCase.contact_id as string,
    caseOfferId: complianceCase.offer_id as string | null,
    caseListingId: complianceCase.listing_id as string | null,
    caseLeadId: complianceCase.lead_id as string | null,
    clientId: opts.clientId,
    contactId: expectedContact,
    offerId: offer!.id as string,
    listingId: expectedListing,
    leadId: expectedLead,
  });

  return evaluateComplianceGate({ isRealEstate: true, settings, hasAcceptedOffer: true, caseStatus: (complianceCase?.status as ComplianceStatus) ?? null, checkpoint, caseId: (complianceCase?.id as string) ?? null, policyValid, contextValid });
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
