/**
 * Real-estate offer + negotiation domain.
 * Dedicated records — not the legacy lead.offer_amount / offer_status snapshot.
 * Trades quotations and deal stages are unchanged.
 */

export const RE_OFFER_STATUSES = [
  "draft",
  "submitted",
  "countered",
  "negotiating",
  "accepted",
  "rejected",
  "withdrawn",
  "expired",
] as const;

export type ReOfferStatus = (typeof RE_OFFER_STATUSES)[number];

export const RE_OFFER_STATUS_LABEL: Record<ReOfferStatus, string> = {
  draft: "Draft",
  submitted: "Awaiting seller",
  countered: "Counter offer",
  negotiating: "Negotiating",
  accepted: "Accepted",
  rejected: "Rejected",
  withdrawn: "Withdrawn",
  expired: "Expired",
};

export const RE_OFFER_ACTIVE_STATUSES: ReOfferStatus[] = [
  "draft",
  "submitted",
  "countered",
  "negotiating",
];

export const RE_OFFER_TERMINAL_STATUSES: ReOfferStatus[] = [
  "accepted",
  "rejected",
  "withdrawn",
  "expired",
];

export const RE_OFFER_EVENT_TYPES = [
  "OFFER_CREATED",
  "OFFER_SUBMITTED",
  "SELLER_COUNTER",
  "BUYER_REVISED",
  "OFFER_ACCEPTED",
  "OFFER_REJECTED",
  "OFFER_WITHDRAWN",
  "OFFER_EXPIRED",
  "NOTE_ADDED",
] as const;

export type ReOfferEventType = (typeof RE_OFFER_EVENT_TYPES)[number];

export const RE_OFFER_EVENT_LABEL: Record<ReOfferEventType, string> = {
  OFFER_CREATED: "Offer created",
  OFFER_SUBMITTED: "Buyer offer",
  SELLER_COUNTER: "Seller counter",
  BUYER_REVISED: "Buyer revision",
  OFFER_ACCEPTED: "Offer accepted",
  OFFER_REJECTED: "Offer rejected",
  OFFER_WITHDRAWN: "Offer withdrawn",
  OFFER_EXPIRED: "Offer expired",
  NOTE_ADDED: "Note",
};

export const RE_OFFER_REJECT_REASONS = [
  "Offer too low",
  "Seller accepted another offer",
  "Terms unacceptable",
  "Property no longer available",
  "Other",
] as const;

/** Listing statuses that may receive a new offer. Sold/let cannot. */
export const LISTING_STATUSES_ALLOWING_OFFER = new Set(["available", "under_offer", "reserved"]);

const ALLOWED_TRANSITIONS: Record<ReOfferStatus, ReOfferStatus[]> = {
  draft: ["submitted", "withdrawn"],
  submitted: ["countered", "negotiating", "accepted", "rejected", "withdrawn"],
  countered: ["negotiating", "countered", "accepted", "rejected", "withdrawn"],
  negotiating: ["countered", "accepted", "rejected", "withdrawn"],
  accepted: [],
  rejected: [],
  withdrawn: [],
  expired: [],
};

export function isReOfferStatus(value: string | null | undefined): value is ReOfferStatus {
  return (RE_OFFER_STATUSES as readonly string[]).includes(String(value ?? ""));
}

export function reOfferStatusLabel(status: string | null | undefined): string {
  if (isReOfferStatus(status)) return RE_OFFER_STATUS_LABEL[status];
  return String(status ?? "").replace(/_/g, " ") || "—";
}

export function canTransitionOffer(from: ReOfferStatus, to: ReOfferStatus): boolean {
  if (from === to && (from === "countered" || from === "negotiating")) return true;
  return ALLOWED_TRANSITIONS[from].includes(to);
}

export function isOfferEditable(status: ReOfferStatus): boolean {
  return status === "draft";
}

export function isOfferLocked(status: ReOfferStatus): boolean {
  return RE_OFFER_TERMINAL_STATUSES.includes(status);
}

export function isOfferActiveStatus(status: ReOfferStatus): boolean {
  return RE_OFFER_ACTIVE_STATUSES.includes(status);
}

export function listingAllowsOffer(listingStatus: string | null | undefined): boolean {
  return LISTING_STATUSES_ALLOWING_OFFER.has(String(listingStatus ?? ""));
}

/** Computed expiry — no cron. Active + past expiry_date → expired for display/read. */
export function effectiveOfferStatus(
  status: ReOfferStatus,
  expiryDate: string | null | undefined,
  now: Date = new Date()
): ReOfferStatus {
  if (!isOfferActiveStatus(status) || status === "draft") return status;
  if (!expiryDate) return status;
  const end = new Date(expiryDate);
  if (Number.isNaN(end.getTime())) return status;
  const day = new Date(end);
  day.setHours(23, 59, 59, 999);
  if (now.getTime() > day.getTime()) return "expired";
  return status;
}

