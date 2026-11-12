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
  const sources: string[] = [];
  for (const value of photos) {
    if (sources.length >= 50) break;
    if (privateListingImageKey(value, clientId, listingId)) {
      const fileId = value.slice(value.lastIndexOf("/") + 1);
      sources.push(`${base}?id=${encodeURIComponent(fileId)}`);
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

export const VIEWING_PARTIES = ["Just me", "Two of us", "A family"] as const;

export type ViewingParty = (typeof VIEWING_PARTIES)[number];

const CATEGORY_LABEL: Record<string, string> = {
  house: "House",
  apartment: "Apartment",
  townhouse: "Townhouse",
  residential_stand: "Residential stand",
  commercial: "Commercial",
  industrial: "Industrial",
  agricultural: "Agricultural",
  other: "Other",
};

const TRANSACTION_PHRASE: Record<string, string> = {
  sale: "for sale",
  rental: "to rent",
  new_development: "in a new development",
  property_management: "under management",
};

export type ViewingFormCard = {
  sentBy: string;
  heading: string;
  placeLine: string | null;
  note: string | null;
  facts: Array<{ label: string; value: string }>;
};

export function viewingParty(value: unknown): ViewingParty | null {
  return VIEWING_PARTIES.includes(value as ViewingParty) ? (value as ViewingParty) : null;
}

/** A drawn PNG, or a short typed name from an older form. */
export function viewingSignatureAccepted(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed.startsWith("data:image/png;base64,")) {
    const payload = trimmed.slice("data:image/png;base64,".length);
    return payload.length >= 16 && trimmed.length <= 250_000 && /^[A-Za-z0-9+/=]+$/.test(payload);
  }
  return trimmed.length >= 2 && trimmed.length <= 200 && !trimmed.startsWith("data:") && !trimmed.includes("\n");
}

export function viewingPhotoKeys(photos: unknown, clientId: string, listingId: string): string[] {
  if (!Array.isArray(photos)) return [];
  const keys: string[] = [];
  for (const value of photos) {
    const key = privateListingImageKey(value, clientId, listingId);
    if (!key) continue;
    keys.push(key);
    if (keys.length >= 4) break;
  }
  return keys;
}

export function formatViewingSlot(value: string): { day: string; time: string; label: string } {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return { day: value, time: "", label: value };
  const day = date.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" });
  const time = date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  return { day, time, label: `${day} at ${time}` };
}

export function viewingFormCard(input: {
  agencyName: string;
  contactName: string | null;
  address: string | null;
  suburb: string | null;
  description: string | null;
  price: number | null;
  currency: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  sizeSqm: number | null;
  transactionType: string | null;
  propertyCategory: string | null;
}): ViewingFormCard {
  const address = clean(input.address);
  const suburb = clean(input.suburb);
  const heading = address || suburb || "Property";
  const category = input.propertyCategory ? CATEGORY_LABEL[input.propertyCategory] ?? null : null;
  const phrase = input.transactionType ? TRANSACTION_PHRASE[input.transactionType] ?? null : null;
  const kind = category && phrase ? `${category} ${phrase}` : category ?? (phrase ? phrase.charAt(0).toUpperCase() + phrase.slice(1) : null);
  const place = suburb && suburb !== heading ? suburb : null;
  const placeLine = [place, kind].filter(Boolean).join(". ") || null;
  const contact = clean(input.contactName);
  const agency = clean(input.agencyName) || "The agency";
  const facts: Array<{ label: string; value: string }> = [];
  const currency = input.currency && /^[A-Z]{3}$/.test(input.currency) ? input.currency : null;
  const price = input.price != null && Number.isFinite(input.price) ? input.price : null;
  if (price != null && currency) {
    facts.push({ label: "Asking", value: `${currency} ${price.toLocaleString("en-US", { maximumFractionDigits: 0 })}` });
  }
  const bedrooms = whole(input.bedrooms);
  const bathrooms = whole(input.bathrooms);
  if (bedrooms != null) facts.push({ label: "Beds", value: String(bedrooms) });
  if (bathrooms != null) facts.push({ label: "Baths", value: String(bathrooms) });
  if (input.sizeSqm != null && Number.isFinite(input.sizeSqm) && input.sizeSqm > 0) {
    const size = Number.isInteger(input.sizeSqm) ? String(input.sizeSqm) : String(Math.round(input.sizeSqm * 10) / 10);
    facts.push({ label: "Size", value: `${size} m²` });
  }
  return {
    sentBy: contact ? `${contact} sent this` : `${agency} sent this`,
    heading,
    placeLine: placeLine ? `${placeLine}.` : null,
    note: clip(input.description),
    facts,
  };
}

function whole(value: number | null): number | null {
  if (value == null || !Number.isFinite(value) || value < 0) return null;
  return Math.trunc(value);
}

function clean(value: string | null | undefined): string | null {
  const text = value?.replace(/[\u0000-\u0008]/g, " ").replace(/\s+/g, " ").trim() ?? "";
  return text || null;
}

function clip(value: string | null | undefined): string | null {
  const text = clean(value);
  if (!text) return null;
  if (text.length <= 220) return text;
  const cut = text.slice(0, 220);
  const last = cut.lastIndexOf(" ");
  return `${(last > 160 ? cut.slice(0, last) : cut).trimEnd()}…`;
}
