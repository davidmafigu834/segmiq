import type { SupabaseClient } from "@supabase/supabase-js";
import { createLead } from "@/lib/leads/createLead";
import { findOpenLeadByPhone } from "@/lib/leads/findOpenLeadByPhone";
import { logLeadEvent } from "@/lib/lead-events";
import { appendInterestedListingIds } from "@/lib/real-estate/helpers";
import { normalizePhoneForWhatsApp } from "@/lib/whatsapp-opener";
import { checkDbRateLimit } from "@/lib/auth/db-rate-limit";
import { getPublicBaseUrl } from "@/lib/constants";
import { buildMarketingDesk, type DeskCount, type MarketingDesk } from "@/lib/real-estate/agent-listing-pages/desk";
import { listingCompliancePublication } from "@/lib/real-estate/compliance-management/publication";
import {
  absoluteListingUrl,
  acceptsNewEnquiry,
  canGenerateOwnShare,
  canReadShareAnalytics,
  canRevokeShare,
  classifyUserAgent,
  listingHasMarketingPhoto,
  publicListingPhotoSources,
  dealSideForListing,
  DEFAULT_LISTING_PAGE_SETTINGS,
  enquiryAssigneeOverride,
  isOrganisationManager,
  listingMarketingGate,
  newPublicSlug,
  newShareToken,
  normaliseCampaignLabel,
  phoneHash,
  projectPublicProperty,
  rangeForPreset,
  safeAgencyHttpUrl,
  shareAcceptsAttribution,
  shareCaption,
  sourceHintFromReferrer,
  submissionReplay,
  validateVerifiedWebsite,
  viewingInstant,
  visitorLabel,
  whatsAppLink,
  whatsAppPrefill,
  initials,
  type AgencyListingPageSettings,
  type ContactPolicy,
  type EnquiryRouting,
  type ShareActor,
} from "@/lib/real-estate/agent-listing-pages/policy";
import { dealOutcomeNote, factualInsights, sourceLabel, totalsFromCounts, visitSeries, type CountedEvent } from "@/lib/real-estate/agent-listing-pages/analytics";

type Db = SupabaseClient;
type Fail = { ok: false; status: number; error: string; code: string };
type Ok<T> = { ok: true } & T;

function fail(status: number, error: string, code: string): Fail {
  return { ok: false, status, error, code };
}

function schemaMissing(error: { code?: string; message?: string } | null): boolean {
  const message = error?.message ?? "";
  return error?.code === "42P01" || error?.code === "PGRST205" || /re_agent_listing_shares|re_agency_listing_page_settings/.test(message);
}

function mapSettings(row: Record<string, unknown> | null): AgencyListingPageSettings {
  if (!row) return { ...DEFAULT_LISTING_PAGE_SETTINGS };
  const policy = String(row.public_contact_policy ?? "");
  const routing = String(row.enquiry_routing ?? "");
  return {
    enabled: row.enabled !== false,
    agentsMayGenerate: row.agents_may_generate !== false,
    publicAgencyName: text(row.public_agency_name),
    showAgentName: row.show_agent_name !== false,
    showAgentPhoto: row.show_agent_photo !== false,
    showAgentPhone: row.show_agent_phone === true,
    publicContactPolicy: (["enquiry_form", "agency_whatsapp", "agent_whatsapp_if_allowed"].includes(policy) ? policy : "enquiry_form") as ContactPolicy,
    enquiryRouting: (routing === "agency_assignment" ? "agency_assignment" : "assign_marketing_agent") as EnquiryRouting,
    catalogueUrl: text(row.catalogue_url),
    verifiedWebsite: text(row.verified_website),
    attributionWindowDays: clamp(row.attribution_window_days, 7, 90, 30),
    maxCampaignLinks: clamp(row.max_campaign_links, 1, 20, 8),
  };
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function clamp(value: unknown, min: number, max: number, fallback: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(n)));
}

async function organisationActive(db: Db, clientId: string): Promise<{ ok: true; client: Record<string, unknown> } | Fail> {
  const { data, error } = await db
    .from("clients")
    .select("id, name, logo_url, website, business_type, is_active, is_archived, security_suspended_at, dial_code, meta_whatsapp_display_number, primary_color")
    .eq("id", clientId)
    .maybeSingle();
  if (error) return fail(503, "Organisation lookup failed", "SERVICE_UNAVAILABLE");
  if (!data || data.business_type !== "real_estate") return fail(404, "Not found", "NOT_FOUND");
  return { ok: true, client: data as Record<string, unknown> };
}

function clientIsActive(client: Record<string, unknown>): boolean {
  return client.is_active !== false && client.is_archived !== true && !client.security_suspended_at;
}

export async function getListingPageSettings(db: Db, clientId: string): Promise<Ok<{ settings: AgencyListingPageSettings; suggestedWebsite: string | null; stored: boolean }> | Fail> {
  const org = await organisationActive(db, clientId);
  if (!org.ok) return org;
  const { data, error } = await db.from("re_agency_listing_page_settings").select("*").eq("client_id", clientId).maybeSingle();
  if (error) return schemaMissing(error) ? fail(503, "Listing page storage is not available yet", "MIGRATION_REQUIRED") : fail(503, "Settings lookup failed", "SERVICE_UNAVAILABLE");
  return {
    ok: true,
    settings: mapSettings((data as Record<string, unknown> | null) ?? null),
    suggestedWebsite: text(org.client.website),
    stored: Boolean(data),
  };
}

export async function saveListingPageSettings(
  db: Db,
  clientId: string,
  patch: Partial<AgencyListingPageSettings>
): Promise<Ok<{ settings: AgencyListingPageSettings }> | Fail> {
  const current = await getListingPageSettings(db, clientId);
  if (!current.ok) return current;
  const next: AgencyListingPageSettings = { ...current.settings, ...patch };
  const verified = validateVerifiedWebsite(next.verifiedWebsite);
  if (next.verifiedWebsite && !verified) return fail(400, "Verified website must be a public https address", "INVALID_WEBSITE");
  const catalogue = next.catalogueUrl ? safeAgencyHttpUrl(verified, validateVerifiedWebsite(next.catalogueUrl)) : null;
  if (next.catalogueUrl && !catalogue) return fail(400, "Catalogue URL must be https on the verified website host", "INVALID_CATALOGUE");
  const row = {
    client_id: clientId,
    enabled: next.enabled,
    agents_may_generate: next.agentsMayGenerate,
    public_agency_name: next.publicAgencyName,
    show_agent_name: next.showAgentName,
    show_agent_photo: next.showAgentPhoto,
    show_agent_phone: next.showAgentPhone,
    public_contact_policy: next.publicContactPolicy,
    enquiry_routing: next.enquiryRouting,
    catalogue_url: catalogue,
    verified_website: verified,
    attribution_window_days: next.attributionWindowDays,
    max_campaign_links: next.maxCampaignLinks,
  };
  const { error } = await db.from("re_agency_listing_page_settings").upsert(row, { onConflict: "client_id" });
  if (error) return fail(503, "Settings could not be saved", "SERVICE_UNAVAILABLE");
  return { ok: true, settings: { ...next, verifiedWebsite: verified, catalogueUrl: catalogue } };
}

