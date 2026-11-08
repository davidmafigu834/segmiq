import { projectPublicProperty } from "@/lib/real-estate/agent-listing-pages/policy";

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
};

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
  photoUrl: string | null;
}): ViewingPropertyCard {
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
    photoCount: input.photoUrl ? 1 : 0,
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
    photoUrl: input.photoUrl,
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
