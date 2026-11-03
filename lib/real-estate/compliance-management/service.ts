import { createHash, randomUUID } from "crypto";
import { getPublicBaseUrl } from "@/lib/constants";
import { createAdminClient } from "@/lib/supabase/admin";
import { permissionsForOrgRole } from "@/lib/auth/rbac/role-profiles";
import { checkDbRateLimit } from "@/lib/auth/db-rate-limit";
import { detectComplianceFileType } from "@/lib/real-estate/compliance";
import {
  loadComplianceActor,
  loadComplianceSettings,
  mutateComplianceCase,
  startOrGetComplianceCase,
} from "@/lib/real-estate/compliance-service";
import { putPrivateDocument } from "@/lib/real-estate/private-document-storage";
import {
  agentStatusLabel,
  ALLOWED_PROFILE_KEYS,
  complianceCapabilities,
  confirmPayment,
  defaultTemplateKey,
  deriveReadiness,
  evaluateDecision,
  hashSecret,
  independentReviewer,
  instantiateTemplate,
  invitationAccess,
  legalTransferAfterMilestone,
  maskProfileForAgent,
  newInvitationToken,
  newOtpCode,
  nextActionLabel,
  otpAccess,
  paymentStateAfterProof,
  pickProfileFields,
  POLICY_TEMPLATES,
  safeAuditSummary,
  secretsMatch,
  stateAfterUpload,
  templateByKey,
  verificationMayBeReused,
  type ComplianceCapabilities,
  type ComplianceContext,
  type InvitationStatus,
  type LegalRoute,
  type PaymentEvidenceState,
  type ReadinessState,
  type RequirementDecision,
  type RequirementState,
} from "@/lib/real-estate/compliance-management/engine";
import type { UserRole } from "@/types";

const MAX_BYTES = 8_000_000;
const INVITE_HOURS = 72;

type Fail = { ok: false; error: string; status: number; code?: string };
type SessionUser = { userId: string; role: UserRole; clientId?: string | null; alsoSells?: boolean | null; user?: { name?: string | null } };

function unavailable(error: { message?: string; code?: string } | null): boolean {
  const message = `${error?.code ?? ""} ${error?.message ?? ""}`.toLowerCase();
  return message.includes("does not exist") || message.includes("schema cache") || message.includes("pgrst205") || message.includes("42703") || message.includes("column");
}

function fail(status: number, error: string, code?: string): Fail {
  return { ok: false, error, status, code };
}

function pepper(): string | null {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) return process.env.NODE_ENV === "production" ? null : "dev-compliance-pepper";
  return secret;
}

export async function loadManagementAccess(session: SessionUser, clientId: string, supportAccess = false) {
  const actor = await loadComplianceActor(session, clientId, supportAccess);
  const settings = await loadComplianceSettings(clientId);
  const permissions = new Set<string>(
    supportAccess
      ? ["compliance.read", "compliance.audit"]
      : permissionsForOrgRole(session.role, { alsoSells: Boolean(session.alsoSells) })
  );
  const capabilities = complianceCapabilities({
    userId: actor.id,
    role: actor.role,
    permissions,
    canReviewFlag: actor.canReviewCompliance,
    restrictReviewToFlaggedUsers: settings.restrict_review_to_flagged_users,
  });
  return { actor, settings, capabilities };
}

function canSeeCase(capabilities: ComplianceCapabilities, actorId: string, role: string, row: { buyer_agent_id?: string | null; listing_agent_id?: string | null }): boolean {
  if (!capabilities.viewSummary) return false;
  if (role === "CLIENT_MANAGER") return true;
  if (role !== "SALESPERSON") return false;
  const owner = row.buyer_agent_id ?? row.listing_agent_id ?? null;
  return !owner || owner === actorId;
}

async function seedRequirements(clientId: string, caseId: string, context: ComplianceContext, customerType: "individual" | "company", legalRoute: LegalRoute | null, transactionType: string | null) {
  const supabase = createAdminClient();
  const template = templateByKey(defaultTemplateKey(context, customerType, legalRoute));
  if (!template) return;
  const items = instantiateTemplate(template, { customerType, legalRoute, transactionType });
  const rows = items.map((item, index) => ({
    client_id: clientId,
    compliance_case_id: caseId,
    requirement_key: item.key,
    label: item.label,
    state: "not_started",
    mandatory: item.mandatoryFor.length > 0,
    waiver_permitted: item.waiverPermitted,
    evidence_kind: item.evidence,
    field_keys: item.fieldKeys ?? [],
    document_type: item.documentType ?? null,
    sort_order: index,
  }));
  if (rows.length === 0) return;
  const inserted = await supabase.from("compliance_case_requirements").upsert(rows, { onConflict: "compliance_case_id,requirement_key", ignoreDuplicates: true });
  if (inserted.error && !unavailable(inserted.error)) throw new Error(inserted.error.message);
}

