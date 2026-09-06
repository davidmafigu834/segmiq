/**
 * After-sales relationship domain for real-estate completions.
 */

export const AFTER_SALES_KINDS = [
  "post_sale_check_in",
  "satisfaction",
  "referral_ask",
  "testimonial_ask",
  "future_needs",
  "rental_renewal",
  "handover_follow_up",
  "other",
] as const;

export type AfterSalesKind = (typeof AFTER_SALES_KINDS)[number];

export const AFTER_SALES_KIND_LABEL: Record<AfterSalesKind, string> = {
  post_sale_check_in: "Post-sale check-in",
  satisfaction: "Satisfaction check",
  referral_ask: "Referral request",
  testimonial_ask: "Testimonial request",
  future_needs: "Future property needs",
  rental_renewal: "Rental renewal",
  handover_follow_up: "Handover follow-up",
  other: "Other",
};

export const AFTER_SALES_STATUSES = [
  "not_started",
  "check_in_due",
  "in_progress",
  "completed",
  "declined",
  "no_response",
] as const;

export type AfterSalesStatus = (typeof AFTER_SALES_STATUSES)[number];

export const AFTER_SALES_STATUS_LABEL: Record<AfterSalesStatus, string> = {
  not_started: "Not started",
  check_in_due: "Check-in due",
  in_progress: "In progress",
  completed: "Completed",
  declined: "Declined",
  no_response: "No response",
};

export const AFTER_SALES_OUTCOMES = [
  "satisfied",
  "neutral",
  "unsatisfied",
  "referral_received",
  "testimonial_received",
  "future_need_recorded",
  "complaint",
  "no_response",
  "other",
] as const;

export type AfterSalesOutcome = (typeof AFTER_SALES_OUTCOMES)[number];

export const AFTER_SALES_OUTCOME_LABEL: Record<AfterSalesOutcome, string> = {
  satisfied: "Satisfied",
  neutral: "Neutral",
  unsatisfied: "Unsatisfied",
  referral_received: "Referral received",
  testimonial_received: "Testimonial received",
  future_need_recorded: "Future need recorded",
  complaint: "Complaint",
  no_response: "No response",
  other: "Other",
};

/** Default cases created when a transaction completes. */
export const DEFAULT_AFTER_SALES_ON_COMPLETE: Array<{
  kind: AfterSalesKind;
  daysUntilDue: number;
}> = [
  { kind: "post_sale_check_in", daysUntilDue: 7 },
  { kind: "satisfaction", daysUntilDue: 14 },
  { kind: "referral_ask", daysUntilDue: 21 },
  { kind: "testimonial_ask", daysUntilDue: 21 },
  { kind: "future_needs", daysUntilDue: 30 },
];

export function afterSalesStatusLabel(status: string | null | undefined): string {
  if ((AFTER_SALES_STATUSES as readonly string[]).includes(String(status ?? ""))) {
    return AFTER_SALES_STATUS_LABEL[status as AfterSalesStatus];
  }
  return String(status ?? "").replace(/_/g, " ") || "—";
}

export function afterSalesKindLabel(kind: string | null | undefined): string {
  if ((AFTER_SALES_KINDS as readonly string[]).includes(String(kind ?? ""))) {
    return AFTER_SALES_KIND_LABEL[kind as AfterSalesKind];
  }
  return String(kind ?? "").replace(/_/g, " ") || "—";
}

export function addDaysIso(from: Date, days: number): string {
  const d = new Date(from);
  d.setDate(d.getDate() + days);
  return d.toISOString();
}
