/**
 * Buyer / tenant requirement completeness — deterministic, based on matching inputs.
 */

export type RequirementFields = {
  buyer_budget_min?: number | null;
  buyer_budget_max?: number | null;
  buyer_bedrooms_wanted?: number | null;
  buyer_area_preference?: string | null;
  buyer_timeline?: string | null;
};

export const MATCHING_REQUIREMENT_KEYS = [
  "budget",
  "bedrooms",
  "area",
] as const;

export type MatchingRequirementKey = (typeof MATCHING_REQUIREMENT_KEYS)[number];

export type RequirementCompleteness = {
  captured: number;
  total: number;
  ready: boolean;
  missing: MatchingRequirementKey[];
  statusLabel: "READY TO MATCH" | "NEEDS MORE INFORMATION";
  summary: string;
};

export function hasBudget(fields: RequirementFields): boolean {
  return fields.buyer_budget_min != null || fields.buyer_budget_max != null;
}

export function hasBedrooms(fields: RequirementFields): boolean {
  return fields.buyer_bedrooms_wanted != null && Number(fields.buyer_bedrooms_wanted) > 0;
}

export function hasArea(fields: RequirementFields): boolean {
  return Boolean((fields.buyer_area_preference ?? "").trim());
}

export function requirementCompleteness(fields: RequirementFields): RequirementCompleteness {
  const checks: Array<{ key: MatchingRequirementKey; ok: boolean }> = [
    { key: "budget", ok: hasBudget(fields) },
    { key: "bedrooms", ok: hasBedrooms(fields) },
    { key: "area", ok: hasArea(fields) },
  ];
  const captured = checks.filter((c) => c.ok).length;
  const missing = checks.filter((c) => !c.ok).map((c) => c.key);
  const ready = captured === checks.length;
  return {
    captured,
    total: checks.length,
    ready,
    missing,
    statusLabel: ready ? "READY TO MATCH" : "NEEDS MORE INFORMATION",
    summary: `${captured} of ${checks.length} key requirements captured`,
  };
}

export const BUYER_TIMELINE_OPTIONS = [
  "Immediate",
  "Within 3 months",
  "3–6 months",
  "6–12 months",
  "Exploring",
] as const;

export const PROPERTY_TYPE_OPTIONS = [
  "House",
  "Townhouse",
  "Apartment",
  "Cluster",
  "Land",
  "Commercial",
  "Other",
] as const;

export function formatBudgetRange(
  min: number | null | undefined,
  max: number | null | undefined
): string | null {
  if (min == null && max == null) return null;
  const fmt = (n: number) => {
    if (n >= 1000) return `US$${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k`;
    return `US$${n.toLocaleString("en-US")}`;
  };
  if (min != null && max != null) return `${fmt(Number(min))} – ${fmt(Number(max))}`;
  if (min != null) return `From ${fmt(Number(min))}`;
  return `Up to ${fmt(Number(max))}`;
}

export function formatRequirementSummary(fields: RequirementFields): string | null {
  const beds = hasBedrooms(fields) ? `${fields.buyer_bedrooms_wanted}+ Bed` : null;
  const area = (fields.buyer_area_preference ?? "").trim() || null;
  const parts = [beds ? `${beds} House` : null, area].filter(Boolean);
  if (parts.length === 0) return null;
  return parts.join(" · ");
}

export function isDemandSide(dealSide: string | null | undefined): boolean {
  return dealSide === "buy_side" || dealSide === "tenant_side" || !dealSide;
}

export function isSupplySide(dealSide: string | null | undefined): boolean {
  return dealSide === "sell_side" || dealSide === "landlord_side";
}
