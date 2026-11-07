import { createHash, randomBytes } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { createSubjectActivity } from "@/lib/activities/subject-activity";
import { hashSecret, secretsMatch, newInvitationToken } from "@/lib/real-estate/compliance-management/engine";
import { evidenceAccessDecision } from "@/lib/real-estate/compliance-management/remediation";
import { canAccessAcquisition, duplicateContactCandidates } from "@/lib/real-estate/acquisition-plan";
import { createAcquisitionOpportunity, saveMandate, type AcquisitionActor } from "@/lib/real-estate/acquisition-service";
import { isAgencyManager } from "@/lib/real-estate/deal-access";
import { isPrivateDocumentStorageConfigured, putPrivateDocument, signPrivateDocument } from "@/lib/real-estate/private-document-storage";
import { intakePepper, sellerIntakeEnabled } from "@/lib/real-estate/seller-intake/flag";
import {
  answersFromClient,
  categoryMapping,
  exclusivityNote,
  fieldsForKind,
  mandateDates,
  mergeCorrection,
  missingInformation,
  moneyAmount,
  personName,
  submissionGaps,
  type IntakeKind,
} from "@/lib/real-estate/seller-intake/fields";
import { mandateFormLabels, mandateFormPhase, mandateFormPlace } from "@/lib/real-estate/mandate-form";
import { listingPartyPlan } from "@/lib/real-estate/seller-intake/parties";
import {
  INTAKE_LINK_TTL_MS,
  canReadSavedAnswers,
  canReviewIntake,
  canSeeRestrictedIntake,
  linkAccess,
  nextActionLabel,
  parseSellerSessionCookie,
  projectAnswers,
  publicFormProjection,
  sellerSessionCookieValue,
  type TokenPurpose,
} from "@/lib/real-estate/seller-intake/access";
import { renderMandatePdf } from "@/lib/real-estate/seller-intake/pdf";
import {
  complianceProfile,
  countsAsSignatureEvidence,
  initialDocumentScanStatus,
  intakeCommercialPlan,
  partyDrafts,
  recordDifferences,
  reviewCanFinish,
  signedUploadState,
  type IntakeSnapshot,
} from "@/lib/real-estate/seller-intake/review-plan";

type Fail = { ok: false; error: string; status: number };
type Row = Record<string, unknown>;
export type IntakeActor = AcquisitionActor;
export type DocumentStore = { put(key: string, body: Buffer): Promise<void> };

function fail(status: number, error: string): Fail {
  return { ok: false, error, status };
}

function disabled(): Fail | null {
  return sellerIntakeEnabled() ? null : fail(404, "Not found");
}

function pepperOrFail(): { ok: true; pepper: string } | Fail {
  const pepper = intakePepper();
  return pepper ? { ok: true, pepper } : fail(503, "Seller intake links are not configured.");
}

function db() {
  return createAdminClient();
}

function asRecord(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out: Record<string, string> = {};
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    if (typeof item === "string") out[key] = item;
  }
  return out;
}

function asClauses(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function asRejected(value: unknown): Array<{ group: string; instruction: string }> {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const group = (item as { group?: unknown }).group;
    const instruction = (item as { instruction?: unknown }).instruction;
    if (typeof group !== "string" || typeof instruction !== "string") return [];
    return [{ group, instruction }];
  });
}

async function event(clientId: string, requestId: string, eventType: string, actorId: string | null, payload: Row = {}) {
  await db().from("re_seller_intake_events").insert({
    client_id: clientId,
    request_id: requestId,
    event_type: eventType,
    actor_id: actorId,
    payload,
  });
}

function agentView(row: Row, template: Row | null) {
  return {
    id: row.id,
    status: row.status,
    nextAction: nextActionLabel(String(row.status)),
    kind: template?.kind ?? null,
    templateTitle: template?.title ?? null,
    templateVersion: template?.version ?? null,
    opportunityId: row.opportunity_id ?? null,
    contactId: row.contact_id ?? null,
    leadId: row.lead_id ?? null,
    publicReference: row.public_reference,
    expiresAt: row.token_expires_at,
    purpose: row.token_purpose,
    updatedAt: row.updated_at,
  };
}

async function loadTemplate(clientId: string, templateId: string) {
  const { data } = await db().from("re_seller_intake_templates").select("*").eq("id", templateId).eq("client_id", clientId).maybeSingle();
  return data as Row | null;
}

async function latestSubmission(requestId: string) {
  const { data } = await db().from("re_seller_intake_submissions").select("*").eq("request_id", requestId);
  const rows = (data ?? []) as Row[];
  return rows.sort((a, b) => Number(b.version) - Number(a.version))[0] ?? null;
}

export async function createIntakeTemplate(input: {
  clientId: string;
  actor: IntakeActor;
  kind: IntakeKind;
  title: string;
  clauses: string[];
  exclusivityMinimumMonths?: number | null;
  exclusivityContinuesUntilVaried?: boolean;
  organisationName?: string | null;
}) {
  const off = disabled();
  if (off) return off;
  if (!isAgencyManager(input.actor.role) || (input.actor.role !== "SUPER_ADMIN" && input.actor.clientId !== input.clientId)) {
    return fail(403, "Only a manager can approve a seller form template.");
  }
  const title = input.title.trim();
  if (title.length < 3 || title.length > 180) return fail(400, "Enter the template title.");
  const clauses = input.clauses.map((clause) => clause.trim()).filter(Boolean).slice(0, 40);
  if (clauses.some((clause) => clause.length > 4000)) return fail(400, "A clause is too long.");
  const months = input.kind === "sole" ? input.exclusivityMinimumMonths ?? null : null;
  if (months != null && (!Number.isInteger(months) || months < 1 || months > 60)) {
    return fail(400, "The exclusive period must be a whole number of months from the signature, or left blank.");
  }
  const { data: existing } = await db().from("re_seller_intake_templates").select("id, version, status").eq("client_id", input.clientId).eq("kind", input.kind);
  const versions = (existing ?? []) as Row[];
  const version = versions.reduce((max, row) => Math.max(max, Number(row.version) || 0), 0) + 1;
  for (const row of versions) {
    if (row.status === "approved") {
      await db().from("re_seller_intake_templates").update({ status: "retired" }).eq("id", row.id as string).eq("client_id", input.clientId);
    }
  }
  const { data, error } = await db().from("re_seller_intake_templates").insert({
    client_id: input.clientId,
    kind: input.kind,
    version,
    status: "approved",
    title,
    clauses,
    organisation_name: input.organisationName?.trim().slice(0, 180) || null,
    exclusivity_minimum_months: months,
    exclusivity_continues_until_varied: input.kind === "sole" && Boolean(input.exclusivityContinuesUntilVaried),
    created_by: input.actor.id,
  }).select("*").single();
  if (error || !data) return fail(500, error?.message ?? "Could not save the template.");
  return { ok: true as const, template: data };
}

