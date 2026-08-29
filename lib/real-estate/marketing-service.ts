import { createAdminClient } from "@/lib/supabase/admin";
import { listingLabel } from "@/lib/real-estate/helpers";
import { QUALIFIED_LEAD_STATUSES, CONTACTED_OR_BEYOND } from "@/lib/sales/company-leads-metrics";
import { deriveFirstRespondedAt } from "@/lib/sales/intelligence/meaningful-activity";
import {
  accumulateFunnel,
  campaignAttentionFlags,
  costPer,
  funnelRates,
  isReSourceType,
  leadSourceFromReType,
  maskWebsiteApiKey,
  medianNumber,
  propertyInsight,
  reSourceLabel,
  RE_DATE_PRESETS,
  resolveReMarketingRange,
  sourceTypeFromLeadSource,
  type ReCampaignPlatform,
  type ReDatePreset,
  type ReSourceType,
} from "@/lib/real-estate/marketing";
import {
  buyerPatchFromMapping,
  mapFormToBuyerRequirements,
} from "@/lib/real-estate/buyer-form-map";

type Actor = { id: string; role: string; clientId: string | null };

export type AttributionInput = {
  clientId: string;
  leadId: string;
  contactId?: string | null;
  sourceType: ReSourceType;
  sourcePlatform?: string | null;
  campaignId?: string | null;
  campaignName?: string | null;
  adsetId?: string | null;
  adsetName?: string | null;
  adId?: string | null;
  adName?: string | null;
  formId?: string | null;
  formName?: string | null;
  listingId?: string | null;
  utm?: {
    utm_source?: string | null;
    utm_medium?: string | null;
    utm_campaign?: string | null;
    utm_content?: string | null;
    utm_term?: string | null;
  };
  landingPage?: string | null;
  referrer?: string | null;
  provider?: string | null;
  externalLeadId?: string | null;
  referralSourceName?: string | null;
  formPrequalified?: boolean;
  rawMetadata?: Record<string, unknown>;
  capturedAt?: string | null;
};

export async function findExistingExternalLead(opts: {
  clientId: string;
  provider: string;
  externalLeadId: string;
}): Promise<string | null> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("marketing_attributions")
    .select("lead_id")
    .eq("client_id", opts.clientId)
    .eq("provider", opts.provider)
    .eq("external_lead_id", opts.externalLeadId)
    .maybeSingle();
  return (data?.lead_id as string | null) ?? null;
}

export async function recordFirstTouchAttribution(
  input: AttributionInput
): Promise<{ created: boolean; id: string | null }> {
  const supabase = createAdminClient();
  const { data: existing } = await supabase
    .from("marketing_attributions")
    .select("id, source_type")
    .eq("client_id", input.clientId)
    .eq("lead_id", input.leadId)
    .maybeSingle();

  if (existing) {
    const latest = input.sourceType;
    if (latest && latest !== existing.source_type) {
      await supabase
        .from("marketing_attributions")
        .update({
          latest_source_type: latest,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id)
        .eq("client_id", input.clientId);
    }
    return { created: false, id: existing.id as string };
  }

  const utm = input.utm ?? {};
  const { data, error } = await supabase
    .from("marketing_attributions")
    .insert({
      client_id: input.clientId,
      lead_id: input.leadId,
      contact_id: input.contactId ?? null,
      source_type: input.sourceType,
      source_platform: input.sourcePlatform ?? null,
      campaign_id: input.campaignId ?? null,
      campaign_name: input.campaignName ?? null,
      adset_id: input.adsetId ?? null,
      adset_name: input.adsetName ?? null,
      ad_id: input.adId ?? null,
      ad_name: input.adName ?? null,
      form_id: input.formId ?? null,
      form_name: input.formName ?? null,
      listing_id: input.listingId ?? null,
      utm_source: utm.utm_source || null,
      utm_medium: utm.utm_medium || null,
      utm_campaign: utm.utm_campaign || null,
      utm_content: utm.utm_content || null,
      utm_term: utm.utm_term || null,
      landing_page: input.landingPage ?? null,
      referrer: input.referrer ?? null,
      provider: input.provider ?? null,
      external_lead_id: input.externalLeadId ?? null,
      referral_source_name: input.referralSourceName ?? null,
      form_prequalified: Boolean(input.formPrequalified),
      raw_metadata: input.rawMetadata ?? {},
      captured_at: input.capturedAt || undefined,
    })
    .select("id")
    .maybeSingle();

  if (error) {
    if (String(error.message ?? "").includes("idx_mkt_attr")) {
      return { created: false, id: null };
    }
    console.error("[marketing-attr] insert failed", error.message);
    return { created: false, id: null };
  }
  return { created: true, id: (data?.id as string | null) ?? null };
}

export async function matchCampaignForIngest(opts: {
  clientId: string;
  formId?: string | null;
  externalCampaignId?: string | null;
  listingId?: string | null;
}): Promise<{
  id: string;
  name: string;
  listing_id: string | null;
  default_agent_id: string | null;
} | null> {
  const supabase = createAdminClient();
  if (opts.formId) {
    const { data } = await supabase
      .from("re_marketing_campaigns")
      .select("id, name, listing_id, default_agent_id")
      .eq("client_id", opts.clientId)
      .eq("form_id", opts.formId)
      .maybeSingle();
    if (data) return data as never;
  }
  if (opts.externalCampaignId) {
    const { data } = await supabase
      .from("re_marketing_campaigns")
      .select("id, name, listing_id, default_agent_id")
      .eq("client_id", opts.clientId)
      .eq("external_campaign_id", opts.externalCampaignId)
      .maybeSingle();
    if (data) return data as never;
  }
  if (opts.listingId) {
    const { data } = await supabase
      .from("re_marketing_campaigns")
      .select("id, name, listing_id, default_agent_id")
      .eq("client_id", opts.clientId)
      .eq("listing_id", opts.listingId)
      .eq("status", "active")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data) return data as never;
  }
  return null;
}

