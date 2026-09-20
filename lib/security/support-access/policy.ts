/**
 * Pure decision layer for Support Access.
 *
 * Everything here is side-effect free so the authorisation rules can be tested
 * without a database. The server is the only authority: callers must load the
 * grant from the database and pass it in — never from a cookie, query string,
 * or client-side state.
 */

import {
  parseSupportAccessScopes,
  type SupportAccessScope,
} from "./scopes";

export type SupportAccessStatus =
  | "PENDING"
  | "APPROVED"
  | "ACTIVE"
  | "EXPIRED"
  | "REVOKED"
  | "DENIED";

export type SupportAccessKind = "SUPPORT" | "BREAK_GLASS";

export type SupportAccessApprovalMode =
  | "SELF_APPROVAL"
  | "SECOND_ADMIN_REQUIRED"
  | "CLIENT_APPROVAL";

/** Durations offered in the request modal. Permanent access is not possible. */
export const SUPPORT_ACCESS_DURATION_OPTIONS = [15, 30, 60, 120] as const;
export const SUPPORT_ACCESS_MAX_DURATION_MINUTES = 120;
/** Emergency access is deliberately shorter than ordinary support access. */
export const BREAK_GLASS_MAX_DURATION_MINUTES = 30;
export const SUPPORT_ACCESS_MIN_REASON_LENGTH = 24;
export const SUPPORT_ACCESS_MAX_REASON_LENGTH = 1000;

export type SupportAccessGrant = {
  id: string;
  reference: string;
  adminUserId: string;
  clientId: string;
  status: SupportAccessStatus;
  accessKind: SupportAccessKind;
  approvalMode: SupportAccessApprovalMode;
  scopes: SupportAccessScope[];
  reason: string;
  ticketReference: string | null;
  durationMinutes: number;
  requestedAt: string;
  approvedAt: string | null;
  approvedByUserId: string | null;
  startedAt: string | null;
  expiresAt: string | null;
  revokedAt: string | null;
  revokedReason: string | null;
  deniedAt: string | null;
  denialReason: string | null;
};

export type SupportAccessDenialCode =
  | "SUPPORT_ACCESS_REQUIRED"
  | "SUPPORT_ACCESS_WRONG_ADMIN"
  | "SUPPORT_ACCESS_WRONG_ORGANISATION"
  | "SUPPORT_ACCESS_NOT_ACTIVE"
  | "SUPPORT_ACCESS_EXPIRED"
  | "SUPPORT_ACCESS_REVOKED"
  | "SUPPORT_ACCESS_SCOPE_MISSING";

export type SupportAccessDecision =
  | { ok: true; grant: SupportAccessGrant; expiresInMs: number }
  | { ok: false; code: SupportAccessDenialCode; status: 403; message: string };

const DENIAL_MESSAGES: Record<SupportAccessDenialCode, string> = {
  SUPPORT_ACCESS_REQUIRED:
    "This organisation's client data is restricted. Start Support Access to continue.",
  SUPPORT_ACCESS_WRONG_ADMIN:
    "This Support Access session belongs to another administrator.",
  SUPPORT_ACCESS_WRONG_ORGANISATION:
    "Your Support Access session does not cover this organisation.",
  SUPPORT_ACCESS_NOT_ACTIVE: "Support Access has not been activated.",
  SUPPORT_ACCESS_EXPIRED: "Support Access expired. Client data has been locked again.",
  SUPPORT_ACCESS_REVOKED: "Support Access was ended for this organisation.",
  SUPPORT_ACCESS_SCOPE_MISSING:
    "Your Support Access session does not include this data category.",
};

export function supportAccessDenial(
  code: SupportAccessDenialCode
): Extract<SupportAccessDecision, { ok: false }> {
  return { ok: false, code, status: 403, message: DENIAL_MESSAGES[code] };
}

function toMs(value: string | null): number | null {
  if (!value) return null;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
}

/**
 * Status the grant actually has right now. A stored ACTIVE row whose expiry has
 * passed is EXPIRED — the database row is updated lazily, never trusted blindly.
 */
export function effectiveGrantStatus(
  grant: Pick<SupportAccessGrant, "status" | "expiresAt" | "revokedAt">,
  nowMs: number = Date.now()
): SupportAccessStatus {
  if (grant.revokedAt) return "REVOKED";
  if (grant.status === "ACTIVE") {
    const expiry = toMs(grant.expiresAt);
    if (expiry == null || expiry <= nowMs) return "EXPIRED";
    return "ACTIVE";
  }
  return grant.status;
}

export function grantRemainingMs(
  grant: Pick<SupportAccessGrant, "status" | "expiresAt" | "revokedAt">,
  nowMs: number = Date.now()
): number {
  if (effectiveGrantStatus(grant, nowMs) !== "ACTIVE") return 0;
  const expiry = toMs(grant.expiresAt);
  return expiry == null ? 0 : Math.max(0, expiry - nowMs);
}

/**
 * The single authorisation rule for privileged client-data access.
 *
 * Checks, in order: grant exists, belongs to this administrator, belongs to the
 * requested organisation, is ACTIVE, has not expired, has not been revoked, and
 * includes the required scope.
 */
