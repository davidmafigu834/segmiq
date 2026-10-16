/**
 * Listing availability decisions for offers and transactions.
 * Pure functions. Services apply the result under the organisation's client_id.
 *
 * An accepted offer is not a completed sale.
 * Closed stock (sold, let, rented, under management) is never restored automatically.
 */

import type { ReTransactionType } from "@/lib/real-estate/transactions";
import { listingStatusAfterTransactionComplete } from "@/lib/real-estate/transactions";

export const CLOSED_LISTING_STATUSES = ["sold", "let", "rented", "under_management"] as const;

export type ClosedListingStatus = (typeof CLOSED_LISTING_STATUSES)[number];

export const ACTIVE_TRANSACTION_STATUSES = ["draft", "pending_compliance", "in_progress"] as const;

export const TERMINAL_TRANSACTION_STATUSES = ["completed", "fallen_through", "cancelled"] as const;

export function isClosedListingStatusValue(status: string | null | undefined): boolean {
  return (CLOSED_LISTING_STATUSES as readonly string[]).includes(String(status ?? ""));
}

export type AcceptOfferDecision =
  | { ok: true; nextListingStatus: "under_offer" | null }
  | { ok: false; error: string; status: 409 | 400 };

/**
 * One reserving offer per listing. A second accept is refused until the
 * existing reservation is completed, cancelled, or fallen through.
 */
export function decideOfferAcceptance(input: {
  listingStatus: string | null | undefined;
  otherReservingOfferCount: number;
}): AcceptOfferDecision {
  if (isClosedListingStatusValue(input.listingStatus)) {
    return {
      ok: false,
      status: 409,
      error: "This listing is already closed. Accepting another offer would contradict that status.",
    };
  }
  if (input.otherReservingOfferCount > 0) {
    return {
      ok: false,
      status: 409,
      error:
        "Another accepted offer already reserves this listing. Complete, cancel, or mark that transaction fallen through before accepting a different offer.",
    };
  }
  const current = String(input.listingStatus ?? "");
  if (current === "under_offer") return { ok: true, nextListingStatus: null };
  if (current === "available" || current === "reserved" || current === "") {
    return { ok: true, nextListingStatus: "under_offer" };
  }
  return {
    ok: false,
    status: 400,
    error: `Cannot accept an offer while the listing is ${current || "unknown"}.`,
  };
}

export type ReleaseDecision = {
  nextStatus: "available" | "reserved" | "under_offer" | null;
  reason: string;
};

/**
 * After a reservation ends, keep the listing held when another reservation
 * remains. Otherwise restore the status recorded when it was held, or
 * `available` when that history is missing and the listing is approved.
 * Unapproved stock goes to `reserved` (not publicly available).
 */
export function decideReservationRelease(input: {
  listingStatus: string | null | undefined;
  approvalStatus: string | null | undefined;
  remainingReservingOffers: number;
  remainingActiveTransactions: number;
  /** Status immediately before the current under_offer hold, when known. */
  heldFromStatus?: string | null;
}): ReleaseDecision {
  const current = String(input.listingStatus ?? "");
  if (isClosedListingStatusValue(current)) {
    return { nextStatus: null, reason: "closed_listing_not_restored" };
  }
  const stillHeld = input.remainingReservingOffers > 0 || input.remainingActiveTransactions > 0;
  if (stillHeld) {
    if (current === "under_offer") return { nextStatus: null, reason: "still_reserved" };
    if (current === "available" || current === "reserved") {
      return { nextStatus: "under_offer", reason: "another_reservation_remains" };
    }
    return { nextStatus: null, reason: "still_reserved" };
  }
  if (current !== "under_offer") {
    return { nextStatus: null, reason: "not_held" };
  }
  const approval = input.approvalStatus ?? "approved";
  if (approval !== "approved") {
    return { nextStatus: "reserved", reason: "review_required_not_approved" };
  }
  const prior = input.heldFromStatus;
  if (prior === "reserved") return { nextStatus: "reserved", reason: "restored_prior_reserved" };
  if (prior && isClosedListingStatusValue(prior)) {
    return { nextStatus: null, reason: "closed_listing_not_restored" };
  }
  return { nextStatus: "available", reason: "reservation_released" };
}

export type CompletionDecision =
  | { ok: true; nextListingStatus: "sold" | "let" | "rented" | "under_management"; idempotent: boolean }
  | { ok: false; error: string; status: 409 | 400 };

export function decideTransactionCompletion(input: {
  transactionType: ReTransactionType;
  listingStatus: string | null | undefined;
  otherActiveTransactionCount: number;
  agreementRecorded: boolean;
  alreadyCompleted: boolean;
}): CompletionDecision {
  if (input.otherActiveTransactionCount > 0) {
    return {
      ok: false,
      status: 409,
      error: "Another active transaction still exists for this listing. Resolve it before completing this one.",
    };
  }
  if (!input.alreadyCompleted && !input.agreementRecorded) {
    return {
      ok: false,
      status: 400,
      error: "Record the agreement as signed before completing the transaction.",
    };
  }
  const target = listingStatusAfterTransactionComplete(input.transactionType);
  const current = String(input.listingStatus ?? "");
  if (current === target) return { ok: true, nextListingStatus: target, idempotent: true };
  if (isClosedListingStatusValue(current) && current !== target) {
    return {
      ok: false,
      status: 409,
      error: `Listing is already ${current}. Completing a ${input.transactionType} transaction would not change it to ${target}.`,
    };
  }
  if (current && !["available", "reserved", "under_offer", ""].includes(current) && current !== target) {
    return {
      ok: false,
      status: 400,
      error: `Cannot complete while the listing status is ${current}.`,
    };
  }
  return { ok: true, nextListingStatus: target, idempotent: input.alreadyCompleted };
}

/** Manual status edits must not bypass an open reservation or fake a completion. */
export function assertManualListingStatusChange(input: {
  nextStatus: string;
  reservingOfferCount: number;
  activeTransactionCount: number;
  completedTransactionCount: number;
}): { ok: true } | { ok: false; error: string } {
  const next = input.nextStatus;
  const held = input.reservingOfferCount > 0 || input.activeTransactionCount > 0;
  if ((next === "sold" || next === "let" || next === "rented") && input.completedTransactionCount < 1) {
    return {
      ok: false,
      error: "Mark the transaction complete to close this listing. A status edit cannot record a sale or letting on its own.",
    };
  }
  if (next === "available" && held) {
    return {
      ok: false,
      error: "This listing still has an accepted offer or an active transaction. Release that reservation before marking it available.",
    };
  }
  return { ok: true };
}

export function offerStillReserves(input: {
  offerStatus: string;
  reservesListing?: boolean | null;
  transactionStatus?: string | null;
}): boolean {
  if (input.reservesListing === false) return false;
  if (input.reservesListing === true) return true;
  if (input.offerStatus !== "accepted") return false;
  if (!input.transactionStatus) return true;
  return (ACTIVE_TRANSACTION_STATUSES as readonly string[]).includes(input.transactionStatus);
}