type ListingRow = Record<string, unknown>;

async function loadListing(db: Db, clientId: string, listingId: string): Promise<ListingRow | null> {
  const { data, error } = await db
    .from("listings")
    .select("id, client_id, agent_id, approval_status, status, address, suburb, price, bedrooms, bathrooms, size_sqm, description, photos, property_category, transaction_type, public_slug")
    .eq("client_id", clientId)
    .eq("id", listingId)
    .maybeSingle();
  if (error || !data) return null;
  return data as ListingRow;
}

async function ensureSlug(db: Db, listing: ListingRow): Promise<string | null> {
  if (typeof listing.public_slug === "string" && listing.public_slug) return listing.public_slug;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const slug = newPublicSlug(text(listing.suburb));
    const { data, error } = await db
      .from("listings")
      .update({ public_slug: slug })
      .eq("id", listing.id as string)
      .is("public_slug", null)
      .select("public_slug")
      .maybeSingle();
    if (!error && data && typeof (data as { public_slug?: string }).public_slug === "string") {
      return (data as { public_slug: string }).public_slug;
    }
    const again = await db.from("listings").select("public_slug").eq("id", listing.id as string).maybeSingle();
    const existing = (again.data as { public_slug?: string } | null)?.public_slug;
    if (existing) return existing;
    if (error && error.code !== "23505") return null;
  }
  return null;
}

function shareDto(row: Record<string, unknown>, origin: string, slug: string) {
  const token = String(row.token);
  return {
    id: row.id,
    listingId: row.listing_id,
    agentId: row.agent_id,
    campaignLabel: text(row.campaign_label),
    status: row.status,
    createdAt: row.created_at,
    revokedAt: row.revoked_at ?? null,
    publicPath: `/property/${slug}?ref=${encodeURIComponent(token)}`,
    publicUrl: absoluteListingUrl(origin, slug, token),
    canonicalPath: `/property/${slug}`,
  };
}

export async function generateShareLink(
  db: Db,
  actor: ShareActor,
  clientId: string,
  input: { listingId: string; campaignLabel?: string | null }
): Promise<Ok<{ share: ReturnType<typeof shareDto>; reused: boolean; caption: string }> | Fail> {
  if (actor.role !== "SUPER_ADMIN" && actor.clientId !== clientId) return fail(403, "Forbidden", "CROSS_TENANT_ACCESS");
  const org = await organisationActive(db, clientId);
  if (!org.ok) return org;
  const settingsResult = await getListingPageSettings(db, clientId);
  if (!settingsResult.ok) return settingsResult;
  const settings = settingsResult.settings;
  if (!settings.enabled || !settings.agentsMayGenerate) return fail(403, "Agent listing pages are switched off", "FEATURE_DISABLED");
  const { data: user, error: userError } = await db
    .from("users")
    .select("id, name, client_id, role, is_active, also_sells")
    .eq("id", actor.userId)
    .maybeSingle();
  if (userError) return fail(503, "Account lookup failed", "SERVICE_UNAVAILABLE");
  const active = Boolean(user) && user?.is_active !== false && user?.client_id === clientId;
  if (!canGenerateOwnShare({ ...actor, alsoSells: actor.alsoSells || user?.also_sells === true }, active)) {
    return fail(403, "You cannot create a marketing link", "FORBIDDEN");
  }
  const listing = await loadListing(db, clientId, input.listingId);
  if (!listing) return fail(404, "Listing not found", "NOT_FOUND");
  const gate = listingMarketingGate({
    organisationId: clientId,
    listingOrganisationId: String(listing.client_id),
    approvalStatus: (listing.approval_status as string | null) ?? null,
    status: (listing.status as string | null) ?? null,
    compliancePublication: await listingCompliancePublication(db, clientId, String(listing.id)),
    featureEnabled: settings.enabled,
    organisationActive: clientIsActive(org.client),
  });
  if (!gate.ok || !gate.advertiseAsAvailable) return fail(403, "This listing cannot be marketed", gate.ok ? "NOT_AVAILABLE" : gate.reason.toUpperCase());
  const campaign = normaliseCampaignLabel(input.campaignLabel);
  if (input.campaignLabel && !campaign) return fail(400, "Campaign label must be 1 to 40 characters", "INVALID_CAMPAIGN");
  const slug = await ensureSlug(db, listing);
  if (!slug) return fail(503, "Could not create a public address", "SERVICE_UNAVAILABLE");
  const existingBase = () =>
    db.from("re_agent_listing_shares").select("*").eq("client_id", clientId).eq("listing_id", input.listingId).eq("agent_id", actor.userId);
  const existing = campaign
    ? await existingBase().eq("campaign_label", campaign).maybeSingle()
    : await existingBase().is("campaign_label", null).maybeSingle();
  if (existing.error) return fail(503, "Link lookup failed", "SERVICE_UNAVAILABLE");
  if (existing.data && (existing.data as { status?: string }).status === "active") {
    const agency = settings.publicAgencyName || text(org.client.name) || "the agency";
    return { ok: true, reused: true, share: shareDto(existing.data as Record<string, unknown>, getPublicBaseUrl(), slug), caption: shareCaption(text(listing.suburb), agency) };
  }
  if (campaign) {
    const { count, error: countError } = await db
      .from("re_agent_listing_shares")
      .select("id", { count: "exact", head: true })
      .eq("client_id", clientId)
      .eq("listing_id", input.listingId)
      .eq("agent_id", actor.userId)
      .not("campaign_label", "is", null);
    if (countError) return fail(503, "Link lookup failed", "SERVICE_UNAVAILABLE");
    if ((count ?? 0) >= settings.maxCampaignLinks) return fail(409, "Campaign link limit reached for this property", "CAMPAIGN_LIMIT");
  }
  const token = newShareToken();
  const { data: inserted, error: insertError } = await db
    .from("re_agent_listing_shares")
    .insert({
      client_id: clientId,
      listing_id: input.listingId,
      agent_id: actor.userId,
      token,
      campaign_label: campaign,
      status: "active",
      created_by: actor.userId,
    })
    .select("*")
    .single();
  if (insertError?.code === "23505") {
    const again = campaign
      ? await existingBase().eq("campaign_label", campaign).maybeSingle()
      : await existingBase().is("campaign_label", null).maybeSingle();
    if (again.data) {
      const agency = settings.publicAgencyName || text(org.client.name) || "the agency";
      return { ok: true, reused: true, share: shareDto(again.data as Record<string, unknown>, getPublicBaseUrl(), slug), caption: shareCaption(text(listing.suburb), agency) };
    }
  }
  if (insertError || !inserted) return fail(503, "Could not create the link", "SERVICE_UNAVAILABLE");
  await db.from("re_listing_marketing_events").insert({
    client_id: clientId,
    listing_id: input.listingId,
    share_id: (inserted as { id: string }).id,
    event_type: "share_link_created",
    bot_class: "human",
    campaign_label: campaign,
    idempotency_key: `created:${(inserted as { id: string }).id}`,
  });
  const agency = settings.publicAgencyName || text(org.client.name) || "the agency";
  return { ok: true, reused: false, share: shareDto(inserted as Record<string, unknown>, getPublicBaseUrl(), slug), caption: shareCaption(text(listing.suburb), agency) };
}

