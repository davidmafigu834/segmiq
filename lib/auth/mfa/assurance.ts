/**
 * Phase 6.1 — MFA assurance at the authorization boundary.
 * Policy-required MFA is not satisfied by password alone.
 */

import { NextResponse } from "next/server";
import { isMfaEnabled, mustEnrollMfa } from "@/lib/auth/mfa/service";
import { isMfaRestrictedAllowlistedPath } from "@/lib/auth/mfa/allowlist";
import { createAdminClient } from "@/lib/supabase/admin";
import type { UserRole } from "@/types";

export { isMfaRestrictedAllowlistedPath } from "@/lib/auth/mfa/allowlist";

export type MfaAssurance = {
  mfaRequired: boolean;
  mfaSatisfied: boolean;
  mfaEnrolmentRequired: boolean;
};

async function sessionHasMfaProof(sessionId: string | null | undefined): Promise<boolean> {
  if (!sessionId) return false;
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("user_sessions")
    .select("mfa_verified_at, auth_strength, revoked_at")
    .eq("id", sessionId)
    .maybeSingle();
  if (!data || data.revoked_at) return false;
  if (data.mfa_verified_at) return true;
  return data.auth_strength === "password_mfa";
}

export async function evaluateMfaAssurance(opts: {
  userId: string;
  role: UserRole | string;
  clientId: string | null;
  /** When MFA is enrolled, this session must show MFA proof. */
  sessionId?: string | null;
}): Promise<MfaAssurance> {
  const enrolled = await isMfaEnabled(opts.userId);
  if (enrolled) {
    const satisfied = await sessionHasMfaProof(opts.sessionId);
    return {
      mfaRequired: true,
      mfaSatisfied: satisfied,
      mfaEnrolmentRequired: false,
    };
  }

  const needsEnrol = await mustEnrollMfa(opts.userId, opts.role, {
    clientId: opts.clientId,
  });
  if (needsEnrol) {
    return { mfaRequired: true, mfaSatisfied: false, mfaEnrolmentRequired: true };
  }

  return { mfaRequired: false, mfaSatisfied: true, mfaEnrolmentRequired: false };
}

export function mfaDeniedResponse(kind: "enrolment" | "challenge" = "challenge"): NextResponse {
  if (kind === "enrolment") {
    return NextResponse.json(
      {
        error: "MFA_ENROLMENT_REQUIRED",
        message: "Complete two-step verification before using SegmiQ.",
        enrollPath: "/client/settings/security",
      },
      { status: 403 }
    );
  }
  return NextResponse.json(
    {
      error: "MFA_REQUIRED",
      message: "Confirm two-step verification for this session.",
    },
    { status: 403 }
  );
}

/**
 * After auth resolves: block normal APIs when MFA is required but not satisfied
 * for this session (enrolment or missing session MFA proof).
 * Allowlisted MFA/session endpoints stay reachable.
 */
export function assertMfaApiAccess(
  assurance: MfaAssurance,
  req: Request | null | undefined
): { ok: true } | { ok: false; response: NextResponse } {
  if (assurance.mfaSatisfied) return { ok: true };

  let path = "";
  try {
    if (req) path = new URL(req.url).pathname;
  } catch {
    path = "";
  }
  if (path && isMfaRestrictedAllowlistedPath(path)) return { ok: true };

  const kind = assurance.mfaEnrolmentRequired ? "enrolment" : "challenge";
  if (!req || !path) {
    return { ok: false, response: mfaDeniedResponse(kind) };
  }
  return { ok: false, response: mfaDeniedResponse(kind) };
}
