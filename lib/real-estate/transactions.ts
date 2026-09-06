/**
 * Real-estate post-offer transaction domain.
 * Tracks agreements, payments, conveyancing, inspections, handover, commission.
 */

export const RE_TRANSACTION_STATUSES = [
  "draft",
  "pending_compliance",
  "in_progress",
  "completed",
  "fallen_through",
  "cancelled",
] as const;

export type ReTransactionStatus = (typeof RE_TRANSACTION_STATUSES)[number];

export const RE_TRANSACTION_STATUS_LABEL: Record<ReTransactionStatus, string> = {
  draft: "Draft",
  pending_compliance: "Awaiting compliance",
  in_progress: "In progress",
  completed: "Completed",
  fallen_through: "Fallen through",
  cancelled: "Cancelled",
};

export const RE_TRANSACTION_ACTIVE_STATUSES: ReTransactionStatus[] = [
  "draft",
  "pending_compliance",
  "in_progress",
];

export const RE_TRANSACTION_TERMINAL_STATUSES: ReTransactionStatus[] = [
  "completed",
  "fallen_through",
  "cancelled",
];

export const RE_TRANSACTION_TYPES = [
  "sale",
  "rental",
  "new_development",
  "property_management",
] as const;

export type ReTransactionType = (typeof RE_TRANSACTION_TYPES)[number];

export const RE_MILESTONE_KEYS = [
  "agreement_drafted",
  "agreement_signed",
  "deposit_received",
  "balance_received",
  "conveyancing_started",
  "conveyancing_complete",
  "inspection_booked",
  "inspection_complete",
  "keys_handed_over",
  "commission_invoiced",
  "commission_settled",
  "other",
] as const;

export type ReMilestoneKey = (typeof RE_MILESTONE_KEYS)[number];

export const RE_MILESTONE_LABEL: Record<ReMilestoneKey, string> = {
  agreement_drafted: "Agreement drafted",
  agreement_signed: "Agreement signed",
  deposit_received: "Deposit received",
  balance_received: "Balance / full payment",
  conveyancing_started: "Conveyancing started",
  conveyancing_complete: "Conveyancing complete",
  inspection_booked: "Inspection booked",
  inspection_complete: "Inspection complete",
  keys_handed_over: "Keys handed over",
  commission_invoiced: "Commission invoiced",
  commission_settled: "Commission settled",
  other: "Other",
};

export const RE_MILESTONE_STATUSES = [
  "pending",
  "in_progress",
  "done",
  "skipped",
  "blocked",
] as const;

export type ReMilestoneStatus = (typeof RE_MILESTONE_STATUSES)[number];

export const DEFAULT_SALE_MILESTONES: Array<{ key: ReMilestoneKey; sort: number }> = [
  { key: "agreement_drafted", sort: 10 },
  { key: "agreement_signed", sort: 20 },
  { key: "deposit_received", sort: 30 },
  { key: "conveyancing_started", sort: 40 },
  { key: "inspection_booked", sort: 50 },
  { key: "inspection_complete", sort: 60 },
  { key: "conveyancing_complete", sort: 70 },
  { key: "balance_received", sort: 80 },
  { key: "keys_handed_over", sort: 90 },
  { key: "commission_invoiced", sort: 100 },
  { key: "commission_settled", sort: 110 },
];

export const DEFAULT_RENTAL_MILESTONES: Array<{ key: ReMilestoneKey; sort: number }> = [
  { key: "agreement_drafted", sort: 10 },
  { key: "agreement_signed", sort: 20 },
  { key: "deposit_received", sort: 30 },
  { key: "inspection_complete", sort: 40 },
  { key: "keys_handed_over", sort: 50 },
  { key: "commission_invoiced", sort: 60 },
  { key: "commission_settled", sort: 70 },
];

export const RE_TXN_EVENT_TYPES = [
  "TRANSACTION_CREATED",
  "STATUS_CHANGED",
  "MILESTONE_UPDATED",
  "DEPOSIT_RECORDED",
  "AGREEMENT_SIGNED",
  "COMPLETION_RECORDED",
  "FALLEN_THROUGH",
  "CANCELLED",
  "COMMISSION_UPDATED",
  "NOTE_ADDED",
] as const;

export type ReTxnEventType = (typeof RE_TXN_EVENT_TYPES)[number];

export function isReTransactionStatus(v: string | null | undefined): v is ReTransactionStatus {
  return (RE_TRANSACTION_STATUSES as readonly string[]).includes(String(v ?? ""));
}

export function reTransactionStatusLabel(status: string | null | undefined): string {
  if (isReTransactionStatus(status)) return RE_TRANSACTION_STATUS_LABEL[status];
  return String(status ?? "").replace(/_/g, " ") || "—";
}

export function isTransactionActive(status: ReTransactionStatus): boolean {
  return RE_TRANSACTION_ACTIVE_STATUSES.includes(status);
}

export function isTransactionTerminal(status: ReTransactionStatus): boolean {
  return RE_TRANSACTION_TERMINAL_STATUSES.includes(status);
}

export function defaultMilestonesForType(
  type: ReTransactionType
): Array<{ key: ReMilestoneKey; sort: number }> {
  if (type === "rental" || type === "property_management") return DEFAULT_RENTAL_MILESTONES;
  return DEFAULT_SALE_MILESTONES;
}

export function listingStatusAfterTransactionComplete(
  transactionType: ReTransactionType
): "sold" | "let" | "rented" | "under_management" {
  if (transactionType === "rental") return "let";
  if (transactionType === "property_management") return "under_management";
  return "sold";
}

export function commissionAmounts(opts: {
  agreedPrice: number;
  listingPct: number | null;
  sellingPct: number | null;
}): { listingAmount: number | null; sellingAmount: number | null; total: number | null } {
  const listingAmount =
    opts.listingPct != null && Number.isFinite(opts.listingPct)
      ? Math.round((opts.agreedPrice * opts.listingPct) / 100)
      : null;
  const sellingAmount =
    opts.sellingPct != null && Number.isFinite(opts.sellingPct)
      ? Math.round((opts.agreedPrice * opts.sellingPct) / 100)
      : null;
  const parts = [listingAmount, sellingAmount].filter((n): n is number => n != null);
  return {
    listingAmount,
    sellingAmount,
    total: parts.length ? parts.reduce((a, b) => a + b, 0) : null,
  };
}

export type ReTxnAction =
  | "start_progress"
  | "complete"
  | "fallen_through"
  | "cancel"
  | "record_deposit"
  | "sign_agreement"
  | "update_commission"
  | "update_notes"
  | "set_expected_completion";

const ALLOWED: Record<ReTransactionStatus, ReTransactionStatus[]> = {
  draft: ["pending_compliance", "in_progress", "cancelled"],
  pending_compliance: ["in_progress", "fallen_through", "cancelled"],
  in_progress: ["completed", "fallen_through", "cancelled"],
  completed: [],
  fallen_through: [],
  cancelled: [],
};

export function canTransitionTransaction(
  from: ReTransactionStatus,
  to: ReTransactionStatus
): boolean {
  return ALLOWED[from].includes(to);
}
