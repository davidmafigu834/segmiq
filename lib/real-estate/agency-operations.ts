/**
 * Agency operations rules. Amounts are integer cents.
 * A percentage is basis points: 300 means 3.00%.
 * Rounding is half away from zero on the absolute value, then the sign is restored.
 * The last allocation marked absorbsRemainder receives the leftover cents.
 */

export const COMMISSION_STATUSES = [
  "projected",
  "earned",
  "invoiced",
  "reported_received",
  "verified_received",
  "allocation_approved",
  "partially_paid",
  "paid",
  "disputed",
  "cancelled",
  "unverified_legacy",
] as const;

export type CommissionStatus = (typeof COMMISSION_STATUSES)[number];

export const PARTICIPANT_ROLES = [
  "sourcing_agent",
  "listing_agent",
  "buyer_agent",
  "introducing_agent",
  "transaction_coordinator",
  "supervising_manager",
  "additional",
  "external_agency",
] as const;

export type ParticipantRole = (typeof PARTICIPANT_ROLES)[number];

export const AGENCY_CAPABILITIES = [
  "approve_mandate",
  "approve_listing",
  "confirm_payment",
  "approve_commission",
  "confirm_payout",
  "reassign_work",
  "company_reports",
  "review_documents",
  "manage_milestones",
] as const;

export type AgencyCapability = (typeof AGENCY_CAPABILITIES)[number];

export type AllocationLine = {
  id: string;
  beneficiaryId: string;
  role: string;
  mode: "percent" | "fixed";
  basisPoints?: number | null;
  fixedCents?: number | null;
  absorbsRemainder?: boolean;
};

export type AllocationResult = {
  id: string;
  beneficiaryId: string;
  role: string;
  cents: number;
};

export function percentOfCents(basisCents: number, basisPoints: number): number {
  if (!Number.isInteger(basisCents) || !Number.isInteger(basisPoints)) {
    throw new Error("Commission math requires integer cents and basis points.");
  }
  if (basisPoints < 0) throw new Error("A commission rate cannot be negative.");
  const negative = basisCents < 0;
  const product = Math.abs(basisCents) * basisPoints;
  const rounded = Math.floor((product + 5000) / 10000);
  return negative ? -rounded : rounded;
}

export function grossCommissionCents(input: {
  basisCents: number;
  mode: "percent" | "fixed";
  basisPoints?: number | null;
  fixedCents?: number | null;
}): number {
  if (input.mode === "fixed") {
    if (input.fixedCents == null || !Number.isInteger(input.fixedCents) || input.fixedCents < 0) {
      throw new Error("A fixed commission needs a non-negative integer amount.");
    }
    return input.fixedCents;
  }
  if (input.basisPoints == null) throw new Error("A percentage commission needs a rate.");
  return percentOfCents(input.basisCents, input.basisPoints);
}

export function allocateCommission(input: {
  distributableCents: number;
  lines: AllocationLine[];
  allowAboveDistributable?: boolean;
}): { ok: true; lines: AllocationResult[]; remainderCents: number } | { ok: false; error: string } {
  if (!Number.isInteger(input.distributableCents) || input.distributableCents < 0) {
    return { ok: false, error: "The distributable amount must be a non-negative integer number of cents." };
  }
  if (input.lines.length === 0) return { ok: false, error: "Add at least one allocation." };
  const drafted: AllocationResult[] = [];
  for (const line of input.lines) {
    let cents = 0;
    if (line.mode === "fixed") {
      if (line.fixedCents == null || !Number.isInteger(line.fixedCents) || line.fixedCents < 0) {
        return { ok: false, error: "Each fixed allocation needs a non-negative amount." };
      }
      cents = line.fixedCents;
    } else {
      if (line.basisPoints == null || !Number.isInteger(line.basisPoints) || line.basisPoints < 0) {
        return { ok: false, error: "Each percentage allocation needs a rate in basis points." };
      }
      cents = percentOfCents(input.distributableCents, line.basisPoints);
    }
    drafted.push({ id: line.id, beneficiaryId: line.beneficiaryId, role: line.role, cents });
  }
  let sum = drafted.reduce((total, line) => total + line.cents, 0);
  let remainder = input.distributableCents - sum;
  const absorber = [...input.lines].reverse().find((line) => line.absorbsRemainder);
  if (absorber && remainder !== 0) {
    const target = drafted.find((line) => line.id === absorber.id);
    if (target) {
      const next = target.cents + remainder;
      if (next < 0 && !input.allowAboveDistributable) {
        return { ok: false, error: "Rounding would make an allocation negative." };
      }
      target.cents = next;
      sum += remainder;
      remainder = input.distributableCents - sum;
    }
  }
  if (sum > input.distributableCents && !input.allowAboveDistributable) {
    return { ok: false, error: "Allocations exceed the distributable commission." };
  }
  return { ok: true, lines: drafted, remainderCents: input.distributableCents - sum };
}

