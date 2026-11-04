import { canTransitionPayment, confirmPayment, type PaymentEvidenceState } from "@/lib/real-estate/compliance-management/engine";

export const INVITATION_SESSION_COOKIE = "sq_cv";
export const INVITATION_SESSION_COOKIE_PATH = "/";

export function invitationSessionCookieOptions(nodeEnv: string | undefined = process.env.NODE_ENV) {
  return {
    httpOnly: true as const,
    sameSite: "lax" as const,
    secure: nodeEnv === "production",
    path: INVITATION_SESSION_COOKIE_PATH,
    maxAge: 60 * 30,
  };
}

/** A cookie is sent when its path is a prefix of the request path. `/verify` does not cover `/api`. */
export function cookieIsSentTo(cookiePath: string, requestPath: string): boolean {
  if (!cookiePath.startsWith("/") || !requestPath.startsWith("/")) return false;
  if (cookiePath === "/") return true;
  const prefix = cookiePath.endsWith("/") ? cookiePath : `${cookiePath}/`;
  const target = requestPath.endsWith("/") ? requestPath : `${requestPath}/`;
  return target.startsWith(prefix);
}

export function salespersonMaySeeCase(input: {
  role: string;
  actorId: string;
  buyerAgentId?: string | null;
  listingAgentId?: string | null;
  organisationWide: boolean;
}): boolean {
  if (input.organisationWide) return true;
  if (input.role !== "SALESPERSON") return false;
  const owners = [input.buyerAgentId, input.listingAgentId].filter((value): value is string => Boolean(value));
  return owners.includes(input.actorId);
}

export function invitationDeliveryPrecheck(input: { email: string | null | undefined; providerConfigured: boolean }): { ok: true; email: string } | { ok: false; status: number; error: string } {
  const email = input.email?.trim() ?? "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, status: 400, error: "This contact needs an email address before a secure verification request can be sent." };
  }
  if (!input.providerConfigured) {
    return { ok: false, status: 503, error: "Email delivery is not configured. The request was not created." };
  }
  return { ok: true, email };
}

const OPEN_INVITE = new Set(["created", "sent", "opened", "in_progress", "changes_requested"]);

export function replaceOpenInvitation(input: { status: string; expiresAt: string; now: Date } | null): "create" | "replace" {
  if (!input) return "create";
  if (!OPEN_INVITE.has(input.status)) return "create";
  if (new Date(input.expiresAt).getTime() <= input.now.getTime()) return "create";
  return "replace";
}

export function evidenceAccessDecision(scanStatus: string | null | undefined): { allowBytes: false; code: "EVIDENCE_QUARANTINED"; error: string } | { allowBytes: true } {
  if (scanStatus === "clean") return { allowBytes: true };
  if (scanStatus === "infected" || scanStatus === "quarantined") {
    return { allowBytes: false, code: "EVIDENCE_QUARANTINED", error: "This file is quarantined and cannot be opened." };
  }
  if (scanStatus === "scan_failed") {
    return { allowBytes: false, code: "EVIDENCE_QUARANTINED", error: "Scanning did not finish. The file stays blocked until a scanner completes." };
  }
  if (scanStatus === "scanning") {
    return { allowBytes: false, code: "EVIDENCE_QUARANTINED", error: "This file is still being scanned." };
  }
  return { allowBytes: false, code: "EVIDENCE_QUARANTINED", error: "This file has not been scanned. It stays quarantined until a scanner marks it clean." };
}

export function correctionMessages(input: { customerInstruction?: string | null; internalNote?: string | null }): { ok: true; customerInstruction: string; internalNote: string | null } | { ok: false; error: string } {
  const customerInstruction = input.customerInstruction?.trim() ?? "";
  const internalNote = input.internalNote?.trim() || null;
  if (customerInstruction.length < 8) return { ok: false, error: "Write what the customer should correct. Internal notes are not sent." };
  if (internalNote && customerInstruction.includes(internalNote)) return { ok: false, error: "The customer message must not include the internal note." };
  return { ok: true, customerInstruction: customerInstruction.slice(0, 1000), internalNote: internalNote?.slice(0, 1000) ?? null };
}

export function customerDeliveryText(customerInstruction: string, internalNote: string | null): string {
  const text = `What to correct: ${customerInstruction}`;
  if (internalNote && text.includes(internalNote)) return `What to correct: ${customerInstruction.replace(internalNote, "").trim()}`;
  return text;
}