export async function listIntakeTemplates(clientId: string, actor: IntakeActor) {
  const off = disabled();
  if (off) return off;
  if (actor.role !== "SUPER_ADMIN" && actor.clientId !== clientId) return fail(403, "Forbidden");
  const { data } = await db().from("re_seller_intake_templates").select("id, kind, version, status, title, organisation_name, exclusivity_minimum_months, exclusivity_continues_until_varied").eq("client_id", clientId).eq("status", "approved");
  return { ok: true as const, templates: data ?? [] };
}

export async function createSellerIntake(input: {
  clientId: string;
  actor: IntakeActor;
  templateId: string;
  opportunityId?: string | null;
  contactId?: string | null;
  leadId?: string | null;
}) {
  const off = disabled();
  if (off) return off;
  const peppered = pepperOrFail();
  if (!peppered.ok) return peppered;
  if (input.actor.role !== "SUPER_ADMIN" && input.actor.clientId !== input.clientId) return fail(403, "Forbidden");
  if (input.actor.role !== "SALESPERSON" && !isAgencyManager(input.actor.role)) return fail(403, "Forbidden");
  const template = await loadTemplate(input.clientId, input.templateId);
  if (!template || template.status !== "approved") return fail(404, "Choose an approved open or sole template.");
  const supabase = db();
  if (input.opportunityId) {
    const { data: opportunity } = await supabase.from("real_estate_acquisition_opportunities").select("id, client_id, assigned_agent_id, sourced_by_agent_id").eq("id", input.opportunityId).eq("client_id", input.clientId).maybeSingle();
    if (!opportunity) return fail(404, "Opportunity was not found in this organisation.");
    if (!canAccessAcquisition({
      role: input.actor.role,
      userId: input.actor.id,
      userClientId: input.actor.clientId,
      resourceClientId: input.clientId,
      assignedAgentId: opportunity.assigned_agent_id as string | null,
      sourcedByAgentId: opportunity.sourced_by_agent_id as string | null,
    })) return fail(403, "Forbidden");
  }
  if (input.contactId) {
    const { data: contact } = await supabase.from("contacts").select("id").eq("id", input.contactId).eq("client_id", input.clientId).maybeSingle();
    if (!contact) return fail(404, "Contact was not found in this organisation.");
  }
  if (input.leadId) {
    const { data: lead } = await supabase.from("leads").select("id").eq("id", input.leadId).eq("client_id", input.clientId).maybeSingle();
    if (!lead) return fail(404, "Conversation was not found in this organisation.");
  }
  const token = newInvitationToken();
  const expires = new Date(Date.now() + INTAKE_LINK_TTL_MS).toISOString();
  const { data, error } = await supabase.from("re_seller_intake_requests").insert({
    client_id: input.clientId,
    template_id: template.id,
    opportunity_id: input.opportunityId ?? null,
    contact_id: input.contactId ?? null,
    lead_id: input.leadId ?? null,
    responsible_agent_id: input.actor.id,
    status: "draft_link",
    token_hash: hashSecret(token, peppered.pepper),
    token_expires_at: expires,
    token_purpose: "initial",
    version: 1,
    public_reference: `SI-${randomBytes(4).toString("hex")}`,
    created_by: input.actor.id,
  }).select("*").single();
  if (error || !data) return fail(500, error?.message ?? "Could not create the seller form.");
  await event(input.clientId, data.id as string, "link_created", input.actor.id, { purpose: "initial" });
  return { ok: true as const, request: agentView(data as Row, template), token, expiresAt: expires };
}

export async function listSellerIntakes(input: {
  clientId: string;
  actor: IntakeActor;
  opportunityId?: string | null;
  contactId?: string | null;
  leadId?: string | null;
}) {
  const off = disabled();
  if (off) return off;
  if (input.actor.role !== "SUPER_ADMIN" && input.actor.clientId !== input.clientId) return fail(403, "Forbidden");
  let query = db().from("re_seller_intake_requests").select("*").eq("client_id", input.clientId);
  if (input.actor.role === "SALESPERSON") query = query.eq("responsible_agent_id", input.actor.id);
  if (input.opportunityId) query = query.eq("opportunity_id", input.opportunityId);
  if (input.contactId) query = query.eq("contact_id", input.contactId);
  if (input.leadId) query = query.eq("lead_id", input.leadId);
  const { data, error } = await query;
  if (error) return fail(500, error.message);
  const requests = [];
  for (const row of (data ?? []) as Row[]) {
    const template = await loadTemplate(input.clientId, String(row.template_id));
    requests.push(agentView(row, template));
  }
  return { ok: true as const, requests };
}

export async function listMandateForms(input: { clientId: string; actor: IntakeActor }) {
  const listed = await listSellerIntakes(input);
  if (!listed.ok) return listed;
  const forms = [];
  for (const request of listed.requests) {
    const submission = await latestSubmission(String(request.id));
    const answers = asRecord(submission?.answers);
    const labels = mandateFormLabels(answers);
    const kind = (request.kind as IntakeKind | null) ?? null;
    forms.push({
      id: request.id,
      phase: mandateFormPhase(String(request.status)),
      status: request.status,
      kind,
      sellerName: labels.sellerName,
      property: labels.property,
      expiryDate: kind ? mandateDates(kind, answers).expiryDate : null,
      contactId: request.contactId,
      opportunityId: request.opportunityId,
      publicReference: request.publicReference,
      updatedAt: request.updatedAt,
    });
  }
  forms.sort((a, b) => String(b.updatedAt ?? "").localeCompare(String(a.updatedAt ?? "")));
  return { ok: true as const, forms };
}