export function canApproveOwnCommission(actorId: string, beneficiaryId: string): boolean {
  return actorId !== beneficiaryId;
}

export function canVerifyCommissionReceipt(input: {
  role: string | null | undefined;
  capabilities: readonly string[];
}): boolean {
  if (input.role === "SUPER_ADMIN" || input.role === "CLIENT_MANAGER") return true;
  return input.capabilities.includes("confirm_payment");
}

export function canApproveCommission(input: {
  actorId: string;
  beneficiaryId: string;
  role: string | null | undefined;
  capabilities: readonly string[];
}): boolean {
  if (!canApproveOwnCommission(input.actorId, input.beneficiaryId)) return false;
  if (input.role === "SUPER_ADMIN" || input.role === "CLIENT_MANAGER") return true;
  return input.capabilities.includes("approve_commission");
}

export function nextCommissionStatus(input: {
  current: CommissionStatus;
  action: "earn" | "invoice" | "report_receipt" | "verify_receipt" | "approve_allocations" | "record_payout" | "cancel" | "dispute";
  payoutComplete?: boolean;
}): CommissionStatus {
  if (input.action === "cancel") return "cancelled";
  if (input.action === "dispute") return "disputed";
  if (input.action === "report_receipt") return "reported_received";
  if (input.action === "verify_receipt") return "verified_received";
  if (input.action === "earn") return "earned";
  if (input.action === "invoice") return "invoiced";
  if (input.action === "approve_allocations") return "allocation_approved";
  if (input.action === "record_payout") return input.payoutComplete ? "paid" : "partially_paid";
  return input.current;
}

export function commissionAfterTransactionFailure(): {
  status: "cancelled";
  verifiedReceived: false;
  earned: false;
} {
  return { status: "cancelled", verifiedReceived: false, earned: false };
}

export function payoutProgress(input: { approvedCents: number; paidCents: number }): "unpaid" | "partially_paid" | "paid" {
  if (input.paidCents <= 0) return "unpaid";
  if (input.paidCents < input.approvedCents) return "partially_paid";
  return "paid";
}

export type VisibleDealSlice = {
  offerProgress: boolean;
  buyerContact: boolean;
  ownerContact: boolean;
  documents: boolean;
  commission: boolean;
  whatsapp: boolean;
};

export function visibleDealSlice(input: {
  roles: readonly ParticipantRole[];
  isManager: boolean;
  capabilities: readonly string[];
}): VisibleDealSlice {
  if (input.isManager) {
    return { offerProgress: true, buyerContact: true, ownerContact: true, documents: true, commission: true, whatsapp: false };
  }
  const roles = new Set(input.roles);
  const accounts = input.capabilities.includes("confirm_payment") || input.capabilities.includes("approve_commission");
  return {
    offerProgress: roles.has("listing_agent") || roles.has("buyer_agent") || roles.has("supervising_manager") || roles.has("transaction_coordinator"),
    buyerContact: roles.has("buyer_agent"),
    ownerContact: roles.has("listing_agent") || roles.has("sourcing_agent"),
    documents: roles.has("transaction_coordinator") || roles.has("listing_agent") || roles.has("buyer_agent") || input.capabilities.includes("review_documents"),
    commission: accounts,
    whatsapp: false,
  };
}

export type HandoverAssignment = {
  recordType:
    | "acquisition"
    | "inspection"
    | "listing"
    | "buyer_search"
    | "viewing"
    | "transaction_buyer"
    | "transaction_listing"
    | "milestone"
    | "activity"
    | "collaboration";
  recordId: string;
  currentAssigneeId: string;
  originalContributorId: string | null;
};