export type SubmissionRequirement = {
  key: string;
  label: string;
  mandatory: boolean;
  evidence: string;
  state: string;
  fieldKeys: string[];
};

const ALREADY_IN_REVIEW = new Set(["submitted", "under_review", "verified", "waived", "not_applicable"]);

export function submissionDecision(input: {
  action: "save" | "submit";
  requirements: SubmissionRequirement[];
  fields: Record<string, string>;
  providedKeys: string[];
}): { ok: true; advance: boolean; updates: string[] } | { ok: false; error: string } {
  const provided = new Set(input.providedKeys);
  const updates = input.requirements.filter((item) => {
    if (ALREADY_IN_REVIEW.has(item.state)) return false;
    if (item.evidence === "document" || item.evidence === "payment") return provided.has(item.key);
    if (item.evidence === "field") return item.fieldKeys.length > 0 && item.fieldKeys.every((key) => Boolean(input.fields[key]?.trim()));
    if (item.evidence === "party") return provided.has(item.key);
    return false;
  }).map((item) => item.key);

  if (input.action === "save") return { ok: true, advance: false, updates: [] };

  const missing = input.requirements.filter((item) => item.mandatory && !ALREADY_IN_REVIEW.has(item.state) && !updates.includes(item.key));
  if (missing.length > 0) return { ok: false, error: `Complete ${missing[0]?.label ?? "the requested information"} before submitting.` };
  if (updates.length === 0) return { ok: false, error: "Add the requested information before submitting." };
  return { ok: true, advance: true, updates };
}

export function paymentStatusChange(input: {
  from: PaymentEvidenceState;
  to: PaymentEvidenceState;
  hasStoredFile: boolean;
  actorMayRecordFinance: boolean;
  actorMayCollect: boolean;
}): { ok: true } | { ok: false; status: number; error: string } {
  if (!canTransitionPayment(input.from, input.to) || input.from === input.to) {
    return { ok: false, status: 409, error: "That payment status is not available from the current state." };
  }
  if (input.to === "independently_confirmed") {
    const confirmed = confirmPayment({ from: input.from, actorMayRecordFinance: input.actorMayRecordFinance });
    if (!confirmed.ok) return { ok: false, status: 403, error: confirmed.error };
    return { ok: true };
  }
  if (input.to === "proof_uploaded") {
    if (!input.actorMayCollect && !input.actorMayRecordFinance) return { ok: false, status: 403, error: "You cannot record payment evidence." };
    if (!input.hasStoredFile) return { ok: false, status: 400, error: "Store the payment file before marking evidence submitted. A status change is not confirmation that money was received." };
    return { ok: true };
  }
  if (!input.actorMayRecordFinance) return { ok: false, status: 403, error: "Only an authorised reviewer can change payment verification." };
  return { ok: true };
}

export type RelatedPartyDraft = { fullName: string; relationshipType: "director" | "beneficial_owner" | "authorised_representative" };

function namesFrom(value: unknown): string[] {
  const source = Array.isArray(value) ? value : typeof value === "string" ? value.split(/\n|;/) : [];
  return source.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean);
}

export function relatedPartiesFromFields(fields: Record<string, unknown>): RelatedPartyDraft[] {
  const rows: RelatedPartyDraft[] = [
    ...namesFrom(fields.directors).map((fullName) => ({ fullName: fullName.slice(0, 200), relationshipType: "director" as const })),
    ...namesFrom(fields.beneficial_owners).map((fullName) => ({ fullName: fullName.slice(0, 200), relationshipType: "beneficial_owner" as const })),
  ];
  if (typeof fields.representative_name === "string" && fields.representative_name.trim()) {
    rows.push({ fullName: fields.representative_name.trim().slice(0, 200), relationshipType: "authorised_representative" });
  }
  const seen = new Set<string>();
  return rows.filter((row) => {
    const key = `${row.relationshipType}:${row.fullName.toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function partyRequirementSatisfied(requirementKey: string, parties: RelatedPartyDraft[]): boolean {
  if (requirementKey === "directors") return parties.some((party) => party.relationshipType === "director");
  if (requirementKey === "beneficial_owners") return parties.some((party) => party.relationshipType === "beneficial_owner");
  return false;
}
