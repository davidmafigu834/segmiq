export type ActivationDecision =
  | { allowed: true; reason: "legacy_exempt" | "commercial_ready" }
  | {
      allowed: false;
      reason:
        | "feature_disabled"
        | "agreement_missing"
        | "agreement_not_executed"
        | "document_not_sealed"
        | "billing_not_ready";
    };
export function decideCommercialActivation(input: {
  legacyCustomer: boolean;
  gateEnabled: boolean;
  agreementStatus: string | null;
  agreementPdfSha256: string | null;
  billingReady: boolean;
  approvedExceptionReference?: string | null;
}): ActivationDecision {
  if (input.legacyCustomer) return { allowed: true, reason: "legacy_exempt" };
  if (!input.gateEnabled) return { allowed: false, reason: "feature_disabled" };
  if (!input.agreementStatus)
    return { allowed: false, reason: "agreement_missing" };
  if (input.agreementStatus !== "executed")
    return { allowed: false, reason: "agreement_not_executed" };
  if (!input.agreementPdfSha256)
    return { allowed: false, reason: "document_not_sealed" };
  if (!input.billingReady && !input.approvedExceptionReference?.trim())
    return { allowed: false, reason: "billing_not_ready" };
  return { allowed: true, reason: "commercial_ready" };
}