export function planHandover(input: {
  fromUserId: string;
  assignments: HandoverAssignment[];
  replacementByType: Partial<Record<HandoverAssignment["recordType"], string>>;
  defaultReplacementId?: string | null;
}): { ok: true; changes: Array<HandoverAssignment & { nextAssigneeId: string }>; preservedContributorIds: string[] } | { ok: false; error: string } {
  const changes: Array<HandoverAssignment & { nextAssigneeId: string }> = [];
  const preserved = new Set<string>();
  for (const row of input.assignments) {
    if (row.currentAssigneeId !== input.fromUserId) continue;
    const next = input.replacementByType[row.recordType] ?? input.defaultReplacementId;
    if (!next) return { ok: false, error: `Choose a replacement for ${row.recordType}.` };
    if (next === input.fromUserId) return { ok: false, error: "The replacement must be a different person." };
    changes.push({ ...row, nextAssigneeId: next });
    if (row.originalContributorId) preserved.add(row.originalContributorId);
  }
  return { ok: true, changes, preservedContributorIds: [...preserved] };
}

export type AttentionItem = {
  id: string;
  title: string;
  reason: string;
  href: string;
};

export function agencyAttention(input: {
  mandatesPending: Array<{ id: string; label: string }>;
  listingsPending: Array<{ id: string; label: string }>;
  mandatesExpiring: Array<{ id: string; label: string; expiresOn: string }>;
  offersWaiting: Array<{ id: string; label: string }>;
  documentsOverdue: Array<{ id: string; label: string }>;
  paymentsUnverified: Array<{ id: string; label: string }>;
  commissionsPending: Array<{ id: string; label: string }>;
  handoversOpen: Array<{ id: string; label: string }>;
  stalledTransactions: Array<{ id: string; label: string; daysIdle: number }>;
  introductionsPending?: Array<{ id: string; label: string }>;
}): AttentionItem[] {
  const items: AttentionItem[] = [];
  for (const row of input.mandatesPending) items.push({ id: `mandate-${row.id}`, title: row.label, reason: "Mandate awaiting approval", href: `/client/mandates` });
  for (const row of input.listingsPending) items.push({ id: `listing-${row.id}`, title: row.label, reason: "Listing awaiting approval", href: `/client/listings` });
  for (const row of input.mandatesExpiring) items.push({ id: `expiry-${row.id}`, title: row.label, reason: `Mandate expires ${row.expiresOn}`, href: `/client/mandates` });
  for (const row of input.offersWaiting) items.push({ id: `offer-${row.id}`, title: row.label, reason: "Offer awaiting a decision", href: `/client/offers` });
  for (const row of input.documentsOverdue) items.push({ id: `doc-${row.id}`, title: row.label, reason: "Transaction document overdue", href: `/client/transactions` });
  for (const row of input.paymentsUnverified) items.push({ id: `pay-${row.id}`, title: row.label, reason: "Payment reported but not verified", href: `/client/commissions` });
  for (const row of input.commissionsPending) items.push({ id: `comm-${row.id}`, title: row.label, reason: "Commission allocation awaiting review", href: `/client/commissions` });
  for (const row of input.handoversOpen) items.push({ id: `hand-${row.id}`, title: row.label, reason: "Staff handover is not finished", href: `/client/agency/team` });
  for (const row of input.stalledTransactions) items.push({ id: `txn-${row.id}`, title: row.label, reason: `No transaction activity for ${row.daysIdle} days`, href: `/client/transactions` });
  for (const row of input.introductionsPending ?? []) {
    items.push({
      id: `intro-${row.id}`,
      title: row.label,
      reason: "Buyer introduction awaiting review",
      href: `/client/buyers/introductions?open=${row.id}`,
    });
  }
  return items;
}

/**
 * One authoritative agreed amount per transaction. A repeated row for the same
 * transaction (joins, retries, duplicate events) is counted once, using its first amount.
 */
export function reportSaleOnce(rows: ReadonlyArray<{ transactionId: string; agreedCents: number }>): {
  transactions: number;
  volumeCents: number;
  duplicatesIgnored: number;
} {
  const seen = new Map<string, number>();
  let duplicates = 0;
  for (const row of rows) {
    if (seen.has(row.transactionId)) {
      duplicates += 1;
      continue;
    }
    if (!Number.isInteger(row.agreedCents)) throw new Error("Sale volume requires integer cents.");
    seen.set(row.transactionId, row.agreedCents);
  }
  let volume = 0;
  for (const cents of seen.values()) volume += cents;
  return { transactions: seen.size, volumeCents: volume, duplicatesIgnored: duplicates };
}