export async function revokeShareLink(db: Db, actor: ShareActor, clientId: string, shareId: string, reason: string | null): Promise<Ok<{ status: "revoked" }> | Fail> {
  const { data, error } = await db.from("re_agent_listing_shares").select("*").eq("id", shareId).eq("client_id", clientId).maybeSingle();
  if (error) return fail(503, "Link lookup failed", "SERVICE_UNAVAILABLE");
  if (!data) return fail(404, "Link not found", "NOT_FOUND");
  const row = data as Record<string, unknown>;
  if (!canRevokeShare(actor, { clientId, agentId: String(row.agent_id) })) return fail(403, "Forbidden", "FORBIDDEN");
  if (row.status === "revoked") return { ok: true, status: "revoked" };
  const { error: updateError } = await db
    .from("re_agent_listing_shares")
    .update({ status: "revoked", revoked_at: new Date().toISOString(), revoked_by: actor.userId, revoke_reason: reason?.slice(0, 200) ?? null })
    .eq("id", shareId)
    .eq("client_id", clientId)
    .eq("status", "active");
  if (updateError) return fail(503, "Could not revoke the link", "SERVICE_UNAVAILABLE");
  await db.from("re_listing_marketing_events").insert({
    client_id: clientId,
    listing_id: row.listing_id,
    share_id: shareId,
    event_type: "share_link_revoked",
    bot_class: "human",
    idempotency_key: `revoked:${shareId}:${Date.now()}`,
  });
  return { ok: true, status: "revoked" };
}

export async function getShareLink(db: Db, actor: ShareActor, clientId: string, shareId: string): Promise<Ok<{ share: Record<string, unknown> }> | Fail> {
  const { data, error } = await db
    .from("re_agent_listing_shares")
    .select("id, listing_id, agent_id, token, campaign_label, status, created_at, revoked_at, listings!inner(address, suburb, status, approval_status, public_slug, price, photos)")
    .eq("client_id", clientId)
    .eq("id", shareId)
    .maybeSingle();
  if (error) return fail(503, "Could not load the link", "SERVICE_UNAVAILABLE");
  if (!data) return fail(404, "Link not found", "NOT_FOUND");
  const row = data as Record<string, unknown>;
  if (!canReadShareAnalytics(actor, { clientId, agentId: String(row.agent_id) })) return fail(403, "Forbidden", "FORBIDDEN");
  const listing = (row.listings ?? {}) as Record<string, unknown>;
  const slug = text(listing.public_slug) ?? "property";
  return {
    ok: true,
    share: {
      ...shareDto(row, getPublicBaseUrl(), slug),
      listing: {
        address: text(listing.address),
        suburb: text(listing.suburb),
        status: listing.status ?? null,
        approvalStatus: listing.approval_status ?? null,
        price: listing.price ?? null,
        hasAuthorisedPhoto: listingHasMarketingPhoto(listing.photos, clientId, String(row.listing_id), process.env.CLOUDFLARE_R2_PUBLIC_URL),
      },
    },
  };
}

export async function listShareLinks(
  db: Db,
  actor: ShareActor,
  clientId: string,
  query: { listingId?: string | null; status?: string | null; q?: string | null; page: number; limit: number }
): Promise<Ok<{ shares: Array<Record<string, unknown>>; page: number; limit: number }> | Fail> {
  if (actor.role !== "SUPER_ADMIN" && actor.clientId !== clientId) return fail(403, "Forbidden", "CROSS_TENANT_ACCESS");
  const org = await organisationActive(db, clientId);
  if (!org.ok) return org;
  let request = db
    .from("re_agent_listing_shares")
    .select("id, listing_id, agent_id, token, campaign_label, status, created_at, revoked_at, listings!inner(address, suburb, status, approval_status, public_slug, price, photos)")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false });
  if (!isOrganisationManager(actor.role)) request = request.eq("agent_id", actor.userId);
  if (query.listingId) request = request.eq("listing_id", query.listingId);
  if (query.status === "active" || query.status === "revoked") request = request.eq("status", query.status);
  const from = (query.page - 1) * query.limit;
  const { data, error } = await request.range(from, from + query.limit - 1);
  if (error) return schemaMissing(error) ? fail(503, "Listing page storage is not available yet", "MIGRATION_REQUIRED") : fail(503, "Could not load links", "SERVICE_UNAVAILABLE");
  const needle = query.q?.trim().toLowerCase() ?? "";
  const rows = ((data ?? []) as Array<Record<string, unknown>>).filter((row) => {
    if (!needle) return true;
    const listing = row.listings as { address?: string; suburb?: string } | null;
    return `${listing?.address ?? ""} ${listing?.suburb ?? ""}`.toLowerCase().includes(needle);
  });
  const names = await agentNames(db, clientId, rows.map((row) => String(row.agent_id)));
  const origin = getPublicBaseUrl();
  return {
    ok: true,
    page: query.page,
    limit: query.limit,
    shares: rows.map((row) => {
      const listing = (row.listings ?? {}) as Record<string, unknown>;
      const slug = text(listing.public_slug) ?? "";
      return {
        ...shareDto(row, origin, slug || "property"),
        agentName: names.get(String(row.agent_id)) ?? null,
        listing: {
          address: text(listing.address),
          suburb: text(listing.suburb),
          status: listing.status ?? null,
          approvalStatus: listing.approval_status ?? null,
          price: listing.price ?? null,
          hasAuthorisedPhoto: listingHasMarketingPhoto(listing.photos, clientId, String(row.listing_id), process.env.CLOUDFLARE_R2_PUBLIC_URL),
        },
      };
    }),
  };
}

async function currencyFor(db: Db, clientId: string): Promise<{ currency: string | null; configured: boolean }> {
  const { data } = await db.from("quotation_settings").select("default_currency").eq("client_id", clientId).maybeSingle();
  const code = text((data as { default_currency?: string } | null)?.default_currency)?.toUpperCase() ?? null;
  if (!data || !code || !/^[A-Z]{3}$/.test(code)) return { currency: null, configured: false };
  return { currency: code, configured: true };
}

export async function loadPublicListingPage(db: Db, slug: string, token: string | null, request: { userAgent: string | null; referrer: string | null; visitor: string | null; recordView?: boolean }): Promise<
  | { state: "unavailable"; reason: string; indexable: false }
  | { state: "ready"; indexable: boolean; page: Record<string, unknown> }
