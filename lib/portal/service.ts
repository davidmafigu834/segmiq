import { createAdminClient } from "@/lib/supabase/admin";
import { sendWhatsApp } from "@/lib/messaging/provider";
import { normalizeToE164 } from "@/lib/phone-validate";
import { signDocumentDownload, uploadDocument } from "@/lib/documents/service";
import { createManualDocumentLink } from "@/lib/documents/linking/store";
import { paymentGate, termAmount } from "@/lib/work-projects/commercial-rules";
import { getPublicBaseUrl } from "@/lib/constants";
import {
  allocateTermPayments,
  INVITE_TTL_MS,
  OTP_TTL_MS,
  portalMoney,
  portalNextStep,
  portalTimeline,
  resolvePortalStage,
  SESSION_TTL_MS,
  supportStatusLabel,
  warrantyForPortal,
  otpDecision,
  otpSendAllowed,
  PORTAL_STAGE_LABEL,
} from "@/lib/portal/rules";
import {
  clearPortalCookie,
  hashPortalSecret,
  newOtpCode,
  newPortalToken,
  portalSecretsMatch,
  readPortalCookie,
  writePortalCookie,
} from "@/lib/portal/auth";

export type PortalSettings = {
  enabled: boolean;
  showProjectFinancials: boolean;
  allowPaymentProofUpload: boolean;
  showAssets: boolean;
  showSerialNumbers: boolean;
  showWarranties: boolean;
  allowSupport: boolean;
  allowUpgradeRequests: boolean;
  portalAiEnabled: boolean;
};

const DEFAULT_SETTINGS: PortalSettings = {
  enabled: false,
  showProjectFinancials: true,
  allowPaymentProofUpload: true,
  showAssets: true,
  showSerialNumbers: true,
  showWarranties: true,
  allowSupport: true,
  allowUpgradeRequests: true,
  portalAiEnabled: false,
};

function mapSettings(row: Record<string, unknown> | null): PortalSettings {
  if (!row) return DEFAULT_SETTINGS;
  return {
    enabled: Boolean(row.enabled),
    showProjectFinancials: row.show_project_financials !== false,
    allowPaymentProofUpload: row.allow_payment_proof_upload !== false,
    showAssets: row.show_assets !== false,
    showSerialNumbers: row.show_serial_numbers !== false,
    showWarranties: row.show_warranties !== false,
    allowSupport: row.allow_support !== false,
    allowUpgradeRequests: row.allow_upgrade_requests !== false,
    portalAiEnabled: Boolean(row.portal_ai_enabled),
  };
}

async function recordEvent(clientId: string, contactId: string | null, eventType: string, metadata: Record<string, unknown> = {}) {
  const supabase = createAdminClient();
  await supabase.from("customer_portal_events").insert({
    client_id: clientId,
    contact_id: contactId,
    event_type: eventType,
    metadata,
  });
}

export async function getPortalSettings(clientId: string) {
  const supabase = createAdminClient();
  const { data } = await supabase.from("customer_portal_settings").select("*").eq("client_id", clientId).maybeSingle();
  return mapSettings(data as Record<string, unknown> | null);
}

export async function savePortalSettings(clientId: string, settings: PortalSettings) {
  const supabase = createAdminClient();
  const { error } = await supabase.from("customer_portal_settings").upsert({
    client_id: clientId,
    enabled: settings.enabled,
    show_project_financials: settings.showProjectFinancials,
    allow_payment_proof_upload: settings.allowPaymentProofUpload,
    show_assets: settings.showAssets,
    show_serial_numbers: settings.showSerialNumbers,
    show_warranties: settings.showWarranties,
    allow_support: settings.allowSupport,
    allow_upgrade_requests: settings.allowUpgradeRequests,
    portal_ai_enabled: settings.portalAiEnabled,
    updated_at: new Date().toISOString(),
  });
  if (error) return { ok: false as const, error: "Portal settings could not be saved." };
  return { ok: true as const, settings };
}

export async function portalUsage(clientId: string) {
  const supabase = createAdminClient();
  const [access, events] = await Promise.all([
    supabase.from("customer_portal_access").select("status, last_login_at").eq("client_id", clientId),
    supabase.from("customer_portal_events").select("event_type").eq("client_id", clientId).limit(1000),
  ]);
  const rows = access.data ?? [];
  const kinds = events.data ?? [];
  return {
    invited: rows.length,
    activated: rows.filter((row) => row.last_login_at).length,
    revoked: rows.filter((row) => row.status === "REVOKED").length,
    paymentProofs: kinds.filter((row) => row.event_type === "PAYMENT_PROOF_UPLOADED").length,
    supportRequests: kinds.filter((row) => row.event_type === "SUPPORT_CASE_CREATED").length,
    upgradeEnquiries: kinds.filter((row) => row.event_type === "UPGRADE_REQUESTED").length,
  };
}