/** Converts a decimal amount (as stored in numeric columns) to integer cents without float multiplication. */
export function decimalToCents(value: string | number | null | undefined): number | null {
  if (value == null || value === "") return null;
  const text = typeof value === "number" ? value.toFixed(6) : String(value).trim();
  const match = /^(-)?(\d+)(?:\.(\d+))?$/.exec(text);
  if (!match) return null;
  const negative = Boolean(match[1]);
  const whole = Number(match[2]);
  const fraction = (match[3] ?? "").padEnd(3, "0");
  let cents = whole * 100 + Number(fraction.slice(0, 2));
  if (Number(fraction[2]) >= 5) cents += 1;
  if (!Number.isSafeInteger(cents)) return null;
  return negative ? -cents : cents;
}

export type CommissionAction =
  | "earn"
  | "invoice"
  | "report_receipt"
  | "verify_receipt"
  | "approve_allocations"
  | "cancel"
  | "dispute";

const FINANCE_ACTIONS = new Set<CommissionAction>(["earn", "invoice", "approve_allocations", "cancel"]);

/** Who may take a commission action. Receipt verification has its own capability. */
export function commissionActionPermitted(input: {
  action: CommissionAction;
  role: string | null | undefined;
  capabilities: readonly string[];
  isBeneficiary: boolean;
}): boolean {
  const manager = input.role === "SUPER_ADMIN" || input.role === "CLIENT_MANAGER";
  const finance = manager || input.capabilities.includes("approve_commission");
  if (input.action === "verify_receipt") return canVerifyCommissionReceipt({ role: input.role, capabilities: input.capabilities });
  if (FINANCE_ACTIONS.has(input.action)) return finance;
  if (input.action === "report_receipt" || input.action === "dispute") return finance || input.isBeneficiary;
  return false;
}

/** Status changes that are refused regardless of permission. */
export function commissionActionBlocked(current: CommissionStatus, action: CommissionAction): string | null {
  if (current === "cancelled") return "This commission is cancelled.";
  if (action === "cancel" && (current === "verified_received" || current === "partially_paid" || current === "paid")) {
    return "A commission with a verified receipt or payout cannot be cancelled. Record an adjustment instead.";
  }
  if (action === "earn" && (current === "paid" || current === "partially_paid")) return "This commission is already being paid.";
  if (action === "approve_allocations" && current === "disputed") return "Resolve the dispute before approving allocations.";
  return null;
}

const COMMISSION_RANK: Partial<Record<CommissionStatus, number>> = {
  unverified_legacy: -1,
  projected: 0,
  earned: 1,
  invoiced: 2,
  reported_received: 3,
  verified_received: 4,
  allocation_approved: 5,
  partially_paid: 6,
  paid: 7,
};

/** The headline status never moves backwards because of a late, lower-stage action. */
export function statusAfterAction(current: CommissionStatus, action: CommissionAction): CommissionStatus {
  const next = nextCommissionStatus({ current, action });
  if (action === "cancel" || action === "dispute") return next;
  if (current === "disputed") return current;
  const from = COMMISSION_RANK[current] ?? 0;
  const to = COMMISSION_RANK[next] ?? 0;
  return to >= from ? next : current;
}

export type CommissionLedgerRow = {
  status: string;
  grossCents: number;
  earnedCents: number;
  invoicedCents: number;
  reportedReceivedCents: number;
  verifiedReceivedCents: number;
  provenance?: string | null;
};

export type AllocationLedgerRow = {
  amountCents: number;
  approvalStatus: string;
  payoutCents: number;
  reportedPayoutCents?: number;
};

export type CommissionTotals = {
  projectedCents: number;
  earnedCents: number;
  invoicedCents: number;
  reportedReceivedCents: number;
  verifiedReceivedCents: number;
  approvedCents: number;
  outstandingPayableCents: number;
  paidCents: number;
  legacyUnverifiedCents: number;
};

/**
 * Cumulative totals. Each stage reads its own durable amount, so a later status
 * never hides an earlier earned or received amount. Cancelled commissions count
 * only amounts that were verified before cancellation. Legacy rows are reported apart.
 */