> {
  const { data: listing, error } = await db
    .from("listings")
    .select("id, client_id, approval_status, status, address, suburb, price, bedrooms, bathrooms, size_sqm, description, photos, property_category, transaction_type, public_slug")
    .eq("public_slug", slug)
    .maybeSingle();
  if (error || !listing) return { state: "unavailable", reason: "not_found", indexable: false };
  const row = listing as ListingRow;
  const clientId = String(row.client_id);
  const org = await organisationActive(db, clientId);
  if (!org.ok) return { state: "unavailable", reason: "not_found", indexable: false };
  const settingsResult = await getListingPageSettings(db, clientId);
  const settings = settingsResult.ok ? settingsResult.settings : { ...DEFAULT_LISTING_PAGE_SETTINGS, enabled: false };
  const gate = listingMarketingGate({
    organisationId: clientId,
    listingOrganisationId: clientId,
    approvalStatus: (row.approval_status as string | null) ?? null,
    status: (row.status as string | null) ?? null,
    compliancePublication: await listingCompliancePublication(db, clientId, String(row.id)),
    featureEnabled: settings.enabled,
    organisationActive: clientIsActive(org.client),
  });
  if (token) {
    const share = await db.from("re_agent_listing_shares").select("*").eq("token", token).maybeSingle();
    const shareRow = share.data as Record<string, unknown> | null;
    if (!shareRow || shareRow.listing_id !== row.id || shareRow.client_id !== clientId) {
      return { state: "unavailable", reason: "invalid_link", indexable: false };
    }
    const agent = await db.from("users").select("id, name, phone, avatar_url, role, is_active, client_id, also_sells").eq("id", shareRow.agent_id as string).maybeSingle();
    const agentRow = (agent.data ?? {}) as Record<string, unknown>;
    const live = shareAcceptsAttribution({
      shareStatus: String(shareRow.status),
      listingOrganisationId: clientId,
      agent: {
        clientId: text(agentRow.client_id),
        role: text(agentRow.role),
        active: agentRow.is_active !== false,
        archived: agentRow.is_archived === true,
        alsoSells: agentRow.also_sells === true,
      },
    });
    if (!gate.ok || !live) return { state: "unavailable", reason: !gate.ok ? gate.reason : "link_inactive", indexable: false };
    if (request.recordView !== false) await recordView(db, row, shareRow, request);
    return { state: "ready", indexable: gate.advertiseAsAvailable, page: await composePage(db, org.client, settings, row, shareRow, agentRow, gate, token) };
  }
  if (!gate.ok) return { state: "unavailable", reason: gate.reason, indexable: false };
  if (request.recordView !== false) await recordView(db, row, null, request);
  return { state: "ready", indexable: gate.advertiseAsAvailable, page: await composePage(db, org.client, settings, row, null, null, gate, null) };
}

async function recordView(db: Db, listing: ListingRow, share: Record<string, unknown> | null, request: { userAgent: string | null; referrer: string | null; visitor: string | null }) {
  const bot = classifyUserAgent(request.userAgent);
  const label = bot === "human" ? visitorLabel(request.visitor, process.env.NEXTAUTH_SECRET) : null;
  await db.from("re_listing_marketing_events").insert({
    client_id: listing.client_id,
    listing_id: listing.id,
    share_id: share?.id ?? null,
    event_type: "page_view",
    bot_class: bot,
    visitor_label: label,
    source_hint: sourceHintFromReferrer(request.referrer),
    campaign_label: share?.campaign_label ?? null,
  });
}

async function composePage(
  db: Db,
  client: Record<string, unknown>,
  settings: AgencyListingPageSettings,
  listing: ListingRow,
  share: Record<string, unknown> | null,
  agent: Record<string, unknown> | null,
  gate: { advertiseAsAvailable: boolean; publicStatus: string },
  token: string | null
) {
  const money = await currencyFor(db, String(listing.client_id));
  const slug = String(listing.public_slug);
  const photoSources = publicListingPhotoSources(
    listing.photos,
    String(listing.client_id),
    String(listing.id),
    slug,
    token,
    process.env.CLOUDFLARE_R2_PUBLIC_URL
  );
  const property = projectPublicProperty({
    address: text(listing.address),
    suburb: text(listing.suburb),
    price: listing.price == null ? null : Number(listing.price),
    currency: money.currency,
    currencyConfigured: money.configured,
    transactionType: text(listing.transaction_type),
    propertyCategory: text(listing.property_category),
    bedrooms: listing.bedrooms == null ? null : Number(listing.bedrooms),
    bathrooms: listing.bathrooms == null ? null : Number(listing.bathrooms),
    sizeSqm: listing.size_sqm == null ? null : Number(listing.size_sqm),
    description: text(listing.description),
    status: gate.publicStatus,
    photoCount: photoSources.length,
  });
  const agencyName = settings.publicAgencyName || text(client.name) || "Agency";
  const website = safeAgencyHttpUrl(settings.verifiedWebsite, settings.verifiedWebsite);
  const catalogue = safeAgencyHttpUrl(settings.verifiedWebsite, settings.catalogueUrl);
  const prefill = whatsAppPrefill(property.suburb, slug);
  let whatsapp: string | null = null;
  if (settings.publicContactPolicy === "agency_whatsapp") {
    whatsapp = whatsAppLink(normalizePhoneForWhatsApp(text(client.meta_whatsapp_display_number), text(client.dial_code) ?? "263"), prefill);
  } else if (settings.publicContactPolicy === "agent_whatsapp_if_allowed" && settings.showAgentPhone && agent) {
    whatsapp = whatsAppLink(normalizePhoneForWhatsApp(text(agent.phone), text(client.dial_code) ?? "263"), prefill);
  }
  const accent = typeof client.primary_color === "string" && /^#[0-9a-fA-F]{6}$/.test(client.primary_color) ? client.primary_color : null;
  const related = await relatedListings(db, String(listing.client_id), String(listing.id), money);
  return {
    slug,
    canonicalPath: `/property/${slug}`,
    property,
    agency: {
      name: agencyName,
      logoUrl: typeof client.logo_url === "string" && client.logo_url.startsWith("https://") ? client.logo_url : null,
      websiteUrl: website,
      catalogueUrl: catalogue,
      accent,
    },
    agent: agent && settings.showAgentName
      ? {
          name: text(agent.name) || "Agent",
          role: agent.role === "CLIENT_MANAGER" ? "Manager" : "Agent",
          initials: initials(text(agent.name)),
          photoUrl: settings.showAgentPhoto && typeof agent.avatar_url === "string" && agent.avatar_url.startsWith("https://") ? agent.avatar_url : null,
        }
      : null,
    actions: {
      enquire: acceptsNewEnquiry({ ok: true, advertiseAsAvailable: gate.advertiseAsAvailable, publicStatus: gate.publicStatus }),
      viewing: acceptsNewEnquiry({ ok: true, advertiseAsAvailable: gate.advertiseAsAvailable, publicStatus: gate.publicStatus }),
      whatsapp,
    },
    photos: photoSources.map((src, index) => ({ index, src })),
    related,
    token: token ? true : false,
  };
}