export async function getPortalIdentity() {
  const token = readPortalCookie();
  if (!token) return null;
  const supabase = createAdminClient();
  const { data: session } = await supabase
    .from("customer_portal_sessions")
    .select("id, client_id, contact_id, access_id, expires_at, revoked_at")
    .eq("token_hash", hashPortalSecret(token))
    .maybeSingle();
  if (!session || session.revoked_at || new Date(session.expires_at as string).getTime() <= Date.now()) return null;
  const { data: access } = await supabase
    .from("customer_portal_access")
    .select("status")
    .eq("id", session.access_id)
    .eq("client_id", session.client_id)
    .eq("contact_id", session.contact_id)
    .maybeSingle();
  if (!access || access.status !== "ACTIVE") return null;
  const settings = await getPortalSettings(session.client_id as string);
  if (!settings.enabled) return null;
  const [{ data: contact }, { data: client }] = await Promise.all([
    supabase.from("contacts").select("name, phone, email").eq("id", session.contact_id).eq("client_id", session.client_id).maybeSingle(),
    supabase.from("clients").select("name, logo_url, meta_whatsapp_display_number").eq("id", session.client_id).maybeSingle(),
  ]);
  if (!contact) return null;
  return {
    sessionId: session.id as string,
    clientId: session.client_id as string,
    contactId: session.contact_id as string,
    accessId: session.access_id as string,
    name: (contact.name as string | null) || "there",
    phone: (contact.phone as string | null) || "",
    email: (contact.email as string | null) || null,
    companyName: (client?.name as string | null) || "Your installer",
    logoUrl: (client?.logo_url as string | null) || null,
    whatsappHref: whatsappLink(client?.meta_whatsapp_display_number as string | null),
    settings,
  };
}

function whatsappLink(display: string | null | undefined) {
  const digits = String(display || "").replace(/\D/g, "");
  return digits.length >= 8 ? `https://wa.me/${digits}` : null;
}

function paymentMethodLabel(method: string) {
  const labels: Record<string, string> = {
    BANK_TRANSFER: "Bank transfer",
    CASH: "Cash",
    MOBILE_MONEY: "Mobile money",
    CARD: "Card",
    CHEQUE: "Cheque",
    FINANCE: "Finance",
    OTHER: "Other",
  };
  return labels[method] || "Payment";
}

function paymentMethodCode(method: string) {
  const code = method.trim().toUpperCase().replace(/[\s-]+/g, "_");
  return ["BANK_TRANSFER", "CASH", "MOBILE_MONEY", "CARD", "CHEQUE", "FINANCE", "OTHER"].includes(code) ? code : "OTHER";
}

async function issueChallenge(access: { id: string; client_id: string; contact_id: string; phone_e164: string }) {
  const supabase = createAdminClient();
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count } = await supabase
    .from("customer_portal_challenges")
    .select("id", { count: "exact", head: true })
    .eq("client_id", access.client_id)
    .eq("phone_e164", access.phone_e164)
    .gte("created_at", since);
  if (!otpSendAllowed(count ?? 0)) return { ok: false as const, error: "Please wait before requesting another code." };
  const code = newOtpCode();
  const { error } = await supabase.from("customer_portal_challenges").insert({
    client_id: access.client_id,
    contact_id: access.contact_id,
    access_id: access.id,
    phone_e164: access.phone_e164,
    code_hash: hashPortalSecret(code),
    expires_at: new Date(Date.now() + OTP_TTL_MS).toISOString(),
  });
  if (error) return { ok: false as const, error: "A code could not be sent." };
  return { ok: true as const, code, phone: access.phone_e164, clientId: access.client_id, contactId: access.contact_id };
}

