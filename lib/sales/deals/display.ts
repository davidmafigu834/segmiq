/**
 * Deal domain — display helpers and stage constants.
 * Never expose raw enums in UI; use these labels.
 */

import type { DealStage, DealValueBasis, DealValueStatus } from "@/types";

export const DEAL_ACTIVE_STAGES = [
  "QUALIFIED",
  "SCOPING",
  "PROPOSAL_SENT",
  "NEGOTIATING",
] as const satisfies readonly DealStage[];

export type DealActiveStage = (typeof DEAL_ACTIVE_STAGES)[number];

export const DEAL_CLOSED_STAGES = ["WON", "LOST"] as const satisfies readonly DealStage[];

export const DEAL_STAGE_LABEL: Record<DealStage, string> = {
  QUALIFIED: "Qualified",
  SCOPING: "Scoping",
  PROPOSAL_SENT: "Proposal sent",
  NEGOTIATING: "Negotiating",
  WON: "Won",
  LOST: "Lost",
};

export const DEAL_STAGE_ACCENT: Record<DealActiveStage, string> = {
  QUALIFIED: "#2684FF",
  SCOPING: "#14B8A6",
  PROPOSAL_SENT: "#8B5CF6",
  NEGOTIATING: "#F59E0B",
};

export function formatDealStage(stage: string): string {
  if (stage in DEAL_STAGE_LABEL) return DEAL_STAGE_LABEL[stage as DealStage];
  return stage.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

export function isDealClosedStage(stage: string): boolean {
  return stage === "WON" || stage === "LOST";
}

export function isDealActiveStage(stage: string): stage is DealActiveStage {
  return (DEAL_ACTIVE_STAGES as readonly string[]).includes(stage);
}

export function getNextDealStage(stage: string): DealActiveStage | null {
  const idx = (DEAL_ACTIVE_STAGES as readonly string[]).indexOf(stage);
  if (idx < 0 || idx >= DEAL_ACTIVE_STAGES.length - 1) return null;
  return DEAL_ACTIVE_STAGES[idx + 1]!;
}

export function formatDealValueStatus(status: DealValueStatus | string | null | undefined): string {
  if (status === "KNOWN") return "Estimated";
  if (status === "RANGE") return "Estimated range";
  if (status === "PENDING_ESTIMATE") return "Value not estimated yet";
  return "Value not estimated yet";
}

export function formatDealValueBasis(basis: DealValueBasis | string | null | undefined): string | null {
  if (basis === "CUSTOMER_BUDGET") return "Customer budget";
  if (basis === "SALES_ESTIMATE") return "Sales estimate";
  if (basis === "LATEST_QUOTE") return "Latest quote";
  if (basis === "WON_VALUE") return "Won value";
  return null;
}

export const LEAD_LIFECYCLE_LABEL: Record<string, string> = {
  NEW: "New",
  CONTACTED: "Contacted",
  QUALIFIED: "Qualified",
  CONVERTED_TO_DEAL: "Deal created",
  NOT_QUALIFIED: "Not qualified",
  NEGOTIATING: "Negotiating (legacy)",
  PROPOSAL_SENT: "Proposal sent (legacy)",
  WON: "Won (legacy)",
  LOST: "Lost (legacy)",
};

export function formatLeadLifecycle(status: string): string {
  return LEAD_LIFECYCLE_LABEL[status] ?? formatDealStage(status);
}

export function isLeadConverted(status: string): boolean {
  return status === "CONVERTED_TO_DEAL";
}

export function isLeadOpenForQualification(status: string): boolean {
  return status === "NEW" || status === "CONTACTED" || status === "QUALIFIED";
}