export async function openMandateForm(input: { clientId: string; requestId: string; actor: IntakeActor }) {
  const off = disabled();
  if (off) return off;
  const loaded = await loadOwnedRequest(input.clientId, input.requestId, input.actor);
  if (!loaded.ok) return loaded;
  const request = loaded.request;
  const template = await loadTemplate(input.clientId, String(request.template_id));
  const submission = await latestSubmission(String(request.id));
  const answers = asRecord(submission?.answers);
  const kind = (template?.kind as IntakeKind | null) ?? null;
  const labels = mandateFormLabels(answers);
  const expiryDate = kind ? mandateDates(kind, answers).expiryDate : null;
  const phase = mandateFormPhase(String(request.status));
  const base = {
    phase,
    sellerName: labels.sellerName,
    property: labels.property,
    kind,
    expiryDate,
    contactId: (request.contact_id as string | null) ?? null,
    opportunityId: (request.opportunity_id as string | null) ?? null,
    listingId: null as string | null,
  };
  if (phase !== "complete") return { ok: true as const, ...base };

  let contactId = base.contactId;
  let opportunityId = base.opportunityId;
  if (!contactId) {
    const phone = answers.cell || answers.representativePhone || null;
    const { data: contacts } = await db().from("contacts").select("id, name, phone").eq("client_id", input.clientId).limit(200);
    const matches = duplicateContactCandidates(contacts ?? [], phone, personName(answers));
    if (matches.length === 1) contactId = matches[0].id as string;
  }
  if (!opportunityId) {
    const place = mandateFormPlace(answers.propertyAddress || null);
    const created = await createAcquisitionOpportunity({
      clientId: input.clientId,
      actor: input.actor,
      contactId,
      ownerName: labels.sellerName === "Seller" ? personName(answers) : labels.sellerName,
      ownerPhone: answers.cell || answers.representativePhone || null,
      address: answers.propertyAddress?.slice(0, 500) || null,
      suburb: place.suburb,
      city: place.city,
      intent: "sale",
      source: "other",
      propertyCategory: categoryMapping(answers.propertyCategory).platform,
      notes: answers.propertyDescription?.slice(0, 2000) || null,
      confirmNewContact: !contactId,
      idempotencyKey: `seller-intake:${request.id}`,
    });
    if (!created.ok) return fail(created.status, created.error);
    opportunityId = created.opportunity.id as string;
    contactId = (created.opportunity.contact_id as string | null) ?? contactId;
    await db().from("re_seller_intake_requests").update({
      contact_id: contactId,
      opportunity_id: opportunityId,
      updated_at: new Date().toISOString(),
    }).eq("id", request.id as string).eq("client_id", input.clientId);
  }
  const price = moneyAmount(answers.askingPrice);
  if (opportunityId) {
    const { data: existingParties } = await db().from("re_acquisition_parties").select("id").eq("request_id", request.id as string).limit(1);
    if (!existingParties?.length) {
      for (const party of partyDrafts({ answers, personContactId: contactId, negotiatorName: input.actor.name })) {
        await db().from("re_acquisition_parties").insert({
          client_id: input.clientId,
          opportunity_id: opportunityId,
          request_id: request.id,
          role: party.role,
          party_kind: party.partyKind,
          contact_id: party.contactId,
          display_name: party.displayName,
          details: { registered_owner_is_contact: party.role === "registered_owner" && party.partyKind === "individual" },
        });
      }
    }
    if (price != null) {
      await db().from("real_estate_acquisition_opportunities").update({ expected_price: price }).eq("id", opportunityId).eq("client_id", input.clientId);
      const note = `seller-intake:${request.id}:asking`;
      const { data: priceRow } = await db().from("real_estate_price_discussions").select("id").eq("opportunity_id", opportunityId).eq("notes", note).maybeSingle();
      if (!priceRow) {
        await db().from("real_estate_price_discussions").insert({
          client_id: input.clientId,
          opportunity_id: opportunityId,
          amount: price,
          currency: "USD",
          price_type: "owner_asking",
          notes: note,
          recorded_by: input.actor.id,
        });
      }
    }
  }
  const { data: opportunity } = await db()
    .from("real_estate_acquisition_opportunities")
    .select("converted_listing_id, assigned_agent_id, address, suburb, property_category")
    .eq("id", opportunityId as string)
    .eq("client_id", input.clientId)
    .maybeSingle();
  let listingId = (opportunity?.converted_listing_id as string | null) ?? null;
  if (!listingId && opportunityId) {
    const now = new Date().toISOString();
    const category = categoryMapping(answers.propertyCategory).platform ?? (opportunity?.property_category as string | null) ?? null;
    const { data: listing, error } = await db().from("listings").insert({
      client_id: input.clientId,
      agent_id: (opportunity?.assigned_agent_id as string | null) ?? input.actor.id,
      acquisition_opportunity_id: opportunityId,
      transaction_type: "sale",
      status: "reserved",
      approval_status: "draft",
      price,
      address: answers.propertyAddress?.slice(0, 500) || (opportunity?.address as string | null) || null,
      suburb: (opportunity?.suburb as string | null) ?? mandateFormPlace(answers.propertyAddress || null).suburb,
      description: answers.propertyDescription?.slice(0, 4000) || null,
      ...(category ? { property_category: category } : {}),
      photos: [],
      created_at: now,
      updated_at: now,
    }).select("id").single();
    if (error || !listing) return fail(500, error?.message ?? "The seller is open. The draft listing did not finish.");
    listingId = listing.id as string;
    const { data: winner } = await db()
      .from("real_estate_acquisition_opportunities")
      .select("converted_listing_id")
      .eq("id", opportunityId)
      .eq("client_id", input.clientId)
      .maybeSingle();
    if (winner?.converted_listing_id) {
      await db().from("listings").delete().eq("id", listingId).eq("client_id", input.clientId).eq("approval_status", "draft");
      listingId = winner.converted_listing_id as string;
    } else {
      await db().from("real_estate_acquisition_opportunities").update({
        converted_listing_id: listingId,
        stage: "listing_preparation",
        updated_at: now,
      }).eq("id", opportunityId).eq("client_id", input.clientId);
    }
    const copies = listingPartyPlan({
      contactId,
      parties: partyDrafts({ answers, personContactId: contactId, negotiatorName: input.actor.name }).map((party) => ({
        role: party.role,
        partyKind: party.partyKind,
        contactId: party.contactId,
        displayName: party.displayName,
      })),
    });
    for (const copy of copies) {
      const { data: existingParty } = await db()
        .from("real_estate_listing_parties")
        .select("id")
        .eq("listing_id", listingId)
        .eq("contact_id", copy.contactId)
        .eq("party_role", copy.partyRole)
        .maybeSingle();
      if (existingParty) continue;
      await db().from("real_estate_listing_parties").insert({
        client_id: input.clientId,
        listing_id: listingId,
        contact_id: copy.contactId,
        party_role: copy.partyRole,
        verification_status: "reported",
        source: "acquisition",
      });
    }
  }
  return { ok: true as const, ...base, contactId, opportunityId, listingId };
}

async function loadOwnedRequest(clientId: string, requestId: string, actor: IntakeActor) {
  const { data } = await db().from("re_seller_intake_requests").select("*").eq("id", requestId).eq("client_id", clientId).maybeSingle();
  if (!data) return fail(404, "Not found");
  if (!canReviewIntake({
    role: actor.role,
    userId: actor.id,
    userClientId: actor.clientId,
    resourceClientId: clientId,
    responsibleAgentId: data.responsible_agent_id as string,
  })) return fail(403, "Forbidden");
  return { ok: true as const, request: data as Row };
}

