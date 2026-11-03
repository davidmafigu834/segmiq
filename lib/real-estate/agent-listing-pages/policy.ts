import { createHash, randomBytes } from "crypto";
import { LISTING_STATUS_LABEL, LISTING_TYPE_LABEL, isClosedListingStatus } from "@/lib/real-estate/listings";
import type { ListingStatus, ListingTransactionType } from "@/types";

export const EVENT_RETENTION_DAYS = 180;
export const DAILY_SUMMARY_RETENTION_DAYS = 730;
export const MAX_CAMPAIGN_LINKS_DEFAULT = 8;
export const ATTRIBUTION_WINDOW_DAYS_DEFAULT = 30;

/**
 * A page view, a form submission, a WhatsApp tap, and a confirmed conversation
 * are different facts. Earlier rows are not overwritten by later ones.
 * Precedence when describing one lead:
 * 1. Stored CRM ownership stays with the existing assignee.
 * 2. A confirmed inbound WhatsApp message is the only WhatsApp lead.
 * 3. An enquiry submission is a lead. A viewing request is a request, not a booking.
 * 4. A WhatsApp click is only a click.
 * 5. A page view is only a visit. Preview fetches are not visitors.
 */
export const ATTRIBUTION_PRECEDENCE = [
  "existing_operational_owner",
  "confirmed_inbound_whatsapp",
  "enquiry_submission",
  "viewing_request",
  "whatsapp_click",
  "page_view",
] as const;

export const CONTACT_POLICIES = ["enquiry_form", "agency_whatsapp", "agent_whatsapp_if_allowed"] as const;
export type ContactPolicy = (typeof CONTACT_POLICIES)[number];
export const ENQUIRY_ROUTINGS = ["assign_marketing_agent", "agency_assignment"] as const;
export type EnquiryRouting = (typeof ENQUIRY_ROUTINGS)[number];

export type AgencyListingPageSettings = {
  enabled: boolean;
  agentsMayGenerate: boolean;
  publicAgencyName: string | null;
  showAgentName: boolean;
  showAgentPhoto: boolean;
  showAgentPhone: boolean;
  publicContactPolicy: ContactPolicy;
  enquiryRouting: EnquiryRouting;
  catalogueUrl: string | null;
  verifiedWebsite: string | null;
  attributionWindowDays: number;
  maxCampaignLinks: number;
};

export const DEFAULT_LISTING_PAGE_SETTINGS: AgencyListingPageSettings = {
  enabled: true,
  agentsMayGenerate: true,
  publicAgencyName: null,
  showAgentName: true,
  showAgentPhoto: true,
  showAgentPhone: false,
  publicContactPolicy: "enquiry_form",
  enquiryRouting: "assign_marketing_agent",
  catalogueUrl: null,
  verifiedWebsite: null,
  attributionWindowDays: ATTRIBUTION_WINDOW_DAYS_DEFAULT,
  maxCampaignLinks: MAX_CAMPAIGN_LINKS_DEFAULT,
};

const PUBLIC_STATUSES = new Set(["available", "under_offer", "reserved", "sold", "let", "rented", "under_management"]);

export type ListingGateInput = {
  organisationId: string;
  listingOrganisationId: string;
  approvalStatus: string | null;
  status: string | null;
  featureEnabled: boolean;
  organisationActive: boolean;
  /** Omitted or inactive keeps the historical approval gate. */
  compliancePublication?: "inactive" | "clear" | "blocked";
};

export type ListingGate =
  | { ok: true; advertiseAsAvailable: boolean; publicStatus: string }
  | { ok: false; reason: "cross_tenant" | "disabled" | "organisation_inactive" | "unapproved" | "unknown_status" | "compliance_blocked" };

/** Whether a listing may be marketed. Sold and rented listings can still render their real status. */
export function listingMarketingGate(input: ListingGateInput): ListingGate {
  if (input.organisationId !== input.listingOrganisationId) return { ok: false, reason: "cross_tenant" };
  if (!input.organisationActive) return { ok: false, reason: "organisation_inactive" };
  if (!input.featureEnabled) return { ok: false, reason: "disabled" };
  const approval = input.approvalStatus ?? "approved";
  if (approval !== "approved") return { ok: false, reason: "unapproved" };
  if (input.compliancePublication === "blocked") return { ok: false, reason: "compliance_blocked" };
  const status = input.status ?? "";
  if (!PUBLIC_STATUSES.has(status)) return { ok: false, reason: "unknown_status" };
  return {
    ok: true,
    advertiseAsAvailable: status === "available",
    publicStatus: status,
  };
}

