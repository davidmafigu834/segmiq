/**
 * Solar sales workflow types.
 *
 * Display stage is derived. The only persisted commercial intents are
 * SITE_VISIT_REQUIRED and NEGOTIATING. Quote Sent, Site Visit Completed,
 * Proposal Prepared, Won, and Lost come from quotations, visits, and deals.
 */

export const SALES_WORKFLOW_PRESETS = ["GENERAL_TRADES", "SOLAR_INSTALLATION"] as const;
export type SalesWorkflowPreset = (typeof SALES_WORKFLOW_PRESETS)[number];

export const SOLAR_SALES_STAGES = [
  "NEW_LEAD",
  "CONTACTED",
  "QUALIFIED",
  "SITE_VISIT_REQUIRED",
  "SITE_VISIT_COMPLETED",
  "PROPOSAL_PREPARED",
  "QUOTE_SENT",
  "NEGOTIATION",
  "WON",
  "LOST",
] as const;

export type SolarSalesStage = (typeof SOLAR_SALES_STAGES)[number];

export const SALES_SITE_VISIT_STATUSES = [
  "SCHEDULED",
  "ON_SITE",
  "COMPLETED",
  "CANCELLED",
  "RESCHEDULED",
  "NO_ACCESS",
] as const;

export type SalesSiteVisitStatus = (typeof SALES_SITE_VISIT_STATUSES)[number];

export const SALES_COMMERCIAL_INTENTS = ["SITE_VISIT_REQUIRED", "NEGOTIATING"] as const;
export type SalesCommercialIntent = (typeof SALES_COMMERCIAL_INTENTS)[number];

export type SolarQuoteFact = {
  id?: string;
  status: string;
  approvalStatus?: string | null;
  sentAt?: string | null;
  number?: string | null;
  total?: number | null;
  currency?: string | null;
  viewedAt?: string | null;
  viewCount?: number | null;
  acceptedAt?: string | null;
  createdAt?: string | null;
};

export type SolarVisitFact = {
  id?: string;
  status: string;
  scheduledStartAt?: string | null;
  assessmentStatus?: "DRAFT" | "COMPLETED" | null;
  completedAt?: string | null;
};

export type SolarSalesFacts = {
  preset: SalesWorkflowPreset;
  leadStatus: string | null;
  dealStage: string | null;
  /** Narrow manual commercial state. Facts above override it. */
  salesCommercialIntent: SalesCommercialIntent | null;
  visits: SolarVisitFact[];
  quotes: SolarQuoteFact[];
};

export type SolarTransitionAction =
  | "update_lead"
  | "require_visit"
  | "schedule_visit"
  | "complete_visit"
  | "create_quote"
  | "send_quote"
  | "negotiate"
  | "mark_won"
  | "mark_lost"
  | "none";

export function isSalesWorkflowPreset(value: string | null | undefined): value is SalesWorkflowPreset {
  return value === "GENERAL_TRADES" || value === "SOLAR_INSTALLATION";
}

export function isSolarSalesStage(value: string | null | undefined): value is SolarSalesStage {
  return (SOLAR_SALES_STAGES as readonly string[]).includes(value ?? "");
}