export async function openSubjectCase(opts: {
  clientId: string;
  session: SessionUser;
  supportAccess?: boolean;
  context: ComplianceContext;
  contactId?: string | null;
  listingId?: string | null;
  transactionId?: string | null;
  customerType?: "individual" | "company";
  legalRoute?: LegalRoute | null;
}): Promise<{ ok: true; caseId: string; created: boolean } | Fail> {
  const access = await loadManagementAccess(opts.session, opts.clientId, opts.supportAccess);
  if (!access.capabilities.collect) return fail(403, "You cannot open a compliance case.");
  const supabase = createAdminClient();
  const customerType = opts.customerType ?? "individual";

  if (opts.context === "transaction") {
    if (!opts.transactionId) return fail(400, "A transaction is required.");
    const { data: txn } = await supabase.from("real_estate_transactions").select("id, client_id, offer_id, contact_id, listing_id, buyer_agent_id, listing_agent_id, lead_id").eq("id", opts.transactionId).eq("client_id", opts.clientId).maybeSingle();
    if (!txn) return fail(404, "Transaction not found.");
    if (!canSeeCase(access.capabilities, access.actor.id, access.actor.role, txn)) return fail(404, "Transaction not found.");
    const existingId = txn.offer_id
      ? (await supabase.from("compliance_cases").select("id").eq("client_id", opts.clientId).eq("offer_id", txn.offer_id as string).maybeSingle()).data?.id
      : null;
    let caseId = (existingId as string | undefined) ?? null;
    let created = false;
    if (!caseId) {
      const started = await startOrGetComplianceCase({
        clientId: opts.clientId,
        actor: access.actor,
        contactId: txn.contact_id as string,
        offerId: (txn.offer_id as string | null) ?? null,
        listingId: txn.listing_id as string,
        leadId: (txn.lead_id as string | null) ?? null,
        entityType: customerType === "company" ? "corporate" : "individual",
      });
      if (!started.ok) return fail(started.status, started.error);
      caseId = started.case.id as string;
      created = started.created;
    }
    await seedRequirements(opts.clientId, caseId, "transaction", customerType, opts.legalRoute ?? null, "sale");
    if (opts.legalRoute) {
      await supabase.from("real_estate_transactions").update({ legal_route: opts.legalRoute }).eq("id", txn.id).eq("client_id", opts.clientId);
      await supabase.from("compliance_cases").update({ legal_route: opts.legalRoute, context: "transaction" }).eq("id", caseId).eq("client_id", opts.clientId);
    }
    return { ok: true, caseId, created };
  }

  if (!opts.contactId) return fail(400, "A customer record is required.");
  const { data: contact } = await supabase.from("contacts").select("id, name").eq("id", opts.contactId).eq("client_id", opts.clientId).maybeSingle();
  if (!contact) return fail(404, "Customer not found.");
  if (opts.context === "property") {
    if (!opts.listingId) return fail(400, "A property is required.");
    const { data: listing } = await supabase.from("listings").select("id, agent_id").eq("id", opts.listingId).eq("client_id", opts.clientId).maybeSingle();
    if (!listing) return fail(404, "Property not found.");
    const { data: party } = await supabase.from("real_estate_listing_parties").select("id").eq("client_id", opts.clientId).eq("listing_id", opts.listingId).eq("contact_id", opts.contactId).limit(1).maybeSingle();
    if (!party) return fail(400, "Link this person to the property before opening listing compliance.");
    if (!canSeeCase(access.capabilities, access.actor.id, access.actor.role, { listing_agent_id: listing.agent_id as string | null })) return fail(404, "Property not found.");
  }

  const existingQuery = supabase.from("compliance_cases").select("id").eq("client_id", opts.clientId).eq("context", opts.context).eq("contact_id", opts.contactId).not("status", "in", "(closed,rejected)");
  const existing = opts.context === "property" && opts.listingId
    ? await supabase.from("compliance_cases").select("id").eq("client_id", opts.clientId).eq("context", "property").eq("listing_id", opts.listingId).not("status", "in", "(closed,rejected)").maybeSingle()
    : await existingQuery.maybeSingle();
  if (existing.error && unavailable(existing.error)) return fail(503, "Compliance foundation migration is not applied.", "COMPLIANCE_FOUNDATION_UNAVAILABLE");
  if (existing.data?.id) return { ok: true, caseId: existing.data.id as string, created: false };

  const inserted = await supabase.from("compliance_cases").insert({
    client_id: opts.clientId,
    contact_id: opts.contactId,
    listing_id: opts.context === "property" ? opts.listingId : null,
    context: opts.context,
    case_type: opts.context,
    entity_type: customerType === "company" ? "corporate" : "individual",
    status: "not_started",
    readiness: "not_started",
    policy_enforced: false,
    legal_route: opts.legalRoute ?? null,
    seller_contact_id: opts.context === "property" ? opts.contactId : null,
    created_by: access.actor.id,
    buyer_agent_id: access.actor.role === "SALESPERSON" ? access.actor.id : null,
    cdd_profile: customerType === "company" ? { registered_name: contact.name } : { legal_name: contact.name },
  }).select("id").maybeSingle();
  if (inserted.error && unavailable(inserted.error)) return fail(503, "Compliance foundation migration is not applied.", "COMPLIANCE_FOUNDATION_UNAVAILABLE");
  if (inserted.error || !inserted.data) return fail(500, "Could not open the compliance case.");
  await seedRequirements(opts.clientId, inserted.data.id as string, opts.context, customerType, opts.legalRoute ?? null, null);
  await supabase.from("compliance_case_events").insert({
    client_id: opts.clientId,
    compliance_case_id: inserted.data.id,
    event_type: "CASE_CREATED",
    summary: safeAuditSummary("CASE_CREATED"),
    created_by: access.actor.id,
  });
  await supabase.from("compliance_work_items").insert({
    client_id: opts.clientId,
    compliance_case_id: inserted.data.id,
    title: "Collect the outstanding compliance information",
    assigned_to: access.actor.id,
    created_by: access.actor.id,
  });
  return { ok: true, caseId: inserted.data.id as string, created: true };
}

export async function getSubjectSummary(opts: {
  clientId: string;
  session: SessionUser;
  supportAccess?: boolean;
  context: ComplianceContext;
  contactId?: string | null;
  listingId?: string | null;
  transactionId?: string | null;
}) {
  const access = await loadManagementAccess(opts.session, opts.clientId, opts.supportAccess);
  if (!access.capabilities.viewSummary) return fail(403, "You cannot view compliance.");
  const supabase = createAdminClient();
  let caseId: string | null = null;
  if (opts.transactionId) {
    const { data: txn } = await supabase.from("real_estate_transactions").select("id, offer_id, compliance_case_id, buyer_agent_id, listing_agent_id, status, legal_route, compliance_readiness, legal_transfer_status, payment_evidence_status, agreed_price, currency, conveyancer_name").eq("id", opts.transactionId).eq("client_id", opts.clientId).maybeSingle();
    if (!txn) return fail(404, "Transaction not found.");
    if (!canSeeCase(access.capabilities, access.actor.id, access.actor.role, txn)) return fail(404, "Transaction not found.");
    caseId = (txn.compliance_case_id as string | null) ?? null;
    if (!caseId && txn.offer_id) {
      const linked = await supabase.from("compliance_cases").select("id").eq("client_id", opts.clientId).eq("offer_id", txn.offer_id as string).maybeSingle();
      caseId = (linked.data?.id as string | undefined) ?? null;
    }
    const summary = caseId ? await projectCase(opts.clientId, caseId, access) : null;
    return {
      ok: true as const,
      enforced: false,
      notice: "Commercial stage, compliance readiness and legal transfer are separate. A completed sale is not a registered transfer.",
      summary,
      transaction: {
        id: txn.id,
        commercialStage: txn.status,
        legalRoute: txn.legal_route ?? null,
        complianceReadiness: txn.compliance_readiness ?? summary?.readiness ?? "not_started",
        legalTransferStatus: txn.legal_transfer_status ?? "not_started",
        paymentEvidenceStatus: txn.payment_evidence_status ?? "reported",
        agreedPrice: txn.agreed_price,
        currency: txn.currency,
        conveyancerName: access.capabilities.recordConveyancing || access.capabilities.review ? txn.conveyancer_name : null,
      },
      templates: POLICY_TEMPLATES.filter((template) => template.context === "transaction").map(publicTemplate),
    };
  }

  const query = supabase.from("compliance_cases").select("id, buyer_agent_id").eq("client_id", opts.clientId).eq("context", opts.context).not("status", "in", "(closed,rejected)");
  const found = opts.context === "property"
    ? await query.eq("listing_id", opts.listingId ?? "").maybeSingle()
    : await query.eq("contact_id", opts.contactId ?? "").maybeSingle();
  if (found.error && unavailable(found.error)) {
    return { ok: true as const, enforced: false, notice: "Compliance checklists are ready in the application. The database migration has not been applied, so cases cannot be stored yet.", summary: null, templates: POLICY_TEMPLATES.filter((template) => template.context === opts.context).map(publicTemplate), code: "COMPLIANCE_FOUNDATION_UNAVAILABLE" };
  }
  caseId = (found.data?.id as string | undefined) ?? null;
  const parties = opts.listingId
    ? await supabase.from("real_estate_listing_parties").select("contact_id, party_role").eq("client_id", opts.clientId).eq("listing_id", opts.listingId)
    : { data: [] as Array<{ contact_id: string; party_role: string }> };
  const summary = caseId ? await projectCase(opts.clientId, caseId, access) : null;
  return {
    ok: true as const,
    enforced: summary?.policyEnforced === true,
    notice: "These requirements are a configurable starting point. They are not a determination of Zimbabwean law until a reviewed policy is enforced.",
    summary,
    parties: parties.data ?? [],
    templates: POLICY_TEMPLATES.filter((template) => template.context === opts.context).map(publicTemplate),
  };
}