export async function applyMappedBuyerRequirements(opts: {
  clientId: string;
  contactId: string;
  formData: Record<string, unknown>;
}): Promise<{ formPrequalified: boolean }> {
  const mapped = mapFormToBuyerRequirements(opts.formData);
  const patch = buyerPatchFromMapping(mapped);
  if (Object.keys(patch).length <= 1) return { formPrequalified: mapped.formPrequalified };
  const supabase = createAdminClient();
  await supabase.from("contacts").update(patch).eq("id", opts.contactId).eq("client_id", opts.clientId);
  return { formPrequalified: mapped.formPrequalified };
}

export async function getLeadAttribution(opts: { clientId: string; leadId: string }) {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("marketing_attributions")
    .select("*")
    .eq("client_id", opts.clientId)
    .eq("lead_id", opts.leadId)
    .maybeSingle();
  if (!data) return null;
  return {
    sourceType: data.source_type as string,
    sourceLabel: reSourceLabel(data.source_type as string),
    campaignName: (data.campaign_name as string | null) ?? null,
    campaignId: (data.campaign_id as string | null) ?? null,
    adName: (data.ad_name as string | null) ?? null,
    listingId: (data.listing_id as string | null) ?? null,
    capturedAt: data.captured_at as string,
    referralSourceName: (data.referral_source_name as string | null) ?? null,
    utmSource: (data.utm_source as string | null) ?? null,
    utmMedium: (data.utm_medium as string | null) ?? null,
    utmCampaign: (data.utm_campaign as string | null) ?? null,
    formPrequalified: Boolean(data.form_prequalified),
    latestSourceType: (data.latest_source_type as string | null) ?? null,
  };
}

async function assertTenantIds(opts: {
  clientId: string;
  listingId?: string | null;
  agentId?: string | null;
  campaignId?: string | null;
}): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  const supabase = createAdminClient();
  if (opts.listingId) {
    const { data } = await supabase
      .from("listings")
      .select("id")
      .eq("id", opts.listingId)
      .eq("client_id", opts.clientId)
      .maybeSingle();
    if (!data) return { ok: false, error: "Listing not found.", status: 404 };
  }
  if (opts.agentId) {
    const { data } = await supabase
      .from("users")
      .select("id")
      .eq("id", opts.agentId)
      .eq("client_id", opts.clientId)
      .maybeSingle();
    if (!data) return { ok: false, error: "Agent not found.", status: 404 };
  }
  if (opts.campaignId) {
    const { data } = await supabase
      .from("re_marketing_campaigns")
      .select("id")
      .eq("id", opts.campaignId)
      .eq("client_id", opts.clientId)
      .maybeSingle();
    if (!data) return { ok: false, error: "Campaign not found.", status: 404 };
  }
  return { ok: true };
}

