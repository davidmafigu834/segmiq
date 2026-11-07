const HOME_CATEGORIES = new Set(["house", "apartment", "townhouse"]);

export function listingAsksForRooms(category: string | null | undefined): boolean {
  return !category || HOME_CATEGORIES.has(category);
}

export type ListingFinishInput = {
  address?: string | null;
  price?: number | null;
  description?: string | null;
  photos?: unknown;
  property_category?: string | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
};

/** What the agent still has to put on a listing that arrived from a mandate. */
export function listingFinishGaps(listing: ListingFinishInput): string[] {
  const photos = Array.isArray(listing.photos)
    ? listing.photos.filter((item) => typeof item === "string" && item.trim())
    : [];
  const gaps: string[] = [];
  if (!listing.address?.trim()) gaps.push("Address is still blank.");
  if (listing.price == null || !Number.isFinite(Number(listing.price))) gaps.push("Price is still blank.");
  if (!listing.description?.trim()) gaps.push("Description is still blank.");
  if (photos.length === 0) gaps.push("Photos are still to add.");
  if (listingAsksForRooms(listing.property_category)) {
    if (listing.bedrooms == null) gaps.push("Bedrooms are still blank.");
    if (listing.bathrooms == null) gaps.push("Bathrooms are still blank.");
  }
  return gaps;
}

export function sellerLetterLabel(input: {
  status: string;
  acceptanceChannel?: string | null;
  revisionStatus?: string | null;
}): string {
  if (input.status === "accepted" || input.revisionStatus === "accepted") return "Seller approved";
  if (input.status === "rejected" || input.revisionStatus === "declined") return "Seller declined";
  if (input.acceptanceChannel === "seller_link" && input.revisionStatus === "buyer_signed") return "With the seller to approve";
  if (input.acceptanceChannel === "seller_link") return "The buyer still has the letter";
  return "The letter has not been sent to the seller";
}

export type ListingHouseContext = {
  seller: { contactId: string | null; name: string } | null;
  opportunityId: string | null;
};
