import type { SupabaseClient } from "@supabase/supabase-js";
import { getPublicBaseUrl } from "@/lib/constants";
import { ensureSlug, generateShareLink, loadPublicListingPage } from "@/lib/real-estate/agent-listing-pages/service";
import { canGenerateOwnShare, initials, rangeForPreset, type ShareActor } from "@/lib/real-estate/agent-listing-pages/policy";
import { totalsFromCounts } from "@/lib/real-estate/agent-listing-pages/analytics";
import {
  channelSegment,
  displayPhone,
  FUNNEL_HTML_MAX_BYTES,
  FUNNEL_LINE_MAX,
  FUNNEL_STATUSES,
  funnelPath,
  handleProblem,
  normaliseHandle,
  renderFunnelDocument,
  whatsappDigits,
  type FunnelContext,
  type FunnelStatus,
} from "@/lib/real-estate/funnels/policy";

type Db = SupabaseClient;
type Fail = { ok: false; status: number; error: string; code: string };

function fail(status: number, error: string, code: string): Fail {
  return { ok: false, status, error, code };
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function one<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

export type FunnelRow = {
  id: string;
  clientId: string;
  listingId: string;
  status: FunnelStatus;
  html: string | null;
  htmlVersion: number;
  shareTitle: string | null;
  shareSummary: string | null;
  shareImageUrl: string | null;
  priceLabel: string | null;
  brief: string | null;
  publishedAt: string | null;
  updatedAt: string;
};

function mapFunnel(row: Record<string, unknown>): FunnelRow {
  const status = String(row.status);
  return {
    id: String(row.id),
    clientId: String(row.client_id),
    listingId: String(row.listing_id),
    status: (FUNNEL_STATUSES as readonly string[]).includes(status) ? (status as FunnelStatus) : "building",
    html: typeof row.html === "string" ? row.html : null,
    htmlVersion: Number(row.html_version ?? 0),
    shareTitle: text(row.share_title),
    shareSummary: text(row.share_summary),
    shareImageUrl: text(row.share_image_url),
    priceLabel: text(row.price_label),
    brief: text(row.brief),
    publishedAt: text(row.published_at),
    updatedAt: String(row.updated_at ?? ""),
  };
}

export function absoluteAsset(url: string | null): string | null {
  if (!url) return null;
  if (url.startsWith("https://")) return url;
  if (url.startsWith("/")) return `${getPublicBaseUrl().replace(/\/$/, "")}${url}`;
  return null;
}

/* ------------------------------------------------------------------ */
/* Public                                                               */
/* ------------------------------------------------------------------ */

const FUNNEL_COLUMNS = "id, client_id, listing_id, status, html, html_version, share_title, share_summary, share_image_url, price_label, brief, published_at, updated_at";
const FUNNEL_META_COLUMNS = "id, client_id, listing_id, status, html_version, share_title, share_summary, share_image_url, price_label, brief, published_at, updated_at";

/** The live funnel for a public slug, without its HTML. */
export async function liveFunnelMeta(db: Db, slug: string): Promise<FunnelRow | null> {
  const { data: listing } = await db.from("listings").select("id").eq("public_slug", slug).maybeSingle();
  if (!listing) return null;
  const { data } = await db
    .from("re_listing_funnels")
    .select(FUNNEL_META_COLUMNS)
    .eq("listing_id", (listing as { id: string }).id)
    .eq("status", "live")
    .maybeSingle();
  return data ? mapFunnel(data as Record<string, unknown>) : null;
}

/**
 * /property/{slug}/{handle}[/{channel}] resolves to the agent's own share token.
 * The default share is created on first use; channel shares must already exist.
 */
export async function resolveAgentLink(db: Db, slug: string, handle: string, channel: string | null): Promise<{ ok: true; token: string } | Fail> {
  const { data: listing } = await db.from("listings").select("id, client_id").eq("public_slug", slug).maybeSingle();
  if (!listing) return fail(404, "Not found", "NOT_FOUND");
  const clientId = String((listing as { client_id: string }).client_id);
  const listingId = String((listing as { id: string }).id);
  const { data: profile } = await db
    .from("re_agent_funnel_profiles")
    .select("user_id")
    .eq("client_id", clientId)
    .eq("handle", normaliseHandle(handle))
    .maybeSingle();
  if (!profile) return fail(404, "Not found", "UNKNOWN_HANDLE");
  const agentId = String((profile as { user_id: string }).user_id);
  const { data: shares } = await db
    .from("re_agent_listing_shares")
    .select("token, campaign_label, status")
    .eq("client_id", clientId)
    .eq("listing_id", listingId)
    .eq("agent_id", agentId)
    .eq("status", "active")
    .limit(40);
  const rows = (shares ?? []) as Array<{ token: string; campaign_label: string | null }>;
  if (channel) {
    const wanted = channelSegment(channel);
    const match = rows.find((row) => row.campaign_label && channelSegment(row.campaign_label) === wanted);
    if (match) return { ok: true, token: match.token };
  }
  const existing = rows.find((row) => !row.campaign_label);
  if (existing) return { ok: true, token: existing.token };
  const { data: user } = await db.from("users").select("id, role, client_id, is_active, also_sells").eq("id", agentId).maybeSingle();
  const agent = user as { role?: string; client_id?: string; is_active?: boolean; also_sells?: boolean } | null;
  if (!agent || agent.client_id !== clientId || agent.is_active === false) return fail(404, "Not found", "AGENT_INACTIVE");
  const created = await generateShareLink(
    db,
    { userId: agentId, role: String(agent.role ?? ""), clientId, alsoSells: agent.also_sells === true },
    clientId,
    { listingId }
  );
  if (!created.ok) return fail(created.status, created.error, created.code);
  const { data: fresh } = await db.from("re_agent_listing_shares").select("token").eq("id", String(created.share.id)).maybeSingle();
  const token = text((fresh as { token?: string } | null)?.token);
  return token ? { ok: true, token } : fail(503, "Link unavailable", "SERVICE_UNAVAILABLE");
}

type PublicPage = {
  property: { heading: string; priceLabel: string | null };
  agency: { name: string; logoUrl: string | null };
  agent: { name: string; role: string; initials: string; photoUrl: string | null } | null;
  actions: { whatsapp: string | null };
};

/** Full funnel document for the sandboxed frame. Preview renders non-live funnels for the SegmiQ team. */
export async function renderFunnel(
  db: Db,
  input: { slug: string; token: string | null; preview?: { funnelId: string } | null; previewHandle?: string | null }
): Promise<{ ok: true; html: string } | Fail> {
  const loaded = await loadPublicListingPage(db, input.slug, input.token, { userAgent: null, referrer: null, visitor: null, recordView: false });
  const { data: listing } = await db.from("listings").select("id, client_id").eq("public_slug", input.slug).maybeSingle();
  if (!listing) return fail(404, "Not found", "NOT_FOUND");
  const listingId = String((listing as { id: string }).id);
  const clientId = String((listing as { client_id: string }).client_id);
  let request = db.from("re_listing_funnels").select(FUNNEL_COLUMNS).eq("listing_id", listingId);
  request = input.preview ? request.eq("id", input.preview.funnelId) : request.eq("status", "live");
  const { data: funnelRow } = await request.maybeSingle();
  if (!funnelRow) return fail(404, "Not found", "NO_FUNNEL");
  const funnel = mapFunnel(funnelRow as Record<string, unknown>);
  if (!funnel.html) return fail(404, "Not found", "NO_HTML");
  if (!input.preview && loaded.state !== "ready") return fail(404, "Not found", "UNAVAILABLE");

  const { data: client } = await db.from("clients").select("name, logo_url, dial_code, meta_whatsapp_display_number").eq("id", clientId).maybeSingle();
  const clientRow = (client ?? {}) as Record<string, unknown>;
  const dial = text(clientRow.dial_code) ?? "263";
  const page = loaded.state === "ready" ? (loaded.page as unknown as PublicPage) : null;
  const agencyName = page?.agency.name ?? text(clientRow.name) ?? "Agency";
  const agencyPhone = whatsappDigits(text(clientRow.meta_whatsapp_display_number), dial);

  let agentUserId: string | null = null;
  if (input.token) {
    const { data: share } = await db.from("re_agent_listing_shares").select("agent_id").eq("token", input.token).maybeSingle();
    agentUserId = text((share as { agent_id?: string } | null)?.agent_id);
  } else if (input.preview && input.previewHandle) {
    const { data: profile } = await db.from("re_agent_funnel_profiles").select("user_id").eq("client_id", clientId).eq("handle", normaliseHandle(input.previewHandle)).maybeSingle();
    agentUserId = text((profile as { user_id?: string } | null)?.user_id);
  }

  let agent: FunnelContext["agent"] = null;
  if (agentUserId && (page?.agent || input.preview)) {
    const [{ data: user }, { data: profile }] = await Promise.all([
      db.from("users").select("name, role, avatar_url, phone").eq("id", agentUserId).maybeSingle(),
      db.from("re_agent_funnel_profiles").select("whatsapp_digits, personal_line").eq("user_id", agentUserId).maybeSingle(),
    ]);
    const userRow = (user ?? {}) as Record<string, unknown>;
    const profileRow = (profile ?? {}) as Record<string, unknown>;
    const name = page?.agent?.name ?? text(userRow.name) ?? "Agent";
    const phone = whatsappDigits(text(profileRow.whatsapp_digits), dial);
    agent = {
      name,
      first: name.split(/\s+/)[0] ?? name,
      initials: page?.agent?.initials ?? initials(name),
      role: userRow.role === "CLIENT_MANAGER" ? "Sales Manager" : "Property Sales Negotiator",
      line: text(profileRow.personal_line) ?? "",
      photoUrl: page?.agent?.photoUrl ?? (typeof userRow.avatar_url === "string" && userRow.avatar_url.startsWith("https://") ? userRow.avatar_url : null),
      phone,
      phoneDisplay: displayPhone(phone),
    };
  }
  const contactPhone = agent?.phone ?? agencyPhone;
  const context: FunnelContext = {
    agent,
    agency: { name: agencyName, logoUrl: page?.agency.logoUrl ?? null },
    contact: {
      first: agent?.first ?? "us",
      name: agent?.name ?? agencyName,
      phone: contactPhone,
      phoneDisplay: displayPhone(contactPhone),
    },
    property: {
      slug: input.slug,
      url: `${getPublicBaseUrl().replace(/\/$/, "")}/property/${input.slug}`,
      heading: page?.property.heading ?? "Property",
      priceLabel: funnel.priceLabel ?? page?.property.priceLabel ?? null,
    },
    preview: Boolean(input.preview),
  };
  return { ok: true, html: renderFunnelDocument(funnel.html, context) };
}

/* ------------------------------------------------------------------ */
/* Agent                                                                */
/* ------------------------------------------------------------------ */

export type AgentProfile = {
  handle: string;
  whatsapp: string | null;
  whatsappDisplay: string;
  line: string | null;
};

export async function getAgentProfile(db: Db, userId: string): Promise<AgentProfile | null> {
  const { data } = await db.from("re_agent_funnel_profiles").select("handle, whatsapp_digits, personal_line").eq("user_id", userId).maybeSingle();
  if (!data) return null;
  const row = data as Record<string, unknown>;
  const digits = text(row.whatsapp_digits);
  return { handle: String(row.handle), whatsapp: digits, whatsappDisplay: displayPhone(digits), line: text(row.personal_line) };
}

export async function handleTaken(db: Db, clientId: string, userId: string, handle: string): Promise<boolean> {
  const { data } = await db.from("re_agent_funnel_profiles").select("user_id").eq("client_id", clientId).eq("handle", handle).maybeSingle();
  return Boolean(data) && (data as { user_id: string }).user_id !== userId;
}

export async function saveAgentProfile(
  db: Db,
  actor: ShareActor,
  input: { handle: string; whatsapp: string; line: string }
): Promise<{ ok: true; profile: AgentProfile } | (Fail & { field?: string })> {
  if (!actor.clientId) return fail(403, "Forbidden", "FORBIDDEN");
  const { data: user } = await db.from("users").select("is_active, client_id, also_sells").eq("id", actor.userId).maybeSingle();
  const userRow = user as { is_active?: boolean; client_id?: string; also_sells?: boolean } | null;
  const active = Boolean(userRow) && userRow?.is_active !== false && userRow?.client_id === actor.clientId;
  if (!canGenerateOwnShare({ ...actor, alsoSells: actor.alsoSells || userRow?.also_sells === true }, active)) {
    return fail(403, "Only agents who sell can set up funnel links", "FORBIDDEN");
  }
  const handle = normaliseHandle(input.handle);
  const problem = handleProblem(handle);
  if (problem) return { ...fail(400, problem, "INVALID_HANDLE"), field: "handle" };
  if (await handleTaken(db, actor.clientId, actor.userId, handle)) {
    return { ...fail(409, "Another agent at your agency has this name.", "HANDLE_TAKEN"), field: "handle" };
  }
  const { data: client } = await db.from("clients").select("dial_code").eq("id", actor.clientId).maybeSingle();
  const digits = whatsappDigits(input.whatsapp, text((client as { dial_code?: string } | null)?.dial_code) ?? "263");
  if (!digits) return { ...fail(400, "Enter the full WhatsApp number, with the country code.", "INVALID_WHATSAPP"), field: "whatsapp" };
  const line = input.line.replace(/\s+/g, " ").trim();
  if (!line) return { ...fail(400, "Write one line buyers will read next to your name.", "INVALID_LINE"), field: "line" };
  if (line.length > FUNNEL_LINE_MAX) return { ...fail(400, `Keep it under ${FUNNEL_LINE_MAX} characters.`, "INVALID_LINE"), field: "line" };
  const { error } = await db.from("re_agent_funnel_profiles").upsert(
    { user_id: actor.userId, client_id: actor.clientId, handle, whatsapp_digits: digits, personal_line: line },
    { onConflict: "user_id" }
  );
  if (error?.code === "23505") return { ...fail(409, "Another agent at your agency has this name.", "HANDLE_TAKEN"), field: "handle" };
  if (error) return fail(503, "Could not save your link details", "SERVICE_UNAVAILABLE");
  return { ok: true, profile: { handle, whatsapp: digits, whatsappDisplay: displayPhone(digits), line } };
}

export type FunnelTotals = { visits: number; whatsapp: number; enquiries: number; viewings: number };

const ZERO: FunnelTotals = { visits: 0, whatsapp: 0, enquiries: 0, viewings: 0 };

function totalsOf(rows: Array<{ event_type: string; bot_class: string; event_count: number }>): FunnelTotals {
  const totals = totalsFromCounts(rows.map((row) => ({ eventType: row.event_type, botClass: row.bot_class, count: Number(row.event_count ?? 0) })), null);
  return { visits: totals.visits, whatsapp: totals.whatsappClicks, enquiries: totals.enquiries, viewings: totals.viewingRequests };
}

function last30() {
  const range = rangeForPreset("30d", new Date(), "UTC");
  const to = range?.to ?? new Date();
  const from = range?.from ?? new Date(to.getTime() - 30 * 86_400_000);
  return { fromDay: from.toISOString().slice(0, 10), toDay: to.toISOString().slice(0, 10) };
}

async function dailyRows(db: Db, clientId: string, shareIds: string[]) {
  if (!shareIds.length) return [] as Array<{ share_id: string; event_type: string; bot_class: string; event_count: number }>;
  const { fromDay, toDay } = last30();
  const { data } = await db
    .from("re_listing_marketing_daily")
    .select("share_id, event_type, bot_class, event_count")
    .eq("client_id", clientId)
    .in("share_id", shareIds)
    .gte("day", fromDay)
    .lte("day", toDay)
    .limit(10000);
  return (data ?? []) as Array<{ share_id: string; event_type: string; bot_class: string; event_count: number }>;
}

export type AgentFunnelItem = {
  listingId: string;
  slug: string | null;
  heading: string;
  suburb: string | null;
  category: string | null;
  priceLabel: string | null;
  funnelStatus: FunnelStatus | null;
  publishedAt: string | null;
  imageUrl: string | null;
  shareTitle: string | null;
  shareSummary: string | null;
  totals: FunnelTotals;
};

const CATEGORY: Record<string, string> = {
  house: "House",
  apartment: "Apartment",
  townhouse: "Townhouse",
  residential_stand: "Stand",
  commercial: "Commercial",
  industrial: "Industrial",
  agricultural: "Agricultural",
  other: "Property",
};

function listingItem(row: Record<string, unknown>, funnel: FunnelRow | null, totals: FunnelTotals): AgentFunnelItem {
  return {
    listingId: String(row.id),
    slug: text(row.public_slug),
    heading: text(row.address) || text(row.suburb) || "Property",
    suburb: text(row.suburb),
    category: CATEGORY[String(row.property_category ?? "")] ?? null,
    priceLabel: funnel?.priceLabel ?? null,
    funnelStatus: funnel?.status ?? null,
    publishedAt: funnel?.publishedAt ?? null,
    imageUrl: funnel?.shareImageUrl ?? null,
    shareTitle: funnel?.shareTitle ?? null,
    shareSummary: funnel?.shareSummary ?? null,
    totals,
  };
}

export type RankingRow = { agentId: string; name: string; initials: string; visits: number; enquiries: number; you: boolean };

export async function agencyRanking(db: Db, clientId: string, userId: string): Promise<RankingRow[]> {
  const { data: shares } = await db.from("re_agent_listing_shares").select("id, agent_id").eq("client_id", clientId).limit(5000);
  const shareRows = (shares ?? []) as Array<{ id: string; agent_id: string }>;
  const owner = new Map(shareRows.map((row) => [row.id, row.agent_id]));
  const rows = await dailyRows(db, clientId, shareRows.map((row) => row.id));
  const byAgent = new Map<string, Array<{ event_type: string; bot_class: string; event_count: number }>>();
  for (const row of rows) {
    const agentId = owner.get(row.share_id);
    if (!agentId) continue;
    const list = byAgent.get(agentId) ?? [];
    list.push(row);
    byAgent.set(agentId, list);
  }
  if (!byAgent.has(userId)) byAgent.set(userId, []);
  const ids = [...byAgent.keys()];
  const { data: users } = await db.from("users").select("id, name").eq("client_id", clientId).in("id", ids);
  const names = new Map(((users ?? []) as Array<{ id: string; name: string | null }>).map((row) => [row.id, text(row.name) ?? "Agent"]));
  return ids
    .map((agentId) => {
      const totals = totalsOf(byAgent.get(agentId) ?? []);
      const name = names.get(agentId) ?? "Agent";
      return { agentId, name, initials: initials(name), visits: totals.visits, enquiries: totals.enquiries + totals.viewings, you: agentId === userId };
    })
    .filter((row) => row.you || row.visits > 0 || row.enquiries > 0)
    .sort((a, b) => b.enquiries - a.enquiries || b.visits - a.visits)
    .slice(0, 10);
}

export async function loadAgentFunnelsHome(db: Db, actor: ShareActor) {
  const clientId = actor.clientId!;
  const [profile, client, funnelsResult, sharesResult] = await Promise.all([
    getAgentProfile(db, actor.userId),
    db.from("clients").select("name").eq("id", clientId).maybeSingle(),
    db.from("re_listing_funnels").select(FUNNEL_META_COLUMNS).eq("client_id", clientId).neq("status", "paused").limit(200),
    db.from("re_agent_listing_shares").select("id, listing_id").eq("client_id", clientId).eq("agent_id", actor.userId).limit(500),
  ]);
  const funnels = ((funnelsResult.data ?? []) as Array<Record<string, unknown>>).map(mapFunnel);
  const funnelByListing = new Map(funnels.map((funnel) => [funnel.listingId, funnel]));
  const shares = (sharesResult.data ?? []) as Array<{ id: string; listing_id: string }>;
  const listingOfShare = new Map(shares.map((row) => [row.id, row.listing_id]));
  const rows = await dailyRows(db, clientId, shares.map((row) => row.id));
  const perListing = new Map<string, Array<{ event_type: string; bot_class: string; event_count: number }>>();
  for (const row of rows) {
    const listingId = listingOfShare.get(row.share_id);
    if (!listingId) continue;
    const list = perListing.get(listingId) ?? [];
    list.push(row);
    perListing.set(listingId, list);
  }
  const { data: listings } = await db
    .from("listings")
    .select("id, address, suburb, price, property_category, public_slug, status, approval_status")
    .eq("client_id", clientId)
    .eq("status", "available")
    .order("updated_at", { ascending: false })
    .limit(200);
  const listingRows = ((listings ?? []) as Array<Record<string, unknown>>).filter((row) => row.approval_status == null || row.approval_status === "approved");
  const items = listingRows.map((row) => listingItem(row, funnelByListing.get(String(row.id)) ?? null, perListing.has(String(row.id)) ? totalsOf(perListing.get(String(row.id))!) : ZERO));
  const withFunnel = items.filter((item) => item.funnelStatus).sort((a, b) => (a.funnelStatus === "live" ? 0 : 1) - (b.funnelStatus === "live" ? 0 : 1));
  const others = items.filter((item) => !item.funnelStatus).slice(0, 60);
  const totals = withFunnel.concat(others).reduce(
    (sum, item) => ({ visits: sum.visits + item.totals.visits, whatsapp: sum.whatsapp + item.totals.whatsapp, enquiries: sum.enquiries + item.totals.enquiries, viewings: sum.viewings + item.totals.viewings }),
    { ...ZERO }
  );
  const { data: fresh } = await db
    .from("re_listing_lead_attributions")
    .select("lead_id, listing_id, created_at, leads!inner(name, status)")
    .eq("client_id", clientId)
    .eq("marketing_agent_id", actor.userId)
    .gte("created_at", new Date(Date.now() - 3 * 86_400_000).toISOString())
    .order("created_at", { ascending: false })
    .limit(1);
  const latest = ((fresh ?? []) as Array<Record<string, unknown>>)[0] ?? null;
  const latestLead = latest
    ? {
        leadId: String(latest.lead_id),
        listingId: String(latest.listing_id),
        name: text(one(latest.leads as Record<string, unknown> | Record<string, unknown>[])?.name) ?? "A buyer",
        createdAt: String(latest.created_at),
        heading: items.find((item) => item.listingId === String(latest.listing_id))?.heading ?? "a property",
      }
    : null;
  return {
    agencyName: text((client.data as { name?: string } | null)?.name) ?? "your agency",
    profile,
    funnels: withFunnel,
    others,
    totals,
    latestLead,
    ranking: await agencyRanking(db, clientId, actor.userId),
  };
}

export type ChannelLink = { shareId: string; label: string; segment: string; totals: FunnelTotals };

export async function loadAgentFunnelDetail(db: Db, actor: ShareActor, listingId: string) {
  const clientId = actor.clientId!;
  const { data: listing } = await db
    .from("listings")
    .select("id, address, suburb, price, property_category, public_slug, status, approval_status")
    .eq("client_id", clientId)
    .eq("id", listingId)
    .maybeSingle();
  if (!listing) return null;
  const row = listing as Record<string, unknown>;
  const [{ data: funnelRow }, profile, { data: client }, { data: shareRows }] = await Promise.all([
    db.from("re_listing_funnels").select(FUNNEL_META_COLUMNS).eq("listing_id", listingId).maybeSingle(),
    getAgentProfile(db, actor.userId),
    db.from("clients").select("name").eq("id", clientId).maybeSingle(),
    db.from("re_agent_listing_shares").select("id, campaign_label, status, created_at").eq("client_id", clientId).eq("listing_id", listingId).eq("agent_id", actor.userId).eq("status", "active").order("created_at"),
  ]);
  const funnel = funnelRow ? mapFunnel(funnelRow as Record<string, unknown>) : null;
  const shares = (shareRows ?? []) as Array<{ id: string; campaign_label: string | null }>;
  const daily = await dailyRows(db, clientId, shares.map((share) => share.id));
  const channels: ChannelLink[] = shares
    .filter((share) => share.campaign_label)
    .map((share) => ({
      shareId: share.id,
      label: String(share.campaign_label),
      segment: channelSegment(share.campaign_label),
      totals: totalsOf(daily.filter((day) => day.share_id === share.id)),
    }))
    .filter((channel) => channel.segment);
  const defaultShare = shares.find((share) => !share.campaign_label) ?? null;
  const { data: attributions } = await db
    .from("re_listing_lead_attributions")
    .select("lead_id, share_id, kind, created_at, leads!inner(id, name, status, form_data)")
    .eq("client_id", clientId)
    .eq("listing_id", listingId)
    .eq("marketing_agent_id", actor.userId)
    .order("created_at", { ascending: false })
    .limit(50);
  const labelOf = new Map(shares.map((share) => [share.id, share.campaign_label]));
  const leads = ((attributions ?? []) as Array<Record<string, unknown>>).map((item) => {
    const lead = one(item.leads as Record<string, unknown> | Record<string, unknown>[]) ?? {};
    const form = (lead.form_data ?? {}) as Record<string, unknown>;
    const label = labelOf.get(String(item.share_id));
    return {
      leadId: String(item.lead_id),
      name: text(lead.name) ?? "Buyer",
      status: text(lead.status) ?? "NEW",
      kind: item.kind === "viewing_request" ? ("viewing_request" as const) : ("enquiry" as const),
      createdAt: String(item.created_at),
      channel: label ?? null,
      message: text(form.message),
      preferredAt: text(form.preferred_at),
    };
  });
  return {
    agencyName: text((client as { name?: string } | null)?.name) ?? "your agency",
    listing: listingItem(row, funnel, totalsOf(daily)),
    available: row.status === "available" && (row.approval_status == null || row.approval_status === "approved"),
    profile,
    hasDefaultLink: Boolean(defaultShare),
    channels,
    leads,
  };
}

export async function addChannelLink(db: Db, actor: ShareActor, listingId: string, label: string): Promise<{ ok: true; channel: ChannelLink } | Fail> {
  const clean = label.replace(/\s+/g, " ").trim().slice(0, 40);
  const segment = channelSegment(clean);
  if (!clean || segment.length < 2) return fail(400, "Name the channel, for example LinkedIn.", "INVALID_CHANNEL");
  const { data: existing } = await db
    .from("re_agent_listing_shares")
    .select("campaign_label")
    .eq("client_id", actor.clientId!)
    .eq("listing_id", listingId)
    .eq("agent_id", actor.userId)
    .eq("status", "active")
    .not("campaign_label", "is", null);
  if (((existing ?? []) as Array<{ campaign_label: string }>).some((row) => channelSegment(row.campaign_label) === segment)) {
    return fail(409, "You already have a link for that channel.", "CHANNEL_EXISTS");
  }
  const created = await generateShareLink(db, actor, actor.clientId!, { listingId, campaignLabel: clean });
  if (!created.ok) return created;
  return { ok: true, channel: { shareId: String(created.share.id), label: clean, segment, totals: { ...ZERO } } };
}

/** Makes sure the agent's main link exists before they copy it, so the first buyer lands on a working page. */
export async function ensureAgentLink(db: Db, actor: ShareActor, listingId: string): Promise<{ ok: true; slug: string } | Fail> {
  const created = await generateShareLink(db, actor, actor.clientId!, { listingId });
  if (!created.ok) return created;
  const path = String(created.share.canonicalPath ?? "");
  return { ok: true, slug: path.replace(/^\/property\//, "") };
}

export function agentFunnelUrl(slug: string, handle: string, channel?: string | null): string {
  return `${getPublicBaseUrl().replace(/\/$/, "")}${funnelPath(slug, handle, channel)}`;
}

/* ------------------------------------------------------------------ */
/* SegmiQ team                                                          */
/* ------------------------------------------------------------------ */

export type AdminFunnelSummary = FunnelRow & {
  clientName: string;
  listingHeading: string;
  listingSuburb: string | null;
  slug: string | null;
  listingStatus: string | null;
};

export async function listFunnelsForAdmin(db: Db): Promise<AdminFunnelSummary[]> {
  const { data } = await db
    .from("re_listing_funnels")
    .select(`${FUNNEL_META_COLUMNS}, listings!inner(address, suburb, public_slug, status), clients!inner(name)`)
    .order("updated_at", { ascending: false })
    .limit(500);
  return ((data ?? []) as Array<Record<string, unknown>>).map((row) => {
    const listing = one(row.listings as Record<string, unknown> | Record<string, unknown>[]) ?? {};
    const client = one(row.clients as Record<string, unknown> | Record<string, unknown>[]) ?? {};
    return {
      ...mapFunnel({ ...row, html: null }),
      clientName: text(client.name) ?? "Organisation",
      listingHeading: text(listing.address) || text(listing.suburb) || "Property",
      listingSuburb: text(listing.suburb),
      slug: text(listing.public_slug),
      listingStatus: text(listing.status),
    };
  });
}

export async function realEstateClientsForAdmin(db: Db) {
  const { data } = await db.from("clients").select("id, name").eq("business_type", "real_estate").or("is_archived.is.null,is_archived.eq.false").order("name").limit(500);
  return ((data ?? []) as Array<{ id: string; name: string | null }>).map((row) => ({ id: row.id, name: text(row.name) ?? "Organisation" }));
}

export async function listingsWithoutFunnel(db: Db, clientId: string) {
  const [{ data: listings }, { data: funnels }] = await Promise.all([
    db.from("listings").select("id, address, suburb, price, status, approval_status").eq("client_id", clientId).order("updated_at", { ascending: false }).limit(300),
    db.from("re_listing_funnels").select("listing_id").eq("client_id", clientId),
  ]);
  const taken = new Set(((funnels ?? []) as Array<{ listing_id: string }>).map((row) => row.listing_id));
  return ((listings ?? []) as Array<Record<string, unknown>>)
    .filter((row) => !taken.has(String(row.id)))
    .map((row) => ({
      id: String(row.id),
      label: [text(row.address), text(row.suburb)].filter(Boolean).join(", ") || "Untitled property",
      status: text(row.status),
      approved: row.approval_status == null || row.approval_status === "approved",
      price: row.price == null ? null : Number(row.price),
    }));
}

export async function createFunnel(db: Db, adminId: string, clientId: string, listingId: string): Promise<{ ok: true; id: string } | Fail> {
  const { data: listing } = await db.from("listings").select("id, client_id, suburb, public_slug").eq("id", listingId).eq("client_id", clientId).maybeSingle();
  if (!listing) return fail(404, "Listing not found for that organisation", "NOT_FOUND");
  const slug = await ensureSlug(db, listing as Record<string, unknown>);
  if (!slug) return fail(503, "Could not create a public address", "SERVICE_UNAVAILABLE");
  const { data, error } = await db
    .from("re_listing_funnels")
    .insert({ client_id: clientId, listing_id: listingId, status: "building", created_by: adminId, updated_by: adminId })
    .select("id")
    .single();
  if (error?.code === "23505") return fail(409, "This property already has a funnel", "EXISTS");
  if (error || !data) return fail(503, "Could not create the funnel", "SERVICE_UNAVAILABLE");
  return { ok: true, id: String((data as { id: string }).id) };
}

export async function getFunnelForAdmin(db: Db, funnelId: string) {
  const { data } = await db
    .from("re_listing_funnels")
    .select(`${FUNNEL_COLUMNS}, listings!inner(id, address, suburb, public_slug, status, approval_status, price), clients!inner(id, name)`)
    .eq("id", funnelId)
    .maybeSingle();
  if (!data) return null;
  const row = data as Record<string, unknown>;
  const listing = one(row.listings as Record<string, unknown> | Record<string, unknown>[]) ?? {};
  const client = one(row.clients as Record<string, unknown> | Record<string, unknown>[]) ?? {};
  const { data: handles } = await db.from("re_agent_funnel_profiles").select("handle").eq("client_id", String(row.client_id)).order("handle").limit(100);
  return {
    funnel: mapFunnel(row),
    clientName: text(client.name) ?? "Organisation",
    listing: {
      id: String(listing.id),
      heading: text(listing.address) || text(listing.suburb) || "Property",
      suburb: text(listing.suburb),
      slug: text(listing.public_slug),
      status: text(listing.status),
      approved: listing.approval_status == null || listing.approval_status === "approved",
    },
    handles: ((handles ?? []) as Array<{ handle: string }>).map((item) => item.handle),
  };
}

export type FunnelPatch = {
  html?: string | null;
  status?: FunnelStatus;
  shareTitle?: string | null;
  shareSummary?: string | null;
  shareImageUrl?: string | null;
  priceLabel?: string | null;
  brief?: string | null;
};

export async function updateFunnel(db: Db, adminId: string, funnelId: string, patch: FunnelPatch): Promise<{ ok: true; funnel: FunnelRow } | Fail> {
  const { data: current } = await db.from("re_listing_funnels").select(FUNNEL_COLUMNS).eq("id", funnelId).maybeSingle();
  if (!current) return fail(404, "Funnel not found", "NOT_FOUND");
  const before = mapFunnel(current as Record<string, unknown>);
  const changes: Record<string, unknown> = { updated_by: adminId };
  if (patch.html !== undefined) {
    const html = patch.html?.trim() ? patch.html : null;
    if (html && Buffer.byteLength(html, "utf8") > FUNNEL_HTML_MAX_BYTES) return fail(400, "The page is over 2 MB. Move images to uploads and link them.", "TOO_LARGE");
    if (html !== before.html) {
      changes.html = html;
      changes.html_version = before.htmlVersion + 1;
    }
  }
  if (patch.shareTitle !== undefined) changes.share_title = patch.shareTitle?.trim().slice(0, 120) || null;
  if (patch.shareSummary !== undefined) changes.share_summary = patch.shareSummary?.trim().slice(0, 300) || null;
  if (patch.brief !== undefined) changes.brief = patch.brief?.trim().slice(0, 4000) || null;
  if (patch.priceLabel !== undefined) changes.price_label = patch.priceLabel?.trim().slice(0, 40) || null;
  if (patch.shareImageUrl !== undefined) {
    const url = patch.shareImageUrl?.trim() || null;
    if (url && !/^(https:\/\/|\/)[^\s]+$/.test(url)) return fail(400, "Share image must be an https address or a site path", "INVALID_IMAGE");
    changes.share_image_url = url;
  }
  if (patch.status && patch.status !== before.status) {
    const html = (changes.html as string | null | undefined) ?? before.html;
    if (patch.status === "live" && !html) return fail(400, "Add the page HTML before publishing", "NO_HTML");
    changes.status = patch.status;
    if (patch.status === "live") {
      changes.published_at = new Date().toISOString();
      changes.published_by = adminId;
    }
  }
  const { data, error } = await db.from("re_listing_funnels").update(changes).eq("id", funnelId).select(FUNNEL_COLUMNS).single();
  if (error || !data) return fail(503, "Could not save the funnel", "SERVICE_UNAVAILABLE");
  return { ok: true, funnel: mapFunnel(data as Record<string, unknown>) };
}