export async function listAcquisitionCampaigns(clientId: string) {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("re_marketing_campaigns")
    .select("*")
    .eq("client_id", clientId)
    .order("updated_at", { ascending: false })
    .limit(200);
  return data ?? [];
}

export async function upsertAcquisitionCampaign(opts: {
  clientId: string;
  actor: Actor;
  id?: string | null;
  name: string;
  platform?: ReCampaignPlatform;
  externalCampaignId?: string | null;
  formId?: string | null;
  listingId?: string | null;
  defaultAgentId?: string | null;
  status?: string;
  startDate?: string | null;
  endDate?: string | null;
  reportedSpend?: number | null;
  notes?: string | null;
}) {
  const tenant = await assertTenantIds({
    clientId: opts.clientId,
    listingId: opts.listingId,
    agentId: opts.defaultAgentId,
  });
  if (!tenant.ok) return tenant;
  const supabase = createAdminClient();
  const row = {
    client_id: opts.clientId,
    name: opts.name.trim(),
    platform: opts.platform ?? "facebook",
    external_campaign_id: opts.externalCampaignId?.trim() || null,
    form_id: opts.formId?.trim() || null,
    listing_id: opts.listingId ?? null,
    default_agent_id: opts.defaultAgentId ?? null,
    status: opts.status ?? "active",
    start_date: opts.startDate ?? null,
    end_date: opts.endDate ?? null,
    reported_spend: opts.reportedSpend ?? null,
    spend_source: "manual",
    notes: opts.notes?.trim() || null,
    updated_at: new Date().toISOString(),
  };
  if (opts.id) {
    const { data, error } = await supabase
      .from("re_marketing_campaigns")
      .update(row)
      .eq("id", opts.id)
      .eq("client_id", opts.clientId)
      .select("*")
      .maybeSingle();
    if (error || !data) return { ok: false as const, error: error?.message ?? "Not found.", status: 404 };
    return { ok: true as const, campaign: data };
  }
  const { data, error } = await supabase.from("re_marketing_campaigns").insert(row).select("*").maybeSingle();
  if (error || !data) return { ok: false as const, error: error?.message ?? "Create failed.", status: 500 };
  return { ok: true as const, campaign: data };
}

export async function deleteAcquisitionCampaign(opts: { clientId: string; campaignId: string }) {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("re_marketing_campaigns")
    .delete()
    .eq("id", opts.campaignId)
    .eq("client_id", opts.clientId);
  if (error) return { ok: false as const, error: error.message, status: 500 };
  return { ok: true as const };
}

export async function getWebsiteIntegrationState(clientId: string) {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("clients")
    .select("website_integration_api_key, website_integration_key_rotated_at")
    .eq("id", clientId)
    .maybeSingle();
  const key = (data?.website_integration_api_key as string | null) ?? null;
  return {
    hasKey: Boolean(key),
    masked: maskWebsiteApiKey(key),
    rotatedAt: (data?.website_integration_key_rotated_at as string | null) ?? null,
  };
}

export type MarketingDashboardFilters = {
  preset: ReDatePreset;
  from?: string | null;
  to?: string | null;
  sourceType?: string | null;
  campaignId?: string | null;
  listingId?: string | null;
  agentId?: string | null;
  dealSide?: string | null;
};

