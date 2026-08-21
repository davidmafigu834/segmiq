/** Enterprise / trade-friendly units of measure. */
export const QUOTE_UNITS = [
  "Each",
  "Unit",
  "Lot",
  "Project",
  "Hour",
  "Day",
  "Week",
  "Month",
  "Metre",
  "m²",
  "m³",
  "Tonne",
  "Kilometre",
] as const;

export type QuoteUnit = (typeof QUOTE_UNITS)[number] | string;

export function normalizeUnit(unit: string | null | undefined): string {
  const u = (unit ?? "").trim();
  return u || "Each";
}