async function relatedListings(db: Db, clientId: string, listingId: string, money: { currency: string | null; configured: boolean }) {
  const { data } = await db
    .from("listings")
    .select("id, client_id, address, suburb, price, bedrooms, bathrooms, status, approval_status, public_slug, photos")
    .eq("client_id", clientId)
    .eq("approval_status", "approved")
    .eq("status", "available")
    .neq("id", listingId)
    .limit(4);
  return ((data ?? []) as Array<Record<string, unknown>>).map((row) => {
    const slug = text(row.public_slug);
    const photos = slug
      ? publicListingPhotoSources(row.photos, clientId, String(row.id), slug, null, process.env.CLOUDFLARE_R2_PUBLIC_URL)
      : [];
    const amount = row.price == null || !Number.isFinite(Number(row.price)) ? null : Number(row.price);
    const priceLabel = money.configured && money.currency && amount != null
      ? `${money.currency} ${amount.toLocaleString("en-US", { maximumFractionDigits: 0 })}`
      : null;
    return {
      heading: text(row.address) || text(row.suburb) || "Property",
      suburb: text(row.suburb),
      bedrooms: row.bedrooms == null ? null : Number(row.bedrooms),
      bathrooms: row.bathrooms == null ? null : Number(row.bathrooms),
      priceLabel,
      photoSrc: photos[0] ?? null,
      href: slug ? `/property/${slug}` : null,
    };
  });
}

export async function recordPublicSignal(
  db: Db,
  input: { slug: string; token: string | null; eventType: "engaged_view" | "whatsapp_click"; userAgent: string | null; visitor: string | null }
): Promise<{ ok: true } | Fail> {
  const loaded = await resolvePublicTarget(db, input.slug, input.token, false);
  if (!loaded.ok) return loaded;
  const bot = classifyUserAgent(input.userAgent);
  await db.from("re_listing_marketing_events").insert({
    client_id: loaded.clientId,
    listing_id: loaded.listingId,
    share_id: loaded.shareId,
    event_type: input.eventType,
    bot_class: bot,
    visitor_label: bot === "human" ? visitorLabel(input.visitor, process.env.NEXTAUTH_SECRET) : null,
    campaign_label: loaded.campaignLabel,
  });
  return { ok: true };
}

async function resolvePublicTarget(db: Db, slug: string, token: string | null, requireEnquiry = true): Promise<Ok<{ clientId: string; listingId: string; shareId: string | null; campaignLabel: string | null; dialCode: string; listing: ListingRow; share: Record<string, unknown> | null; settings: AgencyListingPageSettings; client: Record<string, unknown> }> | Fail> {
  const { data: listing } = await db.from("listings").select("id, client_id, approval_status, status, address, suburb, transaction_type, public_slug, description, price, bedrooms, bathrooms, size_sqm, photos, property_category").eq("public_slug", slug).maybeSingle();
  if (!listing) return fail(404, "This page is unavailable", "UNAVAILABLE");
  const row = listing as ListingRow;
  const org = await organisationActive(db, String(row.client_id));
  if (!org.ok) return fail(404, "This page is unavailable", "UNAVAILABLE");
  const settingsResult = await getListingPageSettings(db, String(row.client_id));
  const settings = settingsResult.ok ? settingsResult.settings : { ...DEFAULT_LISTING_PAGE_SETTINGS, enabled: false };
  const gate = listingMarketingGate({
    organisationId: String(row.client_id),
    listingOrganisationId: String(row.client_id),
    approvalStatus: (row.approval_status as string | null) ?? null,
    status: (row.status as string | null) ?? null,
    compliancePublication: await listingCompliancePublication(db, String(row.client_id), String(row.id)),
    featureEnabled: settings.enabled,
    organisationActive: clientIsActive(org.client),
  });
  if (!gate.ok) return fail(404, "This page is unavailable", "UNAVAILABLE");
  if (requireEnquiry && !acceptsNewEnquiry(gate)) return fail(409, "This property is not accepting new enquiries", "NOT_ACCEPTING");
  let share: Record<string, unknown> | null = null;
  if (token) {
    const found = await db.from("re_agent_listing_shares").select("*").eq("token", token).maybeSingle();
    share = (found.data as Record<string, unknown> | null) ?? null;
    if (!share || share.listing_id !== row.id) return fail(404, "This page is unavailable", "UNAVAILABLE");
    const agent = await db.from("users").select("id, client_id, role, is_active, also_sells").eq("id", share.agent_id as string).maybeSingle();
    const agentRow = (agent.data ?? {}) as Record<string, unknown>;
    const live = shareAcceptsAttribution({
      shareStatus: String(share.status),
      listingOrganisationId: String(row.client_id),
      agent: {
        clientId: text(agentRow.client_id),
        role: text(agentRow.role),
        active: agentRow.is_active !== false,
        archived: agentRow.is_archived === true,
        alsoSells: agentRow.also_sells === true,
      },
    });
    if (!live) return fail(409, "This link is no longer accepting enquiries", "LINK_INACTIVE");
  }
  return {
    ok: true,
    clientId: String(row.client_id),
    listingId: String(row.id),
    shareId: share ? String(share.id) : null,
    campaignLabel: text(share?.campaign_label),
    dialCode: text(org.client.dial_code) ?? "263",
    listing: row,
    share,
    settings,
    client: org.client,
  };
}