export async function getMarketingDashboard(opts: {
  clientId: string;
  filters: MarketingDashboardFilters;
}) {
  const supabase = createAdminClient();
  const range = resolveReMarketingRange(opts.filters.preset, opts.filters.from, opts.filters.to);
  const fromIso = range.from.toISOString();
  const toIso = range.to.toISOString();

  const { data: leadRows } = await supabase
    .from("leads")
    .select(
      "id, contact_id, assigned_to_id, status, source, deal_side, linked_listing_id, created_at, form_data, name"
    )
    .eq("client_id", opts.clientId)
    .gte("created_at", fromIso)
    .lt("created_at", toIso)
    .or("is_archived.is.null,is_archived.eq.false")
    .order("created_at", { ascending: false })
    .limit(4000);

  const leads = leadRows ?? [];
  const leadIds = leads.map((l) => l.id as string);
  const contactIds = [...new Set(leads.map((l) => l.contact_id as string | null).filter(Boolean))] as string[];

  const [{ data: attrs }, { data: campaigns }, { data: users }, { data: listings }] = await Promise.all([
    leadIds.length
      ? supabase
          .from("marketing_attributions")
          .select("*")
          .eq("client_id", opts.clientId)
          .in("lead_id", leadIds)
      : Promise.resolve({ data: [] as Array<Record<string, unknown>> }),
    supabase.from("re_marketing_campaigns").select("*").eq("client_id", opts.clientId),
    supabase.from("users").select("id, name").eq("client_id", opts.clientId).limit(200),
    supabase.from("listings").select("id, address, suburb, status, created_at").eq("client_id", opts.clientId),
  ]);

  const attrByLead = new Map((attrs ?? []).map((a) => [a.lead_id as string, a]));
  const campaignById = new Map((campaigns ?? []).map((c) => [c.id as string, c]));
  const userById = new Map((users ?? []).map((u) => [u.id as string, u.name as string | null]));
  const listingById = new Map((listings ?? []).map((l) => [l.id as string, l]));

  const [{ data: viewingRows }, { data: offerRows }, signals] = await Promise.all([
    contactIds.length
      ? supabase
          .from("viewings")
          .select("id, contact_id, status")
          .in("contact_id", contactIds)
          .in("status", ["scheduled", "completed"])
      : Promise.resolve({ data: [] as Array<Record<string, unknown>> }),
    leadIds.length
      ? supabase
          .from("real_estate_offers")
          .select("id, lead_id, status")
          .eq("client_id", opts.clientId)
          .in("lead_id", leadIds)
      : Promise.resolve({ data: [] as Array<Record<string, unknown>> }),
    loadFirstResponseSignals(leadIds),
  ]);

  const viewingContacts = new Set((viewingRows ?? []).map((v) => v.contact_id as string));
  const offersByLead = new Map<string, Array<{ status: string }>>();
  for (const o of offerRows ?? []) {
    const id = o.lead_id as string;
    const list = offersByLead.get(id) ?? [];
    list.push({ status: o.status as string });
    offersByLead.set(id, list);
  }

  type Row = {
    leadId: string;
    name: string;
    sourceType: ReSourceType;
    campaignId: string | null;
    campaignName: string | null;
    listingId: string | null;
    agentId: string | null;
    agentName: string | null;
    dealSide: string | null;
    createdAt: string;
    status: string;
    qualified: boolean;
    hadViewing: boolean;
    hadOffer: boolean;
    accepted: boolean;
    contacted: boolean;
    firstResponseMins: number | null;
    formPrequalified: boolean;
  };

  const rows: Row[] = leads.map((lead) => {
    const attr = attrByLead.get(lead.id as string);
    const fd = (lead.form_data as Record<string, unknown> | null) ?? {};
    const sourceType = isReSourceType(attr?.source_type as string)
      ? (attr!.source_type as ReSourceType)
      : sourceTypeFromLeadSource(lead.source as string, {
          hubSource: typeof fd.hub_source === "string" ? fd.hub_source : null,
          utmSource: (attr?.utm_source as string | null) ?? null,
        });
    const listingId =
      (attr?.listing_id as string | null) ?? (lead.linked_listing_id as string | null) ?? null;
    const campaignId = (attr?.campaign_id as string | null) ?? null;
    const campaign = campaignId ? campaignById.get(campaignId) : null;
    const offers = offersByLead.get(lead.id as string) ?? [];
    const firstAt = firstMarketingResponseAt(
      signals.eventsByLead.get(lead.id as string) ?? [],
      signals.callAtsByLead.get(lead.id as string) ?? [],
      signals.outboundWaByLead.get(lead.id as string) ?? []
    );
    const created = Date.parse(lead.created_at as string);
    const responded = firstAt ? Date.parse(firstAt) : NaN;
    const mins =
      Number.isFinite(created) && Number.isFinite(responded) && responded >= created
        ? (responded - created) / 60_000
        : null;
    const status = String(lead.status ?? "NEW").toUpperCase();
    return {
      leadId: lead.id as string,
      name: (lead.name as string | null) || "Inquiry",
      sourceType,
      campaignId,
      campaignName: (attr?.campaign_name as string | null) ?? (campaign?.name as string | null) ?? null,
      listingId,
      agentId: (lead.assigned_to_id as string | null) ?? null,
      agentName: lead.assigned_to_id ? userById.get(lead.assigned_to_id as string) ?? null : null,
      dealSide: (lead.deal_side as string | null) ?? null,
      createdAt: lead.created_at as string,
      status,
      qualified: QUALIFIED_LEAD_STATUSES.has(status),
      hadViewing: Boolean(lead.contact_id && viewingContacts.has(lead.contact_id as string)),
      hadOffer: offers.length > 0,
      accepted: offers.some((o) => o.status === "accepted"),
      contacted: Boolean(firstAt) || CONTACTED_OR_BEYOND.has(status),
      firstResponseMins: mins,
      formPrequalified: Boolean(attr?.form_prequalified),
    };
  });

  const f = opts.filters;
  const filtered = rows.filter((r) => {
    if (f.sourceType && r.sourceType !== f.sourceType) return false;
    if (f.campaignId && r.campaignId !== f.campaignId) return false;
    if (f.listingId && r.listingId !== f.listingId) return false;
    if (f.agentId && r.agentId !== f.agentId) return false;
    if (f.dealSide && r.dealSide !== f.dealSide) return false;
    return true;
  });

  const funnel = accumulateFunnel(filtered);
  const rates = funnelRates(funnel);
  const responseMins = filtered
    .map((r) => r.firstResponseMins)
    .filter((n): n is number => n != null && n >= 0);
  const within15 = responseMins.filter((n) => n <= 15).length;
  const uncontacted24h = filtered.filter((r) => {
    if (r.contacted) return false;
    return Date.now() - Date.parse(r.createdAt) > 24 * 60 * 60 * 1000;
  }).length;

  const sourceMap = new Map<ReSourceType, typeof filtered>();
  for (const r of filtered) {
    const list = sourceMap.get(r.sourceType) ?? [];
    list.push(r);
    sourceMap.set(r.sourceType, list);
  }
  const sources = [...sourceMap.entries()]
    .map(([sourceType, list]) => {
      const fn = accumulateFunnel(list);
      return {
        sourceType,
        label: reSourceLabel(sourceType),
        ...fn,
        conversion: conversionSafe(fn.accepted, fn.inquiries),
      };
    })
    .sort((a, b) => b.inquiries - a.inquiries);

  const campaignPerf = (campaigns ?? []).map((c) => {
    const list = filtered.filter((r) => r.campaignId === c.id);
    const fn = accumulateFunnel(list);
    const spend =
      c.spend_source === "synced" && c.synced_spend != null
        ? Number(c.synced_spend)
        : c.reported_spend != null
          ? Number(c.reported_spend)
          : null;
    const listing = c.listing_id ? listingById.get(c.listing_id as string) : null;
    const last = list[0]?.createdAt ?? null;
    return {
      id: c.id as string,
      name: c.name as string,
      platform: c.platform as string,
      status: c.status as string,
      listingId: (c.listing_id as string | null) ?? null,
      propertyLabel: listing ? listingLabel(listing) : null,
      spend,
      spendKind: c.spend_source === "synced" && c.synced_spend != null ? "synced" : spend != null ? "reported" : null,
      ...fn,
      costPerInquiry: costPer(spend, fn.inquiries),
      costPerQualified: costPer(spend, fn.qualified),
      conversion: conversionSafe(fn.accepted, fn.inquiries),
      flags: campaignAttentionFlags({
        inquiries: fn.inquiries,
        qualified: fn.qualified,
        viewings: fn.viewings,
        offers: fn.offers,
        contacted: list.filter((x) => x.contacted).length,
        lastInquiryAt: last,
      }),
    };
  });

  const listingPerf = (listings ?? []).map((listing) => {
    const list = filtered.filter((r) => r.listingId === listing.id);
    if (list.length === 0) return null;
    const fn = accumulateFunnel(list);
    const campaignCount = new Set(list.map((r) => r.campaignId).filter(Boolean)).size;
    const created = listing.created_at ? Date.parse(listing.created_at as string) : NaN;
    const daysListed = Number.isFinite(created)
      ? Math.max(0, Math.floor((Date.now() - created) / 86_400_000))
      : null;
    return {
      listingId: listing.id as string,
      propertyLabel: listingLabel(listing),
      status: listing.status as string,
      campaigns: campaignCount,
      ...fn,
      daysListed,
      insight: propertyInsight(fn),
    };
  }).filter((p): p is NonNullable<typeof p> => Boolean(p));

  const agentMap = new Map<string, Row[]>();
  for (const r of filtered) {
    const key = r.agentId ?? "__unassigned__";
    const list = agentMap.get(key) ?? [];
    list.push(r);
    agentMap.set(key, list);
  }
  const agents = [...agentMap.entries()].map(([id, list]) => {
    const fn = accumulateFunnel(list);
    return {
      agentId: id === "__unassigned__" ? null : id,
      name: id === "__unassigned__" ? "Unassigned" : userById.get(id) ?? "Agent",
      assigned: list.length,
      uncontacted: list.filter((x) => !x.contacted).length,
      ...fn,
    };
  });

  const spendTotal = campaignPerf.reduce(
    (s, c) => s + (c.inquiries > 0 ? c.spend ?? 0 : 0),
    0
  );

  return {
    range: { from: fromIso, to: toIso, label: range.label },
    cohortLabel: `Inquiries acquired ${range.label.toLowerCase()}`,
    kpis: {
      inquiries: funnel.inquiries,
      qualified: funnel.qualified,
      viewings: funnel.viewings,
      offers: funnel.offers,
      accepted: funnel.accepted,
      costPerInquiry: costPer(spendTotal || null, funnel.inquiries),
      costPerQualified: costPer(spendTotal || null, funnel.qualified),
    },
    funnel,
    rates,
    sources,
    campaigns: campaignPerf,
    properties: listingPerf,
    agents,
    handoff: {
      assigned: filtered.filter((r) => r.agentId).length,
      contacted: filtered.filter((r) => r.contacted).length,
      uncontacted: filtered.filter((r) => !r.contacted).length,
      medianFirstResponseMins: medianNumber(responseMins),
      within15Pct: conversionPctSafe(within15, responseMins.length),
      uncontactedAfter24h: uncontacted24h,
    },
    latest: filtered.slice(0, 12).map((r) => ({
      leadId: r.leadId,
      name: r.name,
      sourceLabel: reSourceLabel(r.sourceType),
      propertyLabel: r.listingId && listingById.get(r.listingId) ? listingLabel(listingById.get(r.listingId)!) : null,
      agentName: r.agentName,
      createdAt: r.createdAt,
      qualified: r.qualified,
      stageLabel: r.qualified ? "Qualified" : r.status.replace(/_/g, " "),
    })),
    exportRows: filtered.map((r) => ({
      createdAt: r.createdAt,
      name: r.name,
      sourceLabel: reSourceLabel(r.sourceType),
      campaignName: r.campaignName,
      propertyLabel: r.listingId && listingById.get(r.listingId) ? listingLabel(listingById.get(r.listingId)!) : null,
      agentName: r.agentName,
      qualified: r.qualified,
      hadViewing: r.hadViewing,
      hadOffer: r.hadOffer,
      accepted: r.accepted,
    })),
    filterOptions: {
      listings: (listings ?? []).map((l) => ({
        id: l.id as string,
        label: listingLabel(l),
      })),
      campaigns: (campaigns ?? []).map((c) => ({
        id: c.id as string,
        name: c.name as string,
      })),
      agents: [...userById.entries()].map(([id, name]) => ({ id, name: name || "Agent" })),
    },
  };
}

