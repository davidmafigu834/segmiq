import type { LeadStatus } from "@/types";

export type DealValueSource = "manual" | "proposal";

/** Open stages where reps may enter a manual deal estimate. */
export const MANUAL_DEAL_VALUE_STATUSES: readonly LeadStatus[] = [
  "CONTACTED",
  "NEGOTIATING",
  "PROPOSAL_SENT",
];

export function isDealValueLocked(source: DealValueSource | null | undefined): boolean {
  return source === "proposal";
}

export function canSetManualDealValue(source: DealValueSource | null | undefined): boolean {
  return !isDealValueLocked(source);
}

export function canEnterManualDealValue(status: string): boolean {
  return (MANUAL_DEAL_VALUE_STATUSES as readonly string[]).includes(status);
}

export function parseDealValueInput(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const n = parseFloat(trimmed.replace(/[^0-9.]/g, ""));
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100) / 100;
}

/** PATCH payload when a rep saves their own estimate. */
export function manualDealValueUpdate(
  value: number | null
): { deal_value: number | null; deal_value_source: DealValueSource | null } {
  if (value == null || value <= 0) {
    return { deal_value: null, deal_value_source: null };
  }
  return { deal_value: value, deal_value_source: "manual" };
}

/** Lead update when a quotation total becomes the authoritative deal value. */
export function proposalDealValueUpdate(
  total: number
): { deal_value: number; deal_value_source: DealValueSource } | null {
  const value = Number(total);
  if (!Number.isFinite(value) || value <= 0) return null;
  return { deal_value: Math.round(value * 100) / 100, deal_value_source: "proposal" };
}

export function dealValueSourceLabel(source: DealValueSource | null | undefined): string | null {
  if (source === "proposal") return "From proposal";
  if (source === "manual") return "Rep estimate";
  return null;
}