export function acceptsNewEnquiry(gate: ListingGate): boolean {
  return gate.ok && gate.advertiseAsAvailable;
}

export type ShareActor = {
  userId: string;
  role: string;
  clientId: string | null;
  alsoSells?: boolean;
};

export function isOrganisationManager(role: string | null | undefined): boolean {
  return role === "CLIENT_MANAGER" || role === "SUPER_ADMIN";
}

export function canGenerateOwnShare(actor: ShareActor, agentActive: boolean): boolean {
  if (!agentActive || !actor.clientId) return false;
  if (actor.role === "SALESPERSON") return true;
  return actor.role === "CLIENT_MANAGER" && actor.alsoSells === true;
}

export function canRevokeShare(actor: ShareActor, share: { clientId: string; agentId: string }): boolean {
  if (actor.role !== "SUPER_ADMIN" && actor.clientId !== share.clientId) return false;
  if (isOrganisationManager(actor.role)) return true;
  return actor.role === "SALESPERSON" && actor.userId === share.agentId;
}

export function canReadShareAnalytics(actor: ShareActor, share: { clientId: string; agentId: string }): boolean {
  return canRevokeShare(actor, share);
}

export type AgentMembership = {
  clientId: string | null;
  role: string | null;
  active: boolean;
  archived: boolean;
  alsoSells: boolean;
};

/** A deactivated or removed member cannot collect new attribution. History stays on the share row. */
export function shareAcceptsAttribution(input: {
  shareStatus: string;
  agent: AgentMembership;
  listingOrganisationId: string;
}): boolean {
  if (input.shareStatus !== "active") return false;
  if (!input.agent.active || input.agent.archived) return false;
  if (input.agent.clientId !== input.listingOrganisationId) return false;
  if (input.agent.role === "SALESPERSON") return true;
  return input.agent.role === "CLIENT_MANAGER" && input.agent.alsoSells;
}

export function newShareToken(): string {
  return randomBytes(32).toString("base64url");
}