export function formatOfferMoney(
  amount: number | null | undefined,
  currency = "USD"
): string | null {
  if (amount == null || !Number.isFinite(Number(amount))) return null;
  const n = Number(amount);
  const code = currency === "USD" || !currency ? "US$" : `${currency} `;
  return `${code}${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

export function offerVsAsking(
  offer: number | null | undefined,
  asking: number | null | undefined
): string | null {
  if (offer == null || asking == null || asking === 0) return null;
  const diff = Number(offer) - Number(asking);
  const pct = Math.round((diff / Number(asking)) * 1000) / 10;
  const sign = diff > 0 ? "+" : "";
  return `${sign}${formatOfferMoney(diff) ?? ""} (${sign}${pct}%)`;
}

/** Snapshot onto legacy leads.offer_status (constrained to submitted|countered|accepted|rejected). */
export function leadOfferStatusSnapshot(
  status: ReOfferStatus
): "submitted" | "countered" | "accepted" | "rejected" | null {
  if (status === "draft" || status === "withdrawn" || status === "expired") return null;
  if (status === "submitted") return "submitted";
  if (status === "countered" || status === "negotiating") return "countered";
  if (status === "accepted") return "accepted";
  if (status === "rejected") return "rejected";
  return null;
}

export function leadPipelineFromOfferStatus(status: ReOfferStatus | string | null | undefined):
  | "offer_submitted"
  | "negotiating"
  | "offer_accepted"
  | null {
  const s = effectiveOfferStatus((status as ReOfferStatus) ?? "draft", null);
  if (s === "accepted") return "offer_accepted";
  if (s === "countered" || s === "negotiating") return "negotiating";
  if (s === "submitted") return "offer_submitted";
  return null;
}

export type ReOfferAction =
  | "submit"
  | "counter"
  | "revise"
  | "accept"
  | "reject"
  | "withdraw"
  | "note"
  | "edit_draft";

export function allowedOfferActions(status: ReOfferStatus): ReOfferAction[] {
  const effective = status;
  if (effective === "draft") return ["edit_draft", "submit", "withdraw", "note"];
  if (effective === "submitted") return ["counter", "revise", "accept", "reject", "withdraw", "note"];
  if (effective === "countered" || effective === "negotiating") {
    return ["counter", "revise", "accept", "reject", "withdraw", "note"];
  }
  if (isOfferLocked(effective) || effective === "expired") return ["note"];
  return ["note"];
}

export function nextActionForOffer(status: ReOfferStatus): { label: string; action: ReOfferAction | "open" } {
  switch (status) {
    case "draft":
      return { label: "Submit offer", action: "submit" };
    case "submitted":
      return { label: "Record seller response", action: "counter" };
    case "countered":
      return { label: "Respond to counter", action: "revise" };
    case "negotiating":
      return { label: "Continue negotiation", action: "open" };
    case "accepted":
      return { label: "Start compliance", action: "open" };
    default:
      return { label: "Open offer", action: "open" };
  }
}

export type OfferAttentionReason =
  | "counter_received"
  | "awaiting_seller"
  | "expiry_approaching"
  | "accepted_next_step"
  | "draft_unsubmitted"
  | "stale_negotiation";

export function deriveOfferAttention(input: {
  status: ReOfferStatus;
  updatedAt: string;
  expiryDate?: string | null;
  acceptedAt?: string | null;
}, now: Date = new Date()): { reason: OfferAttentionReason; why: string } | null {
  const status = effectiveOfferStatus(input.status, input.expiryDate, now);
  if (status === "expired") return null;
  if (status === "countered") {
    return { reason: "counter_received", why: "Seller countered" };
  }
  if (status === "submitted") {
    return { reason: "awaiting_seller", why: "Awaiting seller response" };
  }
  if (status === "draft") {
    return { reason: "draft_unsubmitted", why: "Draft offer not submitted" };
  }
  if (status === "accepted") {
    return { reason: "accepted_next_step", why: "Accepted — compliance next" };
  }
  if (input.expiryDate && isOfferActiveStatus(status)) {
    const exp = new Date(input.expiryDate);
    const hours = (exp.getTime() - now.getTime()) / 3_600_000;
    if (hours >= 0 && hours <= 48) {
      return { reason: "expiry_approaching", why: "Expiry approaching" };
    }
  }
  if (status === "negotiating") {
    const ageH = (now.getTime() - new Date(input.updatedAt).getTime()) / 3_600_000;
    if (ageH >= 48) {
      return { reason: "stale_negotiation", why: "Stale negotiation" };
    }
  }
  return null;
}

const ATTENTION_RANK: Record<OfferAttentionReason, number> = {
  counter_received: 0,
  expiry_approaching: 1,
  awaiting_seller: 2,
  accepted_next_step: 3,
  draft_unsubmitted: 4,
  stale_negotiation: 5,
};

export function rankOfferAttention<T extends { reason: OfferAttentionReason }>(items: T[]): T[] {
  return [...items].sort((a, b) => ATTENTION_RANK[a.reason] - ATTENTION_RANK[b.reason]);
}

/** Agents record assigned offers; managers/admins see the company. */
export function canWriteOffer(opts: {
  role: string | null | undefined;
  userId: string;
  userClientId: string | null | undefined;
  offerClientId: string;
  buyerAgentId: string | null | undefined;
}): boolean {
  if (opts.role === "SUPER_ADMIN") return true;
  if (opts.userClientId !== opts.offerClientId) return false;
  if (opts.role === "CLIENT_MANAGER") return true;
  if (opts.role === "SALESPERSON") {
    return Boolean(opts.buyerAgentId && opts.buyerAgentId === opts.userId);
  }
  return false;
}

export function canCreateOfferForAssignment(opts: {
  role: string | null | undefined;
  userId: string;
  userClientId: string | null | undefined;
  clientId: string;
  assignedToId: string | null | undefined;
}): boolean {
  if (opts.role === "SUPER_ADMIN") return true;
  if (opts.userClientId !== opts.clientId) return false;
  if (opts.role === "CLIENT_MANAGER") return true;
  if (opts.role === "SALESPERSON") {
    return !opts.assignedToId || opts.assignedToId === opts.userId;
  }
  return false;
}

export function relativeTimeLabel(iso: string, now: Date = new Date()): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "";
  const delta = now.getTime() - t;
  const min = Math.round(delta / 60_000);
  if (min < 1) return "Just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.round(hr / 24);
  if (day === 1) return "Yesterday";
  if (day < 14) return `${day}d ago`;
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export function isValidOfferCurrency(value: string | null | undefined): boolean {
  return /^[A-Z]{3}$/.test(String(value ?? "").trim());
}

export function listingStatusAfterAccept(currentStatus: string | null | undefined): "under_offer" | null {
  const s = String(currentStatus ?? "");
  if (s === "available" || s === "reserved") return "under_offer";
  return null;
}

export function canViewOfferCommission(role: string | null | undefined): boolean {
  return role === "CLIENT_MANAGER" || role === "SUPER_ADMIN";
}

export type OfferSnapshot = {
  status: ReOfferStatus;
  original_offer_amount: number;
  current_offer_amount: number;
  conditions: string | null;
  expiry_date: string | null;
  internal_notes: string | null;
  submitted_at: string | null;
  accepted_at: string | null;
  rejected_at: string | null;
  withdrawn_at: string | null;
  rejected_reason: string | null;
  withdrawn_reason: string | null;
  updated_at: string;
};

export type OfferMutationPayload = {
  amount?: number | null;
  note?: string | null;
  conditions?: string | null;
  expiry_date?: string | null;
  reason?: string | null;
  now?: Date;
};

export type OfferMutationOk = {
  ok: true;
  next: OfferSnapshot;
  event: { event_type: ReOfferEventType; amount: number | null; note: string | null } | null;
  listingToUnderOffer: boolean;
  syncLead: boolean;
};

export type OfferMutationErr = { ok: false; error: string; status: number };

export function applyOfferMutation(
  offer: OfferSnapshot,
  action: ReOfferAction,
  payload: OfferMutationPayload = {}
): OfferMutationOk | OfferMutationErr {
  const now = payload.now ?? new Date();
  const iso = now.toISOString();
  const effective = effectiveOfferStatus(offer.status, offer.expiry_date, now);

  if (effective === "expired" && action !== "note") {
    return { ok: false, error: "This offer has expired.", status: 409 };
  }

  const amount = payload.amount != null ? Number(payload.amount) : null;
  if (amount != null && (!Number.isFinite(amount) || amount <= 0)) {
    return { ok: false, error: "Offer amount must be greater than 0.", status: 400 };
  }

  const note = payload.note?.trim() || payload.reason?.trim() || null;

  if (action === "note") {
    if (!note) return { ok: false, error: "A note is required.", status: 400 };
    return {
      ok: true,
      next: { ...offer, updated_at: iso },
      event: { event_type: "NOTE_ADDED", amount: null, note },
      listingToUnderOffer: false,
      syncLead: false,
    };
  }

  if (action === "edit_draft") {
    if (!isOfferEditable(offer.status)) {
      return { ok: false, error: "Only draft offers can be edited directly.", status: 409 };
    }
    const nextAmount = amount ?? offer.current_offer_amount;
    return {
      ok: true,
      next: {
        ...offer,
        original_offer_amount: nextAmount,
        current_offer_amount: nextAmount,
        conditions: payload.conditions !== undefined ? payload.conditions : offer.conditions,
        expiry_date: payload.expiry_date !== undefined ? payload.expiry_date : offer.expiry_date,
        internal_notes: payload.note !== undefined ? note : offer.internal_notes,
        updated_at: iso,
      },
      event: note ? { event_type: "NOTE_ADDED", amount: nextAmount, note } : null,
      listingToUnderOffer: false,
      syncLead: false,
    };
  }

  function transition(to: ReOfferStatus): OfferMutationErr | null {
    if (!canTransitionOffer(offer.status, to)) {
      return {
        ok: false,
        error: `Cannot move offer from ${reOfferStatusLabel(offer.status)} to ${reOfferStatusLabel(to)}.`,
        status: 409,
      };
    }
    return null;
  }

  if (action === "submit") {
    const blocked = transition("submitted");
    if (blocked) return blocked;
    return {
      ok: true,
      next: {
        ...offer,
        status: "submitted",
        submitted_at: iso,
        updated_at: iso,
      },
      event: { event_type: "OFFER_SUBMITTED", amount: offer.current_offer_amount, note },
      listingToUnderOffer: false,
      syncLead: true,
    };
  }

  if (action === "counter") {
    if (amount == null) return { ok: false, error: "Counter amount is required.", status: 400 };
    const to: ReOfferStatus = offer.status === "countered" ? "countered" : "countered";
    const blocked = transition(to);
    if (blocked) return blocked;
    return {
      ok: true,
      next: {
        ...offer,
        status: "countered",
        current_offer_amount: amount,
        conditions: payload.conditions !== undefined ? payload.conditions : offer.conditions,
        updated_at: iso,
      },
      event: { event_type: "SELLER_COUNTER", amount, note },
      listingToUnderOffer: false,
      syncLead: true,
    };
  }

  if (action === "revise") {
    if (amount == null) return { ok: false, error: "Revised amount is required.", status: 400 };
    const blocked = transition("negotiating");
    if (blocked) return blocked;
    return {
      ok: true,
      next: {
        ...offer,
        status: "negotiating",
        current_offer_amount: amount,
        conditions: payload.conditions !== undefined ? payload.conditions : offer.conditions,
        updated_at: iso,
      },
      event: { event_type: "BUYER_REVISED", amount, note },
      listingToUnderOffer: false,
      syncLead: true,
    };
  }

  if (action === "accept") {
    const blocked = transition("accepted");
    if (blocked) return blocked;
    const finalAmount = amount ?? offer.current_offer_amount;
    return {
      ok: true,
      next: {
        ...offer,
        status: "accepted",
        current_offer_amount: finalAmount,
        accepted_at: iso,
        updated_at: iso,
      },
      event: { event_type: "OFFER_ACCEPTED", amount: finalAmount, note },
      listingToUnderOffer: true,
      syncLead: true,
    };
  }

  if (action === "reject") {
    const blocked = transition("rejected");
    if (blocked) return blocked;
    return {
      ok: true,
      next: {
        ...offer,
        status: "rejected",
        rejected_at: iso,
        rejected_reason: note,
        updated_at: iso,
      },
      event: { event_type: "OFFER_REJECTED", amount: offer.current_offer_amount, note },
      listingToUnderOffer: false,
      syncLead: true,
    };
  }

  if (action === "withdraw") {
    const blocked = transition("withdrawn");
    if (blocked) return blocked;
    return {
      ok: true,
      next: {
        ...offer,
        status: "withdrawn",
        withdrawn_at: iso,
        withdrawn_reason: note,
        updated_at: iso,
      },
      event: { event_type: "OFFER_WITHDRAWN", amount: offer.current_offer_amount, note },
      listingToUnderOffer: false,
      syncLead: true,
    };
  }

  return { ok: false, error: "Unknown action.", status: 400 };
}

/** Pick the lead snapshot from the most advanced non-draft offer on that inquiry. */
export function pickLeadOfferSnapshot(
  offers: Array<{ status: ReOfferStatus; current_offer_amount: number; listing_id: string; updated_at: string }>
): { offer_status: "submitted" | "countered" | "accepted" | "rejected"; offer_amount: number; listing_id: string } | null {
  const rank: Record<string, number> = {
    accepted: 4,
    negotiating: 3,
    countered: 3,
    submitted: 2,
    rejected: 1,
  };
  let best: (typeof offers)[number] | null = null;
  let bestRank = 0;
  for (const o of offers) {
    const r = rank[o.status] ?? 0;
    if (r > bestRank) {
      best = o;
      bestRank = r;
    } else if (r === bestRank && best && o.updated_at > best.updated_at) {
      best = o;
    }
  }
  if (!best || bestRank === 0) return null;
  const mapped = leadOfferStatusSnapshot(best.status);
  if (!mapped) return null;
  return { offer_status: mapped, offer_amount: best.current_offer_amount, listing_id: best.listing_id };
}
