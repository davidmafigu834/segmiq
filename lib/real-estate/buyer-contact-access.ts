import { canSeeBuyerContact, searchIsMatchable } from "@/lib/real-estate/buyer-match";
import { isListingLive } from "@/lib/real-estate/listings";
import { canCreateOfferForAssignment } from "@/lib/real-estate/offers";

/**
 * Shared buyer-contact policy for listing matches, the CRM directory, property-match sends, and offers.
 *
 * A contact is a private buyer only while they have a buyer search in active, paused, or needs_review.
 * Contacts with no such search — including Solar, Trades, and a walk-in who has not been given a search —
 * stay on the existing organisation rules.
 *
 * An accepted introduction reveals name, phone, and email only for that listing, and only while the
 * search is still matchable and the listing is still approved and available. It does not unlock the
 * organisation directory, other listings, or offer creation.
 */

export type BuyerAccessActor = {
  id: string;
  role: string | null | undefined;
  clientId: string | null;
};

export type BuyerSearchAccessFact = {
  id: string;
  clientId: string;
  contactId: string;
  assignedAgentId: string | null;
  status: string;
  pipelineStage: string | null;
};

export type BuyerIntroductionAccessFact = {
  clientId: string;
  listingId: string;
  searchId: string;
  requestingAgentId: string | null;
  status: string;
};

export type BuyerListingAccessFact = {
  id: string;
  clientId: string;
  status: string | null;
  approvalStatus: string | null;
};

export function isPrivateBuyerSearchStatus(status: string): boolean {
  return status === "active" || status === "paused" || status === "needs_review";
}

export function isBuyerManagerRole(role: string | null | undefined): boolean {
  return role === "SUPER_ADMIN" || role === "CLIENT_MANAGER";
}

function sameOrganisation(actor: BuyerAccessActor, recordClientId: string): boolean {
  if (actor.role === "SUPER_ADMIN") return true;
  return actor.clientId === recordClientId;
}

function privateSearchesFor(input: {
  recordClientId: string;
  contactId: string;
  searches: BuyerSearchAccessFact[];
}): BuyerSearchAccessFact[] {
  return input.searches.filter(
    (row) =>
      row.clientId === input.recordClientId &&
      row.contactId === input.contactId &&
      isPrivateBuyerSearchStatus(row.status)
  );
}

function eligibleIntroduction(input: {
  actor: BuyerAccessActor;
  recordClientId: string;
  search: BuyerSearchAccessFact;
  listing: BuyerListingAccessFact;
  introductions: BuyerIntroductionAccessFact[];
}): boolean {
  if (!searchIsMatchable(input.search)) return false;
  if (input.listing.clientId !== input.recordClientId) return false;
  if (!isListingLive({ status: input.listing.status, approval_status: input.listing.approvalStatus })) return false;
  const accepted = input.introductions.some(
    (row) =>
      row.clientId === input.recordClientId &&
      row.searchId === input.search.id &&
      row.listingId === input.listing.id &&
      row.requestingAgentId === input.actor.id &&
      row.status === "accepted"
  );
  return canSeeBuyerContact({
    requesterId: input.actor.id,
    ownerAgentId: input.search.assignedAgentId,
    role: input.actor.role,
    introductionAccepted: accepted,
  });
}

/** Directory, lookup, and export. Introduction grants are intentionally not applied here. */
export function canViewBuyerInDirectory(input: {
  actor: BuyerAccessActor;
  recordClientId: string;
  contactId: string;
  searches: BuyerSearchAccessFact[];
}): boolean {
  if (!sameOrganisation(input.actor, input.recordClientId)) return false;
  if (isBuyerManagerRole(input.actor.role)) return true;
  const searches = privateSearchesFor(input);
  if (!searches.length) return true;
  return searches.some((row) => row.assignedAgentId === input.actor.id);
}

/**
 * Listing match payload. Pass the listing being viewed so an accepted introduction
 * can apply to that property only.
 */
export function canViewBuyerOnListing(input: {
  actor: BuyerAccessActor;
  recordClientId: string;
  contactId: string;
  searches: BuyerSearchAccessFact[];
  listing: BuyerListingAccessFact;
  introductions: BuyerIntroductionAccessFact[];
}): boolean {
  if (!sameOrganisation(input.actor, input.recordClientId)) return false;
  if (isBuyerManagerRole(input.actor.role)) return true;
  const searches = privateSearchesFor(input);
  if (!searches.length) return true;
  if (searches.some((row) => row.assignedAgentId === input.actor.id)) return true;
  return searches.some((search) =>
    eligibleIntroduction({
      actor: input.actor,
      recordClientId: input.recordClientId,
      search,
      listing: input.listing,
      introductions: input.introductions,
    })
  );
}

/**
 * WhatsApp property-match send. Pending and declined introductions never grant this.
 * An accepted introduction lapses when the search or listing is no longer eligible.
 * A contact who is not a private buyer still needs an owned lead or owned search.
 */
export function canSendPropertyMatch(input: {
  actor: BuyerAccessActor;
  recordClientId: string;
  contactId: string;
  searches: BuyerSearchAccessFact[];
  listing: BuyerListingAccessFact;
  introductions: BuyerIntroductionAccessFact[];
  ownsContactRelationship: boolean;
}): boolean {
  if (!sameOrganisation(input.actor, input.recordClientId)) return false;
  if (input.listing.clientId !== input.recordClientId) return false;
  if (isBuyerManagerRole(input.actor.role)) return true;
  if (!isListingLive({ status: input.listing.status, approval_status: input.listing.approvalStatus })) return false;
  const searches = privateSearchesFor(input);
  if (!searches.length) return input.ownsContactRelationship;
  return canViewBuyerOnListing(input);
}

/**
 * Offer creation keeps walk-ins and contacts that are not private buyers.
 * Organisation membership alone does not cover a private buyer search.
 * An introduction does not grant an offer.
 */
export function canCreateOfferForPrivateBuyer(input: {
  actor: BuyerAccessActor;
  recordClientId: string;
  contactId: string;
  leadAssignedToId: string | null;
  searches: BuyerSearchAccessFact[];
}): boolean {
  if (
    !canCreateOfferForAssignment({
      role: input.actor.role,
      userId: input.actor.id,
      userClientId: input.actor.clientId,
      clientId: input.recordClientId,
      assignedToId: input.leadAssignedToId,
    })
  ) {
    return false;
  }
  if (isBuyerManagerRole(input.actor.role)) return true;
  const searches = privateSearchesFor(input);
  if (!searches.length) return true;
  return searches.some((row) => row.assignedAgentId === input.actor.id);
}
