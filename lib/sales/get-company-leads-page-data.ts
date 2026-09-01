/**
 * Company Leads page aggregator.
 * Tenant-scoped, batched owners + first-response signals — no per-Lead N+1.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { canReassignLeads } from "@/lib/auth/permissions";
import { canActAsSalesperson } from "@/lib/auth/sales-capabilities";
import { leadCardDisplayName } from "@/lib/leads/whatsapp-lead-display";
import {
  companyFromFormData,
  locationFromFormData,
} from "@/lib/sales/leads-directory/format";
import { leadScoreBand } from "@/lib/sales/format";
import { DEAL_STAGE_LABEL } from "@/lib/sales/deals/display";
import { getDealCommercialValue } from "@/lib/sales/deals";
import { formatDealCurrency } from "@/lib/sales/format";
import { loadResponseSignals } from "@/lib/sales/get-company-team-page-data";
import { listingLabel } from "@/lib/real-estate/helpers";
import {
  markedInterestedFromFormData,
  resolveRePipelineStage,
  rePipelineStageLabel,
} from "@/lib/real-estate/pipeline";
import { formatBudgetRange, formatRequirementSummary } from "@/lib/real-estate/requirements";
import { isRealEstate, normalizeBusinessType } from "@/lib/terminology";
import {
  deriveFirstRespondedAt,
  deriveLastMeaningfulActivityAt,
  firstQualifyingResponseMinutes,
} from "@/lib/sales/intelligence/meaningful-activity";
import {
  COMPANY_LEADS_CAP,
  QUALIFIED_LEAD_STATUSES,
  buildCompanyLeadsKpis,
  companyLeadHasDeal,
  companyLeadLifecycleLabel,
  companyLeadScoreSignals,
  conversionRate,
  countCompanyLeadsTabs,
  customerNeedFromLead,
  formatCompanyLeadActivityAt,
  formatCompanyLeadCreatedAt,
  formatLastActivityLabel,
  formatLeadNextActionView,
  inPeriod,
  intentLabelForScore,
  isHotIntent,
  periodBounds,
  sourceOptionFromRaw,
} from "@/lib/sales/company-leads-metrics";
import type {
  CompanyLeadDetail,
  CompanyLeadRelatedDeal,
  CompanyLeadRow,
  CompanyLeadsOwnerOption,
  CompanyLeadsPageData,
  CompanyLeadsSourceOption,
} from "@/components/dashboard/company/leads/types";
import type { DealRow, LeadRow, LeadStatus, UserRole } from "@/types";

type TeamUser = {
  id: string;
  name: string | null;
  avatar_url: string | null;
  role: string;
  also_sells: boolean | null;
  is_active: boolean | null;
};

type LeadLite = {
  id: string;
  client_id: string;
  assigned_to_id: string | null;
  contact_id: string | null;
  source: string | null;
  status: string;
  form_data: Record<string, unknown> | null;
  name: string | null;
  phone: string | null;
  email: string | null;
  budget: string | null;
  project_type: string | null;
  timeline: string | null;
  not_qualified_reason: string | null;
  follow_up_date: string | null;
  created_at: string;
  score: number | null;
  score_breakdown: Record<string, number> | null;
  customer_need: string | null;
  decision_maker_status: string | null;
  buying_timeframe: string | null;
  active_deal_id: string | null;
  convert_later_note: string | null;
  is_archived: boolean | null;
  deal_side: string | null;
  linked_listing_id: string | null;
  offer_status: string | null;
};

const LEAD_SELECT =
  "id, client_id, assigned_to_id, contact_id, source, status, form_data, name, phone, email, budget, project_type, timeline, not_qualified_reason, follow_up_date, created_at, score, score_breakdown, customer_need, decision_maker_status, buying_timeframe, active_deal_id, convert_later_note, is_archived, deal_side, linked_listing_id, offer_status";

function enquiryContext(lead: LeadLite): string | null {
  const project = lead.project_type?.trim() || null;
  const company = companyFromFormData(lead.form_data);
  const identity = leadCardDisplayName(lead);
  if (company && company.toLowerCase() !== identity.toLowerCase()) return company;
  return project;
}

function mapRow(opts: {
  lead: LeadLite;
  owner: TeamUser | undefined;
  firstContactAt: string | null;
  lastActivityAt: string | null;
  actorUserId: string;
  canModifyAnyOwned: boolean;
  isSuperAdmin: boolean;
  now: Date;
}): CompanyLeadRow {
  const { lead, owner, now } = opts;
  const source = sourceOptionFromRaw(lead.source);
  const score = lead.score;
  const canModify =
    opts.isSuperAdmin ||
    (opts.canModifyAnyOwned && lead.assigned_to_id === opts.actorUserId);
  const identity = leadCardDisplayName(lead);
  const hasDeal = companyLeadHasDeal({
    status: lead.status,
    activeDealId: lead.active_deal_id,
  });
  const dbStatus = lead.status as LeadStatus;
  const lifecycle =
    dbStatus === "NEW" && opts.firstContactAt ? ("CONTACTED" as LeadStatus) : dbStatus;

  return {
    id: lead.id,
    identity,
    enquiryContext: enquiryContext(lead),
    location: locationFromFormData(lead.form_data),
    sourceKey: source.key,
    sourceLabel: source.label,
    sourceRaw: lead.source,
    phone: lead.phone?.trim() || null,
    email: lead.email?.trim() || null,
    lifecycle,
    lifecycleLabel: companyLeadLifecycleLabel(lifecycle),
    leadScore: score,
    intent: leadScoreBand(score),
    intentLabel: intentLabelForScore(score),
    ownerId: lead.assigned_to_id,
    ownerName: owner?.name?.trim() || null,
    ownerAvatarUrl: owner?.avatar_url ?? null,
    createdAt: lead.created_at,
    createdLabel: formatCompanyLeadCreatedAt(lead.created_at, now),
    firstContactAt: opts.firstContactAt,
    lastActivityAt: opts.lastActivityAt,
    followUpAt: lead.follow_up_date,
    nextAction: formatLeadNextActionView(lead.follow_up_date, {
      label: lead.convert_later_note,
      now,
    }),
    hasDeal,
    activeDealId: lead.active_deal_id,
    contactId: lead.contact_id,
    customerWaiting: false,
    canModify,
    dealSide: lead.deal_side,
  };
}

async function enrichRealEstateLeadRows(opts: {
  supabase: ReturnType<typeof createAdminClient>;
  clientId: string;
  leads: LeadLite[];
  rows: CompanyLeadRow[];
}): Promise<void> {
  const { supabase, clientId, leads, rows } = opts;
  const contactIds = [...new Set(leads.map((l) => l.contact_id).filter(Boolean))] as string[];
  const listingIds = [...new Set(leads.map((l) => l.linked_listing_id).filter(Boolean))] as string[];

  const { data: listingStock } = await supabase
    .from("listings")
    .select("id, address, suburb, client_id")
    .eq("client_id", clientId);
  const allListingIds = (listingStock ?? []).map((l) => l.id as string);

  const [{ data: contacts }, { data: linkedListings }, { data: viewings }] = await Promise.all([
    contactIds.length
      ? supabase
          .from("contacts")
          .select(
            "id, buyer_budget_min, buyer_budget_max, buyer_bedrooms_wanted, buyer_area_preference, interested_listing_ids"
          )
          .eq("client_id", clientId)
          .in("id", contactIds)
      : Promise.resolve({ data: [] as Array<Record<string, unknown>> }),
    listingIds.length
      ? supabase
          .from("listings")
          .select("id, address, suburb")
          .eq("client_id", clientId)
          .in("id", listingIds)
      : Promise.resolve({ data: [] as Array<Record<string, unknown>> }),
    allListingIds.length && contactIds.length
      ? supabase
          .from("viewings")
          .select("contact_id, scheduled_at, status")
          .in("contact_id", contactIds)
          .in("listing_id", allListingIds)
          .eq("status", "scheduled")
          .gte("scheduled_at", new Date().toISOString())
          .order("scheduled_at", { ascending: true })
      : Promise.resolve({ data: [] as Array<Record<string, unknown>> }),
  ]);

  const contactById = new Map((contacts ?? []).map((c) => [c.id as string, c]));
  const listingById = new Map((linkedListings ?? []).map((l) => [l.id as string, l]));
  const nextViewingByContact = new Map<string, string>();
  for (const v of viewings ?? []) {
    const cid = v.contact_id as string;
    if (!nextViewingByContact.has(cid)) nextViewingByContact.set(cid, v.scheduled_at as string);
  }
  const completedContactIds = new Set<string>();
  if (allListingIds.length && contactIds.length) {
    const { data: completed } = await supabase
      .from("viewings")
      .select("contact_id")
      .in("contact_id", contactIds)
      .in("listing_id", allListingIds)
      .eq("status", "completed")
      .limit(500);
    for (const v of completed ?? []) completedContactIds.add(v.contact_id as string);
  }

  const rowById = new Map(rows.map((r) => [r.id, r]));
  for (const lead of leads) {
    const row = rowById.get(lead.id);
    if (!row) continue;
    const contact = lead.contact_id ? contactById.get(lead.contact_id) : undefined;
    const interested = Array.isArray(contact?.interested_listing_ids)
      ? (contact!.interested_listing_ids as unknown[]).length > 0
      : false;
    const stage = resolveRePipelineStage({
      leadStatus: lead.status,
      offerStatus: lead.offer_status,
      hasInterestedListing: interested,
      hasLinkedListing: Boolean(lead.linked_listing_id),
      hasUpcomingViewing: Boolean(lead.contact_id && nextViewingByContact.has(lead.contact_id)),
      hasCompletedViewing: Boolean(lead.contact_id && completedContactIds.has(lead.contact_id)),
      markedInterested: markedInterestedFromFormData(lead.form_data),
    });
    const linked = lead.linked_listing_id ? listingById.get(lead.linked_listing_id) : undefined;
    row.reStage = stage;
    row.reStageLabel = rePipelineStageLabel(stage);
    row.requirementSummary = contact
      ? formatRequirementSummary({
          buyer_budget_min: contact.buyer_budget_min as number | null,
          buyer_budget_max: contact.buyer_budget_max as number | null,
          buyer_bedrooms_wanted: contact.buyer_bedrooms_wanted as number | null,
          buyer_area_preference: contact.buyer_area_preference as string | null,
        })
      : null;
    row.budgetLabel = contact
      ? formatBudgetRange(
          contact.buyer_budget_min as number | null,
          contact.buyer_budget_max as number | null
        )
      : null;
    row.linkedListingLabel = linked
      ? listingLabel({
          address: linked.address as string | null,
          suburb: linked.suburb as string | null,
        })
      : null;
    const viewingAt = lead.contact_id ? nextViewingByContact.get(lead.contact_id) : undefined;
    if (viewingAt && !row.nextAction.hasNextAction) {
      const when = new Date(viewingAt);
      row.nextAction = {
        ...row.nextAction,
        hasNextAction: true,
        label: "Viewing",
        at: viewingAt,
        whenLabel: when.toLocaleString("en-GB", {
          weekday: "short",
          hour: "2-digit",
          minute: "2-digit",
        }),
        urgency: "soon",
        completable: false,
      };
    }
  }
}

export async function getCompanyLeadsPageData(opts: {
  clientId: string;
  actor: {
    userId: string;
    role: UserRole;
    clientId?: string | null;
    alsoSells?: boolean | null;
  };
}): Promise<CompanyLeadsPageData> {
  const { clientId, actor } = opts;
  const now = new Date();
  const { period30Start, period60Start } = periodBounds(now);
  const supabase = createAdminClient();
  const alsoSells = canActAsSalesperson(actor);
  const canReassign = canReassignLeads(actor, clientId);
  const isSuperAdmin = actor.role === "SUPER_ADMIN";

  const [clientRes, teamRes, leadsRes] = await Promise.all([
    supabase.from("clients").select("id, name, business_type").eq("id", clientId).maybeSingle(),
    supabase
      .from("users")
      .select("id, name, avatar_url, role, also_sells, is_active")
      .eq("client_id", clientId)
      .in("role", ["SALESPERSON", "CLIENT_MANAGER"])
      .order("name", { ascending: true }),
    supabase
      .from("leads")
      .select(LEAD_SELECT)
      .eq("client_id", clientId)
      .or("is_archived.is.null,is_archived.eq.false")
      .order("created_at", { ascending: false })
      .limit(COMPANY_LEADS_CAP),
  ]);

  const team = (teamRes.data ?? []) as TeamUser[];
  const teamById = new Map(team.map((u) => [u.id, u]));
  const clientName = (clientRes.data?.name as string) ?? "Company";
  const businessType = normalizeBusinessType(
    (clientRes.data as { business_type?: string } | null)?.business_type
  );
  const leads = ((leadsRes.data ?? []) as LeadLite[]).filter(Boolean);

  const ids = leads.map((l) => l.id);
  const signals = await loadResponseSignals(ids);

  const rows = leads.map((lead) => {
    const firstContactAt = deriveFirstRespondedAt(
      signals.eventsByLead.get(lead.id) ?? [],
      signals.callAtsByLead.get(lead.id) ?? [],
      signals.outboundWaByLead.get(lead.id) ?? []
    );
    const lastActivityAt = deriveLastMeaningfulActivityAt(
      signals.eventsByLead.get(lead.id) ?? [],
      signals.callAtsByLead.get(lead.id) ?? [],
      signals.outboundWaByLead.get(lead.id) ?? []
    );
    return mapRow({
      lead,
      owner: lead.assigned_to_id ? teamById.get(lead.assigned_to_id) : undefined,
      firstContactAt,
      lastActivityAt,
      actorUserId: actor.userId,
      canModifyAnyOwned: alsoSells,
      isSuperAdmin,
      now,
    });
  });

  if (isRealEstate(businessType)) {
    await enrichRealEstateLeadRows({ supabase, clientId, leads, rows });
  }

  const last30 = leads.filter((l) => inPeriod(l.created_at, period30Start));
  const prev30 = leads.filter((l) => inPeriod(l.created_at, period60Start, period30Start));

  const contactedIn = (cohort: LeadLite[]) =>
    cohort.filter((l) => {
      const first = deriveFirstRespondedAt(
        signals.eventsByLead.get(l.id) ?? [],
        signals.callAtsByLead.get(l.id) ?? [],
        signals.outboundWaByLead.get(l.id) ?? []
      );
      return Boolean(first);
    }).length;

  const qualifiedIn = (cohort: LeadLite[]) =>
    cohort.filter((l) => QUALIFIED_LEAD_STATUSES.has(l.status)).length;

  const convertedIn = (cohort: LeadLite[]) =>
    cohort.filter((l) =>
      companyLeadHasDeal({ status: l.status, activeDealId: l.active_deal_id })
    ).length;

  const hotOpen = leads.filter(
    (l) => l.status !== "NOT_QUALIFIED" && isHotIntent(l.score)
  ).length;

  const conv = conversionRate(convertedIn(last30), last30.length);
  const convPrev = conversionRate(convertedIn(prev30), prev30.length);

  const avgResponseMinutes = firstQualifyingResponseMinutes(last30, signals);
  const avgResponseMinutesPrev = firstQualifyingResponseMinutes(prev30, signals);

  const kpis = buildCompanyLeadsKpis({
    newLeads: last30.length,
    newLeadsPrev: prev30.length,
    hotLeads: hotOpen,
    // Hot Leads is an operational stock count. Without historical score
    // snapshots, comparing it with a prior acquisition cohort is misleading.
    hotLeadsPrev: null,
    contacted: contactedIn(last30),
    contactedPrev: contactedIn(prev30),
    qualified: qualifiedIn(last30),
    qualifiedPrev: qualifiedIn(prev30),
    conversionPct: conv,
    conversionPrev: convPrev,
    avgResponseMinutes,
    avgResponseMinutesPrev,
  });

  const owners: CompanyLeadsOwnerOption[] = team
    .filter((u) => u.is_active !== false && (u.role === "SALESPERSON" || u.also_sells))
    .map((u) => ({
      id: u.id,
      name: u.name?.trim() || "Team member",
      avatarUrl: u.avatar_url,
    }));

  const sourceMap = new Map<string, string>();
  for (const row of rows) {
    if (row.sourceKey && row.sourceLabel) sourceMap.set(row.sourceKey, row.sourceLabel);
  }
  const sources: CompanyLeadsSourceOption[] = [...sourceMap.entries()]
    .map(([key, label]) => ({ key, label }))
    .sort((a, b) => a.label.localeCompare(b.label));

  return {
    clientId,
    clientName,
    businessType,
    actorUserId: actor.userId,
    alsoSells,
    canReassign,
    canAddLead: true,
    kpis,
    rows,
    tabCounts: countCompanyLeadsTabs(rows),
    owners,
    sources,
  };
}

export async function getCompanyLeadDetail(opts: {
  clientId: string;
  leadId: string;
  actor: {
    userId: string;
    role: UserRole;
    clientId?: string | null;
    alsoSells?: boolean | null;
  };
}): Promise<CompanyLeadDetail | null> {
  const supabase = createAdminClient();
  const { data: lead } = await supabase
    .from("leads")
    .select("*")
    .eq("id", opts.leadId)
    .eq("client_id", opts.clientId)
    .maybeSingle();
  if (!lead) return null;
  if (lead.is_archived === true) return null;

  const leadLite = lead as LeadLite;
  const leadRow = lead as LeadRow;
  const alsoSells = canActAsSalesperson(opts.actor);
  const isSuperAdmin = opts.actor.role === "SUPER_ADMIN";
  const canReassign = canReassignLeads(opts.actor, opts.clientId);
  const canModify =
    isSuperAdmin || (alsoSells && leadLite.assigned_to_id === opts.actor.userId);
  const hasDeal = companyLeadHasDeal({
    status: leadLite.status,
    activeDealId: leadLite.active_deal_id,
  });
  const canCreateDeal =
    canModify && !hasDeal && leadLite.status !== "NOT_QUALIFIED";

  const [ownerRes, signals, waRes, dealRes] = await Promise.all([
    leadLite.assigned_to_id
      ? supabase
          .from("users")
          .select("id, name, avatar_url")
          .eq("id", leadLite.assigned_to_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    loadResponseSignals([leadLite.id]),
    supabase
      .from("whatsapp_messages")
      .select("direction, created_at")
      .eq("lead_id", leadLite.id)
      .order("created_at", { ascending: false })
      .limit(8),
    leadLite.active_deal_id
      ? supabase.from("deals").select("*").eq("id", leadLite.active_deal_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const firstContactAt = deriveFirstRespondedAt(
    signals.eventsByLead.get(leadLite.id) ?? [],
    signals.callAtsByLead.get(leadLite.id) ?? [],
    signals.outboundWaByLead.get(leadLite.id) ?? []
  );
  const waRows = (waRes.data ?? []) as Array<{ direction: string; created_at: string }>;
  const waAts = waRows.map((m) => m.created_at);
  const lastActivityAt = deriveLastMeaningfulActivityAt(
    signals.eventsByLead.get(leadLite.id) ?? [],
    signals.callAtsByLead.get(leadLite.id) ?? [],
    waAts.length ? waAts : signals.outboundWaByLead.get(leadLite.id) ?? []
  );

  const latestWa = waRows[0];
  const customerWaiting = Boolean(latestWa && latestWa.direction === "inbound");

  const phone = leadLite.phone?.trim() || null;
  const email = leadLite.email?.trim() || null;
  const digits = phone ? phone.replace(/[^\d]/g, "") : "";
  const isWa = String(leadLite.source ?? "").toUpperCase().includes("WHATSAPP");
  const whatsappHref = isWa
    ? `/client/inbox?lead=${leadLite.id}`
    : digits
      ? `https://wa.me/${digits}`
      : `/client/inbox?lead=${leadLite.id}`;
  const source = sourceOptionFromRaw(leadLite.source);
  const owner = ownerRes.data as { id: string; name: string | null; avatar_url: string | null } | null;
  const score = leadLite.score;
  const identity = leadCardDisplayName(leadLite);

  let relatedDeal: CompanyLeadRelatedDeal | null = null;
  if (dealRes.data) {
    const deal = dealRes.data as DealRow;
    const commercial = getDealCommercialValue(deal, { latestQuoteTotal: null });
    relatedDeal = {
      id: deal.id,
      name: deal.name?.trim() || "Deal",
      stage: deal.stage,
      stageLabel: DEAL_STAGE_LABEL[deal.stage] ?? deal.stage,
      valueLabel:
        commercial.kind === "pending" ? "Value not estimated" : commercial.display,
    };
  }

  const nextAction = formatLeadNextActionView(leadLite.follow_up_date, {
    label: leadLite.convert_later_note,
    customerWaiting,
  });

  const dbStatus = leadLite.status as LeadStatus;
  const lifecycle =
    dbStatus === "NEW" && firstContactAt ? ("CONTACTED" as LeadStatus) : dbStatus;

  return {
    id: leadLite.id,
    identity,
    enquiryContext: enquiryContext(leadLite),
    location: locationFromFormData(leadLite.form_data),
    lifecycle,
    lifecycleLabel: companyLeadLifecycleLabel(lifecycle),
    notQualifiedReason: leadLite.not_qualified_reason,
    phone,
    email,
    telHref: phone ? `tel:${phone}` : null,
    mailtoHref: email ? `mailto:${email}` : null,
    whatsappHref,
    canCall: Boolean(phone),
    canWhatsApp: Boolean(isWa || digits),
    canEmail: Boolean(email),
    leadScore: score,
    intent: leadScoreBand(score),
    intentLabel: intentLabelForScore(score),
    scoreSignals: companyLeadScoreSignals({
      scoreBreakdown: leadLite.score_breakdown,
      source: leadLite.source,
      budget: leadLite.budget,
      customerNeed: leadLite.customer_need,
      buyingTimeframe: leadLite.buying_timeframe ?? leadLite.timeline,
      decisionMakerStatus: leadLite.decision_maker_status,
      projectType: leadLite.project_type,
      status: leadLite.status,
    }),
    sourceKey: source.key,
    sourceLabel: source.label,
    ownerId: leadLite.assigned_to_id,
    ownerName: owner?.name?.trim() || null,
    ownerAvatarUrl: owner?.avatar_url ?? null,
    firstContactAt,
    firstContactLabel: formatCompanyLeadActivityAt(firstContactAt),
    lastActivityAt,
    lastActivityLabel: formatLastActivityLabel(lastActivityAt),
    customerNeed: customerNeedFromLead({
      customerNeed: leadLite.customer_need,
      formData: leadLite.form_data,
      projectType: leadLite.project_type,
    }),
    nextAction,
    customerWaiting,
    hasDeal,
    relatedDeal,
    canModify,
    canReassign,
    canCreateDeal,
    viewDetailsHref: leadLite.contact_id ? `/client/contacts/${leadLite.contact_id}` : null,
    openDealHref: relatedDeal ? `/client/deals/${relatedDeal.id}` : null,
    leadForDeal: canCreateDeal ? leadRow : null,
  };
}

export function moneyLabel(n: number | null | undefined, currency = "USD"): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return formatDealCurrency(n, { currency });
}