export async function submitPublicForm(
  db: Db,
  input: {
    slug: string;
    token: string | null;
    kind: "enquiry" | "viewing_request";
    name: string;
    phone: string;
    message: string | null;
    preferredAt: string | null;
    contactMethod: string | null;
    idempotencyKey: string | null;
    ipKey: string;
    retrying?: boolean;
  }
): Promise<Ok<{ agencyName: string; duplicate: boolean }> | Fail> {
  const limited = await checkDbRateLimit({ key: `listing-page:${input.kind}:${input.ipKey}`, limit: 8, windowMs: 60 * 60 * 1000 });
  if (!limited.ok) return fail(429, "Too many requests. Please wait and try again.", "RATE_LIMITED");
  const target = await resolvePublicTarget(db, input.slug, input.token);
  if (!target.ok) return target;
  const digits = normalizePhoneForWhatsApp(input.phone, target.dialCode);
  if (!digits) return fail(400, "Enter a valid phone number", "INVALID_PHONE");
  const name = input.name.replace(/\s+/g, " ").trim();
  if (name.length < 2 || name.length > 120) return fail(400, "Enter your name", "INVALID_NAME");
  const message = input.message?.trim().slice(0, 2000) ?? "";
  let preferred: string | null = null;
  if (input.kind === "viewing_request") {
    if (!input.preferredAt) return fail(400, "Choose a preferred time", "INVALID_TIME");
    const parsed = viewingInstant(input.preferredAt);
    if (!parsed.ok) return fail(400, parsed.error, "INVALID_TIME");
    preferred = parsed.at;
  }
  const hash = phoneHash(digits);
  const idempotency = (input.idempotencyKey && /^[A-Za-z0-9_.:-]{8,200}$/.test(input.idempotencyKey)
    ? input.idempotencyKey
    : `auto:${input.kind}:${hash}:${target.shareId ?? target.listingId}`
  ).slice(0, 200);
  const inserted = await db
    .from("re_listing_public_submissions")
    .insert({
      client_id: target.clientId,
      share_id: target.shareId,
      listing_id: target.listingId,
      kind: input.kind,
      idempotency_key: idempotency,
      phone_hash: hash,
      status: "pending",
    })
    .select("id")
    .single();
  if (inserted.error?.code === "23505") {
    const prior = await db
      .from("re_listing_public_submissions")
      .select("id, lead_id, status, created_at")
      .eq("client_id", target.clientId)
      .eq("kind", input.kind)
      .eq("phone_hash", hash)
      .maybeSingle();
    const row = prior.data as { lead_id?: string | null; status?: string; created_at?: string } | null;
    if (!row) return fail(409, "Please try that again", "RETRY");
    const age = Date.now() - Date.parse(row.created_at ?? "");
    const replay = submissionReplay({ leadId: row.lead_id ?? null, status: row.status ?? "pending", ageMs: Number.isFinite(age) ? age : 0 });
    if (replay === "replay") {
      return { ok: true, duplicate: true, agencyName: target.settings.publicAgencyName || text(target.client.name) || "the agency" };
    }
    if (replay === "retry") return fail(409, "Please try that again", "RETRY");
    if (input.retrying) return fail(409, "Please try that again", "RETRY");
    await db.from("re_listing_public_submissions").delete().eq("client_id", target.clientId).eq("kind", input.kind).eq("phone_hash", hash).is("lead_id", null);
    return submitPublicForm(db, { ...input, retrying: true });
  }
  if (inserted.error || !inserted.data) return fail(503, "Could not save the enquiry", "SERVICE_UNAVAILABLE");
  const submissionId = (inserted.data as { id: string }).id;
  try {
    const open = await findOpenLeadByPhone({ supabase: db, clientId: target.clientId, phoneDigits: digits });
    const agentEligible = target.share
      ? shareAcceptsAttribution({
          shareStatus: "active",
          listingOrganisationId: target.clientId,
          agent: await agentMembership(db, String(target.share.agent_id)),
        })
      : false;
    const assignment = enquiryAssigneeOverride({
      routing: target.settings.enquiryRouting,
      openLeadOwnerId: open?.assigned_to_id ?? null,
      marketingAgentEligible: agentEligible,
      marketingAgentId: target.share ? String(target.share.agent_id) : "",
    });
    const leadInput = {
      clientId: target.clientId,
      source: "WEBSITE" as const,
      formData: {
        name,
        phone: `+${digits}`,
        message,
        intake: "agent_listing_page",
        kind: input.kind,
        listing_suburb: text(target.listing.suburb),
        preferred_at: preferred,
        preferred_contact: input.contactMethod,
        campaign_label: target.campaignLabel,
        project_type: input.kind === "viewing_request" ? "Viewing request" : "Property enquiry",
      },
      followUpDate: preferred,
      hubSource: input.kind === "viewing_request" ? "Viewing request" : "Property enquiry",
    };
    let created = await createLead({ ...leadInput, overrideAssigneeId: assignment.overrideAssigneeId });
    if (!created.ok && created.code === "UNKNOWN" && assignment.overrideAssigneeId) {
      created = await createLead(leadInput);
    }
    if (!created.ok) {
      await db.from("re_listing_public_submissions").delete().eq("id", submissionId);
      return fail(503, "Could not save the enquiry", "SERVICE_UNAVAILABLE");
    }
    const { data: lead } = await db.from("leads").select("id, assigned_to_id, linked_listing_id, deal_side, contact_id").eq("id", created.leadId).maybeSingle();
    const leadRow = (lead ?? {}) as Record<string, unknown>;
    const patch: Record<string, unknown> = { project_type: input.kind === "viewing_request" ? "Viewing request" : "Property enquiry" };
    if (!leadRow.linked_listing_id) patch.linked_listing_id = target.listingId;
    if (!leadRow.deal_side) {
      const side = dealSideForListing(text(target.listing.transaction_type));
      if (side) patch.deal_side = side;
    }
    if (preferred && !created.duplicate) patch.follow_up_date = preferred;
    await db.from("leads").update(patch).eq("id", created.leadId).eq("client_id", target.clientId);
    if (leadRow.contact_id) {
      const contact = await db.from("contacts").select("interested_listing_ids").eq("id", leadRow.contact_id as string).maybeSingle();
      const next = appendInterestedListingIds((contact.data as { interested_listing_ids?: unknown } | null)?.interested_listing_ids, target.listingId);
      await db.from("contacts").update({ interested_listing_ids: next }).eq("id", leadRow.contact_id as string);
    }
    if (target.shareId) {
      await db.from("re_listing_lead_attributions").insert({
        client_id: target.clientId,
        lead_id: created.leadId,
        share_id: target.shareId,
        listing_id: target.listingId,
        marketing_agent_id: target.share?.agent_id ?? null,
        operational_owner_id: (leadRow.assigned_to_id as string | null) ?? assignment.preservedOwnerId,
        kind: input.kind,
      });
      await db.from("marketing_attributions").insert({
        client_id: target.clientId,
        lead_id: created.leadId,
        contact_id: (leadRow.contact_id as string | null) ?? null,
        source_type: "website",
        listing_id: target.listingId,
        campaign_name: target.campaignLabel,
        landing_page: `/property/${input.slug}`,
        provider: "agent_listing_page",
        external_lead_id: submissionId,
        raw_metadata: { shareId: target.shareId, kind: input.kind },
      });
    }
    await db.from("re_listing_marketing_events").insert({
      client_id: target.clientId,
      listing_id: target.listingId,
      share_id: target.shareId,
      event_type: input.kind === "viewing_request" ? "viewing_request" : "enquiry_submit",
      bot_class: "human",
      lead_id: created.leadId,
      campaign_label: target.campaignLabel,
      idempotency_key: `form:${submissionId}`,
    });
    await logLeadEvent({
      leadId: created.leadId,
      clientId: target.clientId,
      actor: { id: null, name: "Property page", role: "public" },
      eventType: input.kind === "viewing_request" ? "NOTE_ADDED" : "RE_ENQUIRY",
      eventData: {
        kind: input.kind,
        suburb: text(target.listing.suburb),
        preferredAt: preferred,
        confirmedViewing: false,
      },
      dedupeKey: `listing-page:${submissionId}`,
    });
    await db.from("re_listing_public_submissions").update({ status: "accepted", lead_id: created.leadId }).eq("id", submissionId);
    return { ok: true, duplicate: created.duplicate, agencyName: target.settings.publicAgencyName || text(target.client.name) || "the agency" };
  } catch {
    await db.from("re_listing_public_submissions").delete().eq("id", submissionId).is("lead_id", null);
    return fail(503, "Could not save the enquiry", "SERVICE_UNAVAILABLE");
  }
}