/** First human response: logged call, outbound WhatsApp with actor, MESSAGE_SENT, CALL_LOGGED, or walk-in intake. Never the lead row's updated timestamp. */
export function firstMarketingResponseAt(
  events: Array<{ event_type: string; created_at: string }>,
  callAts: string[],
  outboundWaAts: string[]
): string | null {
  const derived = deriveFirstRespondedAt(events, callAts, outboundWaAts);
  const intake = events
    .filter((e) => e.event_type === "INTAKE_LOGGED" && e.created_at)
    .map((e) => e.created_at);
  const all = [derived, ...intake].filter((x): x is string => Boolean(x)).sort();
  return all[0] ?? null;
}

export function parseMarketingFilters(sp: URLSearchParams): MarketingDashboardFilters {
  const presetRaw = sp.get("preset") ?? "this_month";
  const preset = (RE_DATE_PRESETS as readonly string[]).includes(presetRaw)
    ? (presetRaw as ReDatePreset)
    : "this_month";
  return {
    preset,
    from: sp.get("from"),
    to: sp.get("to"),
    sourceType: sp.get("source"),
    campaignId: sp.get("campaign"),
    listingId: sp.get("listing"),
    agentId: sp.get("agent"),
    dealSide: sp.get("deal_side"),
  };
}

