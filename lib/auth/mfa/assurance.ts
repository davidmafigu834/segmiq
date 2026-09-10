import { NextResponse } from "next/server";
import { isMfaEnabled, mustEnrollMfa } from "@/lib/auth/mfa/service";
import { isMfaRestrictedAllowlistedPath } from "@/lib/auth/mfa/allowlist";
import type { UserRole } from "@/types";

export { isMfaRestrictedAllowlistedPath } from "@/lib/auth/mfa/allowlist";

/**
 * Phase 6.1 — MFA assurance at the authorization boundary.
 * Policy-required MFA is not satisfied by password alone.
 */

export type MfaAssurance = {
  mfaRequired: boolean;
  mfaSatisfied: boolean;
  mfaEnrolmentRequired: boolean;
};

export async function evaluateMfaAssurance(opts: {
  userId: string;
  role: UserRole | string;
  clientId: string | null;
}): Promise<MfaAssurance> {
  const enrolled = await isMfaEnabled(opts.userId);
  if (enrolled) {
    // Enrolled users only receive sessions after MFA challenge (mfa_verified_at).
    return { mfaRequired: true, mfaSatisfied: true, mfaEnrolmentRequired: false };
  }

  const needsEnrol = await mustEnrollMfa(opts.userId, opts.role, {
    clientId: opts.clientId,
  });
  if (needsEnrol) {
    return { mfaRequired: true, mfaSatisfied: false, mfaEnrolmentRequired: true };
  }

  return { mfaRequired: false, mfaSatisfied: true, mfaEnrolmentRequired: false };
}

export function mfaDeniedResponse(): NextResponse {
  return NextResponse.json(
    {
      error: "MFA_ENROLMENT_REQUIRED",
      message: "Complete two-step verification before using SegmiQ.",
      enrollPath: "/client/settings/security",
    },
    { status: 403 }
  );
}

/**
 * After auth resolves: block normal APIs when enrolment is still required.
 * Allowlisted MFA/session endpoints stay reachable.
 */
export function assertMfaApiAccess(
  assurance: MfaAssurance,
  req: Request | null | undefined
): { ok: true } | { ok: false; response: NextResponse } {
  if (assurance.mfaSatisfied) return { ok: true };
  if (!assurance.mfaEnrolmentRequired) return { ok: true };

  let path = "";
  try {
    if (req) path = new URL(req.url).pathname;
  } catch {
    path = "";
  }
  if (path && isMfaRestrictedAllowlistedPath(path)) return { ok: true };
  // Cookie-only guards without Request cannot safely allow CRM access.
  if (!req) {
    return { ok: false, response: mfaDeniedResponse() };
  }
  if (!path) return { ok: false, response: mfaDeniedResponse() };
  return { ok: false, response: mfaDeniedResponse() };
}
