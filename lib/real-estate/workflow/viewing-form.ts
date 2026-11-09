import { authorisedMarketingPhotoUrl, projectPublicProperty } from "@/lib/real-estate/agent-listing-pages/policy";
import { privateListingImageKey } from "@/lib/real-estate/listing-access";

export const VIEWING_ACCENT = "#2f3a32";

export type ViewingPropertyCard = {
  heading: string;
  place: string | null;
  priceLabel: string | null;
  priceOnRequest: boolean;
  categoryLabel: string | null;
  transactionLabel: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  description: string | null;
  photoUrl: string | null;
  photoUrls: string[];
};

/** Every photograph stored on the listing, in order. Inspection files and files added on the listing share this list. */
export function viewingFormPhotoSources(
  photos: unknown,
  clientId: string,
  listingId: string,
  token: string,
  publicBase: string | null | undefined,
): string[] {
  if (!Array.isArray(photos)) return [];
  const base = `/api/public/journey/${encodeURIComponent(token)}/photo`;
  let privateIndex = 0;
  const sources: string[] = [];
  for (const value of photos) {
    if (sources.length >= 50) break;
    if (privateListingImageKey(value, clientId, listingId)) {
      sources.push(privateIndex === 0 ? base : `${base}?index=${privateIndex}`);
      privateIndex += 1;
      continue;
    }
    const url = authorisedMarketingPhotoUrl(value, clientId, listingId, publicBase);
    if (url) sources.push(url);
  }
  return sources;
}

export function viewingPropertyCard(input: {
  address: string | null;
  suburb: string | null;
  price: number | null;
  currency: string | null;
  currencyConfigured: boolean;
  transactionType: string | null;
  propertyCategory: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  description: string | null;
  photoUrl?: string | null;
  photoUrls?: string[];
}): ViewingPropertyCard {
  const photoUrls = input.photoUrls ?? (input.photoUrl ? [input.photoUrl] : []);
  const projected = projectPublicProperty({
    address: input.address,
    suburb: input.suburb,
    price: input.price,
    currency: input.currency,
    currencyConfigured: input.currencyConfigured,
    transactionType: input.transactionType,
    propertyCategory: input.propertyCategory,
    bedrooms: input.bedrooms,
    bathrooms: input.bathrooms,
    sizeSqm: null,
    description: input.description,
    status: "available",
    photoCount: photoUrls.length,
  });
  const suburb = projected.suburb;
  const place = suburb && !projected.heading.toLowerCase().includes(suburb.toLowerCase()) ? suburb : null;
  return {
    heading: projected.heading,
    place,
    priceLabel: projected.priceLabel,
    priceOnRequest: projected.priceLabel == null,
    categoryLabel: projected.categoryLabel,
    transactionLabel: viewingDealLabel(input.transactionType, projected.transactionLabel),
    bedrooms: projected.bedrooms,
    bathrooms: projected.bathrooms,
    description: projected.description,
    photoUrl: photoUrls[0] ?? null,
    photoUrls,
  };
}

function viewingDealLabel(type: string | null, fallback: string | null): string | null {
  if (type === "sale") return "For sale";
  if (type === "rental") return "To rent";
  return fallback;
}

/** Near-black ink on a light agency colour, paper ink on a dark one. */
export function viewingAccentInk(accent: string): string {
  const match = /^#([0-9a-fA-F]{6})$/.exec(accent);
  if (!match) return "#f7f4ef";
  const value = Number.parseInt(match[1], 16);
  const luminance = (0.2126 * ((value >> 16) & 255) + 0.7152 * ((value >> 8) & 255) + 0.0722 * (value & 255)) / 255;
  return luminance > 0.62 ? "#171916" : "#f7f4ef";
}
