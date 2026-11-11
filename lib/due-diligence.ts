/**
 * Public entry for the sale-mandate check.
 * The pieces live under lib/real-estate/due-diligence so a new rule can be added
 * without changing the upload or report routes.
 */
export { evaluateDueDiligence } from "@/lib/real-estate/due-diligence/evaluate";
export { extractDocument } from "@/lib/real-estate/due-diligence/extract";
export { buildChecks, requiredDocumentTypes } from "@/lib/real-estate/due-diligence/rules";
export { decideStatus, scoreRisk, PASS_SCORE, CONDITIONAL_SCORE } from "@/lib/real-estate/due-diligence/scoring";
export { verifySellerIdentity } from "@/lib/identity-verification";
export { runDueDiligence, getMandate } from "@/lib/real-estate/due-diligence/service";
export type { Evaluation, EvaluationInput, DocumentExtraction, IdentityOutcome } from "@/lib/real-estate/due-diligence/types";