export function isOpaqueShareToken(value: string): boolean {
  return /^[A-Za-z0-9_-]{32,80}$/.test(value) && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

export function publicSlugBase(suburb: string | null | undefined): string {
  const raw = (suburb ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .trim();
  const slug = raw.replace(/[\s_]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
  return slug || "property";
}

export function buildPublicSlug(suburb: string | null | undefined, suffix: string): string {
  const safe = suffix.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 8);
  return `${publicSlugBase(suburb)}-${safe || "page"}`;
}

export function newPublicSlug(suburb: string | null | undefined): string {
  return buildPublicSlug(suburb, randomBytes(4).toString("hex"));
}

export function normaliseCampaignLabel(value: string | null | undefined): string | null {
  if (value == null) return null;
  const label = value.replace(/\s+/g, " ").trim();
  if (!label) return null;
  if (label.length > 40) return null;
  if (/[\u0000-\u001f]/.test(label)) return null;
  return label;
}

export function listingPagePath(slug: string, token?: string | null): string {
  const path = `/property/${encodeURIComponent(slug)}`;
  if (!token) return path;
  return `${path}?ref=${encodeURIComponent(token)}`;
}

export function canonicalListingPath(slug: string): string {
  return listingPagePath(slug);
}

export function absoluteListingUrl(origin: string, slug: string, token?: string | null): string {
  return `${origin.replace(/\/$/, "")}${listingPagePath(slug, token)}`;
}

const PRIVATE_HOSTS = new Set(["localhost", "127.0.0.1", "0.0.0.0", "::1"]);

/** HTTPS URL on the same host as the verified company website. Rejects credentials and other hosts. */
export function safeAgencyHttpUrl(verifiedWebsite: string | null | undefined, candidate: string | null | undefined): string | null {
  if (!verifiedWebsite || !candidate) return null;
  let verified: URL;
  let target: URL;
  try {
    verified = new URL(verifiedWebsite);
    target = new URL(candidate);
  } catch {
    return null;
  }
  if (verified.protocol !== "https:" || target.protocol !== "https:") return null;
  if (verified.username || verified.password || target.username || target.password) return null;
  if (verified.hash || target.hash) return null;
  const host = target.hostname.toLowerCase();
  if (PRIVATE_HOSTS.has(host) || host.endsWith(".local")) return null;
  if (host !== verified.hostname.toLowerCase()) return null;
  return target.toString();
}

export function validateVerifiedWebsite(value: string | null | undefined): string | null {
  if (!value?.trim()) return null;
  const withScheme = /^https?:\/\//i.test(value.trim()) ? value.trim() : `https://${value.trim()}`;
  try {
    const url = new URL(withScheme);
    if (url.protocol !== "https:" || url.username || url.password) return null;
    const host = url.hostname.toLowerCase();
    if (PRIVATE_HOSTS.has(host) || host.endsWith(".local") || !host.includes(".")) return null;
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}

export type PublicListingSource = {
  address: string | null;
  suburb: string | null;
  price: number | null;
  currency: string | null;
  currencyConfigured: boolean;
  transactionType: string | null;
  propertyCategory: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  sizeSqm: number | null;
  description: string | null;
  status: string | null;
  photoCount: number;
};

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

export type PublicPropertyProjection = {
  heading: string;
  suburb: string | null;
  address: string | null;
  priceLabel: string | null;
  priceOnRequest: boolean;
  currency: string | null;
  currencyContext: "quotation_currency" | "unconfigured";
  transactionLabel: string | null;
  categoryLabel: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  sizeSqm: number | null;
  description: string | null;
  status: string;
  statusLabel: string;
  advertiseAsAvailable: boolean;
  photoCount: number;
};

export function projectPublicProperty(source: PublicListingSource): PublicPropertyProjection {
  const status = (PUBLIC_STATUSES.has(source.status ?? "") ? source.status : "available") as string;
  const heading = source.address?.trim() || source.suburb?.trim() || "Property";
  const currency = source.currencyConfigured && source.currency && /^[A-Z]{3}$/.test(source.currency) ? source.currency : null;
  const amount = source.price != null && Number.isFinite(Number(source.price)) ? Number(source.price) : null;
  const priceLabel = amount != null && currency
    ? `${currency} ${amount.toLocaleString("en-US", { maximumFractionDigits: 0 })}`
    : null;
  const transactionLabel = source.transactionType && source.transactionType in LISTING_TYPE_LABEL
    ? LISTING_TYPE_LABEL[source.transactionType as ListingTransactionType]
    : null;
  const categoryLabel = source.propertyCategory ? CATEGORY_LABEL[source.propertyCategory] ?? null : null;
  return {
    heading,
    suburb: source.suburb?.trim() || null,
    address: source.address?.trim() || null,
    priceLabel,
    priceOnRequest: amount != null && !currency,
    currency,
    currencyContext: currency ? "quotation_currency" : "unconfigured",
    transactionLabel,
    categoryLabel,
    bedrooms: finiteInt(source.bedrooms),
    bathrooms: finiteInt(source.bathrooms),
    sizeSqm: source.sizeSqm != null && Number.isFinite(Number(source.sizeSqm)) ? Number(source.sizeSqm) : null,
    description: source.description?.replace(/[\u0000-\u0008]/g, "").trim().slice(0, 5000) || null,
    status,
    statusLabel: status in LISTING_STATUS_LABEL ? LISTING_STATUS_LABEL[status as ListingStatus] : status,
    advertiseAsAvailable: status === "available" && !isClosedListingStatus(status),
    photoCount: Math.max(0, Math.min(50, source.photoCount)),
  };
}

function finiteInt(value: number | null): number | null {
  if (value == null || !Number.isFinite(Number(value))) return null;
  return Math.trunc(Number(value));
}

export const RESTRICTED_PUBLIC_KEYS = [
  "seller",
  "owner",
  "mandate",
  "mandate_type",
  "acquisition",
  "notes",
  "rejection_reason",
  "kyc",
  "client_id",
  "agent_id",
  "contact_id",
  "phone",
] as const;

export function whatsAppPrefill(suburb: string | null | undefined, publicSlug: string): string {
  const place = suburb?.trim() || "the property";
  return `Hello, I'm interested in the property in ${place}. Could you share more information? Ref: ${publicSlug}`;
}

export function whatsAppLink(digits: string | null | undefined, text: string): string | null {
  if (!digits || !/^[1-9]\d{7,15}$/.test(digits)) return null;
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}

export function shareCaption(suburb: string | null | undefined, agencyName: string): string {
  const place = suburb?.trim();
  if (place) return `${place}. Enquire with ${agencyName}.`;
  return `Property enquiry for ${agencyName}.`;
}

export function initials(name: string | null | undefined): string {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean).slice(0, 2);
  if (!parts.length) return "A";
  return parts.map((part) => part[0]?.toUpperCase() ?? "").join("");
}

export type EnquiryAssignmentInput = {
  routing: EnquiryRouting;
  openLeadOwnerId: string | null;
  marketingAgentEligible: boolean;
  marketingAgentId: string;
};

/** Never pass an override when an open lead already has an owner. */
export function enquiryAssigneeOverride(input: EnquiryAssignmentInput): { overrideAssigneeId?: string; preservedOwnerId: string | null } {
  if (input.openLeadOwnerId) return { preservedOwnerId: input.openLeadOwnerId };
  if (input.routing === "assign_marketing_agent" && input.marketingAgentEligible) {
    return { overrideAssigneeId: input.marketingAgentId, preservedOwnerId: null };
  }
  return { preservedOwnerId: null };
}

export function dealSideForListing(transactionType: string | null | undefined): "buy_side" | "tenant_side" | null {
  if (transactionType === "rental") return "tenant_side";
  if (transactionType === "sale" || transactionType === "new_development") return "buy_side";
  return null;
}

const PREVIEW_AGENTS = [
  /whatsapp/i,
  /facebookexternalhit/i,
  /facebot/i,
  /twitterbot/i,
  /slackbot/i,
  /telegrambot/i,
  /linkedinbot/i,
  /discordbot/i,
  /pinterest/i,
  /skypeuripreview/i,
  /embedly/i,
  /quora link preview/i,
  /redditbot/i,
  /vkshare/i,
  /w3c_validator/i,
  /ia_archiver/i,
];

const AUTOMATION_AGENTS = [
  /bot/i,
  /crawler/i,
  /spider/i,
  /headless/i,
  /curl\//i,
  /wget/i,
  /python-requests/i,
  /go-http-client/i,
  /httpclient/i,
  /scrapy/i,
  /preview/i,
];

export type BotClass = "human" | "preview" | "automation" | "unknown";

export function classifyUserAgent(userAgent: string | null | undefined): BotClass {
  const ua = userAgent?.trim() ?? "";
  if (!ua) return "unknown";
  if (PREVIEW_AGENTS.some((pattern) => pattern.test(ua))) return "preview";
  if (AUTOMATION_AGENTS.some((pattern) => pattern.test(ua))) return "automation";
  return "human";
}

export function visitorLabel(raw: string | null | undefined, pepper: string | null | undefined): string | null {
  if (!raw || !pepper || !/^[A-Za-z0-9_-]{16,80}$/.test(raw)) return null;
  return createHash("sha256").update(`${pepper}:${raw}`).digest("hex").slice(0, 32);
}

export function phoneHash(normalisedDigits: string): string {
  return createHash("sha256").update(`listing-page-phone:${normalisedDigits}`).digest("hex");
}

export function sourceHintFromReferrer(referrer: string | null | undefined): string {
  if (!referrer) return "direct";
  try {
    const host = new URL(referrer).hostname.toLowerCase();
    if (host.includes("whatsapp") || host === "wa.me" || host.endsWith("whatsapp.com")) return "whatsapp";
    if (host.includes("facebook") || host === "fb.com" || host.endsWith("fb.me")) return "facebook";
    if (host.includes("instagram")) return "instagram";
    if (host === "t.co" || host.includes("twitter") || host.includes("x.com")) return "x";
    return "referral";
  } catch {
    return "direct";
  }
}

export function isValidTimeZone(timeZone: string): boolean {
  try {
    Intl.DateTimeFormat("en-US", { timeZone });
    return true;
  } catch {
    return false;
  }
}

function zoneOffsetMs(instant: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(instant);
  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const hour = Number(map.hour) % 24;
  const asUtc = Date.UTC(Number(map.year), Number(map.month) - 1, Number(map.day), hour, Number(map.minute), Number(map.second));
  return asUtc - instant.getTime();
}

/** Convert a wall-clock time in an IANA zone to UTC. Rejects naive offsets. */
export function zonedWallTimeToUtc(wall: string, timeZone: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(wall) || !isValidTimeZone(timeZone)) return null;
  const guess = new Date(`${wall}Z`);
  if (Number.isNaN(guess.getTime())) return null;
  const first = new Date(guess.getTime() - zoneOffsetMs(guess, timeZone));
  return new Date(guess.getTime() - zoneOffsetMs(first, timeZone));
}

export function rangeForPreset(
  preset: "7d" | "30d" | "90d" | "custom",
  now: Date,
  timeZone: string,
  customFrom?: string | null,
  customTo?: string | null
): { from: Date; to: Date } | null {
  if (!isValidTimeZone(timeZone)) return null;
  const dayKey = (date: Date) =>
    new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
  if (preset === "custom") {
    if (!customFrom || !customTo || !/^\d{4}-\d{2}-\d{2}$/.test(customFrom) || !/^\d{4}-\d{2}-\d{2}$/.test(customTo)) return null;
    const from = zonedWallTimeToUtc(`${customFrom}T00:00:00`, timeZone);
    const toStart = zonedWallTimeToUtc(`${customTo}T00:00:00`, timeZone);
    if (!from || !toStart) return null;
    const to = new Date(toStart.getTime() + 24 * 60 * 60 * 1000);
    if (to.getTime() <= from.getTime() || to.getTime() - from.getTime() > 366 * 24 * 60 * 60 * 1000) return null;
    return { from, to };
  }
  const days = preset === "7d" ? 7 : preset === "30d" ? 30 : 90;
  const today = zonedWallTimeToUtc(`${dayKey(now)}T00:00:00`, timeZone);
  if (!today) return null;
  return { from: new Date(today.getTime() - (days - 1) * 24 * 60 * 60 * 1000), to: new Date(today.getTime() + 24 * 60 * 60 * 1000) };
}

export function viewingInstant(iso: string, now = new Date()): { ok: true; at: string } | { ok: false; error: string } {
  if (!/(?:Z|[+-]\d{2}:\d{2})$/.test(iso)) return { ok: false, error: "Preferred time needs a timezone." };
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return { ok: false, error: "Preferred time is not a valid date." };
  const delta = at.getTime() - now.getTime();
  if (delta < 60 * 60 * 1000) return { ok: false, error: "Choose a time at least an hour from now." };
  if (delta > 90 * 24 * 60 * 60 * 1000) return { ok: false, error: "Choose a time within the next 90 days." };
  return { ok: true, at: at.toISOString() };
}

export function submissionReplay(existing: { leadId: string | null; status: string; ageMs: number }): "replay" | "retry" | "takeover" {
  if (existing.status === "accepted" && existing.leadId) return "replay";
  if (existing.status === "pending" && existing.ageMs < 60_000) return "retry";
  return "takeover";
}

export function publicMediaPath(slug: string, index: number, token?: string | null): string {
  const params = new URLSearchParams({ slug, index: String(index) });
  if (token) params.set("token", token);
  return `/api/public/listing-pages/media?${params.toString()}`;
}

export function mediaPathIsDurableMarketingAsset(path: string): boolean {
  return path.startsWith("/api/public/listing-pages/media?") && !/X-Amz-Signature|r2\.cloudflarestorage|Expires=/i.test(path);
}

export function countPrivatePhotos(photos: unknown, clientId: string, listingId: string): number {
  if (!Array.isArray(photos)) return 0;
  const prefix = `clients/${clientId}/listings/${listingId}/photos/`;
  return photos.filter((value) => typeof value === "string" && value.startsWith(prefix) && /^[a-zA-Z0-9_-]+\.(jpg|jpeg|png|webp|avif)$/i.test(value.slice(prefix.length))).length;
}

export function privatePhotoKeyAt(photos: unknown, clientId: string, listingId: string, index: number): string | null {
  if (!Array.isArray(photos) || !Number.isInteger(index) || index < 0) return null;
  const prefix = `clients/${clientId}/listings/${listingId}/photos/`;
  const keys = photos.filter((value): value is string => typeof value === "string" && value.startsWith(prefix) && /^[a-zA-Z0-9_-]+\.(jpg|jpeg|png|webp|avif)$/i.test(value.slice(prefix.length)));
  return keys[index] ?? null;
}
