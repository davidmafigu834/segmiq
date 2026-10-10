import type { CatalogueItem, ListingItem } from "./types";

export type CatalogueMatch =
  | { status: "none" }
  | { status: "ambiguous"; options: CatalogueItem[] }
  | { status: "matched"; item: CatalogueItem; quantity: number | null };

const SIZE_RE = /\b\d{3}\s*\/\s*\d{2}\s*r?\s*\d{2}\b/i;

export function extractQuantity(text: string): number | null {
  const specific = text.match(
    /\b(?:qty|quantity|x|×)\s*(\d+)\b|\b(\d+)\s*(?:tyres?|tires?|units?|pcs|pieces?|items?)\b/i
  );
  const raw = specific?.[1] || specific?.[2];
  if (raw) {
    const n = Number(raw);
    if (Number.isFinite(n) && n > 0 && n <= 10000) return n;
  }
  const withoutSize = text.replace(SIZE_RE, " ");
  const loose = withoutSize.match(/\b(\d+)\b/);
  if (!loose) return null;
  const n = Number(loose[1]);
  if (!Number.isFinite(n) || n <= 0 || n > 10000) return null;
  return n;
}

function tokens(value: string): string[] {
  return value
    .toLowerCase()
    .split(/[^a-z0-9/]+/)
    .map((part) => part.trim())
    .filter((part) => part.length >= 3);
}

function mentioned(text: string, phrase: string | null | undefined): boolean {
  const needle = phrase?.trim().toLowerCase();
  if (!needle || needle.length < 3) return false;
  return text.toLowerCase().includes(needle);
}

export function matchCatalogue(text: string, items: CatalogueItem[]): CatalogueMatch {
  const hay = text.toLowerCase();
  const size = text.match(SIZE_RE)?.[0]?.replace(/\s+/g, "").toLowerCase() ?? null;
  const scored = items
    .map((item) => {
      let score = 0;
      if (mentioned(hay, item.name)) score += 5;
      if (mentioned(hay, item.sku)) score += 5;
      if (mentioned(hay, item.brand)) score += 3;
      if (size && item.size && item.size.replace(/\s+/g, "").toLowerCase().includes(size.replace(/\s+/g, ""))) {
        score += 4;
      } else if (size && item.name.replace(/\s+/g, "").toLowerCase().includes(size)) {
        score += 4;
      }
      const overlap = tokens(item.name).filter((token) => hay.includes(token)).length;
      score += Math.min(overlap, 3);
      return { item, score };
    })
    .filter((row) => row.score >= 3)
    .sort((a, b) => b.score - a.score);

  if (scored.length === 0) return { status: "none" };
  const top = scored[0].score;
  const tied = scored.filter((row) => row.score === top).map((row) => row.item);
  if (tied.length > 1) return { status: "ambiguous", options: tied.slice(0, 6) };
  return { status: "matched", item: tied[0], quantity: extractQuantity(text) };
}

export function matchListings(text: string, listings: ListingItem[]): ListingItem[] {
  const hay = text.toLowerCase();
  return listings.filter((listing) => {
    if (listing.location && hay.includes(listing.location.toLowerCase())) return true;
    return tokens(listing.name).some((token) => token.length >= 4 && hay.includes(token));
  });
}

export function draftFingerprint(
  lines: Array<{ productId: string | null; name: string; quantity: number }>
): string {
  return lines
    .map((line) => `${line.productId ?? line.name}:${line.quantity}`)
    .sort()
    .join("|");
}

export function defaultRequiredFields(input: {
  businessType: string | null;
  hasListings: boolean;
  hasProducts: boolean;
}): Array<{ key: string; label: string }> {
  if (input.businessType === "real_estate" || (input.hasListings && !input.hasProducts)) {
    return [
      { key: "intent", label: "Sale or rental" },
      { key: "location", label: "Location" },
      { key: "budget", label: "Budget" },
    ];
  }
  if (input.hasProducts) {
    return [
      { key: "product", label: "Product" },
      { key: "quantity", label: "Quantity" },
    ];
  }
  return [
    { key: "scope", label: "Requested work" },
    { key: "preferred_date", label: "Preferred date" },
  ];
}
