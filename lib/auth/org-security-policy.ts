/**
 * Organisation security policy (Phase 6).
 * Stored on clients.security_policy JSONB. Server clamps unsafe values.
 */

export type OrgMfaRequirement = "off" | "managers" | "all";

export type OrgSecurityPolicy = {
  mfaRequirement: OrgMfaRequirement;
  /** Idle timeout hours (human activity). Clamped 1–24. */
  idleTtlHours: number | null;
  /** Absolute session lifetime hours. Clamped 8–168. */
  absoluteTtlHours: number | null;
  /** ISO timestamp — until then MFA policy prompts but does not hard-block CRM. */
  mfaGraceUntil: string | null;
  allowDataExports: boolean;
};

export const DEFAULT_ORG_SECURITY_POLICY: OrgSecurityPolicy = {
  mfaRequirement: "off",
  idleTtlHours: null,
  absoluteTtlHours: null,
  mfaGraceUntil: null,
  allowDataExports: true,
};

const IDLE_MIN = 1;
const IDLE_MAX = 24;
const ABS_MIN = 8;
const ABS_MAX = 168; // 7d

export function parseOrgSecurityPolicy(raw: unknown): OrgSecurityPolicy {
  const src = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const mfa =
    src.mfaRequirement === "managers" || src.mfaRequirement === "all" || src.mfaRequirement === "off"
      ? src.mfaRequirement
      : "off";
  let idle: number | null =
    typeof src.idleTtlHours === "number" && Number.isFinite(src.idleTtlHours)
      ? Math.round(src.idleTtlHours)
      : null;
  let abs: number | null =
    typeof src.absoluteTtlHours === "number" && Number.isFinite(src.absoluteTtlHours)
      ? Math.round(src.absoluteTtlHours)
      : null;
  if (idle != null) idle = Math.min(IDLE_MAX, Math.max(IDLE_MIN, idle));
  if (abs != null) abs = Math.min(ABS_MAX, Math.max(ABS_MIN, abs));
  return {
    mfaRequirement: mfa,
    idleTtlHours: idle,
    absoluteTtlHours: abs,
    mfaGraceUntil: typeof src.mfaGraceUntil === "string" ? src.mfaGraceUntil : null,
    allowDataExports: src.allowDataExports === false ? false : true,
  };
}

export function orgMfaRequiredForRole(
  policy: OrgSecurityPolicy,
  role: string,
  nowMs = Date.now()
): boolean {
  if (role === "SUPER_ADMIN" || role === "AGENCY_ADMIN") return false; // platform MFA is separate
  if (policy.mfaRequirement === "off") return false;
  if (policy.mfaGraceUntil) {
    const grace = Date.parse(policy.mfaGraceUntil);
    if (!Number.isNaN(grace) && nowMs < grace) return false;
  }
  if (policy.mfaRequirement === "all") return true;
  if (policy.mfaRequirement === "managers") {
    return role === "CLIENT_MANAGER";
  }
  return false;
}

export function idleTtlMsFromOrgPolicy(
  policy: OrgSecurityPolicy | null | undefined,
  fallbackMs: number
): number {
  if (!policy?.idleTtlHours) return fallbackMs;
  return policy.idleTtlHours * 60 * 60 * 1000;
}

export function absoluteTtlMsFromOrgPolicy(
  policy: OrgSecurityPolicy | null | undefined,
  fallbackMs: number
): number {
  if (!policy?.absoluteTtlHours) return fallbackMs;
  return policy.absoluteTtlHours * 60 * 60 * 1000;
}
