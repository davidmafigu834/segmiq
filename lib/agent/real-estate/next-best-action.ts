import { isDemandSide, isSupplySide } from "@/lib/real-estate/requirements";

export type ReNextBestAction = {
  id: string;
  label: string;
};

/** Deterministic RE next-best-action for Hub intelligence panel. */
export function resolveReNextBestAction(opts: {
  dealSide: string | null;
  matchReady: boolean;
  hasUpcomingViewing: boolean;
  hasLinkedListing: boolean;
  humanNeeded: boolean;
}): ReNextBestAction {
  if (opts.humanNeeded) {
    return { id: "review_handoff", label: "Review agent handoff and take over if needed" };
  }
  if (opts.hasUpcomingViewing) {
    return { id: "confirm_viewing", label: "Confirm upcoming viewing details with the customer" };
  }
  if (isDemandSide(opts.dealSide) && opts.matchReady) {
    return { id: "offer_matches", label: "Offer 1–3 property matches or arrange a viewing" };
  }
  if (isDemandSide(opts.dealSide) && opts.hasLinkedListing) {
    return { id: "qualify_buyer", label: "Qualify budget, area and bedrooms naturally" };
  }
  if (isSupplySide(opts.dealSide)) {
    return { id: "qualify_seller", label: "Qualify property details and seller timeline" };
  }
  return { id: "understand_intent", label: "Clarify whether they are buying, renting or selling" };
}