export async function getSellerIntake(input: { clientId: string; requestId: string; actor: IntakeActor }) {
  const off = disabled();
  if (off) return off;
  const loaded = await loadOwnedRequest(input.clientId, input.requestId, input.actor);
  if (!loaded.ok) return loaded;
  const request = loaded.request;
  const template = await loadTemplate(input.clientId, String(request.template_id));
  const submission = await latestSubmission(String(request.id));
  const answers = asRecord(submission?.answers);
  const kind = (template?.kind as IntakeKind) ?? "open";
  const restricted = canSeeRestrictedIntake({ role: input.actor.role, userClientId: input.actor.clientId, resourceClientId: input.clientId });
  const projected = projectAnswers({ kind, answers, canSeeRestricted: restricted, includeValues: true });
  const { data: review } = await db().from("re_seller_intake_reviews").select("*").eq("request_id", request.id).maybeSingle();
  const { data: documents } = await db().from("re_seller_intake_documents").select("id, signature_state, scan_status, content_sha256, submission_version, created_at").eq("client_id", input.clientId).eq("request_id", request.id);
  const { data: parties } = await db().from("re_acquisition_parties").select("role, party_kind, display_name, contact_id").eq("client_id", input.clientId).eq("request_id", request.id);
  let duplicates: Array<{ id: string; name: string | null; phone: string | null }> = [];
  if (!request.contact_id && (answers.cell || answers.representativePhone || answers.registeredOwner)) {
    const { data: contacts } = await db().from("contacts").select("id, name, phone").eq("client_id", input.clientId).limit(200);
    duplicates = duplicateContactCandidates(contacts ?? [], answers.cell || answers.representativePhone, personName(answers))
      .slice(0, 5)
      .map((row) => ({ id: row.id, name: row.name, phone: row.phone }));
  }
  return {
    ok: true as const,
    request: agentView(request, template),
    fields: projected.fields,
    restrictedPending: projected.restrictedPending,
    canSeeRestricted: restricted,
    submissionVersion: Number(submission?.version ?? 0),
    missing: missingInformation(kind, answers),
    duplicates,
    parties: parties ?? [],
    documents: ((documents ?? []) as Row[]).map((row) => ({
      id: row.id,
      signatureState: row.signature_state,
      scanStatus: row.scan_status,
      countsAsSignature: countsAsSignatureEvidence({
        signatureState: row.signature_state as "prepared_unsigned",
        scanStatus: String(row.scan_status),
      }),
      downloadable: evidenceAccessDecision(String(row.scan_status)).allowBytes,
      version: row.submission_version,
    })),
    review: review ? { outcome: (review as Row).outcome, appliedAt: (review as Row).applied_at, error: (review as Row).error, mandateId: (review as Row).mandate_id, opportunityId: (review as Row).opportunity_id, complianceCaseId: (review as Row).compliance_case_id, contactId: (review as Row).contact_id } : null,
    mandateApprovalGranted: false,
  };
}

export async function loadSellerIntakeRecord(input: { clientId: string; requestId: string; actor: IntakeActor }) {
  const off = disabled();
  if (off) return off;
  const loaded = await loadOwnedRequest(input.clientId, input.requestId, input.actor);
  if (!loaded.ok) return loaded;
  const template = await loadTemplate(input.clientId, String(loaded.request.template_id));
  const submission = await latestSubmission(input.requestId);
  const { data: client } = await db()
    .from("clients")
    .select("name, logo_url, primary_color, website, meta_whatsapp_display_number")
    .eq("id", input.clientId)
    .maybeSingle();
  const kind: IntakeKind = template?.kind === "sole" ? "sole" : "open";
  return {
    ok: true as const,
    kind,
    answers: asRecord(submission?.answers),
    restrictedPending: false,
    templateTitle: typeof template?.title === "string" ? template.title : null,
    submittedAt: typeof submission?.submitted_at === "string" ? submission.submitted_at : null,
    agencyName: typeof client?.name === "string" && client.name.trim() ? client.name.trim() : "Agency",
    logoUrl: typeof client?.logo_url === "string" ? client.logo_url : null,
    brandColor: typeof client?.primary_color === "string" ? client.primary_color : null,
    website: typeof client?.website === "string" ? client.website : null,
    phone: typeof client?.meta_whatsapp_display_number === "string" ? client.meta_whatsapp_display_number : null,
  };
}

async function replaceToken(request: Row, actor: IntakeActor, purpose: TokenPurpose, status: string) {
  const peppered = pepperOrFail();
  if (!peppered.ok) return peppered;
  const token = newInvitationToken();
  const expires = new Date(Date.now() + INTAKE_LINK_TTL_MS).toISOString();
  if (request.token_hash) {
    await db().from("re_seller_intake_revoked_tokens").insert({
      token_hash: request.token_hash,
      client_id: request.client_id,
      request_id: request.id,
    });
  }
  if (request.session_hash) {
    await db().from("re_seller_intake_revoked_sessions").insert({
      session_hash: request.session_hash,
      client_id: request.client_id,
      request_id: request.id,
    });
  }
  const { data, error } = await db().from("re_seller_intake_requests").update({
    token_hash: hashSecret(token, peppered.pepper),
    token_expires_at: expires,
    token_purpose: purpose,
    session_hash: null,
    session_expires_at: null,
    status,
    updated_at: new Date().toISOString(),
  }).eq("id", request.id as string).eq("client_id", request.client_id as string).select("*").maybeSingle();
  if (error || !data) return fail(500, error?.message ?? "Could not replace the link.");
  await event(String(request.client_id), String(request.id), "link_reissued", actor.id, {
    purpose,
    previousPurpose: request.token_purpose,
    sessionCleared: true,
  });
  return { ok: true as const, request: data as Row, token, expiresAt: expires };
}

export async function revokeSellerIntake(input: { clientId: string; requestId: string; actor: IntakeActor }) {
  const off = disabled();
  if (off) return off;
  const loaded = await loadOwnedRequest(input.clientId, input.requestId, input.actor);
  if (!loaded.ok) return loaded;
  if (loaded.request.status === "accepted") return fail(409, "An accepted intake keeps its records. Revoke does not delete them.");
  if (loaded.request.token_hash) {
    await db().from("re_seller_intake_revoked_tokens").insert({
      token_hash: loaded.request.token_hash,
      client_id: input.clientId,
      request_id: input.requestId,
    });
  }
  if (loaded.request.session_hash) {
    await db().from("re_seller_intake_revoked_sessions").insert({
      session_hash: loaded.request.session_hash,
      client_id: input.clientId,
      request_id: input.requestId,
    });
  }
  const { error } = await db().from("re_seller_intake_requests").update({
    status: "revoked",
    token_hash: null,
    session_hash: null,
    session_expires_at: null,
    updated_at: new Date().toISOString(),
  }).eq("id", input.requestId).eq("client_id", input.clientId);
  if (error) return fail(500, error.message);
  await event(input.clientId, input.requestId, "link_revoked", input.actor.id, {});
  return { ok: true as const, status: "revoked" as const };
}

export async function reissueSellerIntake(input: {
  clientId: string;
  requestId: string;
  actor: IntakeActor;
  purpose?: "resume" | "initial";
}) {
  const off = disabled();
  if (off) return off;
  const loaded = await loadOwnedRequest(input.clientId, input.requestId, input.actor);
  if (!loaded.ok) return loaded;
  if (loaded.request.status === "accepted" || loaded.request.status === "revoked") {
    return fail(409, "Issue a new seller form. This one is closed.");
  }
  const purpose: TokenPurpose = input.purpose === "resume" ? "resume" : "initial";
  const replaced = await replaceToken(loaded.request, input.actor, purpose, String(loaded.request.status));
  if (!replaced.ok) return replaced;
  const template = await loadTemplate(input.clientId, String(loaded.request.template_id));
  return {
    ok: true as const,
    request: agentView(replaced.request, template),
    token: replaced.token,
    expiresAt: replaced.expiresAt,
    behaviour: purpose === "resume"
      ? "The previous link and browser session no longer open this form. This resume link can show the answers already saved on this request."
      : "The previous link and browser session no longer open this form. This new link starts blank and does not show saved answers until this browser saves them.",
  };
}