export function evaluateSupportAccess(input: {
  grant: SupportAccessGrant | null | undefined;
  adminUserId: string;
  clientId: string;
  scope: SupportAccessScope;
  nowMs?: number;
}): SupportAccessDecision {
  const { grant, adminUserId, clientId, scope } = input;
  const nowMs = input.nowMs ?? Date.now();

  if (!grant) return supportAccessDenial("SUPPORT_ACCESS_REQUIRED");
  if (!adminUserId || grant.adminUserId !== adminUserId) {
    return supportAccessDenial("SUPPORT_ACCESS_WRONG_ADMIN");
  }
  if (!clientId || grant.clientId !== clientId) {
    return supportAccessDenial("SUPPORT_ACCESS_WRONG_ORGANISATION");
  }

  const status = effectiveGrantStatus(grant, nowMs);
  if (status === "REVOKED") return supportAccessDenial("SUPPORT_ACCESS_REVOKED");
  if (status === "EXPIRED") return supportAccessDenial("SUPPORT_ACCESS_EXPIRED");
  if (status !== "ACTIVE") return supportAccessDenial("SUPPORT_ACCESS_NOT_ACTIVE");

  if (!grant.scopes.includes(scope)) {
    return supportAccessDenial("SUPPORT_ACCESS_SCOPE_MISSING");
  }

  return { ok: true, grant, expiresInMs: grantRemainingMs(grant, nowMs) };
}

/** Platform policy for who may approve a request. Configured, never inferred. */
export function resolveApprovalMode(
  raw: string | null | undefined = process.env.SUPPORT_ACCESS_APPROVAL_MODE
): SupportAccessApprovalMode {
  const value = raw?.trim().toUpperCase();
  if (value === "SECOND_ADMIN_REQUIRED") return "SECOND_ADMIN_REQUIRED";
  if (value === "CLIENT_APPROVAL") return "CLIENT_APPROVAL";
  // SegmiQ runs a single internal platform admin today. Self-approval is an
  // explicit, auditable policy mode — not an implicit Super Admin bypass.
  return "SELF_APPROVAL";
}

export function maxDurationMinutes(kind: SupportAccessKind): number {
  return kind === "BREAK_GLASS"
    ? BREAK_GLASS_MAX_DURATION_MINUTES
    : SUPPORT_ACCESS_MAX_DURATION_MINUTES;
}

export type SupportAccessRequestInput = {
  clientId?: unknown;
  reason?: unknown;
  ticketReference?: unknown;
  scopes?: unknown;
  durationMinutes?: unknown;
  accessKind?: unknown;
};

export type ValidatedSupportAccessRequest = {
  clientId: string;
  reason: string;
  ticketReference: string | null;
  scopes: SupportAccessScope[];
  durationMinutes: number;
  accessKind: SupportAccessKind;
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Reject blank or throwaway reasons; a reason must describe the issue. */
export function validateSupportAccessRequest(
  input: SupportAccessRequestInput
):
  | { ok: true; value: ValidatedSupportAccessRequest }
  | { ok: false; error: string } {
  const clientId = typeof input.clientId === "string" ? input.clientId.trim() : "";
  if (!UUID_RE.test(clientId)) {
    return { ok: false, error: "A valid organisation is required" };
  }

  const reason = typeof input.reason === "string" ? input.reason.trim() : "";
  if (reason.length < SUPPORT_ACCESS_MIN_REASON_LENGTH) {
    return {
      ok: false,
      error: `Describe the issue in at least ${SUPPORT_ACCESS_MIN_REASON_LENGTH} characters`,
    };
  }
  if (reason.length > SUPPORT_ACCESS_MAX_REASON_LENGTH) {
    return { ok: false, error: "Reason is too long" };
  }
  // A reason padded with one repeated word is not a reason.
  if (new Set(reason.toLowerCase().split(/\s+/).filter(Boolean)).size < 4) {
    return { ok: false, error: "Describe why client-data access is required" };
  }

  const scopes = parseSupportAccessScopes(input.scopes);
  if (!scopes.length) {
    return { ok: false, error: "Select at least one access scope" };
  }

  const accessKind: SupportAccessKind =
    input.accessKind === "BREAK_GLASS" ? "BREAK_GLASS" : "SUPPORT";

  const durationMinutes = Number(input.durationMinutes);
  if (!Number.isInteger(durationMinutes) || durationMinutes <= 0) {
    return { ok: false, error: "Select an access duration" };
  }
  if (durationMinutes > maxDurationMinutes(accessKind)) {
    return {
      ok: false,
      error: `Access cannot exceed ${maxDurationMinutes(accessKind)} minutes`,
    };
  }

  const ticketRaw =
    typeof input.ticketReference === "string" ? input.ticketReference.trim() : "";
  const ticketReference = ticketRaw ? ticketRaw.slice(0, 64) : null;

  return {
    ok: true,
    value: { clientId, reason, ticketReference, scopes, durationMinutes, accessKind },
  };
}

/**
 * Whether the requesting administrator may also approve their own request.
 * SELF_APPROVAL is a deliberate policy mode for a single-admin platform team.
 */
export function canSelfApprove(mode: SupportAccessApprovalMode): boolean {
  return mode === "SELF_APPROVAL";
}

/** Human countdown for banners. The server expiry remains authoritative. */
export function formatRemaining(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}