async function agentMembership(db: Db, userId: string) {
  const { data } = await db.from("users").select("client_id, role, is_active, also_sells").eq("id", userId).maybeSingle();
  const row = (data ?? {}) as Record<string, unknown>;
  return {
    clientId: text(row.client_id),
    role: text(row.role),
    active: row.is_active !== false,
    archived: row.is_archived === true,
    alsoSells: row.also_sells === true,
  };
}

export async function shareAnalytics(
  db: Db,
  actor: ShareActor,
  clientId: string,
  shareId: string,
  range: { from: Date; to: Date }
): Promise<Ok<{ totals: ReturnType<typeof totalsFromCounts>; series: ReturnType<typeof visitSeries>; insights: string[]; outcomeNote: string | null; sources: Array<{ source: string; label: string; visits: number }>; link: { address: string | null; suburb: string | null; listingId: string; campaignLabel: string | null; status: string; publicUrl: string | null } }> | Fail> {
  const { data: share, error } = await db.from("re_agent_listing_shares").select("id, client_id, agent_id, listing_id, token, campaign_label, status, listings(address, suburb, public_slug)").eq("id", shareId).eq("client_id", clientId).maybeSingle();
  if (error) return fail(503, "Analytics lookup failed", "SERVICE_UNAVAILABLE");
  if (!share) return fail(404, "Link not found", "NOT_FOUND");
  if (!canReadShareAnalytics(actor, { clientId, agentId: String((share as { agent_id: string }).agent_id) })) return fail(403, "Forbidden", "FORBIDDEN");
  const counts = await countRange(db, clientId, range, { shareId });
  const unique = await uniqueVisitors(db, range, { shareId });
  const totals = totalsFromCounts(counts.events, unique);
  const sources = await sourceCounts(db, range, { shareId });
  const { data: won } = await db
    .from("re_listing_lead_attributions")
    .select("lead_id, marketing_agent_id, operational_owner_id, leads!inner(status, linked_listing_id)")
    .eq("share_id", shareId)
    .limit(200);
  let outcomeNote: string | null = null;
  for (const row of (won ?? []) as Array<Record<string, unknown>>) {
    const lead = row.leads as { status?: string; linked_listing_id?: string } | null;
    const txn = lead?.status === "WON"
      ? await db.from("real_estate_transactions").select("id").eq("lead_id", row.lead_id as string).eq("listing_id", (share as { listing_id: string }).listing_id).limit(1).maybeSingle()
      : null;
    const note = dealOutcomeNote({
      leadWon: lead?.status === "WON",
      transactionLinked: Boolean(txn?.data),
      marketingAgentId: text(row.marketing_agent_id),
      operationalOwnerId: text(row.operational_owner_id),
    });
    if (note) {
      outcomeNote = note;
      break;
    }
  }
  const row = share as Record<string, unknown>;
  const listingRaw = row.listings;
  const listing = (Array.isArray(listingRaw) ? listingRaw[0] : listingRaw ?? null) as Record<string, unknown> | null;
  const slug = text(listing?.public_slug);
  const token = text(row.token);
  return {
    ok: true,
    totals,
    series: visitSeries(counts.series),
    insights: factualInsights(totals, sources),
    outcomeNote,
    sources: Object.entries(sources)
      .filter(([, count]) => count > 0)
      .sort((a, b) => b[1] - a[1])
      .map(([source, visits]) => ({ source, label: sourceLabel(source), visits })),
    link: {
      address: text(listing?.address),
      suburb: text(listing?.suburb),
      listingId: String(row.listing_id),
      campaignLabel: text(row.campaign_label),
      status: String(row.status ?? ""),
      publicUrl: slug && token ? absoluteListingUrl(getPublicBaseUrl(), slug, token) : null,
    },
  };
}

async function countRange(db: Db, clientId: string, range: { from: Date; to: Date }, scope: { shareId?: string; shareIds?: string[]; agentId?: string }) {
  if (scope.shareIds && scope.shareIds.length === 0) return { events: [] as CountedEvent[], series: [] as Array<{ day: string; eventType: string; botClass: string; count: number; shareId: string }> };
  let request = db
    .from("re_listing_marketing_daily")
    .select("day, event_type, bot_class, event_count, share_id")
    .eq("client_id", clientId)
    .gte("day", range.from.toISOString().slice(0, 10))
    .lte("day", range.to.toISOString().slice(0, 10));
  if (scope.shareId) request = request.eq("share_id", scope.shareId);
  if (scope.shareIds) request = request.in("share_id", scope.shareIds);
  const { data } = await request.limit(5000);
  const rows = (data ?? []) as Array<Record<string, unknown>>;
  const events: CountedEvent[] = rows.map((row) => ({
    eventType: String(row.event_type),
    botClass: String(row.bot_class),
    count: Number(row.event_count ?? 0),
  }));
  const series = rows.map((row) => ({
    day: String(row.day),
    eventType: String(row.event_type),
    botClass: String(row.bot_class),
    count: Number(row.event_count ?? 0),
    shareId: String(row.share_id ?? ""),
  }));
  return { events, series };
}

async function uniqueVisitors(db: Db, range: { from: Date; to: Date }, scope: { shareId: string }): Promise<number | null> {
  const { data } = await db
    .from("re_listing_marketing_events")
    .select("visitor_label")
    .eq("share_id", scope.shareId)
    .eq("event_type", "page_view")
    .eq("bot_class", "human")
    .gte("occurred_at", range.from.toISOString())
    .lt("occurred_at", range.to.toISOString())
    .limit(5000);
  const labels = ((data ?? []) as Array<{ visitor_label?: string | null }>).map((row) => row.visitor_label).filter((value): value is string => Boolean(value));
  if (labels.length >= 5000) return null;
  return new Set(labels).size;
}