export async function requestIntakeCorrections(input: {
  clientId: string;
  requestId: string;
  actor: IntakeActor;
  groups: string[];
  instruction: string;
}) {
  const off = disabled();
  if (off) return off;
  const loaded = await loadOwnedRequest(input.clientId, input.requestId, input.actor);
  if (!loaded.ok) return loaded;
  if (loaded.request.status !== "submitted" && loaded.request.status !== "changes_requested") {
    return fail(409, "Ask for corrections after the seller has submitted the form.");
  }
  const instruction = input.instruction.trim();
  if (instruction.length < 8 || instruction.length > 1000) return fail(400, "Write what the seller should correct.");
  const template = await loadTemplate(input.clientId, String(loaded.request.template_id));
  const known = new Set(fieldsForKind((template?.kind as IntakeKind) ?? "open").map((field) => field.group));
  const groups = [...new Set(input.groups)].filter((group) => known.has(group as never));
  if (!groups.length) return fail(400, "Choose the sections to correct.");
  const current = await latestSubmission(input.requestId);
  if (!current) return fail(409, "There is no submission to correct.");
  const answers = asRecord(current.answers);
  const accepted = [...known].filter((group) => !groups.includes(group));
  const version = Number(current.version) + 1;
  const { error } = await db().from("re_seller_intake_submissions").insert({
    client_id: input.clientId,
    request_id: input.requestId,
    version,
    answers,
    accepted_groups: accepted,
    rejected_groups: groups.map((group) => ({ group, instruction })),
  });
  if (error) return fail(500, error.message);
  const replaced = await replaceToken(loaded.request, input.actor, "correction", "changes_requested");
  if (!replaced.ok) return replaced;
  return {
    ok: true as const,
    request: agentView(replaced.request, template),
    token: replaced.token,
    expiresAt: replaced.expiresAt,
    behaviour: "The previous link and browser session are revoked. This correction link shows the accepted sections and asks only for the rejected sections.",
  };
}

async function sessionMatchesRequest(request: Row, cookie: string | null, pepper: string) {
  const parsed = parseSellerSessionCookie(cookie, String(request.id));
  if (!parsed || !request.session_hash) return false;
  if (request.session_expires_at && new Date(String(request.session_expires_at)).getTime() <= Date.now()) return false;
  const hash = hashSecret(parsed.secret, pepper);
  const { data: revoked } = await db().from("re_seller_intake_revoked_sessions").select("session_hash").eq("session_hash", hash).eq("request_id", request.id).maybeSingle();
  if (revoked) return false;
  return secretsMatch(parsed.secret, pepper, String(request.session_hash));
}

async function requestByToken(token: string) {
  const peppered = pepperOrFail();
  if (!peppered.ok) return peppered;
  const hash = hashSecret(token, peppered.pepper);
  const { data: revoked } = await db().from("re_seller_intake_revoked_tokens").select("request_id").eq("token_hash", hash).maybeSingle();
  if (revoked) return fail(410, "This link is not available.");
  const { data } = await db().from("re_seller_intake_requests").select("*").eq("token_hash", hash).maybeSingle();
  if (!data) return fail(404, "This link is not available.");
  return { ok: true as const, request: data as Row, pepper: peppered.pepper };
}

export async function publicSellerIntake(input: { token: string; sessionToken: string | null; now?: Date }) {
  const off = disabled();
  if (off) return off;
  const loaded = await requestByToken(input.token);
  if (!loaded.ok) return loaded;
  const request = loaded.request;
  const access = linkAccess({
    status: String(request.status),
    expiresAt: (request.token_expires_at as string | null) ?? null,
    revokedAt: request.status === "revoked" ? new Date().toISOString() : null,
    now: input.now ?? new Date(),
  });
  if (!access.ok) return fail(410, "This link is not available.");
  const template = await loadTemplate(String(request.client_id), String(request.template_id));
  if (!template) return fail(404, "This link is not available.");
  const submission = await latestSubmission(String(request.id));
  const answers = asRecord(submission?.answers);
  const purpose = (request.token_purpose as TokenPurpose) ?? "initial";
  const sessionMatches = await sessionMatchesRequest(request, input.sessionToken, loaded.pepper);
  const canRead = canReadSavedAnswers({ purpose, sessionMatches });
  const kind = template.kind as IntakeKind;
  const { data: client } = await db().from("clients").select("name, logo_url, website, meta_whatsapp_display_number").eq("id", request.client_id).maybeSingle();
  const organisationName = (template.organisation_name as string | null)?.trim() || (client?.name as string | null)?.trim() || null;
  return {
    ok: true as const,
    version: Number(submission?.version ?? 0),
    status: request.status,
    form: publicFormProjection({
      kind,
      purpose,
      answers,
      acceptedGroups: Array.isArray(submission?.accepted_groups) ? submission.accepted_groups as string[] : [],
      rejected: asRejected(submission?.rejected_groups),
      canRead,
      templateTitle: String(template.title),
      clauses: asClauses(template.clauses),
      exclusivityNote: exclusivityNote({
        kind,
        minimumMonths: (template.exclusivity_minimum_months as number | null) ?? null,
        continuesUntilVaried: Boolean(template.exclusivity_continues_until_varied),
      }),
      agencyName: organisationName,
      logoUrl: (client?.logo_url as string | null) ?? null,
      websiteUrl: (client?.website as string | null) ?? null,
      phone: (client?.meta_whatsapp_display_number as string | null) ?? null,
    }),
  };
}