function conversionSafe(n: number, d: number): number | null {
  if (!d) return null;
  return Math.round((n / d) * 1000) / 10;
}
function conversionPctSafe(n: number, d: number): number | null {
  return conversionSafe(n, d);
}

async function loadFirstResponseSignals(leadIds: string[]) {
  const empty = {
    callAtsByLead: new Map<string, string[]>(),
    outboundWaByLead: new Map<string, string[]>(),
    eventsByLead: new Map<string, Array<{ event_type: string; created_at: string }>>(),
  };
  if (leadIds.length === 0) return empty;
  const supabase = createAdminClient();
  const [calls, wa, events] = await Promise.all([
    supabase.from("call_logs").select("lead_id, created_at").in("lead_id", leadIds).limit(4000),
    supabase
      .from("whatsapp_messages")
      .select("lead_id, created_at, actor_id")
      .in("lead_id", leadIds)
      .eq("direction", "outbound")
      .not("actor_id", "is", null)
      .limit(4000),
    supabase
      .from("lead_events")
      .select("lead_id, event_type, created_at")
      .in("lead_id", leadIds)
      .in("event_type", ["CALL_LOGGED", "MESSAGE_SENT", "INTAKE_LOGGED"])
      .limit(4000),
  ]);
  for (const row of calls.data ?? []) {
    const id = row.lead_id as string;
    const list = empty.callAtsByLead.get(id) ?? [];
    list.push(row.created_at as string);
    empty.callAtsByLead.set(id, list);
  }
  for (const row of wa.data ?? []) {
    const id = row.lead_id as string;
    const list = empty.outboundWaByLead.get(id) ?? [];
    list.push(row.created_at as string);
    empty.outboundWaByLead.set(id, list);
  }
  for (const row of events.data ?? []) {
    const id = row.lead_id as string;
    const list = empty.eventsByLead.get(id) ?? [];
    list.push({ event_type: row.event_type as string, created_at: row.created_at as string });
    empty.eventsByLead.set(id, list);
  }
  return empty;
}

