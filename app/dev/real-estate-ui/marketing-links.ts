"use client";

import { useSyncExternalStore } from "react";

export type RangeId = "7" | "30" | "90";
export type Slice = { visits: number; enquiries: number; viewings: number; offers: number; whatsapp: number };

export type Listing = {
  id: string;
  address: string;
  suburb: string;
  seller: string | null;
  status: string;
};

export type LinkRow = {
  id: string;
  listingId: string;
  address: string;
  suburb: string;
  campaign: string | null;
  source: string | null;
  path: string;
  outcome: string;
  note: string;
  revoked: boolean;
  slices: Record<RangeId, Slice>;
};

export const LISTINGS: Listing[] = [
  { id: "baines", address: "2 Baines Avenue", suburb: "Avondale", seller: "David Mafigu", status: "On the market" },
  { id: "kingsmead", address: "14 Kingsmead", suburb: "Borrowdale", seller: "Tendai Moyo", status: "On the market" },
  { id: "stonechat", address: "8 Stonechat Lane", suburb: "Borrowdale", seller: "Amina Cruz", status: "In preparation" },
  { id: "kensington", address: "Flat 4B, Kensington", suburb: "Kensington", seller: "Rudo Ncube", status: "Under offer" },
  { id: "brooke", address: "4 Borrowdale Brooke", suburb: "Borrowdale", seller: null, status: "On the market" },
];

function zero(): Slice {
  return { visits: 0, enquiries: 0, viewings: 0, offers: 0, whatsapp: 0 };
}

function slices(input: Record<RangeId, Slice>): Record<RangeId, Slice> {
  return { "7": { ...input["7"] }, "30": { ...input["30"] }, "90": { ...input["90"] } };
}

const SEED: LinkRow[] = [
  {
    id: "kensington",
    listingId: "kensington",
    address: "Flat 4B, Kensington",
    suburb: "Kensington",
    campaign: null,
    source: null,
    path: "https://www.segmiq.com/property/kensington?ref=desk",
    outcome: "No enquiry yet.",
    note: "People opened the page and left.",
    revoked: false,
    slices: slices({
      "7": { visits: 4, enquiries: 0, viewings: 0, offers: 0, whatsapp: 0 },
      "30": { visits: 6, enquiries: 0, viewings: 0, offers: 0, whatsapp: 0 },
      "90": { visits: 11, enquiries: 0, viewings: 0, offers: 0, whatsapp: 0 },
    }),
  },
  {
    id: "kingsmead",
    listingId: "kingsmead",
    address: "14 Kingsmead",
    suburb: "Borrowdale",
    campaign: "WhatsApp Status",
    source: "WhatsApp",
    path: "https://www.segmiq.com/property/kingsmead?ref=desk",
    outcome: "Seller sent a counter at US$180,000.",
    note: "The enquiry is the offer already on the desk.",
    revoked: false,
    slices: slices({
      "7": { visits: 2, enquiries: 0, viewings: 0, offers: 0, whatsapp: 1 },
      "30": { visits: 11, enquiries: 1, viewings: 1, offers: 1, whatsapp: 4 },
      "90": { visits: 18, enquiries: 1, viewings: 1, offers: 1, whatsapp: 6 },
    }),
  },
  {
    id: "stonechat",
    listingId: "stonechat",
    address: "8 Stonechat Lane",
    suburb: "Borrowdale",
    campaign: "Property portal",
    source: "Property Portal",
    path: "https://www.segmiq.com/property/stonechat?ref=desk",
    outcome: "Chipo Ndlovu signed the form.",
    note: "The PDF is ready on the desk.",
    revoked: false,
    slices: slices({
      "7": { visits: 1, enquiries: 0, viewings: 0, offers: 0, whatsapp: 0 },
      "30": { visits: 8, enquiries: 1, viewings: 1, offers: 1, whatsapp: 0 },
      "90": { visits: 14, enquiries: 1, viewings: 1, offers: 1, whatsapp: 0 },
    }),
  },
  {
    id: "brooke",
    listingId: "brooke",
    address: "4 Borrowdale Brooke",
    suburb: "Borrowdale",
    campaign: null,
    source: "Website",
    path: "https://www.segmiq.com/property/borrowdale-brooke?ref=desk",
    outcome: "Rudo Ncube is viewing today at 09:30.",
    note: "The viewing request came from this link.",
    revoked: false,
    slices: slices({
      "7": { visits: 3, enquiries: 1, viewings: 1, offers: 0, whatsapp: 1 },
      "30": { visits: 5, enquiries: 1, viewings: 1, offers: 0, whatsapp: 1 },
      "90": { visits: 9, enquiries: 1, viewings: 1, offers: 0, whatsapp: 2 },
    }),
  },
];

let links = SEED;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useMarketingLinks() {
  return useSyncExternalStore(subscribe, () => links, () => links);
}

export function listingById(id: string) {
  return LISTINGS.find((listing) => listing.id === id) ?? null;
}

export function listingIdForAddress(address: string) {
  return LISTINGS.find((listing) => listing.address === address)?.id ?? null;
}

export function createPersonalLink(listingId: string) {
  const listing = listingById(listingId);
  if (!listing) return null;
  const existing = links.find((link) => link.listingId === listingId && link.campaign == null && !link.revoked);
  if (existing) return existing;
  const created: LinkRow = {
    id: `${listingId}-personal`,
    listingId,
    address: listing.address,
    suburb: listing.suburb,
    campaign: null,
    source: null,
    path: `https://www.segmiq.com/property/${listingId}?ref=desk`,
    outcome: "No visits yet.",
    note: "Created from the property.",
    revoked: false,
    slices: { "7": zero(), "30": zero(), "90": zero() },
  };
  links = [created, ...links];
  emit();
  return created;
}

export function createCampaignLink(listingId: string, label: string): { link: LinkRow } | { error: string } {
  const name = label.trim().slice(0, 40);
  if (!name) return { error: "Name the campaign." };
  const listing = listingById(listingId);
  if (!listing) return { error: "That property is not on this desk." };
  if (!links.some((link) => link.listingId === listingId && link.campaign == null && !link.revoked)) {
    createPersonalLink(listingId);
  }
  const duplicate = links.some((link) => link.listingId === listingId && !link.revoked && link.campaign?.toLowerCase() === name.toLowerCase());
  if (duplicate) return { error: "That campaign link already exists." };
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "campaign";
  const created: LinkRow = {
    id: `${listingId}-${slug}`,
    listingId,
    address: listing.address,
    suburb: listing.suburb,
    campaign: name,
    source: null,
    path: `https://www.segmiq.com/property/${listingId}?ref=${slug}`,
    outcome: "No visits yet.",
    note: "Created from the property.",
    revoked: false,
    slices: { "7": zero(), "30": zero(), "90": zero() },
  };
  links = [created, ...links];
  emit();
  return { link: created };
}

export function revokeLink(id: string) {
  links = links.map((link) => (link.id === id ? { ...link, revoked: true } : link));
  emit();
}
