/** Property register rules. Pure, so the register route and tests share them. */

export type RegisterMandateState =
  | "approved"
  | "expiring"
  | "expired"
  | "awaiting"
  | "revoked"
  | "legacy_unverified"
  | "none";

export type RegisterIssue =
  | "pending_approval"
  | "rejected"
  | "no_agent"
  | "no_price"
  | "no_photos"
  | "no_mandate"
  | "mandate_expiring"
  | "mandate_expired"
  | "mandate_revoked";

export const REGISTER_ISSUE_LABEL: Record<RegisterIssue, string> = {
  pending_approval: "Waiting for approval",
  rejected: "Approval rejected",
  no_agent: "No listing agent",
  no_price: "No price",
  no_photos: "No photos",
  no_mandate: "No mandate on record",
  mandate_expiring: "Mandate expires soon",
  mandate_expired: "Mandate expired",
  mandate_revoked: "Mandate revoked",
};

export type RegisterRow = {
  listingId: string;
  sourcingAgentId: string | null;
  sourcingAgentName: string | null;
  listingAgentName: string | null;
  mandate: RegisterMandateState;
  mandateExpiry: string | null;
  interestCount: number;
  searchCount: number;
  viewingCount: number;
  upcomingViewingCount: number;
  offerCount: number;
  hasActiveTransaction: boolean;
  /** Only set when the actor may open the transaction. */
  activeTransactionId: string | null;
  issues: RegisterIssue[];
  canRequestCollaboration: boolean;
};

export const REGISTER_MANDATE_LABEL: Record<RegisterMandateState, string> = {
  approved: "Mandate active",
  expiring: "Mandate expiring",
  expired: "Mandate expired",
  awaiting: "Mandate in review",
  revoked: "Mandate revoked",
  legacy_unverified: "Mandate unverified",
  none: "No mandate",
};

export const MANDATE_EXPIRY_WARNING_DAYS = 30;

const CLOSED = new Set(["sold", "let", "rented"]);

function dayStart(value: string): number {
  return new Date(`${value.slice(0, 10)}T00:00:00Z`).getTime();
}

/**
 * Mandate state shown in the register. A mandate row wins over the legacy listing fields;
 * legacy fields alone are never treated as a verified mandate.
 */
export function registerMandateState(input: {
  mandateStatus: string | null;
  mandateExpiry: string | null;
  legacyMandateType?: string | null;
  legacyExpiry?: string | null;
  now?: Date;
}): RegisterMandateState {
  const now = (input.now ?? new Date()).getTime();
  const status = input.mandateStatus;
  if (status === "approved") {
    if (!input.mandateExpiry) return "approved";
    const expiry = dayStart(input.mandateExpiry);
    if (expiry < dayStart(new Date(now).toISOString())) return "expired";
    return expiry - now <= MANDATE_EXPIRY_WARNING_DAYS * 86_400_000 ? "expiring" : "approved";
  }
  if (status === "expired" || status === "superseded") return "expired";
  if (status === "revoked") return "revoked";
  if (status === "legacy_unverified") return "legacy_unverified";
  if (status === "draft" || status === "awaiting_evidence" || status === "submitted") return "awaiting";
  if (status === "rejected") return "none";
  if (input.legacyMandateType || input.legacyExpiry) return "legacy_unverified";
  return "none";
}

export function registerIssues(input: {
  status: string;
  approvalStatus: string | null;
  agentId: string | null;
  price: number | null;
  photoCount: number;
  mandate: RegisterMandateState;
}): RegisterIssue[] {
  if (CLOSED.has(input.status)) return [];
  const issues: RegisterIssue[] = [];
  if (input.approvalStatus === "pending_approval") issues.push("pending_approval");
  if (input.approvalStatus === "rejected") issues.push("rejected");
  if (!input.agentId) issues.push("no_agent");
  if (input.price == null) issues.push("no_price");
  if (input.photoCount === 0) issues.push("no_photos");
  if (input.mandate === "none") issues.push("no_mandate");
  if (input.mandate === "expiring") issues.push("mandate_expiring");
  if (input.mandate === "expired") issues.push("mandate_expired");
  if (input.mandate === "revoked") issues.push("mandate_revoked");
  return issues;
}

/** Whether the actor may open the active transaction from the register. */
export function canOpenRegisterTransaction(input: {
  isManager: boolean;
  actorId: string;
  listingAgentId: string | null;
  participantIds: readonly string[];
}): boolean {
  return input.isManager || input.listingAgentId === input.actorId || input.participantIds.includes(input.actorId);
}