export async function savePublicSellerIntake(input: {
  token: string;
  sessionToken: string | null;
  answers: unknown;
  version: number | null;
  submit: boolean;
  now?: Date;
}) {
  const off = disabled();
  if (off) return off;
  const viewed = await publicSellerIntake({ token: input.token, sessionToken: input.sessionToken, now: input.now });
  if (!viewed.ok) return viewed;
  const loaded = await requestByToken(input.token);
  if (!loaded.ok) return loaded;
  const request = loaded.request;
  if (request.status === "submitted" || request.status === "review_applying" || request.status === "review_incomplete" || request.status === "accepted") {
    const current = await latestSubmission(String(request.id));
    return { ok: true as const, idempotent: true, version: Number(current?.version ?? viewed.version), status: request.status, sessionToken: null as string | null };
  }
  const template = await loadTemplate(String(request.client_id), String(request.template_id));
  if (!template) return fail(404, "This link is not available.");
  const kind = template.kind as IntakeKind;
  const current = await latestSubmission(String(request.id));
  const previous = asRecord(current?.answers);
  const purpose = request.token_purpose as TokenPurpose;
  const sessionMatches = await sessionMatchesRequest(request, input.sessionToken, loaded.pepper);
  if (current && Object.values(previous).some(Boolean) && !canReadSavedAnswers({ purpose, sessionMatches })) {
    return fail(409, "This form was already started in another browser. Ask the agent for a resume link.");
  }
  if (current && input.version !== Number(current.version)) {
    return fail(409, "This form changed in another session. Reload it and continue.");
  }
  let answers = answersFromClient(kind, input.answers);
  if (purpose === "correction") {
    answers = mergeCorrection(previous, answers, Array.isArray(current?.accepted_groups) ? current.accepted_groups as string[] : []);
  }
  if (input.submit) {
    const gaps = submissionGaps(kind, answers);
    if (gaps.length) return fail(400, `Still needed: ${gaps.join(", ")}`);
  }
  const version = current ? Number(current.version) + 1 : 1;
  const snapshot: IntakeSnapshot | null = input.submit
    ? {
        templateId: String(template.id),
        templateVersion: Number(template.version),
        kind,
        title: String(template.title),
        clauses: asClauses(template.clauses),
        exclusivityMinimumMonths: (template.exclusivity_minimum_months as number | null) ?? null,
        exclusivityContinuesUntilVaried: Boolean(template.exclusivity_continues_until_varied),
        organisationName: (template.organisation_name as string | null) ?? null,
        answers,
        submittedAt: (input.now ?? new Date()).toISOString(),
      }
    : null;
  const saved = current
    ? await db().from("re_seller_intake_submissions").update({
        answers,
        version,
        snapshot,
        submitted_at: input.submit ? (input.now ?? new Date()).toISOString() : null,
      }).eq("id", current.id as string).eq("client_id", request.client_id as string).eq("version", Number(current.version)).select("id, version").maybeSingle()
    : await db().from("re_seller_intake_submissions").insert({
        client_id: request.client_id,
        request_id: request.id,
        version,
        answers,
        snapshot,
        submitted_at: input.submit ? (input.now ?? new Date()).toISOString() : null,
      }).select("id, version").single();
  if (saved.error || !saved.data) return fail(saved.error ? 500 : 409, saved.error?.message ?? "This form changed in another session. Reload it and continue.");
  let sessionToken: string | null = null;
  const patch: Row = {
    status: input.submit ? "submitted" : "in_progress",
    updated_at: new Date().toISOString(),
  };
  if (!request.session_hash || !sessionMatches) {
    const secret = newInvitationToken();
    sessionToken = sellerSessionCookieValue(String(request.id), secret);
    patch.session_hash = hashSecret(secret, loaded.pepper);
    patch.session_expires_at = request.token_expires_at;
  }
  await db().from("re_seller_intake_requests").update(patch).eq("id", request.id as string).eq("client_id", request.client_id as string);
  await event(String(request.client_id), String(request.id), input.submit ? "submitted" : "draft_saved", null, { version });
  return { ok: true as const, idempotent: false, version, status: patch.status, sessionToken };
}

async function claim(request: Row) {
  const nextVersion = Number(request.version ?? 1) + 1;
  const rpc = await db().rpc("re_seller_intake_claim_review", {
    p_request: request.id,
    p_client: request.client_id,
    p_version: Number(request.version ?? 1),
  });
  const rpcRow = Array.isArray(rpc.data) ? rpc.data[0] : rpc.data;
  if (rpcRow && typeof rpcRow === "object" && "id" in (rpcRow as Row)) return rpcRow as Row;
  const { data } = await db().from("re_seller_intake_requests").update({
    status: "review_applying",
    version: nextVersion,
    updated_at: new Date().toISOString(),
  }).eq("id", request.id as string).eq("client_id", request.client_id as string).eq("version", Number(request.version ?? 1)).in("status", ["submitted", "review_incomplete"]).select("*").maybeSingle();
  return (data as Row | null) ?? null;
}

async function remember(clientId: string, requestId: string, reviewerId: string, version: number, patch: Row) {
  const { data: existing } = await db().from("re_seller_intake_reviews").select("id").eq("request_id", requestId).maybeSingle();
  if (existing) {
    await db().from("re_seller_intake_reviews").update({ ...patch, updated_at: new Date().toISOString() }).eq("request_id", requestId).eq("client_id", clientId);
    return;
  }
  await db().from("re_seller_intake_reviews").insert({
    client_id: clientId,
    request_id: requestId,
    reviewer_id: reviewerId,
    submission_version: version,
    ...patch,
  });
}

