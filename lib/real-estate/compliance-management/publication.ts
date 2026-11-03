import type { SupabaseClient } from "@supabase/supabase-js";
import { listingPublicationDecision, type ReadinessState } from "@/lib/real-estate/compliance-management/engine";

function relationMissing(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  const message = `${error.code ?? ""} ${error.message ?? ""}`.toLowerCase();
  return message.includes("pgrst205") || message.includes("42p01") || message.includes("does not exist") || message.includes("schema cache");
}

/**
 * Existing listing approval remains the publication gate.
 * This blocks a public page only after the organisation turns on listing-readiness enforcement.
 * A database that has not received the foundation migration stays on the current gate.
 */
export async function listingCompliancePublication(
  db: SupabaseClient,
  clientId: string,
  listingId: string
): Promise<"inactive" | "clear" | "blocked"> {
  const policies = await db
    .from("compliance_policy_versions")
    .select("template_key, status, enforcement")
    .eq("client_id", clientId)
    .eq("template_key", "listing_readiness")
    .eq("status", "active")
    .limit(5);
  if (relationMissing(policies.error)) return "inactive";
  if (policies.error) return "blocked";
  const enforced = (policies.data ?? []).some((row) => {
    const enforcement = row.enforcement as { listing_publication?: boolean } | null;
    return enforcement?.listing_publication === true;
  });
  if (!enforced) return "inactive";

  const propertyCase = await db
    .from("compliance_cases")
    .select("readiness, context")
    .eq("client_id", clientId)
    .eq("listing_id", listingId)
    .eq("context", "property")
    .limit(1)
    .maybeSingle();
  if (propertyCase.error) return "blocked";
  return listingPublicationDecision({
    enforcementActive: true,
    caseReadiness: (propertyCase.data?.readiness as ReadinessState | undefined) ?? null,
  });
}
