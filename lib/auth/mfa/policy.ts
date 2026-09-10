/**
 * MFA policy by role — safe rollout for SUPER_ADMIN.
 *
 * Env:
 * - MFA_ENFORCE_SUPER_ADMIN=true → require MFA for SUPER_ADMIN after grace
 * - MFA_SUPER_ADMIN_GRACE_DAYS=14 (default) — days after ACCOUNT_SECURITY_ROLLOUT_AT
 * - ACCOUNT_SECURITY_ROLLOUT_AT=ISO date (default: 2026-09-09)
 *
 * Until enforcement is on (or grace not elapsed), SUPER_ADMIN is prompted but not locked out.
 */

import type { UserRole } from "@/types";

export type MfaPolicyLevel = "optional" | "recommended" | "required";

function rolloutAtMs(): number {
  const raw = process.env.ACCOUNT_SECURITY_ROLLOUT_AT?.trim();
  if (raw) {
    const t = Date.parse(raw);
    if (!Number.isNaN(t)) return t;
  }
  return Date.parse("2026-09-09T00:00:00.000Z");
}

function graceDays(): number {
  const n = Number(process.env.MFA_SUPER_ADMIN_GRACE_DAYS ?? "14");
  return Number.isFinite(n) && n >= 0 ? n : 14;
}

export function isSuperAdminMfaEnforced(nowMs = Date.now()): boolean {
  if (process.env.MFA_ENFORCE_SUPER_ADMIN !== "true") return false;
  const graceEnd = rolloutAtMs() + graceDays() * 24 * 60 * 60 * 1000;
  return nowMs >= graceEnd;
}

export function mfaPolicyForRole(role: UserRole | string, nowMs = Date.now()): MfaPolicyLevel {
  if (role === "SUPER_ADMIN" || role === "AGENCY_ADMIN") {
    return isSuperAdminMfaEnforced(nowMs) ? "required" : "recommended";
  }
  if (role === "CLIENT_MANAGER") return "recommended";
  return "optional";
}

export function mustHaveMfaToLogin(role: UserRole | string, mfaEnabled: boolean, nowMs = Date.now()): boolean {
  if (mfaEnabled) return true; // already enabled → always challenge
  return mfaPolicyForRole(role, nowMs) === "required";
}

export const MFA_SETUP_TTL_MS = 15 * 60 * 1000;
export const MFA_LOGIN_CHALLENGE_TTL_MS = 8 * 60 * 1000;
export const STEP_UP_TTL_MS = 10 * 60 * 1000;
export const RECOVERY_CODE_COUNT = 10;