export async function acceptIntakeReview(input: {
  clientId: string;
  requestId: string;
  actor: IntakeActor;
  submissionVersion: number;
  linkContactId?: string | null;
  confirmNewContact?: boolean;
  confirmChanges?: boolean;
  store?: DocumentStore;
  now?: Date;
}) {
  const off = disabled();
  if (off) return off;
  const loaded = await loadOwnedRequest(input.clientId, input.requestId, input.actor);
  if (!loaded.ok) return loaded;
  const { data: prior } = await db().from("re_seller_intake_reviews").select("*").eq("request_id", input.requestId).eq("client_id", input.clientId).maybeSingle();
  if (prior && (prior as Row).applied_at && (prior as Row).outcome === "accepted") {
    return {
      ok: true as const,
      idempotent: true,
      contactId: (prior as Row).contact_id,
      opportunityId: (prior as Row).opportunity_id,
      mandateId: (prior as Row).mandate_id,
      documentId: (prior as Row).document_id,
      complianceCaseId: (prior as Row).compliance_case_id,
    };
  }
  if (loaded.request.status === "review_applying") return fail(409, "Another review is already applying this intake.");
  if (loaded.request.status !== "submitted" && loaded.request.status !== "review_incomplete") {
    return fail(409, "Review the intake after the seller submits it.");
  }
  const submission = await latestSubmission(input.requestId);
  const snapshot = submission?.snapshot as IntakeSnapshot | null;
  if (!submission || !snapshot?.answers) return fail(409, "The submitted snapshot is missing.");
  if (Number(submission.version) !== input.submissionVersion) return fail(409, "The submission changed. Reload the review.");
  const plan = intakeCommercialPlan(snapshot);
  const supabase = db();
  let contactId = (input.linkContactId ?? (loaded.request.contact_id as string | null) ?? (prior as Row | null)?.contact_id ?? null) as string | null;
  if (contactId) {
    const { data: contact } = await supabase.from("contacts").select("id, name, phone, email").eq("id", contactId).eq("client_id", input.clientId).maybeSingle();
    if (!contact) return fail(404, "Contact was not found in this organisation.");
    const differences = recordDifferences(
      { name: contact.name as string | null, phone: contact.phone as string | null, email: contact.email as string | null },
      { name: plan.personName, phone: plan.phone, email: plan.email }
    );
    if (differences.length && !input.confirmChanges) {
      return { ok: false as const, status: 409 as const, error: "Confirm the changes to the existing contact.", differences };
    }
  } else if (!input.confirmNewContact) {
    const { data: contacts } = await supabase.from("contacts").select("id, name, phone").eq("client_id", input.clientId).limit(200);
    const duplicates = duplicateContactCandidates(contacts ?? [], plan.phone, plan.personName).slice(0, 5);
    if (duplicates.length) {
      return {
        ok: false as const,
        status: 409 as const,
        error: "A similar contact already exists. Select them or confirm a new contact.",
        duplicates: duplicates.map((row) => ({ id: row.id, name: row.name, phone: row.phone })),
      };
    }
  }
  const existingOpportunityId = ((prior as Row | null)?.opportunity_id as string | null) ?? (loaded.request.opportunity_id as string | null) ?? null;
  if (existingOpportunityId) {
    const { data: opportunity } = await supabase.from("real_estate_acquisition_opportunities").select("owner_name, address").eq("id", existingOpportunityId).eq("client_id", input.clientId).maybeSingle();
    const differences = recordDifferences(
      { owner_name: opportunity?.owner_name as string | null, address: opportunity?.address as string | null },
      { owner_name: plan.ownerName, address: plan.address }
    );
    if (differences.length && !input.confirmChanges) {
      return { ok: false as const, status: 409 as const, error: "Confirm the changes to the existing property.", differences };
    }
  }
  const claimed = await claim(loaded.request);
  if (!claimed) {
    const again = await db().from("re_seller_intake_reviews").select("*").eq("request_id", input.requestId).maybeSingle();
    if (again.data && (again.data as Row).applied_at) {
      const row = again.data as Row;
      return { ok: true as const, idempotent: true, contactId: row.contact_id, opportunityId: row.opportunity_id, mandateId: row.mandate_id, documentId: row.document_id, complianceCaseId: row.compliance_case_id };
    }
    return fail(409, "Another review is already applying this intake.");
  }
  try {
    let opportunityId = ((prior as Row | null)?.opportunity_id as string | null) ?? (loaded.request.opportunity_id as string | null) ?? null;
    if (!contactId && plan.company) {
      const createdContact = await supabase.from("contacts").insert({
        client_id: input.clientId,
        name: plan.personName,
        phone: plan.phone,
        email: plan.email,
      }).select("id").single();
      if (createdContact.error || !createdContact.data) throw new Error(createdContact.error?.message ?? "Could not record the representative.");
      contactId = createdContact.data.id as string;
      await remember(input.clientId, input.requestId, input.actor.id, input.submissionVersion, { contact_id: contactId, opportunity_id: opportunityId });
    }
    if (!opportunityId) {
      const created = await createAcquisitionOpportunity({
        clientId: input.clientId,
        actor: input.actor,
        contactId,
        ownerName: plan.ownerName,
        ownerPhone: plan.phone,
        address: plan.address?.slice(0, 500) ?? null,
        suburb: plan.address?.split(",")[0]?.trim().slice(0, 120) || "Address supplied",
        intent: "sale",
        source: "other",
        propertyCategory: plan.categoryPlatform,
        notes: plan.categoryAmbiguous,
        confirmNewContact: input.confirmNewContact || !contactId,
        idempotencyKey: `seller-intake:${input.requestId}`,
      });
      if (!created.ok) {
        await remember(input.clientId, input.requestId, input.actor.id, input.submissionVersion, { error: created.error });
        await db().from("re_seller_intake_requests").update({ status: "review_incomplete" }).eq("id", input.requestId);
        return created;
      }
      opportunityId = created.opportunity.id as string;
      contactId = (created.opportunity.contact_id as string | null) ?? contactId;
    }
    if (contactId && input.confirmChanges) {
      await supabase.from("contacts").update({
        name: plan.personName,
        phone: plan.phone,
        email: plan.email,
      }).eq("id", contactId).eq("client_id", input.clientId);
    }
    await remember(input.clientId, input.requestId, input.actor.id, input.submissionVersion, { contact_id: contactId, opportunity_id: opportunityId });
    await supabase.from("re_seller_intake_requests").update({ contact_id: contactId, opportunity_id: opportunityId }).eq("id", input.requestId).eq("client_id", input.clientId);
    if (input.confirmChanges && opportunityId) {
      await supabase.from("real_estate_acquisition_opportunities").update({
        owner_name: plan.ownerName,
        address: plan.address?.slice(0, 500) ?? null,
        contact_id: contactId,
      }).eq("id", opportunityId).eq("client_id", input.clientId);
    }
    for (const party of partyDrafts({ answers: snapshot.answers, personContactId: contactId, negotiatorName: input.actor.name })) {
      const { data: existingParty } = await supabase.from("re_acquisition_parties").select("id").eq("request_id", input.requestId).eq("role", party.role).maybeSingle();
      if (!existingParty) {
        await supabase.from("re_acquisition_parties").insert({
          client_id: input.clientId,
          opportunity_id: opportunityId,
          request_id: input.requestId,
          role: party.role,
          party_kind: party.partyKind,
          contact_id: party.contactId,
          display_name: party.displayName,
          details: { registered_owner_is_contact: party.role === "registered_owner" && party.partyKind === "individual" },
        });
      }
    }
    if (plan.askingPrice != null) {
      const note = `seller-intake:${input.requestId}:asking`;
      const { data: price } = await supabase.from("real_estate_price_discussions").select("id").eq("opportunity_id", opportunityId).eq("notes", note).maybeSingle();
      if (!price) {
        await supabase.from("real_estate_price_discussions").insert({
          client_id: input.clientId,
          opportunity_id: opportunityId,
          amount: plan.askingPrice,
          currency: "USD",
          price_type: "owner_asking",
          notes: note,
          recorded_by: input.actor.id,
        });
      }
    }
    let complianceCaseId = ((prior as Row | null)?.compliance_case_id as string | null) ?? null;
    if (!complianceCaseId && contactId) {
      const inserted = await supabase.from("compliance_cases").insert({
        client_id: input.clientId,
        contact_id: contactId,
        entity_type: plan.company ? "corporate" : "individual",
        case_type: "cdd",
        status: plan.complianceStatus,
        risk_level: "unclassified",
        created_by: input.actor.id,
        cdd_profile: complianceProfile(snapshot),
      }).select("id").maybeSingle();
      if (inserted.error || !inserted.data) {
        await remember(input.clientId, input.requestId, input.actor.id, input.submissionVersion, { contact_id: contactId, opportunity_id: opportunityId, error: inserted.error?.message ?? "Could not open the compliance case." });
        await supabase.from("re_seller_intake_requests").update({ status: "review_incomplete" }).eq("id", input.requestId);
        return fail(500, "The intake was not finished because the compliance case was not opened.");
      }
      complianceCaseId = inserted.data.id as string;
      if (plan.company) {
        await supabase.from("compliance_related_parties").insert({
          client_id: input.clientId,
          compliance_case_id: complianceCaseId,
          contact_id: contactId,
          full_name: plan.personName,
          relationship_type: "authorised_representative",
        });
      }
      await remember(input.clientId, input.requestId, input.actor.id, input.submissionVersion, { contact_id: contactId, opportunity_id: opportunityId, compliance_case_id: complianceCaseId });
    }
    const { data: existingDocuments } = await supabase.from("re_seller_intake_documents").select("id, content_sha256").eq("client_id", input.clientId).eq("request_id", input.requestId).eq("signature_state", "prepared_unsigned");
    let documentId = ((prior as Row | null)?.document_id as string | null) ?? ((existingDocuments ?? [])[0] as Row | undefined)?.id as string | undefined ?? null;
    if (!documentId) {
      const rendered = renderMandatePdf(snapshot);
      const key = `clients/${input.clientId}/seller-intake/${input.requestId}/${rendered.sha256}.pdf`;
      if (input.store) await input.store.put(key, rendered.bytes);
      else if (isPrivateDocumentStorageConfigured()) await putPrivateDocument(key, rendered.bytes, "application/pdf");
      else throw new Error("PRIVATE_STORAGE_UNAVAILABLE");
      const inserted = await supabase.from("re_seller_intake_documents").insert({
        client_id: input.clientId,
        request_id: input.requestId,
        template_id: snapshot.templateId,
        submission_version: snapshot.templateVersion,
        storage_key: key,
        content_sha256: rendered.sha256,
        scan_status: initialDocumentScanStatus(),
        signature_state: "prepared_unsigned",
        byte_size: rendered.bytes.length,
        created_by: input.actor.id,
      }).select("id").single();
      if (inserted.error || !inserted.data) throw new Error(inserted.error?.message ?? "Could not record the prepared mandate.");
      documentId = inserted.data.id as string;
      await remember(input.clientId, input.requestId, input.actor.id, input.submissionVersion, { document_id: documentId, contact_id: contactId, opportunity_id: opportunityId, compliance_case_id: complianceCaseId });
    }
    let mandateId = ((prior as Row | null)?.mandate_id as string | null) ?? null;
    if (!mandateId && opportunityId) {
      const mandate = await saveMandate({
        clientId: input.clientId,
        opportunityId,
        actor: input.actor,
        mandateType: snapshot.kind,
        startDate: plan.startDate,
        expiryDate: plan.expiryDate,
        submit: true,
        evidenceStatus: plan.evidenceStatus,
      });
      if (!mandate.ok) throw new Error(mandate.error);
      mandateId = mandate.mandate.id as string;
      await remember(input.clientId, input.requestId, input.actor.id, input.submissionVersion, { mandate_id: mandateId });
    }
    if (!reviewCanFinish({ mandateId, documentId })) {
      await supabase.from("re_seller_intake_requests").update({ status: "review_incomplete" }).eq("id", input.requestId);
      return fail(500, "The intake review is incomplete because the mandate or prepared document is missing.");
    }
    const appliedAt = (input.now ?? new Date()).toISOString();
    await remember(input.clientId, input.requestId, input.actor.id, input.submissionVersion, {
      outcome: "accepted",
      applied_at: appliedAt,
      error: null,
      contact_id: contactId,
      opportunity_id: opportunityId,
      mandate_id: mandateId,
      document_id: documentId,
      compliance_case_id: complianceCaseId,
    });
    await supabase.from("re_seller_intake_requests").update({ status: "accepted", opportunity_id: opportunityId, contact_id: contactId, updated_at: appliedAt }).eq("id", input.requestId).eq("client_id", input.clientId);
    await event(input.clientId, input.requestId, "intake_accepted", input.actor.id, { mandateStatus: "submitted", listingCreated: false });
    if (opportunityId) {
      const activity = await createSubjectActivity({
        clientId: input.clientId,
        subjectType: "acquisition",
        subjectId: opportunityId,
        title: "Collect the signed mandate and identity evidence",
        assignedToId: input.actor.id,
        notes: "Seller intake was accepted for capture. This is not mandate approval, listing approval or evidence verification.",
        createdBy: input.actor.id,
      });
      if (!activity.ok) await event(input.clientId, input.requestId, "next_action_pending", input.actor.id, { error: activity.error });
    }
    return { ok: true as const, idempotent: false, contactId, opportunityId, mandateId, documentId, complianceCaseId };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not finish the intake review.";
    await remember(input.clientId, input.requestId, input.actor.id, input.submissionVersion, { error: message });
    await db().from("re_seller_intake_requests").update({ status: "review_incomplete", updated_at: new Date().toISOString() }).eq("id", input.requestId).eq("client_id", input.clientId);
    return fail(500, message === "PRIVATE_STORAGE_UNAVAILABLE" ? "The prepared mandate could not be stored. The review can be retried." : message);
  }
}

