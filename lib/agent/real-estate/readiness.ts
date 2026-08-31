import {
  isDemandSide,
  requirementCompleteness,
  type RequirementFields,
} from "@/lib/real-estate/requirements";

export type MatchReadiness = {
  readyToMatch: boolean;
  statusLabel: "READY TO MATCH" | "NEEDS MORE INFORMATION" | "NOT_APPLICABLE";
  missing: string[];
  summary: string;
  guidance: string;
};

/** Deterministic gate before property.match — budget, bedrooms and area must be captured. */
export function evaluateMatchReadiness(
  dealSide: string | null | undefined,
  fields: RequirementFields
): MatchReadiness {
  if (!isDemandSide(dealSide)) {
    return {
      readyToMatch: false,
      statusLabel: "NOT_APPLICABLE",
      missing: [],
      summary: "Matching applies to buyers and tenants only.",
      guidance:
        "For sellers or landlords, qualify their property details and timeline instead of searching listings.",
    };
  }
  const completeness = requirementCompleteness(fields);
  return {
    readyToMatch: completeness.ready,
    statusLabel: completeness.statusLabel,
    missing: completeness.missing,
    summary: completeness.summary,
    guidance: completeness.ready
      ? "Requirements are sufficient — you may call property.match when the customer wants alternatives."
      : `Continue natural qualification. Still need: ${completeness.missing.join(", ")}.`,
  };
}
