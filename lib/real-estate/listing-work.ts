import { listingFinishGaps } from "@/lib/real-estate/listing-house";
import { isClosedListingStatus } from "@/lib/real-estate/listings";

export type ListingWorkFilter = "all" | "finish" | "ready" | "under_offer" | "closed";

export type ListingWorkRow = {
  id: string;
  address: string | null;
  suburb: string | null;
  price: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  description: string | null;
  hasPhotos: boolean;
  propertyCategory: string | null;
  status: string;
  transactionType: string;
  sellerName: string | null;
  sellerId: string | null;
  viewingCount: number;
  offerCount: number;
};

export function listingWorkGaps(row: Pick<ListingWorkRow, "address" | "price" | "description" | "hasPhotos" | "propertyCategory" | "bedrooms" | "bathrooms">): string[] {
  return listingFinishGaps({
    address: row.address,
    price: row.price,
    description: row.description,
    photos: row.hasPhotos ? ["photo"] : [],
    property_category: row.propertyCategory,
    bedrooms: row.bedrooms,
    bathrooms: row.bathrooms,
  });
}

export function listingWorkBadge(row: ListingWorkRow): { label: string; tone: "warning" | "success" | "neutral" } {
  if (isClosedListingStatus(row.status)) return { label: row.status === "sold" ? "Sold" : "Rented", tone: "neutral" };
  if (row.status === "under_offer") return { label: "Under offer", tone: "warning" };
  if (listingWorkGaps(row).length) return { label: "Still to finish", tone: "warning" };
  return { label: "Ready", tone: "success" };
}

export function listingWorkVisible(row: ListingWorkRow, filter: ListingWorkFilter, query: string): boolean {
  const gaps = listingWorkGaps(row).length > 0;
  const closed = isClosedListingStatus(row.status);
  const matchesFilter =
    filter === "all" ||
    (filter === "finish" && gaps && !closed) ||
    (filter === "ready" && !gaps && !closed && row.status !== "under_offer") ||
    (filter === "under_offer" && row.status === "under_offer") ||
    (filter === "closed" && closed);
  if (!matchesFilter) return false;
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return [row.address, row.suburb, row.sellerName].filter(Boolean).join(" ").toLowerCase().includes(needle);
}

export function listingWorkCounts(row: Pick<ListingWorkRow, "viewingCount" | "offerCount">): string {
  if (!row.viewingCount && !row.offerCount) return "No viewings or offers yet";
  const parts: string[] = [];
  if (row.viewingCount) parts.push(`${row.viewingCount} viewing${row.viewingCount === 1 ? "" : "s"}`);
  if (row.offerCount) parts.push(`${row.offerCount} offer${row.offerCount === 1 ? "" : "s"}`);
  return parts.join(" · ");
}
