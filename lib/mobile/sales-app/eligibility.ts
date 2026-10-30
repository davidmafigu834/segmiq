import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { canActAsSalesperson } from "@/lib/auth/sales-capabilities";
import { normalizeUserRole } from "@/lib/auth/roles";
import type { MobileApiErrorCode } from "@/lib/mobile/sales-app/errors";

export type OrganisationAccessState = "active" | "inactive" | "security_suspended" | "missing";

export type MobileSalesCandidate = {
  userId: string;
  role: string | null | undefined;
  alsoSells: boolean | null | undefined;
  clientId: string | null | undefined;
  isActive: boolean;
};

export type MobileSalesEligibility =
  | { ok: true }
  | { ok: false; code: MobileApiErrorCode; error: string };

/**
 * Every SegmiQ Sales token issuance path must pass this check before a
 * user_sessions row is created: an active salesperson or selling manager whose
 * organisation is active and not security-suspended.
 */
export function evaluateMobileSalesEligibility(
  candidate: MobileSalesCandidate,
  organisation: OrganisationAccessState | null
): MobileSalesEligibility {
  if (!candidate.userId || !candidate.isActive) {
    return { ok: false, code: "ACCOUNT_DISABLED", error: "Unauthorized" };
  }
  const role = normalizeUserRole(candidate.role ?? null);
  if (
    !role ||
    !canActAsSalesperson({ userId: candidate.userId, role, alsoSells: Boolean(candidate.alsoSells) })
  ) {
    return {
      ok: false,
      code: "INSUFFICIENT_ROLE",
      error: "Segmiq Sales is for salesperson and selling manager accounts only.",
    };
  }
  if (!candidate.clientId) {
    return { ok: false, code: "NO_ORGANISATION", error: "Your account is not linked to a client." };
  }
  if (organisation !== "active") {
    return {
      ok: false,
      code: "ORGANISATION_SUSPENDED",
      error: "Your organisation's SegmiQ access is suspended. Contact your administrator.",
    };
  }
  return { ok: true };
}

/**
 * Same tenant lockout fields validateAuthClaims enforces on every request.
 * Throws when the database cannot be read so callers can answer 503 instead
 * of issuing a token they cannot vouch for.
 */
export async function loadOrganisationAccessState(
  clientId: string,
  supabase: SupabaseClient = createAdminClient()
): Promise<OrganisationAccessState> {
  const { data, error } = await supabase
    .from("clients")
    .select("is_active, is_archived, security_suspended_at")
    .eq("id", clientId)
    .maybeSingle();
  if (error) throw new Error(`Organisation access lookup unavailable: ${error.message}`);
  if (!data) return "missing";
  const row = data as {
    is_active?: boolean | null;
    is_archived?: boolean | null;
    security_suspended_at?: string | null;
  };
  if (row.is_active === false || row.is_archived === true) return "inactive";
  if (row.security_suspended_at) return "security_suspended";
  return "active";
}