export async function attachSignedIntakeDocument(input: {
  clientId: string;
  requestId: string;
  actor: IntakeActor;
  filename: string;
  bytes: Buffer;
  store?: DocumentStore;
}) {
  const off = disabled();
  if (off) return off;
  const loaded = await loadOwnedRequest(input.clientId, input.requestId, input.actor);
  if (!loaded.ok) return loaded;
  if (loaded.request.status !== "accepted") return fail(409, "Attach the signed copy after intake review.");
  const digest = createHash("sha256").update(input.bytes).digest("hex");
  const key = `clients/${input.clientId}/seller-intake/${input.requestId}/signed-${digest}.pdf`;
  if (input.store) await input.store.put(key, input.bytes);
  else if (isPrivateDocumentStorageConfigured()) await putPrivateDocument(key, input.bytes, "application/pdf");
  else return fail(503, "Private document storage is not configured. The file was not marked clean.");
  const state = signedUploadState();
  const template = await loadTemplate(input.clientId, String(loaded.request.template_id));
  const { data, error } = await db().from("re_seller_intake_documents").insert({
    client_id: input.clientId,
    request_id: input.requestId,
    template_id: template?.id ?? loaded.request.template_id,
    submission_version: Number(template?.version ?? 1),
    storage_key: key,
    content_sha256: digest,
    scan_status: state.scanStatus,
    signature_state: state.signatureState,
    byte_size: input.bytes.length,
    created_by: input.actor.id,
  }).select("id, scan_status, signature_state").single();
  if (error || !data) return fail(500, error?.message ?? "Could not store the signed copy.");
  await event(input.clientId, input.requestId, "signed_copy_uploaded", input.actor.id, { documentId: data.id, scanStatus: data.scan_status });
  return { ok: true as const, document: data, countsAsSignature: countsAsSignatureEvidence(state) };
}

export async function openIntakeDocument(input: { clientId: string; requestId: string; documentId: string; actor: IntakeActor }) {
  const off = disabled();
  if (off) return off;
  const loaded = await loadOwnedRequest(input.clientId, input.requestId, input.actor);
  if (!loaded.ok) return loaded;
  if (!canSeeRestrictedIntake({ role: input.actor.role, userClientId: input.actor.clientId, resourceClientId: input.clientId })) {
    return fail(403, "This prepared mandate includes restricted answers. A manager opens it after the scan is clean.");
  }
  const { data } = await db().from("re_seller_intake_documents").select("*").eq("id", input.documentId).eq("client_id", input.clientId).eq("request_id", input.requestId).maybeSingle();
  if (!data) return fail(404, "Not found");
  const decision = evidenceAccessDecision(String((data as Row).scan_status));
  if (!decision.allowBytes) return fail(409, decision.error);
  const key = String((data as Row).storage_key ?? "");
  if (!isPrivateDocumentStorageConfigured()) return fail(503, "Private document storage is not configured for a scanned download.");
  const url = await signPrivateDocument(key, "mandate.pdf", "application/pdf");
  return { ok: true as const, url, expiresInSeconds: 300 };
}