async function sourceCounts(db: Db, range: { from: Date; to: Date }, scope: { shareId: string }): Promise<Record<string, number>> {
  const { data } = await db
    .from("re_listing_marketing_events")
    .select("source_hint")
    .eq("share_id", scope.shareId)
    .eq("event_type", "page_view")
    .eq("bot_class", "human")
    .gte("occurred_at", range.from.toISOString())
    .lt("occurred_at", range.to.toISOString())
    .limit(5000);
  const counts: Record<string, number> = {};
  for (const row of (data ?? []) as Array<{ source_hint?: string | null }>) {
    const key = row.source_hint || "direct";
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

export async function marketingSummary(db: Db, actor: ShareActor, clientId: string, range: { from: Date; to: Date }) {
  if (actor.role !== "SUPER_ADMIN" && actor.clientId !== clientId) return fail(403, "Forbidden", "CROSS_TENANT_ACCESS");
  const org = await organisationActive(db, clientId);
  if (!org.ok) return org;
  const manager = isOrganisationManager(actor.role);
  let shareQuery = db.from("re_agent_listing_shares").select("id, listing_id, agent_id, status, campaign_label").eq("client_id", clientId);
  if (!manager) shareQuery = shareQuery.eq("agent_id", actor.userId);
  const { data: shares, error } = await shareQuery.limit(1000);
  if (error) return fail(503, "Could not load marketing summary", "SERVICE_UNAVAILABLE");
  const rows = (shares ?? []) as Array<Record<string, unknown>>;
  const shareIds = rows.map((row) => String(row.id));
  const counted = await countRange(db, clientId, range, manager ? {} : { shareIds });
  const totals = totalsFromCounts(counted.events, null);
  const byShare = shareIds.map((shareId) => {
    const mine = counted.series.filter((row) => row.shareId === shareId);
    const shareTotals = totalsFromCounts(mine, null);
    return {
      shareId,
      visits: shareTotals.visits,
      enquiries: shareTotals.enquiries,
      viewingRequests: shareTotals.viewingRequests,
      whatsappClicks: shareTotals.whatsappClicks,
      series: visitSeries(mine),
    };
  });
  const activeLinks = rows.filter((row) => row.status === "active").length;
  const listings = new Set(rows.filter((row) => row.status === "active").map((row) => String(row.listing_id))).size;
  const names = manager ? await agentNames(db, clientId, rows.map((row) => String(row.agent_id))) : new Map<string, string>();
  return {
    ok: true as const,
    totals,
    series: visitSeries(counted.series),
    byShare,
    unlinked: manager ? [] : await unlinkedListings(db, clientId, actor.userId, rows),
    activeLinks,
    listingsMarketed: listings,
    insights: factualInsights(totals, {}),
    byAgent: manager ? groupAgents(rows, names) : [],
  };
}

async function unlinkedListings(db: Db, clientId: string, userId: string, shares: Array<Record<string, unknown>>) {
  const linked = new Set(shares.filter((row) => row.status === "active").map((row) => String(row.listing_id)));
  const { data, error } = await db
    .from("listings")
    .select("id, address, suburb, approval_status")
    .eq("client_id", clientId)
    .eq("agent_id", userId)
    .eq("status", "available")
    .limit(40);
  if (error) return [] as Array<{ id: string; address: string | null; suburb: string | null }>;
  return ((data ?? []) as Array<Record<string, unknown>>)
    .filter((row) => {
      const approval = row.approval_status;
      return (approval == null || approval === "approved") && !linked.has(String(row.id));
    })
    .map((row) => ({ id: String(row.id), address: text(row.address), suburb: text(row.suburb) }));
}

async function agentNames(db: Db, clientId: string, ids: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(ids.filter(Boolean))];
  if (!unique.length) return new Map();
  const { data } = await db.from("users").select("id, name").eq("client_id", clientId).in("id", unique);
  const names = new Map<string, string>();
  for (const row of (data ?? []) as Array<{ id: string; name?: string | null }>) {
    if (row.name?.trim()) names.set(row.id, row.name.trim());
  }
  return names;
}

/** The agent's own last 30 days, for the Today desk. Null when marketing storage is unavailable. */
export async function loadMarketingDesk(db: Db, clientId: string, userId: string): Promise<MarketingDesk | null> {
  const range = rangeForPreset("30d", new Date(), "UTC");
  if (!range) return null;
  const { data: shares, error } = await db
    .from("re_agent_listing_shares")
    .select("id, listing_id, status, listings!inner(address, suburb)")
    .eq("client_id", clientId)
    .eq("agent_id", userId)
    .limit(200);
  if (error) return null;
  const shareRows = (shares ?? []) as Array<Record<string, unknown>>;
  const shareIds = shareRows.map((row) => String(row.id));
  let counts: DeskCount[] = [];
  if (shareIds.length) {
    const fromDay = range.from.toISOString().slice(0, 10);
    const toDay = range.to.toISOString().slice(0, 10);
    const { data, error: countError } = await db
      .from("re_listing_marketing_daily")
      .select("share_id, event_type, bot_class, event_count")
      .eq("client_id", clientId)
      .in("share_id", shareIds)
      .gte("day", fromDay)
      .lte("day", toDay)
      .limit(5000);
    if (countError) return null;
    counts = ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
      shareId: String(row.share_id),
      eventType: String(row.event_type),
      botClass: String(row.bot_class),
      count: Number(row.event_count ?? 0),
    }));
  }
  const { data: listings, error: listingError } = await db
    .from("listings")
    .select("id, address, suburb, approval_status")
    .eq("client_id", clientId)
    .eq("agent_id", userId)
    .eq("status", "available")
    .limit(40);
  if (listingError) return null;
  const marketable = ((listings ?? []) as Array<Record<string, unknown>>).filter((row) => {
    const approval = row.approval_status;
    return approval == null || approval === "approved";
  });
  return buildMarketingDesk({
    shares: shareRows.map((row) => {
      const listing = (row.listings ?? {}) as Record<string, unknown>;
      return {
        id: String(row.id),
        listingId: String(row.listing_id),
        status: String(row.status),
        address: text(listing.address),
        suburb: text(listing.suburb),
      };
    }),
    counts,
    listings: marketable.map((row) => ({
      id: String(row.id),
      address: text(row.address),
      suburb: text(row.suburb),
    })),
  });
}

function groupAgents(rows: Array<Record<string, unknown>>, names: Map<string, string>) {
  const map = new Map<string, { agentId: string; agentName: string | null; links: number }>();
  for (const row of rows) {
    const id = String(row.agent_id);
    const current = map.get(id) ?? { agentId: id, agentName: names.get(id) ?? null, links: 0 };
    if (row.status === "active") current.links += 1;
    map.set(id, current);
  }
  return [...map.values()];
}

export async function attributedLeads(db: Db, actor: ShareActor, clientId: string, shareId: string | null) {
  if (actor.role !== "SUPER_ADMIN" && actor.clientId !== clientId) return fail(403, "Forbidden", "CROSS_TENANT_ACCESS");
  let request = db
    .from("re_listing_lead_attributions")
    .select("id, lead_id, share_id, listing_id, marketing_agent_id, operational_owner_id, kind, created_at")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false })
    .limit(100);
  if (!isOrganisationManager(actor.role)) request = request.eq("marketing_agent_id", actor.userId);
  if (shareId) {
    const share = await db.from("re_agent_listing_shares").select("agent_id").eq("id", shareId).eq("client_id", clientId).maybeSingle();
    if (!share.data) return fail(404, "Link not found", "NOT_FOUND");
    if (!canReadShareAnalytics(actor, { clientId, agentId: String((share.data as { agent_id: string }).agent_id) })) return fail(403, "Forbidden", "FORBIDDEN");
    request = request.eq("share_id", shareId);
  }
  const { data, error } = await request;
  if (error) return fail(503, "Could not load attributed leads", "SERVICE_UNAVAILABLE");
  return { ok: true as const, leads: data ?? [] };
}