export async function getWebsiteLeadMetrics(clientId: string) {
  const [dash, integration] = await Promise.all([
    getMarketingDashboard({
      clientId,
      filters: { preset: "this_month", sourceType: "website" },
    }),
    getWebsiteIntegrationState(clientId),
  ]);
  return {
    month: dash.funnel,
    latest: dash.latest,
    rangeLabel: dash.range.label,
    integration,
  };
}

export async function getListingMarketing(opts: { clientId: string; listingId: string }) {
  const tenant = await assertTenantIds({ clientId: opts.clientId, listingId: opts.listingId });
  if (!tenant.ok) return tenant;
  const today = new Date().toISOString().slice(0, 10);
  const dash = await getMarketingDashboard({
    clientId: opts.clientId,
    filters: {
      preset: "custom",
      from: "2010-01-01",
      to: today,
      listingId: opts.listingId,
    },
  });
  const row = dash.properties.find((p) => p && p.listingId === opts.listingId) ?? null;
  return {
    ok: true as const,
    funnel: dash.funnel,
    sources: dash.sources,
    campaigns: dash.campaigns.filter((c) => c.listingId === opts.listingId || c.inquiries > 0),
    row,
  };
}

export async function exportMarketingCsv(opts: {
  clientId: string;
  filters: MarketingDashboardFilters;
}): Promise<string> {
  const dash = await getMarketingDashboard(opts);
  const header = [
    "Inquiry Date",
    "Contact",
    "Source",
    "Campaign",
    "Property",
    "Agent",
    "Stage",
    "Viewing",
    "Offer",
    "Accepted",
  ];
  const esc = (s: string | number | boolean | null | undefined) => {
    const t = s == null ? "" : String(s);
    return /[",\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
  };
  const lines = [header.join(",")];
  for (const r of dash.exportRows) {
    lines.push(
      [
        esc(r.createdAt),
        esc(r.name),
        esc(r.sourceLabel),
        esc(r.campaignName),
        esc(r.propertyLabel),
        esc(r.agentName),
        esc(r.qualified ? "Qualified" : "Open"),
        esc(r.hadViewing ? "Yes" : "No"),
        esc(r.hadOffer ? "Yes" : "No"),
        esc(r.accepted ? "Yes" : "No"),
      ].join(",")
    );
  }
  return lines.join("\n");
}

export { leadSourceFromReType };
