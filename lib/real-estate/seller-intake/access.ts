import { isAgencyManager, sameOrganisation } from "@/lib/real-estate/deal-access";
import { canReviewMandate } from "@/lib/real-estate/acquisition-plan";
import { fieldsForKind, type IntakeField, type IntakeKind } from "@/lib/real-estate/seller-intake/fields";

export type TokenPurpose = "initial" | "resume" | "correction";

export function linkAccess(input: {
  status: string;
  expiresAt: string | null;
  revokedAt: string | null;
  now: Date;
}): { ok: true } | { ok: false; reason: "expired" | "revoked" | "closed" } {
  if (input.revokedAt || input.status === "revoked") return { ok: false, reason: "revoked" };
  if (input.status === "accepted" || input.status === "expired") return { ok: false, reason: "closed" };
  if (!input.expiresAt || new Date(input.expiresAt).getTime() <= input.now.getTime()) return { ok: false, reason: "expired" };
  return { ok: true };
}

/**
 * A newly opened link does not reveal saved answers.
 * The browser session, or a later resume/correction link, is the scoped secret for those answers.
 * A phone or name match is never enough.
 */
export function canReadSavedAnswers(input: { purpose: TokenPurpose; sessionMatches: boolean }): boolean {
  if (input.sessionMatches) return true;
  return input.purpose === "resume" || input.purpose === "correction";
}

export function canReviewIntake(input: {
  role: string | null | undefined;
  userId: string;
  userClientId: string | null | undefined;
  resourceClientId: string;
  responsibleAgentId: string | null | undefined;
}): boolean {
  if (input.role === "SUPER_ADMIN") return true;
  if (!sameOrganisation(input.userClientId, input.resourceClientId)) return false;
  if (isAgencyManager(input.role)) return true;
  return input.role === "SALESPERSON" && input.responsibleAgentId === input.userId;
}

export function canSeeRestrictedIntake(input: {
  role: string | null | undefined;
  userClientId: string | null | undefined;
  resourceClientId: string;
}): boolean {
  if (input.role === "SUPER_ADMIN") return true;
  return sameOrganisation(input.userClientId, input.resourceClientId) && isAgencyManager(input.role);
}

export function intakeReviewGrantsMandateApproval(): boolean {
  return false;
}

export function salespersonMandateReviewStaysClosed(input: {
  role: string;
  userId: string;
  userClientId: string;
  resourceClientId: string;
}): boolean {
  return canReviewMandate(input) === false && input.role === "SALESPERSON";
}

export function projectAnswers(input: {
  kind: IntakeKind;
  answers: Record<string, string>;
  canSeeRestricted: boolean;
  includeValues: boolean;
}): { fields: Array<IntakeField & { value: string | null }>; restrictedPending: boolean } {
  let restrictedPending = false;
  const fields = fieldsForKind(input.kind).map((field) => {
    const raw = input.answers[field.key] ?? "";
    if (!input.includeValues) return { ...field, value: null };
    if (field.restricted && !input.canSeeRestricted) {
      if (raw) restrictedPending = true;
      return { ...field, value: raw ? "Submitted for a permitted reviewer" : "" };
    }
    return { ...field, value: raw };
  });
  return { fields, restrictedPending };
}

export function publicFormProjection(input: {
  kind: IntakeKind;
  purpose: TokenPurpose;
  answers: Record<string, string>;
  acceptedGroups: readonly string[];
  rejected: ReadonlyArray<{ group: string; instruction: string }>;
  canRead: boolean;
  templateTitle: string;
  clauses: readonly string[];
  exclusivityNote: string | null;
}): {
  title: string;
  kind: IntakeKind;
  clauses: string[];
  exclusivityNote: string | null;
  fields: Array<IntakeField & { value: string; locked: boolean; instruction: string | null }>;
  draftExists: boolean;
} {
  const rejected = new Map(input.rejected.map((item) => [item.group, item.instruction]));
  const showSaved = input.canRead;
  return {
    title: input.templateTitle,
    kind: input.kind,
    clauses: [...input.clauses],
    exclusivityNote: input.exclusivityNote,
    draftExists: Object.values(input.answers).some(Boolean) && !showSaved,
    fields: fieldsForKind(input.kind).map((field) => {
      const locked = input.purpose === "correction" && input.acceptedGroups.includes(field.group);
      const askingAgain = input.purpose === "correction" && rejected.has(field.group);
      const saved = input.answers[field.key] ?? "";
      const value = locked ? saved : showSaved && !askingAgain ? saved : "";
      return { ...field, value, locked, instruction: rejected.get(field.group) ?? null };
    }),
  };
}

export const INTAKE_LINK_TTL_MS = 14 * 24 * 60 * 60 * 1000;

export function sellerSessionCookieValue(requestId: string, secret: string): string {
  return `${requestId}.${secret}`;
}

/** A cookie for another request is ignored. It cannot select or reveal that request. */
export function parseSellerSessionCookie(value: string | null, requestId: string): { secret: string } | null {
  if (!value) return null;
  let decoded = value;
  try { decoded = decodeURIComponent(value); } catch { return null; }
  const dot = decoded.indexOf(".");
  if (dot < 1) return null;
  const id = decoded.slice(0, dot);
  const secret = decoded.slice(dot + 1);
  if (id !== requestId || secret.length < 20) return null;
  return { secret };
}

export function nextActionLabel(status: string): string | null {
  switch (status) {
    case "draft_link":
      return "Share the seller form";
    case "in_progress":
      return "Seller is completing the form";
    case "submitted":
      return "Review the seller intake";
    case "changes_requested":
      return "Waiting for seller corrections";
    case "review_incomplete":
      return "Retry the seller intake review";
    case "review_applying":
      return "Seller intake review is in progress";
    case "accepted":
      return "Collect the signed mandate and evidence";
    default:
      return null;
  }
}