async function deliverCode(clientId: string, contactId: string, phone: string, code: string) {
  const supabase = createAdminClient();
  const { data: lead } = await supabase
    .from("leads")
    .select("id, name, assigned_to_id")
    .eq("client_id", clientId)
    .eq("contact_id", contactId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { data: client } = await supabase.from("clients").select("name").eq("id", clientId).maybeSingle();
  const company = (client?.name as string | null) || "your installer";
  const text = `Your ${company} portal code is ${code}. It expires in 10 minutes.`;
  if (!lead?.id) return { sent: false };
  const result = await sendWhatsApp({
    to: phone,
    template: "SEND_CUSTOM_MESSAGE",
    variables: { "1": "there", "2": company, "3": text },
    fallbackBody: text,
    context: { userId: (lead.assigned_to_id as string | null) || undefined, leadId: lead.id as string, clientId, notificationType: "DOCUMENT_SENT" },
  }).catch(() => ({ ok: false }));
  return { sent: Boolean(result.ok) };
}

export async function startPortalOtp(input: { inviteToken?: string | null; phone?: string | null }) {
  const supabase = createAdminClient();
  const generic = { ok: true as const, message: "If this number has portal access, a code is on its way." };
  if (input.inviteToken) {
    const { data: invite } = await supabase
      .from("customer_portal_invites")
      .select("access_id, client_id, contact_id, expires_at")
      .eq("token_hash", hashPortalSecret(input.inviteToken))
      .maybeSingle();
    if (!invite || new Date(invite.expires_at as string).getTime() <= Date.now()) return generic;
    const settings = await getPortalSettings(invite.client_id as string);
    if (!settings.enabled) return generic;
    const { data: access } = await supabase
      .from("customer_portal_access")
      .select("id, client_id, contact_id, phone_e164, status")
      .eq("id", invite.access_id)
      .eq("client_id", invite.client_id)
      .eq("contact_id", invite.contact_id)
      .maybeSingle();
    if (!access || access.status !== "ACTIVE") return generic;
    const challenge = await issueChallenge(access as { id: string; client_id: string; contact_id: string; phone_e164: string });
    if (!challenge.ok) return { ok: false as const, error: challenge.error };
    await deliverCode(challenge.clientId, challenge.contactId, challenge.phone, challenge.code);
    return { ...generic, phoneHint: challenge.phone.slice(-3) };
  }
  const phone = normalizeToE164(input.phone);
  if (!phone) return generic;
  const { data: matches } = await supabase
    .from("customer_portal_access")
    .select("id, client_id, contact_id, phone_e164, status")
    .eq("phone_e164", phone)
    .eq("status", "ACTIVE")
    .limit(2);
  if (!matches || matches.length !== 1) return generic;
  const settings = await getPortalSettings(matches[0].client_id as string);
  if (!settings.enabled) return generic;
  const challenge = await issueChallenge(matches[0] as { id: string; client_id: string; contact_id: string; phone_e164: string });
  if (!challenge.ok) return { ok: false as const, error: challenge.error };
  await deliverCode(challenge.clientId, challenge.contactId, challenge.phone, challenge.code);
  return generic;
}

export async function verifyPortalOtp(input: { inviteToken?: string | null; phone?: string | null; code: string }) {
  const supabase = createAdminClient();
  const code = input.code.replace(/\s/g, "");
  if (!/^\d{6}$/.test(code)) return { ok: false as const, error: "Enter the 6-digit code." };
  let accessId: string | null = null;
  let clientId: string | null = null;
  let contactId: string | null = null;
  if (input.inviteToken) {
    const { data: invite } = await supabase
      .from("customer_portal_invites")
      .select("access_id, client_id, contact_id, expires_at")
      .eq("token_hash", hashPortalSecret(input.inviteToken))
      .maybeSingle();
    if (!invite) return { ok: false as const, error: "That code is not valid." };
    accessId = invite.access_id as string;
    clientId = invite.client_id as string;
    contactId = invite.contact_id as string;
  } else {
    const phone = normalizeToE164(input.phone);
    if (!phone) return { ok: false as const, error: "That code is not valid." };
    const { data: access } = await supabase
      .from("customer_portal_access")
      .select("id, client_id, contact_id")
      .eq("phone_e164", phone)
      .eq("status", "ACTIVE")
      .limit(2);
    if (!access || access.length !== 1) return { ok: false as const, error: "That code is not valid." };
    accessId = access[0].id as string;
    clientId = access[0].client_id as string;
    contactId = access[0].contact_id as string;
  }
  const { data: challenge } = await supabase
    .from("customer_portal_challenges")
    .select("id, code_hash, expires_at, consumed_at, attempts")
    .eq("client_id", clientId)
    .eq("contact_id", contactId)
    .eq("access_id", accessId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!challenge) return { ok: false as const, error: "That code is not valid." };
  const decision = otpDecision({
    now: new Date(),
    expiresAt: new Date(challenge.expires_at as string),
    consumedAt: (challenge.consumed_at as string | null) ?? null,
    attempts: Number(challenge.attempts) || 0,
    codeMatches: portalSecretsMatch(hashPortalSecret(code), challenge.code_hash as string),
  });
  if (!decision.ok) {
    if (decision.reason === "mismatch") {
      await supabase.from("customer_portal_challenges").update({ attempts: Number(challenge.attempts) + 1 }).eq("id", challenge.id);
    }
    return { ok: false as const, error: decision.reason === "expired" ? "That code has expired." : "That code is not valid." };
  }
  const consumed = await supabase
    .from("customer_portal_challenges")
    .update({ consumed_at: new Date().toISOString() })
    .eq("id", challenge.id)
    .is("consumed_at", null)
    .select("id");
  if (!consumed.data?.length) return { ok: false as const, error: "That code has already been used." };
  const token = newPortalToken();
  const expires = new Date(Date.now() + SESSION_TTL_MS);
  const { error } = await supabase.from("customer_portal_sessions").insert({
    client_id: clientId,
    contact_id: contactId,
    access_id: accessId,
    token_hash: hashPortalSecret(token),
    expires_at: expires.toISOString(),
  });
  if (error) return { ok: false as const, error: "The portal could not be opened." };
  await supabase.from("customer_portal_access").update({ last_login_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", accessId);
  writePortalCookie(token, expires);
  await recordEvent(clientId!, contactId, "PORTAL_LOGIN");
  return { ok: true as const };
}

export async function logoutPortal() {
  const identity = await getPortalIdentity();
  const token = readPortalCookie();
  if (token) {
    const supabase = createAdminClient();
    await supabase.from("customer_portal_sessions").update({ revoked_at: new Date().toISOString() }).eq("token_hash", hashPortalSecret(token));
  }
  clearPortalCookie();
  if (identity) await recordEvent(identity.clientId, identity.contactId, "PORTAL_LOGOUT");
}

async function ownedProject(clientId: string, contactId: string, projectId: string) {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("work_projects")
    .select("id, project_number, title, status, project_value, currency, site_name, site_address, quotation_id, project_owner_id, workflow_key")
    .eq("id", projectId)
    .eq("client_id", clientId)
    .eq("contact_id", contactId)
    .maybeSingle();
  return data;
}

function scheduleLabel(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString(undefined, { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });
}

export async function listPortalProjects(clientId: string, contactId: string, settings: PortalSettings) {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("work_projects")
    .select("id, project_number, title, status, site_name, site_address, target_completion_date")
    .eq("client_id", clientId)
    .eq("contact_id", contactId)
    .order("updated_at", { ascending: false });
  const projects = data ?? [];
  const ids = projects.map((row) => row.id as string);
  const installations = ids.length
    ? await supabase.from("work_project_installations").select("project_id, status, scheduled_start_at").in("project_id", ids).neq("status", "CANCELLED")
    : { data: [] };
  const byProject = new Map((installations.data ?? []).map((row) => [row.project_id as string, row]));
  return projects.map((project) => {
    const installation = byProject.get(project.id as string);
    const stage = resolvePortalStage({
      projectStatus: project.status as string,
      installationStatus: (installation?.status as string | undefined) ?? null,
      commissioningStatus: null,
      handoverStatus: null,
    });
    return {
      id: project.id,
      number: project.project_number,
      title: project.title,
      stage: PORTAL_STAGE_LABEL[stage],
      site: [project.site_name, project.site_address].filter(Boolean).join(", ") || null,
      nextStep: portalNextStep(stage, scheduleLabel((installation?.scheduled_start_at as string | null) ?? null)),
      completed: stage === "COMPLETED",
      financialsVisible: settings.showProjectFinancials,
    };
  });
}

export async function getPortalProject(clientId: string, contactId: string, projectId: string, settings: PortalSettings) {
  const project = await ownedProject(clientId, contactId, projectId);
  if (!project) return null;
  const supabase = createAdminClient();
  const [installationRes, paymentsRes, termsRes, equipmentRes, visitsRes, quotationRes, commissioningRes, handoverRes, assessmentsRes] = await Promise.all([
    supabase.from("work_project_installations").select("id, status, scheduled_start_at, actual_start_at, site_name, site_address, completion_summary").eq("project_id", projectId).eq("client_id", clientId).neq("status", "CANCELLED").order("created_at", { ascending: false }).limit(1),
    supabase.from("work_project_payments").select("id, amount, currency, payment_method, reference, paid_at, status, payment_term_id").eq("project_id", projectId).eq("client_id", clientId).order("paid_at", { ascending: false }),
    supabase.from("work_project_payment_terms").select("id, label, term_type, percent, amount, trigger_type, sequence").eq("project_id", projectId).eq("client_id", clientId).order("sequence"),
    supabase.from("work_project_equipment").select("description, quantity_required, quantity_reserved, quantity_issued, track_inventory, cancelled").eq("project_id", projectId).eq("client_id", clientId),
    supabase.from("work_project_visits").select("id, title, visit_type, status, scheduled_start_at").eq("project_id", projectId).eq("client_id", clientId).order("scheduled_start_at"),
    project.quotation_id
      ? supabase.from("quotations").select("quote_number, status, total, currency, public_token, link_revoked_at, accepted_at").eq("id", project.quotation_id).eq("client_id", clientId).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase.from("work_project_commissioning").select("status, commissioned_at, customer_summary").eq("project_id", projectId).eq("client_id", clientId).eq("status", "COMPLETED").limit(1),
    supabase.from("work_project_handovers").select("status, handover_at, customer_name, customer_notes, acknowledged").eq("project_id", projectId).eq("client_id", clientId).eq("status", "COMPLETED").limit(1),
    supabase.from("work_project_visits").select("id").eq("project_id", projectId).eq("client_id", clientId).eq("visit_type", "SITE_ASSESSMENT").eq("status", "COMPLETED"),
  ]);
  const installation = installationRes.data?.[0] ?? null;
  const commissioning = commissioningRes.data?.[0] ?? null;
  const handover = handoverRes.data?.[0] ?? null;
  const stage = resolvePortalStage({
    projectStatus: project.status as string,
    installationStatus: (installation?.status as string | undefined) ?? null,
    commissioningStatus: (commissioning?.status as string | undefined) ?? null,
    handoverStatus: (handover?.status as string | undefined) ?? null,
  });
  const confirmed = (paymentsRes.data ?? []).filter((row) => row.status === "CONFIRMED");
  const pending = (paymentsRes.data ?? []).filter((row) => row.status === "PENDING");
  const value = project.project_value == null ? null : Number(project.project_value);
  const money = portalMoney(confirmed.map((row) => Number(row.amount)), value);
  const terms = (termsRes.data ?? []).map((term) => ({
    id: term.id as string,
    label: term.label as string,
    trigger: term.trigger_type as string,
    termType: term.term_type as "PERCENTAGE" | "FIXED_AMOUNT",
    percent: term.percent as number | null,
    amount: term.amount as number | null,
    computed: termAmount(
      { termType: term.term_type as "PERCENTAGE" | "FIXED_AMOUNT", percent: term.percent as number | null, amount: term.amount as number | null },
      value
    ),
  }));
  const confirmedByTerm = new Map<string, number>();
  let unallocated = 0;
  for (const row of confirmed) {
    const amount = Number(row.amount);
    if (row.payment_term_id) confirmedByTerm.set(row.payment_term_id as string, (confirmedByTerm.get(row.payment_term_id as string) ?? 0) + amount);
    else unallocated += amount;
  }
  const gate = paymentGate({ projectValue: value, terms, confirmedByTerm, unallocatedConfirmed: unallocated });
  const equipment = (equipmentRes.data ?? []).filter((row) => !row.cancelled && row.track_inventory);
  const equipmentPrepared = equipment.length > 0 && equipment.every((row) => Number(row.quantity_reserved) + Number(row.quantity_issued) >= Number(row.quantity_required));
  const timeline = portalTimeline({
    confirmed: true,
    assessmentCompleted: (assessmentsRes.data ?? []).length > 0,
    showDeposit: settings.showProjectFinancials && (terms.length > 0 || value != null),
    depositReceived: gate.configured ? gate.satisfied : confirmed.length > 0,
    equipmentRequired: equipment.length > 0,
    equipmentPrepared,
    installationScheduled: installation?.status === "SCHEDULED" || Boolean(installation?.scheduled_start_at),
    installationStarted: Boolean(installation?.actual_start_at) || ["IN_PROGRESS", "PAUSED", "QA_PENDING", "COMMISSIONING_PENDING", "HANDOVER_PENDING", "COMPLETED"].includes((installation?.status as string) || ""),
    commissioningCompleted: Boolean(commissioning),
    handoverCompleted: Boolean(handover),
    projectCompleted: project.status === "COMPLETED",
  });
  const quote = quotationRes.data;
  return {
    id: project.id,
    number: project.project_number,
    title: project.title,
    stage: PORTAL_STAGE_LABEL[stage],
    stageKey: stage,
    nextStep: portalNextStep(stage, scheduleLabel((installation?.scheduled_start_at as string | null) ?? null)),
    site: [installation?.site_name || project.site_name, installation?.site_address || project.site_address].filter(Boolean).join(", ") || null,
    timeline,
    financials: settings.showProjectFinancials
      ? {
          currency: (project.currency as string) || "USD",
          projectValue: money.projectValue,
          paid: money.paid,
          outstanding: money.outstanding,
          terms: allocateTermPayments(terms.map((term) => ({ id: term.id, label: term.label, amount: term.computed })), money.paid),
          history: confirmed.map((row) => ({
            id: row.id,
            amount: Number(row.amount),
            method: paymentMethodLabel(String(row.payment_method || "")),
            reference: row.reference,
            paidAt: row.paid_at,
          })),
          awaitingReview: pending.map((row) => ({ id: row.id, amount: Number(row.amount), paidAt: row.paid_at })),
        }
      : confirmed.length
        ? { paymentReceived: true as const }
        : null,
    allowProof: settings.allowPaymentProofUpload && settings.showProjectFinancials,
    installation: installation
      ? {
          scheduled: installation.status === "SCHEDULED" || Boolean(installation.scheduled_start_at),
          scheduleLabel: scheduleLabel(installation.scheduled_start_at as string | null),
          started: Boolean(installation.actual_start_at),
          startedLabel: scheduleLabel(installation.actual_start_at as string | null),
          site: [installation.site_name, installation.site_address].filter(Boolean).join(", ") || null,
          summary: (installation.completion_summary as string | null) || null,
        }
      : { scheduled: false, scheduleLabel: null, started: false, startedLabel: null, site: null, summary: null },
    visits: (visitsRes.data ?? [])
      .filter((row) => row.status !== "CANCELLED")
      .map((row) => ({
        id: row.id,
        title: row.title || (row.visit_type === "SITE_ASSESSMENT" ? "Site assessment" : "Site visit"),
        when: scheduleLabel(row.scheduled_start_at as string | null),
        status: row.status === "COMPLETED" ? "Completed" : row.status === "RESCHEDULED" ? "Rescheduled" : "Scheduled",
      })),
    quotation: quote
      ? {
          number: quote.quote_number,
          status: quote.status,
          total: settings.showProjectFinancials ? quote.total : null,
          currency: quote.currency,
          href: quote.public_token && !quote.link_revoked_at ? `/quote/${quote.public_token}` : null,
        }
      : null,
    commissioning: commissioning
      ? {
          completed: true,
          at: commissioning.commissioned_at,
          summary: (commissioning.customer_summary as string | null) || "System commissioned successfully",
        }
      : null,
    handover: handover
      ? {
          at: handover.handover_at,
          customerName: handover.customer_name,
          customerNotes: handover.customer_notes,
          acknowledged: handover.acknowledged,
        }
      : null,
  };
}

export async function listPortalAssets(clientId: string, contactId: string, settings: PortalSettings) {
  if (!settings.showAssets) return [];
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("customer_installed_assets")
    .select("id, name, asset_type, status, quantity, unit, manufacturer, model, serial_number, site_name, site_address, installed_at, parent_asset_id, customer_visible")
    .eq("client_id", clientId)
    .eq("contact_id", contactId)
    .eq("customer_visible", true)
    .order("installed_at", { ascending: false });
  const rows = data ?? [];
  const ids = rows.map((row) => row.id as string);
  const warranties = settings.showWarranties && ids.length
    ? await supabase.from("installed_asset_warranties").select("installed_asset_id, warranty_type, starts_at, expires_at, voided_at, terms_summary").in("installed_asset_id", ids)
    : { data: [] };
  return rows.map((asset) => ({
    id: asset.id,
    name: asset.name,
    assetType: asset.asset_type,
    status: asset.status === "ACTIVE" ? "Active" : String(asset.status).toLowerCase(),
    quantity: Number(asset.quantity),
    unit: asset.unit,
    manufacturer: asset.manufacturer,
    model: asset.model,
    serialNumber: settings.showSerialNumbers ? asset.serial_number : null,
    site: [asset.site_name, asset.site_address].filter(Boolean).join(", ") || null,
    siteName: asset.site_name,
    installedAt: asset.installed_at,
    parentAssetId: asset.parent_asset_id,
    warranties: (warranties.data ?? [])
      .filter((row) => row.installed_asset_id === asset.id)
      .map((row) => warrantyForPortal(row as { starts_at: string; expires_at: string | null; voided_at: string | null }))
      .filter(Boolean)
      .map((row, index) => ({
        ...(row as { label: string; startsAt: string; expiresAt: string | null }),
        type: (warranties.data ?? []).filter((item) => item.installed_asset_id === asset.id)[index]?.warranty_type,
        summary: (warranties.data ?? []).filter((item) => item.installed_asset_id === asset.id)[index]?.terms_summary ?? null,
      })),
  }));
}

export async function getPortalAsset(clientId: string, contactId: string, assetId: string, settings: PortalSettings) {
  const assets = await listPortalAssets(clientId, contactId, settings);
  return assets.find((asset) => asset.id === assetId) ?? null;
}

export async function listPortalDocuments(clientId: string, contactId: string) {
  const supabase = createAdminClient();
  const { data: projects } = await supabase.from("work_projects").select("id, quotation_id").eq("client_id", clientId).eq("contact_id", contactId);
  const projectIds = (projects ?? []).map((row) => row.id as string);
  if (!projectIds.length) return [];
  const [payments, installations, assets] = await Promise.all([
    supabase.from("work_project_payments").select("id").eq("client_id", clientId).in("project_id", projectIds),
    supabase.from("work_project_installations").select("id").eq("client_id", clientId).in("project_id", projectIds),
    supabase.from("customer_installed_assets").select("id").eq("client_id", clientId).eq("contact_id", contactId),
  ]);
  const entityIds = [
    ...projectIds,
    ...(projects ?? []).map((row) => row.quotation_id as string | null).filter(Boolean),
    ...(payments.data ?? []).map((row) => row.id as string),
    ...(installations.data ?? []).map((row) => row.id as string),
    ...(assets.data ?? []).map((row) => row.id as string),
  ] as string[];
  const { data: links } = await supabase
    .from("document_entity_links")
    .select("id, document_id, entity_type, entity_id, match_reason")
    .eq("client_id", clientId)
    .eq("visibility", "CUSTOMER_VISIBLE")
    .in("entity_id", entityIds);
  const documentIds = [...new Set((links ?? []).map((row) => row.document_id as string))];
  if (!documentIds.length) return [];
  const { data: documents } = await supabase.from("documents").select("id, title").in("id", documentIds).eq("client_id", clientId);
  const title = new Map((documents ?? []).map((row) => [row.id as string, (row.title as string) || "Document"]));
  const seen = new Set<string>();
  return (links ?? []).flatMap((link) => {
    const id = link.document_id as string;
    if (seen.has(id) || !title.has(id)) return [];
    seen.add(id);
    return [{
      id,
      title: title.get(id) || "Document",
      category: (link.match_reason as string) || "Project document",
    }];
  });
}

export async function portalDocumentUrl(clientId: string, contactId: string, documentId: string) {
  const allowed = await listPortalDocuments(clientId, contactId);
  if (!allowed.some((doc) => doc.id === documentId)) return null;
  const supabase = createAdminClient();
  const { data: project } = await supabase
    .from("work_projects")
    .select("project_owner_id")
    .eq("client_id", clientId)
    .eq("contact_id", contactId)
    .not("project_owner_id", "is", null)
    .limit(1)
    .maybeSingle();
  if (!project?.project_owner_id) return null;
  const signed = await signDocumentDownload({
    clientId,
    documentId,
    actor: { userId: project.project_owner_id as string, role: "CLIENT_MANAGER", clientId },
  });
  if (!signed.ok) return null;
  await recordEvent(clientId, contactId, "DOCUMENT_VIEWED", { documentId });
  return signed.url;
}

export async function submitPortalProof(
  identity: { clientId: string; contactId: string; settings: PortalSettings },
  projectId: string,
  input: { amount: number; method: string; reference?: string | null; file: { buffer: Buffer; filename: string; contentType: string } }
) {
  if (!identity.settings.allowPaymentProofUpload || !identity.settings.showProjectFinancials) {
    return { ok: false as const, error: "Payment uploads are not available." };
  }
  const project = await ownedProject(identity.clientId, identity.contactId, projectId);
  if (!project) return { ok: false as const, error: "Project not found." };
  if (!project.project_owner_id) return { ok: false as const, error: "The company needs to review this another way." };
  if (!(input.amount > 0)) return { ok: false as const, error: "Enter the amount you paid." };
  const uploaded = await uploadDocument({
    clientId: identity.clientId,
    actor: { userId: project.project_owner_id as string, role: "CLIENT_MANAGER", clientId: identity.clientId },
    file: input.file,
    title: `Payment proof ${project.project_number}`,
    description: "Uploaded by the customer in the portal.",
  });
  if (!uploaded.ok) return { ok: false as const, error: "The file could not be saved." };
  const supabase = createAdminClient();
  const { data: payment, error } = await supabase
    .from("work_project_payments")
    .insert({
      client_id: identity.clientId,
      project_id: projectId,
      amount: input.amount,
      currency: project.currency || "USD",
      payment_method: paymentMethodCode(input.method || "OTHER"),
      reference: input.reference?.trim() || null,
      paid_at: new Date().toISOString(),
      status: "PENDING",
    })
    .select("id")
    .single();
  if (error || !payment) return { ok: false as const, error: "The payment could not be recorded." };
  await createManualDocumentLink({
    clientId: identity.clientId,
    documentId: uploaded.document.id,
    actorUserId: project.project_owner_id as string,
    candidate: {
      entityType: "WORK_PROJECT_PAYMENT",
      entityId: payment.id as string,
      linkType: "MANUAL",
      confidence: "HIGH",
      matchReason: "Payment proof",
      label: "Payment proof",
      metadata: { portal_contact_id: identity.contactId },
    },
  });
  await supabase.from("document_entity_links").update({ visibility: "CUSTOMER_VISIBLE" }).eq("client_id", identity.clientId).eq("document_id", uploaded.document.id).eq("entity_id", payment.id);
  await recordEvent(identity.clientId, identity.contactId, "PAYMENT_PROOF_UPLOADED", { projectId, paymentId: payment.id });
  return { ok: true as const };
}

export async function createPortalSupport(
  identity: { clientId: string; contactId: string; settings: PortalSettings; name: string },
  input: { projectId?: string | null; assetId?: string | null; category: string; message: string }
) {
  if (!identity.settings.allowSupport) return { ok: false as const, error: "Support requests are not available." };
  const message = input.message.trim();
  if (message.length < 4) return { ok: false as const, error: "Tell us what is happening." };
  const category = ["TECHNICAL", "WARRANTY", "INSTALLATION", "CUSTOMER_SERVICE", "MAINTENANCE"].includes(input.category) ? input.category : "OTHER";
  const supabase = createAdminClient();
  let projectId: string | null = null;
  if (input.projectId) {
    const project = await ownedProject(identity.clientId, identity.contactId, input.projectId);
    if (!project) return { ok: false as const, error: "Project not found." };
    projectId = project.id as string;
  }
  let assetId: string | null = null;
  if (input.assetId) {
    const { data: asset } = await supabase
      .from("customer_installed_assets")
      .select("id")
      .eq("id", input.assetId)
      .eq("client_id", identity.clientId)
      .eq("contact_id", identity.contactId)
      .eq("customer_visible", true)
      .maybeSingle();
    if (!asset) return { ok: false as const, error: "That equipment was not found." };
    assetId = asset.id as string;
  }
  const { data, error } = await supabase
    .from("support_cases")
    .insert({
      client_id: identity.clientId,
      contact_id: identity.contactId,
      work_project_id: projectId,
      installed_asset_id: assetId,
      status: "OPEN",
      reason_category: category,
      reason: message.slice(0, 500),
      customer_message: message,
    })
    .select("id")
    .single();
  if (error || !data) return { ok: false as const, error: "The request could not be sent." };
  await recordEvent(identity.clientId, identity.contactId, "SUPPORT_CASE_CREATED", { caseId: data.id, assetId });
  return { ok: true as const, id: data.id as string };
}

export async function listPortalSupport(clientId: string, contactId: string) {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("support_cases")
    .select("id, status, reason_category, customer_message, created_at, installed_asset_id")
    .eq("client_id", clientId)
    .eq("contact_id", contactId)
    .order("created_at", { ascending: false })
    .limit(40);
  return (data ?? []).map((row) => ({
    id: row.id,
    status: supportStatusLabel(row.status as string),
    category: row.reason_category,
    message: row.customer_message,
    createdAt: row.created_at,
    assetId: row.installed_asset_id,
  }));
}

export async function createPortalUpgrade(
  identity: { clientId: string; contactId: string; settings: PortalSettings; name: string; phone: string },
  input: { projectId?: string | null; intent: string; detail?: string | null }
) {
  if (!identity.settings.allowUpgradeRequests) return { ok: false as const, error: "Upgrade requests are not available." };
  const intent = input.intent.trim();
  if (!intent) return { ok: false as const, error: "Choose what you would like to add." };
  let ownerId: string | null = null;
  if (input.projectId) {
    const project = await ownedProject(identity.clientId, identity.contactId, input.projectId);
    if (!project) return { ok: false as const, error: "Project not found." };
    ownerId = (project.project_owner_id as string | null) ?? null;
  }
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("leads")
    .insert({
      client_id: identity.clientId,
      contact_id: identity.contactId,
      source: "CUSTOMER_PORTAL",
      status: "NEW",
      name: identity.name,
      phone: identity.phone,
      assigned_to_id: ownerId,
      form_data: { portal_intent: intent, detail: input.detail?.trim() || null, project_id: input.projectId || null },
    })
    .select("id")
    .single();
  if (error || !data) return { ok: false as const, error: "The request could not be sent." };
  await recordEvent(identity.clientId, identity.contactId, "UPGRADE_REQUESTED", { leadId: data.id, intent });
  if (ownerId) {
    await supabase.from("notifications").insert({
      user_id: ownerId,
      client_id: identity.clientId,
      type: "WORK_PROJECT_ALERT",
      message: `${identity.name} asked about: ${intent}`,
      read: false,
    });
  }
  return { ok: true as const };
}

export async function invitePortalContact(actor: { userId: string; clientId: string }, contactId: string) {
  const settings = await getPortalSettings(actor.clientId);
  if (!settings.enabled) return { ok: false as const, error: "Turn on the customer portal in settings first." };
  const supabase = createAdminClient();
  const { data: contact } = await supabase.from("contacts").select("id, name, phone").eq("id", contactId).eq("client_id", actor.clientId).maybeSingle();
  if (!contact) return { ok: false as const, error: "Customer not found." };
  const phone = normalizeToE164(contact.phone as string | null);
  if (!phone) return { ok: false as const, error: "Add a mobile number before sending portal access." };
  const { data: access, error } = await supabase
    .from("customer_portal_access")
    .upsert({
      client_id: actor.clientId,
      contact_id: contactId,
      phone_e164: phone,
      status: "ACTIVE",
      invited_by: actor.userId,
      invited_at: new Date().toISOString(),
      revoked_at: null,
      updated_at: new Date().toISOString(),
    }, { onConflict: "client_id,contact_id" })
    .select("id")
    .single();
  if (error || !access) return { ok: false as const, error: "Portal access could not be created." };
  const token = newPortalToken();
  await supabase.from("customer_portal_invites").insert({
    client_id: actor.clientId,
    contact_id: contactId,
    access_id: access.id,
    token_hash: hashPortalSecret(token),
    expires_at: new Date(Date.now() + INVITE_TTL_MS).toISOString(),
  });
  const link = `${getPublicBaseUrl()}/portal/enter?t=${token}`;
  const { data: client } = await supabase.from("clients").select("name").eq("id", actor.clientId).maybeSingle();
  const company = (client?.name as string | null) || "us";
  const text = `Hi ${contact.name || "there"}, you can view your project progress, payments and warranty documents here: ${link}`;
  const { data: lead } = await supabase.from("leads").select("id, assigned_to_id").eq("client_id", actor.clientId).eq("contact_id", contactId).limit(1).maybeSingle();
  let sent = false;
  if (lead?.id) {
    const result = await sendWhatsApp({
      to: phone,
      template: "SEND_CUSTOM_MESSAGE",
      variables: { "1": String(contact.name || "there").split(" ")[0], "2": company, "3": text },
      fallbackBody: text,
      context: { userId: actor.userId, leadId: lead.id as string, clientId: actor.clientId, notificationType: "DOCUMENT_SENT" },
    }).catch(() => ({ ok: false }));
    sent = Boolean(result.ok);
  }
  await recordEvent(actor.clientId, contactId, "PORTAL_INVITED", { sent });
  return { ok: true as const, link, sent, phone };
}

export async function revokePortalContact(clientId: string, contactId: string) {
  const supabase = createAdminClient();
  const now = new Date().toISOString();
  const { data } = await supabase
    .from("customer_portal_access")
    .update({ status: "REVOKED", revoked_at: now, updated_at: now })
    .eq("client_id", clientId)
    .eq("contact_id", contactId)
    .select("id");
  if (!data?.length) return { ok: false as const, error: "Portal access was not found." };
  await supabase.from("customer_portal_sessions").update({ revoked_at: now }).eq("client_id", clientId).eq("contact_id", contactId).is("revoked_at", null);
  await recordEvent(clientId, contactId, "PORTAL_REVOKED");
  return { ok: true as const };
}

export async function shareProjectDocument(clientId: string, projectId: string, documentId: string, visible: boolean) {
  const supabase = createAdminClient();
  const { data: project } = await supabase.from("work_projects").select("id").eq("id", projectId).eq("client_id", clientId).maybeSingle();
  if (!project) return { ok: false as const, error: "Project not found." };
  const { data } = await supabase
    .from("document_entity_links")
    .update({ visibility: visible ? "CUSTOMER_VISIBLE" : "INTERNAL" })
    .eq("client_id", clientId)
    .eq("document_id", documentId)
    .eq("entity_id", projectId)
    .select("id");
  if (!data?.length) return { ok: false as const, error: "Link the document to this project first." };
  return { ok: true as const };
}