function publicTemplate(template: (typeof POLICY_TEMPLATES)[number]) {
  return { key: template.key, label: template.label, disclaimer: template.disclaimer, requirements: template.requirements.map((item) => ({ key: item.key, label: item.label, help: item.help })) };
}

async function projectCase(clientId: string, caseId: string, access: Awaited<ReturnType<typeof loadManagementAccess>>) {
  const supabase = createAdminClient();
  const { data: row } = await supabase.from("compliance_cases").select("id, client_id, contact_id, listing_id, context, status, readiness, entity_type, buyer_agent_id, created_by, submitted_by, assigned_compliance_user_id, last_reviewed_at, policy_enforced, legal_route, cdd_profile, edd_reason, reused_from_case_id").eq("id", caseId).eq("client_id", clientId).maybeSingle();
  if (!row) return null;
  if (!canSeeCase(access.capabilities, access.actor.id, access.actor.role, row)) return null;
  const [{ data: requirements }, { data: invitations }, { data: events }, { data: reviewer }] = await Promise.all([
    supabase.from("compliance_case_requirements").select("id, requirement_key, label, state, mandatory, waiver_permitted, evidence_kind").eq("client_id", clientId).eq("compliance_case_id", caseId).order("sort_order"),
    supabase.from("compliance_invitations").select("id, status, purpose, expires_at, sent_at, submitted_at").eq("client_id", clientId).eq("compliance_case_id", caseId).order("created_at", { ascending: false }).limit(8),
    supabase.from("compliance_case_events").select("id, event_type, summary, created_at, confidential").eq("client_id", clientId).eq("compliance_case_id", caseId).order("created_at", { ascending: false }).limit(12),
    row.assigned_compliance_user_id ? supabase.from("users").select("name").eq("id", row.assigned_compliance_user_id as string).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const requirementRows = (requirements ?? []).map((item) => ({
    id: item.id as string,
    key: item.requirement_key as string,
    label: item.label as string,
    state: item.state as RequirementState,
    mandatory: Boolean(item.mandatory),
  }));
  const readiness = (row.readiness as ReadinessState) || deriveReadiness({ caseStatus: row.status as string, requirements: requirementRows });
  const missing = requirementRows.filter((item) => item.mandatory && !["verified", "waived", "not_applicable"].includes(item.state)).map((item) => item.label);
  const restricted = row.status === "edd_required" || row.status === "restricted" || readiness === "escalated";
  return {
    caseId: row.id,
    context: row.context,
    status: row.status,
    statusLabel: access.capabilities.viewEscalation ? row.status : agentStatusLabel(String(row.status), readiness),
    readiness,
    reviewerName: access.capabilities.review ? (reviewer?.name ?? null) : null,
    lastReviewedAt: row.last_reviewed_at,
    nextAction: nextActionLabel({ readiness, missing, canReview: access.capabilities.review }),
    missing,
    requirements: requirementRows,
    invitations: invitations ?? [],
    audit: (events ?? [])
      .filter((event) => access.capabilities.viewEscalation || event.confidential !== true)
      .map((event) => ({ id: event.id, summary: access.capabilities.viewAudit ? event.summary : safeAuditSummary(String(event.event_type)), at: event.created_at })),
    profile: access.capabilities.review ? row.cdd_profile : maskProfileForAgent((row.cdd_profile as Record<string, unknown>) ?? {}),
    policyEnforced: row.policy_enforced === true,
    legalRoute: row.legal_route,
    canInvite: access.capabilities.invite,
    canReview: access.capabilities.review,
    canSeeRestricted: access.capabilities.viewEscalation,
    restricted: restricted && !access.capabilities.viewEscalation,
    reuseCaseId: row.reused_from_case_id,
    escalationDetail: access.capabilities.viewEscalation ? row.edd_reason : null,
  };
}

export async function complianceCentre(opts: { clientId: string; session: SessionUser; supportAccess?: boolean; section: string }) {
  const access = await loadManagementAccess(opts.session, opts.clientId, opts.supportAccess);
  if (!access.capabilities.viewSummary) return fail(403, "You cannot view compliance.");
  const supabase = createAdminClient();
  if (opts.section === "policies") {
    if (!access.capabilities.managePolicy && !access.capabilities.review) return fail(403, "Policy configuration is limited to compliance managers.");
    const rows = await supabase.from("compliance_policy_versions").select("id, template_key, version, status, enforcement, effective_from, review_note, activated_at").eq("client_id", opts.clientId).order("template_key");
    if (rows.error && unavailable(rows.error)) return fail(503, "Compliance foundation migration is not applied.", "COMPLIANCE_FOUNDATION_UNAVAILABLE");
    return { ok: true as const, policies: rows.data ?? [], templates: POLICY_TEMPLATES.map(publicTemplate), canManage: access.capabilities.managePolicy };
  }
  if (opts.section === "requests") {
    const rows = await supabase.from("compliance_invitations").select("id, compliance_case_id, purpose, status, expires_at, sent_at, submitted_at, created_at").eq("client_id", opts.clientId).order("created_at", { ascending: false }).limit(50);
    if (rows.error && unavailable(rows.error)) return fail(503, "Compliance foundation migration is not applied.", "COMPLIANCE_FOUNDATION_UNAVAILABLE");
    const caseIds = [...new Set((rows.data ?? []).map((row) => row.compliance_case_id as string))];
    const cases = caseIds.length
      ? await supabase.from("compliance_cases").select("id, context, buyer_agent_id, listing_agent_id").eq("client_id", opts.clientId).in("id", caseIds)
      : { data: [] as Array<Record<string, unknown>> };
    const caseById = new Map((cases.data ?? []).map((row) => [row.id as string, row]));
    return {
      ok: true as const,
      requests: (rows.data ?? []).flatMap((row) => {
        const parent = caseById.get(row.compliance_case_id as string);
        if (!parent || !canSeeCase(access.capabilities, access.actor.id, access.actor.role, parent as { buyer_agent_id?: string | null })) return [];
        return [{
          id: row.id,
          caseId: row.compliance_case_id,
          caseType: parent.context,
          purpose: row.purpose,
          status: row.status,
          expiresAt: row.expires_at,
          sentAt: row.sent_at,
          submittedAt: row.submitted_at,
        }];
      }),
    };
  }
  if (opts.section === "audit") {
    if (!access.capabilities.viewAudit) return fail(403, "You cannot view the compliance audit.");
    const rows = await supabase.from("compliance_case_events").select("id, compliance_case_id, event_type, summary, created_at, confidential").eq("client_id", opts.clientId).order("created_at", { ascending: false }).limit(80);
    if (rows.error && unavailable(rows.error)) return fail(503, "Compliance foundation migration is not applied.", "COMPLIANCE_FOUNDATION_UNAVAILABLE");
    return {
      ok: true as const,
      events: (rows.data ?? [])
        .filter((event) => access.capabilities.viewEscalation || event.confidential !== true)
        .map((event) => ({ id: event.id, caseId: event.compliance_case_id, summary: safeAuditSummary(String(event.event_type)), at: event.created_at })),
    };
  }
  const queue = await supabase.from("compliance_case_requirements").select("id, label, state, compliance_case_id, updated_at").eq("client_id", opts.clientId).in("state", ["submitted", "under_review", "more_information_required"]).order("updated_at", { ascending: false }).limit(50);
  if (queue.error && unavailable(queue.error)) return fail(503, "Compliance foundation migration is not applied.", "COMPLIANCE_FOUNDATION_UNAVAILABLE");
  const caseIds = [...new Set((queue.data ?? []).map((row) => row.compliance_case_id as string))];
  const cases = caseIds.length
    ? await supabase.from("compliance_cases").select("id, context, status, contact_id, listing_id, assigned_compliance_user_id, buyer_agent_id").eq("client_id", opts.clientId).in("id", caseIds)
    : { data: [] as Array<Record<string, unknown>> };
  const caseById = new Map((cases.data ?? []).map((row) => [row.id as string, row]));
  const visible = (queue.data ?? []).filter((row) => {
    const parent = caseById.get(row.compliance_case_id as string);
    if (!parent) return false;
    return canSeeCase(access.capabilities, access.actor.id, access.actor.role, parent as { buyer_agent_id?: string | null });
  });
  const counts = {
    pendingReviews: visible.filter((row) => row.state === "submitted" || row.state === "under_review").length,
    changesRequested: visible.filter((row) => row.state === "more_information_required").length,
    escalated: access.capabilities.viewEscalation ? (cases.data ?? []).filter((row) => row.status === "edd_required").length : 0,
  };
  return {
    ok: true as const,
    counts,
    queue: visible.map((row) => {
      const parent = caseById.get(row.compliance_case_id as string);
      const restricted = parent?.status === "edd_required" && !access.capabilities.viewEscalation;
      return {
        id: row.id,
        caseId: row.compliance_case_id,
        caseType: restricted ? "Restricted" : parent?.context ?? "transaction",
        requirement: restricted ? "Restricted review" : row.label,
        state: restricted ? "escalated" : row.state,
        submittedAt: row.updated_at,
        reviewerId: access.capabilities.review ? parent?.assigned_compliance_user_id ?? null : null,
        nextAction: restricted ? "Waiting on compliance." : row.state === "more_information_required" ? "Collect a correction." : "Review the submission.",
      };
    }),
    canReview: access.capabilities.review,
  };
}

export async function decideRequirement(opts: {
  clientId: string;
  session: SessionUser;
  requirementId: string;
  expectedState: RequirementState;
  decision: RequirementDecision;
  reason?: string | null;
}) {
  const access = await loadManagementAccess(opts.session, opts.clientId);
  const supabase = createAdminClient();
  const { data: requirement } = await supabase.from("compliance_case_requirements").select("id, state, waiver_permitted, compliance_case_id").eq("id", opts.requirementId).eq("client_id", opts.clientId).maybeSingle();
  if (!requirement) return fail(404, "Requirement not found.");
  const { data: row } = await supabase.from("compliance_cases").select("created_by, buyer_agent_id, submitted_by").eq("id", requirement.compliance_case_id as string).eq("client_id", opts.clientId).maybeSingle();
  if (!row) return fail(404, "Case not found.");
  const decision = evaluateDecision({
    decision: opts.decision,
    from: requirement.state as RequirementState,
    waiverPermitted: Boolean(requirement.waiver_permitted),
    reason: opts.reason,
    actorIsIndependent: independentReviewer(access.actor.id, { createdBy: row.created_by as string | null, buyerAgentId: row.buyer_agent_id as string | null, submittedBy: row.submitted_by as string | null }),
    actorMayReview: access.capabilities.approveEvidence,
  });
  if (!decision.ok) return fail(403, decision.error);
  const rpc = await supabase.rpc("compliance_requirement_decide_atomic", {
    p_client_id: opts.clientId,
    p_requirement_id: opts.requirementId,
    p_expected_state: opts.expectedState,
    p_actor_id: access.actor.id,
    p_next_state: decision.to,
    p_reason: opts.reason ?? null,
  });
  if (rpc.error && unavailable(rpc.error)) return fail(503, "The compliance decision function is not available. Apply the foundation migration before recording decisions.", "COMPLIANCE_FOUNDATION_UNAVAILABLE");
  if (rpc.error) {
    const message = rpc.error.message ?? "Could not record the decision.";
    const status = message.includes("RE409") ? 409 : message.includes("RE404") ? 404 : 400;
    return fail(status, message.replace(/^RE\d+:\s*/, ""));
  }
  if (opts.decision === "request_changes") {
    await supabase.from("compliance_work_items").insert({
      client_id: opts.clientId,
      compliance_case_id: requirement.compliance_case_id,
      requirement_id: requirement.id,
      title: "Follow up on the requested correction",
      created_by: access.actor.id,
    });
  }
  return { ok: true as const, result: rpc.data };
}

export async function createDocumentInvitation(opts: {
  clientId: string;
  session: SessionUser;
  caseId: string;
  requirementKeys: string[];
  purpose: "submission" | "correction";
  hours?: number;
}) {
  const access = await loadManagementAccess(opts.session, opts.clientId);
  if (!access.capabilities.invite) return fail(403, "You cannot request documents.");
  const secret = pepper();
  if (!secret) return fail(503, "Invitation signing is not configured.");
  const supabase = createAdminClient();
  const { data: row } = await supabase.from("compliance_cases").select("id, buyer_agent_id, contact_id").eq("id", opts.caseId).eq("client_id", opts.clientId).maybeSingle();
  if (!row || !canSeeCase(access.capabilities, access.actor.id, access.actor.role, row)) return fail(404, "Case not found.");
  const { data: requirements } = await supabase.from("compliance_case_requirements").select("requirement_key").eq("client_id", opts.clientId).eq("compliance_case_id", opts.caseId);
  const allowed = new Set((requirements ?? []).map((item) => item.requirement_key as string));
  const keys = [...new Set(opts.requirementKeys)].filter((key) => allowed.has(key));
  if (keys.length === 0) return fail(400, "Choose at least one requirement on this case.");
  const { data: contact } = await supabase.from("contacts").select("email, phone").eq("id", row.contact_id as string).eq("client_id", opts.clientId).maybeSingle();
  const token = newInvitationToken();
  const hours = Math.min(Math.max(opts.hours ?? INVITE_HOURS, 1), 24 * 14);
  const inserted = await supabase.from("compliance_invitations").insert({
    client_id: opts.clientId,
    compliance_case_id: opts.caseId,
    token_hash: hashSecret(token, secret),
    purpose: opts.purpose,
    requirement_keys: keys,
    status: "created",
    expires_at: new Date(Date.now() + hours * 3600_000).toISOString(),
    recipient_email: contact?.email ?? null,
    recipient_phone: contact?.phone ?? null,
    created_by: access.actor.id,
  }).select("id").maybeSingle();
  if (inserted.error && unavailable(inserted.error)) return fail(503, "Compliance foundation migration is not applied.", "COMPLIANCE_FOUNDATION_UNAVAILABLE");
  if (inserted.error || !inserted.data) return fail(500, "Could not create the document request.");
  await supabase.from("compliance_case_events").insert({
    client_id: opts.clientId,
    compliance_case_id: opts.caseId,
    event_type: "INVITATION_CREATED",
    summary: safeAuditSummary("INVITATION_CREATED"),
    created_by: access.actor.id,
  });
  const delivery = await deliverInvitationCode({
    clientId: opts.clientId,
    invitationId: inserted.data.id as string,
    email: (contact?.email as string | null) ?? null,
    actorId: access.actor.id,
    secret,
    includeLink: `${getPublicBaseUrl()}/verify/c/${token}`,
  });
  return { ok: true as const, invitationId: inserted.data.id, path: `/verify/c/${token}`, delivery };
}

async function deliverInvitationCode(opts: { clientId: string; invitationId: string; email: string | null; actorId: string | null; secret: string; includeLink: string }) {
  if (!opts.email || !process.env.RESEND_API_KEY || !process.env.RESEND_FROM_EMAIL) {
    return { status: "created" as const, delivered: false, reason: "OTP_DELIVERY_UNAVAILABLE" };
  }
  const supabase = createAdminClient();
  const code = newOtpCode();
  await supabase.from("compliance_invitation_sessions").insert({
    client_id: opts.clientId,
    invitation_id: opts.invitationId,
    otp_hash: hashSecret(code, opts.secret),
    otp_expires_at: new Date(Date.now() + 10 * 60_000).toISOString(),
    expires_at: new Date(Date.now() + 30 * 60_000).toISOString(),
  });
  const { sendEmailWithLog } = await import("@/lib/messaging/email");
  const sent = await sendEmailWithLog({
    mail: {
      to: opts.email,
      from: process.env.RESEND_FROM_EMAIL,
      subject: "Your secure document request",
      text: `Use this code to open your document request: ${code}\n\nOpen ${opts.includeLink}\n\nThe code expires in 10 minutes. SegmiQ will not ask you to send identity documents by chat.`,
    },
    context: { userId: opts.actorId, clientId: opts.clientId, leadId: null, notificationType: "COMPLIANCE_ALERT" },
    payloadPreview: "Compliance verification code sent",
  });
  if (!sent.ok) return { status: "created" as const, delivered: false, reason: "OTP_DELIVERY_UNAVAILABLE" };
  await supabase.from("compliance_invitations").update({ status: "sent", sent_at: new Date().toISOString() }).eq("id", opts.invitationId).eq("client_id", opts.clientId);
  return { status: "sent" as const, delivered: true, reason: null };
}

export async function publicInvitationAction(opts: {
  token: string;
  action: "preview" | "send_code" | "verify" | "save" | "submit";
  code?: string | null;
  sessionId?: string | null;
  fields?: Record<string, unknown>;
  files?: Array<{ requirementKey: string; filename: string; contentType: string; bytes: Buffer }>;
  ip: string;
}) {
  const limited = await checkDbRateLimit({ key: `compliance-invite:${opts.ip}`, limit: 30, windowMs: 10 * 60_000 });
  if (!limited.ok) return fail(429, "Too many attempts. Wait before trying again.");
  const secret = pepper();
  if (!secret) return fail(503, "Invitation signing is not configured.");
  const supabase = createAdminClient();
  const tokenHash = hashSecret(opts.token, secret);
  const { data: invitation, error } = await supabase.from("compliance_invitations").select("id, client_id, compliance_case_id, purpose, requirement_keys, status, expires_at, revoked_at, recipient_email").eq("token_hash", tokenHash).maybeSingle();
  if (error && unavailable(error)) return fail(503, "Document requests are not available yet.", "COMPLIANCE_FOUNDATION_UNAVAILABLE");
  if (!invitation) return fail(404, "This request is not available.");
  const access = invitationAccess({
    status: invitation.status as InvitationStatus,
    expiresAt: invitation.expires_at as string,
    now: new Date(),
    revoked: Boolean(invitation.revoked_at),
  });
  if (!access.ok && opts.action !== "preview") return fail(410, access.reason === "expired" ? "This request has expired." : "This request is closed.");
  const { data: client } = await supabase.from("clients").select("name").eq("id", invitation.client_id as string).maybeSingle();
  if (opts.action === "preview") {
    if (invitation.status === "created" || invitation.status === "sent") {
      await supabase.from("compliance_invitations").update({ status: invitation.status === "created" ? "opened" : "opened", opened_at: new Date().toISOString() }).eq("id", invitation.id);
    }
    return {
      ok: true as const,
      agencyName: client?.name ?? "Your agency",
      purpose: invitation.purpose === "correction" ? "Correct the requested information" : "Provide the requested information",
      notice: "The agency requested this information for customer due diligence. Uploading a document does not mean it has been accepted.",
      deliveryConfigured: Boolean(process.env.RESEND_API_KEY && process.env.RESEND_FROM_EMAIL && invitation.recipient_email),
      expired: !access.ok,
    };
  }
  if (!access.ok) return fail(410, "This request is closed.");
  if (opts.action === "send_code") {
    const delivery = await deliverInvitationCode({
      clientId: invitation.client_id as string,
      invitationId: invitation.id as string,
      email: (invitation.recipient_email as string | null) ?? null,
      actorId: null,
      secret,
      includeLink: "the same secure page",
    });
    if (!delivery.delivered) return fail(503, "A verification code cannot be delivered yet. Ask the agency to use an approved email channel.", "OTP_DELIVERY_UNAVAILABLE");
    return { ok: true as const, delivered: true };
  }
  const { data: session } = await supabase.from("compliance_invitation_sessions").select("id, otp_hash, otp_expires_at, attempts, verified_at, expires_at").eq("invitation_id", invitation.id as string).order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (opts.action === "verify") {
    if (!session?.otp_hash || !session.otp_expires_at) return fail(400, "Request a verification code first.");
    const gate = otpAccess({ attempts: Number(session.attempts ?? 0), expiresAt: session.otp_expires_at as string, now: new Date(), verified: Boolean(session.verified_at) });
    if (!gate.ok && gate.reason !== "already_verified") return fail(400, gate.reason === "locked" ? "Too many attempts." : "That code has expired.");
    if (!opts.code || !secretsMatch(opts.code, secret, session.otp_hash as string)) {
      await supabase.from("compliance_invitation_sessions").update({ attempts: Number(session.attempts ?? 0) + 1 }).eq("id", session.id);
      return fail(400, "That code is not valid.");
    }
    const verifiedUntil = new Date(Date.now() + 30 * 60_000).toISOString();
    await supabase.from("compliance_invitation_sessions").update({ verified_at: new Date().toISOString(), expires_at: verifiedUntil }).eq("id", session.id);
    await supabase.from("compliance_invitations").update({ status: "in_progress" }).eq("id", invitation.id);
    const { data: requirements } = await supabase.from("compliance_case_requirements").select("requirement_key, label, evidence_kind, field_keys, state").eq("client_id", invitation.client_id as string).eq("compliance_case_id", invitation.compliance_case_id as string).in("requirement_key", invitation.requirement_keys as string[]);
    return { ok: true as const, sessionId: session.id, requirements: requirements ?? [] };
  }
  if (!opts.sessionId || !session || session.id !== opts.sessionId || !session.verified_at || new Date(session.expires_at as string).getTime() < Date.now()) {
    return fail(401, "Verify your code before continuing.");
  }
  const keys = new Set((invitation.requirement_keys as string[]) ?? []);
  const { data: requirements } = await supabase.from("compliance_case_requirements").select("id, requirement_key, state, field_keys, document_type").eq("client_id", invitation.client_id as string).eq("compliance_case_id", invitation.compliance_case_id as string);
  const inScope = (requirements ?? []).filter((item) => keys.has(item.requirement_key as string));
  if (opts.action === "save" || opts.action === "submit") {
    const allowedFields = inScope.flatMap((item) => (Array.isArray(item.field_keys) ? item.field_keys : []) as string[]).filter((key) => (ALLOWED_PROFILE_KEYS as readonly string[]).includes(key));
    const picked = pickProfileFields(opts.fields ?? {}, allowedFields);
    if (Object.keys(picked).length) {
      const { data: current } = await supabase.from("compliance_cases").select("cdd_profile").eq("id", invitation.compliance_case_id as string).eq("client_id", invitation.client_id as string).maybeSingle();
      await supabase.from("compliance_cases").update({ cdd_profile: { ...((current?.cdd_profile as object) ?? {}), ...picked } }).eq("id", invitation.compliance_case_id as string).eq("client_id", invitation.client_id as string);
    }
    for (const file of opts.files ?? []) {
      if (!keys.has(file.requirementKey)) continue;
      const detected = detectComplianceFileType(file.bytes);
      if (!detected || file.bytes.length > MAX_BYTES) return fail(400, "Upload a PDF or image under 8 MB.");
      const requirement = inScope.find((item) => item.requirement_key === file.requirementKey);
      if (!requirement) continue;
      const next = stateAfterUpload(requirement.state as RequirementState);
      const version = await supabase.from("compliance_evidence_versions").select("id", { count: "exact", head: true }).eq("requirement_id", requirement.id as string);
      const storageKey = `clients/${invitation.client_id}/compliance/${invitation.compliance_case_id}/${randomUUID()}`;
      await putPrivateDocument(storageKey, file.bytes, detected);
      await supabase.from("compliance_evidence_versions").insert({
        client_id: invitation.client_id,
        compliance_case_id: invitation.compliance_case_id,
        requirement_id: requirement.id,
        invitation_id: invitation.id,
        storage_key: storageKey,
        checksum_sha256: createHash("sha256").update(file.bytes).digest("hex"),
        content_type: detected,
        byte_size: file.bytes.length,
        original_filename: file.filename.slice(0, 180),
        version_number: (version.count ?? 0) + 1,
        scan_status: "unscanned",
      });
      if (next) {
        await supabase.from("compliance_case_requirements").update({ state: next }).eq("id", requirement.id as string).eq("client_id", invitation.client_id as string).in("state", ["not_started", "awaiting_information", "more_information_required", "rejected", "submitted"]);
      }
    }
    if (opts.action === "save") {
      await supabase.from("compliance_invitations").update({ status: "in_progress" }).eq("id", invitation.id);
      return { ok: true as const, saved: true };
    }
    await supabase.from("compliance_invitations").update({ status: "submitted", submitted_at: new Date().toISOString() }).eq("id", invitation.id);
    await supabase.from("compliance_case_events").insert({
      client_id: invitation.client_id,
      compliance_case_id: invitation.compliance_case_id,
      event_type: "INVITATION_SUBMITTED",
      summary: safeAuditSummary("INVITATION_SUBMITTED"),
      created_by: null,
    });
    await supabase.from("compliance_cases").update({ status: "in_progress" }).eq("id", invitation.compliance_case_id as string).eq("client_id", invitation.client_id as string).eq("status", "not_started");
    await supabase.from("compliance_cases").update({ status: "ready_for_review", readiness: "under_review", submitted_for_review_at: new Date().toISOString() }).eq("id", invitation.compliance_case_id as string).eq("client_id", invitation.client_id as string).in("status", ["in_progress", "awaiting_documents", "more_information_required"]);
    return { ok: true as const, submitted: true };
  }
  return fail(400, "Unsupported action.");
}

export async function recordPaymentEvidence(opts: { clientId: string; session: SessionUser; transactionId: string; next: PaymentEvidenceState }) {
  const access = await loadManagementAccess(opts.session, opts.clientId);
  const supabase = createAdminClient();
  const { data: txn } = await supabase.from("real_estate_transactions").select("id, payment_evidence_status, buyer_agent_id").eq("id", opts.transactionId).eq("client_id", opts.clientId).maybeSingle();
  if (!txn || !canSeeCase(access.capabilities, access.actor.id, access.actor.role, txn)) return fail(404, "Transaction not found.");
  const current = (txn.payment_evidence_status as PaymentEvidenceState | null) ?? "reported";
  if (opts.next === "independently_confirmed") {
    const confirmed = confirmPayment({ from: current, actorMayRecordFinance: access.capabilities.recordFinance });
    if (!confirmed.ok) return fail(403, confirmed.error);
  } else if (opts.next === "proof_uploaded") {
    const uploaded = paymentStateAfterProof(current);
    if (!uploaded || !access.capabilities.collect) return fail(409, "Upload payment evidence before marking it received. A screenshot is not confirmation.");
  } else if (!access.capabilities.recordFinance) {
    return fail(403, "Only an authorised reviewer can change payment verification.");
  }
  const updated = await supabase.from("real_estate_transactions").update({ payment_evidence_status: opts.next }).eq("id", opts.transactionId).eq("client_id", opts.clientId).eq("payment_evidence_status", current).select("payment_evidence_status").maybeSingle();
  if (updated.error && unavailable(updated.error)) return fail(503, "Payment evidence tracking is not available until the foundation migration is applied.", "COMPLIANCE_FOUNDATION_UNAVAILABLE");
  if (!updated.data) return fail(409, "Payment status changed. Refresh and try again.");
  return { ok: true as const, paymentEvidenceStatus: updated.data.payment_evidence_status };
}

export async function recordLegalMilestone(opts: { clientId: string; session: SessionUser; transactionId: string; milestoneKey: string; done: boolean; note?: string | null }) {
  const access = await loadManagementAccess(opts.session, opts.clientId);
  if (!access.capabilities.recordConveyancing) return fail(403, "Conveyancing updates are limited to authorised staff.");
  if (opts.milestoneKey === "keys_handed_over" && opts.done) {
    return fail(400, "Handover does not confirm legal transfer. Record the legal milestone separately.");
  }
  const supabase = createAdminClient();
  const { data: txn } = await supabase.from("real_estate_transactions").select("id, legal_route, legal_transfer_status").eq("id", opts.transactionId).eq("client_id", opts.clientId).maybeSingle();
  if (!txn) return fail(404, "Transaction not found.");
  const existing = await supabase.from("real_estate_transaction_milestones").select("id, status").eq("client_id", opts.clientId).eq("transaction_id", opts.transactionId).eq("milestone_key", opts.milestoneKey).maybeSingle();
  if (existing.error && unavailable(existing.error)) return fail(503, "That milestone is not available until the foundation migration is applied.", "COMPLIANCE_FOUNDATION_UNAVAILABLE");
  const status = opts.done ? "done" : "in_progress";
  if (existing.data) {
    await supabase.from("real_estate_transaction_milestones").update({ status, notes: opts.note ?? null, completed_at: opts.done ? new Date().toISOString() : null }).eq("id", existing.data.id as string).eq("client_id", opts.clientId);
  } else {
    const inserted = await supabase.from("real_estate_transaction_milestones").insert({ client_id: opts.clientId, transaction_id: opts.transactionId, milestone_key: opts.milestoneKey, status, notes: opts.note ?? null, completed_at: opts.done ? new Date().toISOString() : null, sort_order: 80 });
    if (inserted.error) return fail(400, "That milestone is not available for this transaction.");
  }
  const legal = legalTransferAfterMilestone({
    milestoneKey: opts.milestoneKey,
    milestoneDone: opts.done,
    route: (txn.legal_route as LegalRoute | null) ?? null,
    current: (txn.legal_transfer_status as "not_started") ?? "not_started",
  });
  await supabase.from("real_estate_transactions").update({ legal_transfer_status: legal }).eq("id", opts.transactionId).eq("client_id", opts.clientId);
  return { ok: true as const, legalTransferStatus: legal };
}

export async function savePolicyVersion(opts: { clientId: string; session: SessionUser; templateKey: string; enforcement: { listing_publication?: boolean; allow_reuse?: boolean }; reviewNote: string; activate: boolean }) {
  const access = await loadManagementAccess(opts.session, opts.clientId);
  if (!access.capabilities.managePolicy) return fail(403, "You cannot change compliance policy.");
  const template = templateByKey(opts.templateKey);
  if (!template) return fail(400, "Unknown policy template.");
  if (opts.reviewNote.trim().length < 8) return fail(400, "Record who reviewed this policy and why it may be used.");
  const supabase = createAdminClient();
  const prior = await supabase.from("compliance_policy_versions").select("version").eq("client_id", opts.clientId).eq("template_key", opts.templateKey).order("version", { ascending: false }).limit(1).maybeSingle();
  if (prior.error && unavailable(prior.error)) return fail(503, "Compliance foundation migration is not applied.", "COMPLIANCE_FOUNDATION_UNAVAILABLE");
  const version = Number(prior.data?.version ?? 0) + 1;
  const inserted = await supabase.from("compliance_policy_versions").insert({
    client_id: opts.clientId,
    template_key: opts.templateKey,
    version,
    status: opts.activate ? "active" : "reviewed",
    definition: { requirements: template.requirements.map((item) => item.key), disclaimer: template.disclaimer },
    enforcement: { listing_publication: opts.enforcement.listing_publication === true, allow_reuse: opts.enforcement.allow_reuse === true },
    review_note: opts.reviewNote.trim().slice(0, 1000),
    activated_by: opts.activate ? access.actor.id : null,
    activated_at: opts.activate ? new Date().toISOString() : null,
    created_by: access.actor.id,
  }).select("id, version, status").maybeSingle();
  if (!inserted.data) return fail(500, "Could not save the policy version.");
  if (opts.activate) {
    await supabase.from("compliance_policy_versions").update({ status: "retired" }).eq("client_id", opts.clientId).eq("template_key", opts.templateKey).eq("status", "active").neq("id", inserted.data.id as string);
  }
  return { ok: true as const, policy: inserted.data };
}

export async function escalateCase(opts: { clientId: string; session: SessionUser; caseId: string; reason: string }) {
  const access = await loadManagementAccess(opts.session, opts.clientId);
  if (!access.capabilities.viewEscalation) return fail(403, "You cannot escalate a restricted review.");
  if (opts.reason.trim().length < 8) return fail(400, "Record the reason for escalation.");
  const result = await mutateComplianceCase({
    clientId: opts.clientId,
    caseId: opts.caseId,
    actor: access.actor,
    action: "require_edd",
    payload: { edd_reason: opts.reason.trim().slice(0, 1000) },
  });
  if (!result.ok) return fail(result.status, result.error);
  const supabase = createAdminClient();
  await supabase.from("compliance_cases").update({ readiness: "escalated" }).eq("id", opts.caseId).eq("client_id", opts.clientId);
  const reviewers = await supabase.from("users").select("id").eq("client_id", opts.clientId).eq("can_review_compliance", true).limit(20);
  const ids = (reviewers.data ?? []).map((user) => user.id as string);
  if (ids.length) {
    await supabase.from("notifications").insert(ids.map((user_id) => ({ user_id, type: "COMPLIANCE_ALERT", message: "A restricted compliance review needs attention.", read: false })));
  }
  return { ok: true as const };
}

export async function considerReuse(opts: { clientId: string; session: SessionUser; caseId: string }) {
  const access = await loadManagementAccess(opts.session, opts.clientId);
  if (!access.capabilities.viewSummary) return fail(403, "You cannot view compliance.");
  const supabase = createAdminClient();
  const { data: row } = await supabase.from("compliance_cases").select("id, contact_id, context, risk_level, cdd_profile").eq("id", opts.caseId).eq("client_id", opts.clientId).maybeSingle();
  if (!row || row.context === "property" || row.context === "transaction") return { ok: true as const, reuse: { allowed: false, reason: "Reuse applies to buyer or seller identity, not to a property or transaction file." } };
  const { data: prior } = await supabase.from("compliance_cases").select("id, status, approved_at, risk_level, cdd_profile").eq("client_id", opts.clientId).eq("contact_id", row.contact_id as string).eq("context", row.context as string).eq("status", "approved").neq("id", opts.caseId).order("approved_at", { ascending: false }).limit(1).maybeSingle();
  const policy = await supabase.from("compliance_policy_versions").select("enforcement").eq("client_id", opts.clientId).eq("status", "active").limit(1).maybeSingle();
  const enforcement = (policy.data?.enforcement as { allow_reuse?: boolean; reuse_validity_days?: number } | null) ?? {};
  const decision = verificationMayBeReused({
    sameOrganisation: true,
    sourceStatus: (prior?.status as string) ?? "missing",
    sourceApprovedAt: (prior?.approved_at as string | null) ?? null,
    validityDays: enforcement.reuse_validity_days ?? 365,
    now: new Date(),
    policyAllowsReuse: enforcement.allow_reuse === true,
    materialUnchanged: JSON.stringify(prior?.cdd_profile ?? {}) === JSON.stringify(row.cdd_profile ?? {}),
    sourceRisk: (prior?.risk_level as string) ?? "unclassified",
    nextRisk: (row.risk_level as string) ?? "unclassified",
  });
  if (decision.allowed && prior?.id) {
    await supabase.from("compliance_cases").update({ reused_from_case_id: prior.id }).eq("id", opts.caseId).eq("client_id", opts.clientId);
  }
  return { ok: true as const, reuse: { ...decision, sourceCaseId: decision.allowed ? prior?.id ?? null : null } };
}

export async function completeWorkItem(opts: { clientId: string; session: SessionUser; workItemId: string }) {
  const access = await loadManagementAccess(opts.session, opts.clientId);
  if (!access.capabilities.collect) return fail(403, "You cannot update this task.");
  const supabase = createAdminClient();
  const updated = await supabase.from("compliance_work_items").update({ status: "done", completed_at: new Date().toISOString() }).eq("id", opts.workItemId).eq("client_id", opts.clientId).eq("status", "open").select("id, requirement_id").maybeSingle();
  if (!updated.data) return fail(404, "Task not found.");
  return { ok: true as const, verifiedRequirement: false };
}

export async function revokeInvitation(opts: { clientId: string; session: SessionUser; invitationId: string }) {
  const access = await loadManagementAccess(opts.session, opts.clientId);
  if (!access.capabilities.invite) return fail(403, "You cannot revoke this request.");
  const supabase = createAdminClient();
  const updated = await supabase.from("compliance_invitations").update({ status: "revoked", revoked_at: new Date().toISOString() }).eq("id", opts.invitationId).eq("client_id", opts.clientId).in("status", ["created", "sent", "opened", "in_progress", "changes_requested"]).select("compliance_case_id").maybeSingle();
  if (!updated.data) return fail(404, "Request not found.");
  await supabase.from("compliance_case_events").insert({
    client_id: opts.clientId,
    compliance_case_id: updated.data.compliance_case_id,
    event_type: "INVITATION_REVOKED",
    summary: "A document request was revoked.",
    created_by: access.actor.id,
  });
  return { ok: true as const };
}

export function mobileComplianceDto(summary: { statusLabel?: string; readiness?: string; nextAction?: string; missing?: string[] } | null) {
  return {
    schemaVersion: 1,
    statusLabel: summary?.statusLabel ?? "Not started",
    readiness: summary?.readiness ?? "not_started",
    nextAction: summary?.nextAction ?? "Open the checklist.",
    missingCount: summary?.missing?.length ?? 0,
  };
}