export function commissionTotals(
  commissions: readonly CommissionLedgerRow[],
  allocations: readonly AllocationLedgerRow[]
): CommissionTotals {
  const totals: CommissionTotals = {
    projectedCents: 0,
    earnedCents: 0,
    invoicedCents: 0,
    reportedReceivedCents: 0,
    verifiedReceivedCents: 0,
    approvedCents: 0,
    outstandingPayableCents: 0,
    paidCents: 0,
    legacyUnverifiedCents: 0,
  };
  for (const row of commissions) {
    if (row.status === "unverified_legacy" || row.provenance === "legacy_transaction_fields") {
      totals.legacyUnverifiedCents += row.grossCents;
      continue;
    }
    totals.verifiedReceivedCents += row.verifiedReceivedCents;
    if (row.status === "cancelled") continue;
    totals.projectedCents += row.grossCents;
    totals.earnedCents += row.earnedCents;
    totals.invoicedCents += row.invoicedCents;
    totals.reportedReceivedCents += row.reportedReceivedCents;
  }
  for (const line of allocations) {
    totals.paidCents += line.payoutCents;
    if (line.approvalStatus !== "approved") continue;
    totals.approvedCents += line.amountCents;
    totals.outstandingPayableCents += Math.max(0, line.amountCents - line.payoutCents);
  }
  return totals;
}

/** Cumulative fields set by an action. Amounts only ever grow. */
export function cumulativePatch(input: {
  action: CommissionAction;
  grossCents: number;
  amountCents?: number | null;
  current: { earnedCents: number; invoicedCents: number; reportedReceivedCents: number; verifiedReceivedCents: number };
  nowIso: string;
}): Record<string, number | string> {
  const amount = input.amountCents ?? input.grossCents;
  if (input.action === "earn") return { earned_cents: Math.max(input.current.earnedCents, input.grossCents), earned_at: input.nowIso };
  if (input.action === "invoice") {
    return { invoiced_cents: Math.max(input.current.invoicedCents, input.grossCents), invoiced_at: input.nowIso };
  }
  if (input.action === "report_receipt") {
    return { reported_received_cents: input.current.reportedReceivedCents + amount, reported_received_at: input.nowIso };
  }
  if (input.action === "verify_receipt") {
    return { verified_received_cents: input.current.verifiedReceivedCents + amount, verified_received_at: input.nowIso };
  }
  return {};
}

export type AllocationDraftLine = { beneficiaryId: string | null; mode: "percent" | "fixed"; basisPoints?: number | null; fixedCents?: number | null };

/**
 * Starting lines for the allocation form. A template supplies the split; with
 * no template the agent enters every share. There is no 50/50 default.
 */
export function initialAllocationLines(template: { lines?: AllocationDraftLine[] | null } | null): AllocationDraftLine[] {
  if (template?.lines?.length) return template.lines.map((line) => ({ ...line }));
  return [];
}

export type DocumentDecision = "under_review" | "verified" | "rejected" | "replacement_requested";

export function documentDecisionError(decision: DocumentDecision, reason: string | null | undefined): string | null {
  if ((decision === "rejected" || decision === "replacement_requested") && !reason?.trim()) {
    return "Give a reason so the uploader knows what to fix.";
  }
  return null;
}

/** Document visibility. An upload never implies verification or payment. */
export function canSeeTransactionDocument(input: {
  visibility: string;
  isManager: boolean;
  capabilities: readonly string[];
  isParticipant: boolean;
  isUploader: boolean;
}): boolean {
  if (input.isManager) return true;
  if (input.isUploader) return true;
  if (input.visibility === "finance") {
    return input.capabilities.includes("confirm_payment") || input.capabilities.includes("approve_commission");
  }
  if (input.visibility === "managers") return input.capabilities.includes("review_documents");
  return input.isParticipant || input.capabilities.includes("review_documents");
}

export function handoverRecordKey(recordType: string, recordId: string): string {
  return `${recordType}:${recordId}`;
}

/** Differences between the previewed set and the set found at execution time. */
export function handoverDrift(previewKeys: readonly string[], currentKeys: readonly string[]): {
  added: string[];
  removed: string[];
  changed: boolean;
} {
  const before = new Set(previewKeys);
  const after = new Set(currentKeys);
  const added = [...after].filter((key) => !before.has(key));
  const removed = [...before].filter((key) => !after.has(key));
  return { added, removed, changed: added.length > 0 || removed.length > 0 };
}

export function capabilitiesForRole(role: string | null | undefined): AgencyCapability[] {
  if (role === "CLIENT_MANAGER" || role === "SUPER_ADMIN") return [...AGENCY_CAPABILITIES];
  return [];
}

export function documentReviewAfterUpload(): "awaiting_review" {
  return "awaiting_review";
}

export const MANAGER_NAV_SECTIONS = ["main", "acquisition", "buyer_sales", "agency", "more_tools", "system"] as const;

export const AGENT_PRIMARY_NAV_IDS = ["dashboard", "whatsapp", "listings", "tasks"] as const;
