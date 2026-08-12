/**
 * Company / Manager Sales Dashboard aggregator.
 * Company-scoped (client_id) — NOT filtered to the logged-in manager as Deal owner.
 * Reuses getDealCommercialValue, getDealAttentionState, firstQualifyingResponseMinutes, goals.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { ROUND_ROBIN_ELIGIBLE_OR } from "@/lib/auth/sales-capabilities";
import { firstQualifyingResponseMinutes } from "@/lib/sales/intelligence/meaningful-activity";
import { reasonText } from "@/lib/sales/intelligence/reasons";
import type { SalesActionReasonCode } from "@/lib/sales/intelligence/types";
import {
  DEAL_ACTIVE_STAGES,
  DEAL_STAGE_ACCENT,
  DEAL_STAGE_LABEL,
  getDealAttentionState,
  getDealCommercialValue,
  getDealNextActionState,
  latestQuoteTotal,
  type DealActiveStage,
} from "@/lib/sales/deals";
import { calcProgress } from "@/lib/sales/goals/progress";
import { goalPeriodBounds, parseGoalPeriodKey } from "@/lib/sales/goals/period";
import {
  formatDealValue,
  formatResponseTime,
  formatTrend,
} from "@/lib/sales/sales-dashboard-display";
import { timeAgo } from "@/lib/sales-priority-lead";
import { leadJoinName } from "@/lib/format";
import type { DealRow, QuotationRow } from "@/types";
import type { SalesFunnelStage, SalesKpiItem, SalesPipelineSnapshotStage } from "@/components/dashboard/sales/types";
import type {
  CompanyActivityItem,
  CompanyAtRiskDeal,
  CompanyFocusSignal,
  CompanyLeadSourceItem,
  CompanyRevenuePoint,
  CompanyTeamMemberRow,
  CompanySalesDashboardData,
} from "@/components/dashboard/company/types";

const QUALIFIED_LEAD_STATUSES = new Set([
  "QUALIFIED",
  "CONVERTED_TO_DEAL",
  "PROPOSAL_SENT",
  "NEGOTIATING",
  "WON",
]);

const CONTACTED_OR_BEYOND = new Set([
  "CONTACTED",
  "QUALIFIED",
  "CONVERTED_TO_DEAL",
  "PROPOSAL_SENT",
  "NEGOTIATING",
  "WON",
  "LOST",
]);

const TEAM_PREVIEW_LIMIT = 5;
const AT_RISK_PREVIEW_LIMIT = 5;
const ACTIVITY_LIMIT = 8;
const HOT_SCORE_THRESHOLD = 70;

function startOfLocalDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function startOfLocalMonth(d: Date): Date {
  const x = new Date(d);
  x.setDate(1);
  x.setHours(0, 0, 0, 0);
  return x;
}

function daysAgo(d: Date, n: number): Date {
  const x = startOfLocalDay(d);
  x.setDate(x.getDate() - n);
  return x;
}

function moneyLabel(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return formatDealValue(n);
}

function commercialAmount(
  deal: DealRow,
  quoteTotal: number | null
): { known: number; pending: boolean } {
  const v = getDealCommercialValue(deal, { latestQuoteTotal: quoteTotal });
  if (v.kind === "pending") return { known: 0, pending: true };
  if (v.kind === "amount") return { known: v.amount, pending: false };
  return { known: (v.min + v.max) / 2, pending: false };
}

function trendVs(
  current: number,
  previous: number,
  vs: string,
  opts?: { invertGood?: boolean }
): SalesKpiItem["trend"] | undefined {
  const t = formatTrend(current, previous);
  if (t.direction === "none") return undefined;
  if (t.direction === "flat") return { label: `${t.label} ${vs}`.trim(), direction: "flat" };
  if (t.direction === "new") return { label: `${t.label} ${vs}`.trim(), direction: "up" };

  if (opts?.invertGood) {
    // Lower response time is better: treat "down" as positive (up/green).
    if (t.direction === "down") {
      return { label: `${t.label} faster ${vs}`.trim(), direction: "up" };
    }
    return { label: `${t.label} slower ${vs}`.trim(), direction: "down" };
  }

  if (t.direction === "up") return { label: `${t.label} ${vs}`, direction: "up" };
  return { label: `${t.label} ${vs}`, direction: "down" };
}

function normalizeSourceKey(raw: string | null | undefined): {
  key: string;
  label: string;
  brand: CompanyLeadSourceItem["brand"];
} {
  const s = String(raw ?? "").toUpperCase();
  if (s.includes("WHATSAPP")) return { key: "whatsapp", label: "WhatsApp", brand: "whatsapp" };
  if (s.includes("FACEBOOK") || s === "FB" || s.includes("META"))
    return { key: "facebook", label: "Facebook Ads", brand: "facebook" };
  if (s.includes("REFERRAL")) return { key: "referral", label: "Referrals", brand: "referral" };
  if (s.includes("LANDING") || s.includes("WEBSITE") || s.includes("PROFILE") || s === "WEB")
    return { key: "website", label: "Website", brand: "website" };
  if (s.includes("WALK")) return { key: "walkin", label: "Walk-in", brand: "walkin" };
  if (s.includes("MANUAL") || s.includes("OUTBOUND"))
    return { key: "other", label: "Manual / Outbound", brand: "other" };
  if (!s) return { key: "other", label: "Other", brand: "other" };
  return { key: s.toLowerCase(), label: s.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()), brand: "other" };
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ""}${parts[parts.length - 1]![0] ?? ""}`.toUpperCase();
}

function roleLabel(role: string, alsoSells: boolean | null | undefined): string {
  if (role === "CLIENT_MANAGER") {
    return alsoSells ? "Company Manager · Also sells" : "Company Manager";
  }
  return "Sales Executive";
}

function dealHref(deal: DealRow, alsoSells: boolean): string {
  if (alsoSells) return `/sales/deals/${deal.id}`;
  return `/client/leads/pipeline?lead=${deal.originating_lead_id}`;
}

function activityTitle(
  eventType: string,
  actorName: string | null,
  subjectName: string,
  eventData: Record<string, unknown> | null
): { kind: CompanyActivityItem["kind"]; title: string; detail: string | null } {
  const who = actorName?.trim() || "Team member";
  switch (eventType) {
    case "DEAL_WON": {
      const value = eventData?.won_value ?? eventData?.deal_value;
      const valueLabel =
        value != null && Number(value) > 0 ? moneyLabel(Number(value)) : null;
      return {
        kind: "won",
        title: valueLabel
          ? `${who} won a Deal worth ${valueLabel}`
          : `${who} won a Deal — ${subjectName}`,
        detail: subjectName,
      };
    }
    case "DEAL_CREATED":
      return { kind: "deal", title: `${who} created a Deal`, detail: subjectName };
    case "DEAL_LOST":
      return { kind: "other", title: `${who} marked a Deal lost`, detail: subjectName };
    case "DEAL_STAGE_CHANGED": {
      const to = String(eventData?.to_stage ?? "").replace(/_/g, " ");
      const stageLabel = to
        ? to.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())
        : "next stage";
      return {
        kind: "deal",
        title: `${who} moved a Deal to ${stageLabel}`,
        detail: subjectName,
      };
    }
    case "QUOTE_SENT":
    case "DOCUMENT_SENT":
      return {
        kind: "quote",
        title: `${who} sent a Quote`,
        detail: subjectName,
      };
    case "FOLLOW_UP_COMPLETED":
      return {
        kind: "call",
        title: `${who} completed a follow-up`,
        detail: subjectName,
      };
    case "LEAD_ASSIGNED":
    case "ASSIGNED":
      return {
        kind: "lead",
        title: `${who} was assigned a Lead`,
        detail: subjectName,
      };
    case "CALL_LOGGED":
      return {
        kind: "call",
        title: `${who} logged a call`,
        detail: subjectName,
      };
    default:
      return {
        kind: "other",
        title: eventType
          .replace(/_/g, " ")
          .toLowerCase()
          .replace(/\b\w/g, (c) => c.toUpperCase()),
        detail: `${who} · ${subjectName}`,
      };
  }
}

function buildFocusSignals(opts: {
  overdueFollowUps: number;
  dealsAtRisk: number;
  hotAwaitingContact: number;
  noNextAction: number;
  unassigned: number;
  awaitingEstimate: number;
  hasTeam: boolean;
  hasLeads: boolean;
  hasDeals: boolean;
}): CompanyFocusSignal[] {
  if (!opts.hasTeam && !opts.hasLeads && !opts.hasDeals) {
    return [
      {
        id: "onboarding",
        severity: "info",
        count: 0,
        label: "Start building your sales operation",
        supporting: "Add your team, capture Leads and create Deals when opportunities are qualified.",
        href: "/client/team",
        ctaLabel: "Add team member",
      },
    ];
  }

  const candidates: Array<CompanyFocusSignal & { rank: number }> = [];

  if (opts.overdueFollowUps > 0) {
    candidates.push({
      id: "overdue-followups",
      severity: "critical",
      count: opts.overdueFollowUps,
      label: "Overdue follow-ups",
      supporting: "Follow-ups are past due.",
      href: "/client/leads?filter=follow_up",
      rank: 100 + opts.overdueFollowUps,
    });
  }
  if (opts.dealsAtRisk > 0) {
    candidates.push({
      id: "deals-at-risk",
      severity: "high",
      count: opts.dealsAtRisk,
      label: "Deals at risk",
      supporting: "Active Deals need attention.",
      href: "/client/leads/pipeline",
      rank: 90 + opts.dealsAtRisk,
    });
  }
  if (opts.hotAwaitingContact > 0) {
    candidates.push({
      id: "hot-enquiries",
      severity: "high",
      count: opts.hotAwaitingContact,
      label: "Hot enquiries",
      supporting: "New high-intent Leads awaiting contact.",
      href: "/client/leads?status=NEW",
      rank: 85 + opts.hotAwaitingContact,
    });
  }
  if (opts.noNextAction > 0) {
    candidates.push({
      id: "no-next-action",
      severity: "medium",
      count: opts.noNextAction,
      label: "Deals with no next action",
      supporting: "Active Deals need a scheduled next step.",
      href: "/client/leads/pipeline",
      rank: 70 + opts.noNextAction,
    });
  }
  if (opts.unassigned > 0) {
    candidates.push({
      id: "unassigned",
      severity: "medium",
      count: opts.unassigned,
      label: "Unassigned enquiries",
      supporting: "New Leads waiting for ownership.",
      href: "/client/leads?unassigned=1",
      rank: 75 + opts.unassigned,
    });
  }
  if (opts.awaitingEstimate > 0) {
    candidates.push({
      id: "awaiting-estimate",
      severity: "info",
      count: opts.awaitingEstimate,
      label: "Deals awaiting estimate",
      supporting: "Pipeline value is incomplete without estimates.",
      href: "/client/leads/pipeline",
      rank: 40 + opts.awaitingEstimate,
    });
  }

  candidates.sort((a, b) => b.rank - a.rank);
  return candidates.slice(0, 3).map((c) => ({
    id: c.id,
    severity: c.severity,
    count: c.count,
    label: c.label,
    supporting: c.supporting,
    href: c.href,
    ...(c.ctaLabel ? { ctaLabel: c.ctaLabel } : {}),
  }));
}

function buildCompanyKpis(opts: {
  newEnquiries: number;
  newEnquiriesPrev: number;
  qualifiedLeads: number;
  qualifiedLeadsPrev: number;
  activeDeals: number;
  pipelineKnown: number;
  awaitingEstimate: number;
  dealsWon: number;
  dealsWonPrev: number;
  wonValue: number;
  avgResponseMinutes: number | null;
  avgResponseMinutesPrev: number | null;
}): SalesKpiItem[] {
  const pipelineSupporting =
    opts.awaitingEstimate > 0
      ? `${opts.awaitingEstimate} Deal${opts.awaitingEstimate === 1 ? "" : "s"} awaiting estimate`
      : "Active Deals only";

  const pipelineValue =
    opts.activeDeals > 0 && opts.pipelineKnown === 0 && opts.awaitingEstimate > 0
      ? "—"
      : moneyLabel(opts.pipelineKnown);

  const responseTrend =
    opts.avgResponseMinutes != null && opts.avgResponseMinutesPrev != null
      ? trendVs(opts.avgResponseMinutes, opts.avgResponseMinutesPrev, "vs last 30 days", {
          invertGood: true,
        })
      : undefined;

  return [
    {
      id: "new-enquiries",
      label: "New enquiries",
      value: String(opts.newEnquiries),
      supporting: "Last 30 days",
      trend: trendVs(opts.newEnquiries, opts.newEnquiriesPrev, "vs last 30 days"),
      icon: "enquiries",
      href: "/client/leads",
    },
    {
      id: "qualified",
      label: "Qualified Leads",
      value: String(opts.qualifiedLeads),
      supporting: "Last 30 days",
      trend: trendVs(opts.qualifiedLeads, opts.qualifiedLeadsPrev, "vs last 30 days"),
      icon: "conversion",
      href: "/client/leads?status=QUALIFIED",
    },
    {
      id: "active-deals",
      label: "Active Deals",
      value: String(opts.activeDeals),
      supporting: "In pipeline",
      icon: "deals",
      href: "/client/leads/pipeline",
    },
    {
      id: "pipeline",
      label: "Pipeline Value",
      value: pipelineValue,
      supporting: pipelineSupporting,
      icon: "pipeline",
      href: "/client/leads/pipeline",
    },
    {
      id: "won",
      label: "Deals Won",
      value: String(opts.dealsWon),
      supporting: opts.dealsWon === 0 ? "This month" : moneyLabel(opts.wonValue),
      trend: trendVs(opts.dealsWon, opts.dealsWonPrev, "vs last month"),
      icon: "won",
      href: "/client/reports",
    },
    {
      id: "response",
      label: "Team response time",
      value: formatResponseTime(opts.avgResponseMinutes),
      supporting: "Avg. first contact",
      trend: responseTrend,
      icon: "response",
      href: "/client/reports",
    },
  ];
}

function buildFunnel(opts: {
  leadsThisMonth: Array<{ status: string }>;
  deals: DealRow[];
  monthStart: Date;
}): SalesFunnelStage[] {
  const leads = opts.leadsThisMonth;
  const enquiries = leads.length;
  const contacted = leads.filter((l) => CONTACTED_OR_BEYOND.has(l.status)).length;
  const qualified = leads.filter((l) => QUALIFIED_LEAD_STATUSES.has(l.status)).length;
  const dealsCreated = opts.deals.filter((d) => new Date(d.created_at) >= opts.monthStart).length;
  const proposalSent = opts.deals.filter((d) =>
    ["PROPOSAL_SENT", "NEGOTIATING", "WON"].includes(d.stage)
  ).length;
  const won = opts.deals.filter(
    (d) => d.stage === "WON" && d.won_at && new Date(d.won_at) >= opts.monthStart
  ).length;

  return [
    { id: "enquiries", label: "Enquiries", count: enquiries, icon: "enquiries" },
    { id: "contacted", label: "Contacted", count: contacted, icon: "contacted" },
    { id: "qualified", label: "Qualified Leads", count: qualified, icon: "qualified" },
    { id: "deals", label: "Deals created", count: dealsCreated, icon: "deals" },
    { id: "proposal", label: "Proposal sent", count: proposalSent, icon: "proposal" },
    { id: "won", label: "Won", count: won, icon: "won" },
  ];
}

/**
 * Overall Lead → Won conversion for this month:
 * Won Deals this month / Enquiries created this month.
 * Period counts — not cohort conversion. Null when no enquiries.
 */
function overallConversion(enquiries: number, won: number): number | null {
  if (enquiries <= 0) return null;
  return Math.round((won / enquiries) * 1000) / 10;
}

export async function getCompanySalesDashboard(opts: {
  clientId: string;
  /** When true, Deal deep-links use /sales/deals; otherwise Customer Hub. */
  alsoSells?: boolean;
  now?: Date;
}): Promise<CompanySalesDashboardData> {
  const now = opts.now ?? new Date();
  const alsoSells = Boolean(opts.alsoSells);
  const clientId = opts.clientId;
  const supabase = createAdminClient();

  const monthStart = startOfLocalMonth(now);
  const prevMonthStart = new Date(monthStart);
  prevMonthStart.setMonth(prevMonthStart.getMonth() - 1);
  const period30Start = daysAgo(now, 30);
  const period60Start = daysAgo(now, 60);
  const revenueFrom = startOfLocalMonth(new Date(now.getFullYear(), now.getMonth() - 5, 1));
  const goalBounds = goalPeriodBounds(parseGoalPeriodKey(null, now));

  const [
    clientRes,
    teamRes,
    leadsRes,
    dealsRes,
    wonThisMonthRes,
    wonLastMonthRes,
    wonHistoryRes,
    goalsRes,
    eventsRes,
  ] = await Promise.all([
    supabase
      .from("clients")
      .select("id, name, assignment_mode, business_type, response_time_limit_hours")
      .eq("id", clientId)
      .maybeSingle(),
    supabase
      .from("users")
      .select("id, name, role, also_sells, avatar_url, is_active")
      .eq("client_id", clientId)
      .or(ROUND_ROBIN_ELIGIBLE_OR)
      .eq("is_active", true)
      .order("name", { ascending: true }),
    supabase
      .from("leads")
      .select(
        "id, name, status, source, score, created_at, assigned_to_id, follow_up_date"
      )
      .eq("client_id", clientId)
      .or("is_archived.is.null,is_archived.eq.false")
      .order("created_at", { ascending: false })
      .limit(5000),
    supabase
      .from("deals")
      .select("*")
      .eq("client_id", clientId)
      .order("updated_at", { ascending: false })
      .limit(2000),
    supabase
      .from("deals")
      .select("id, owner_id, won_value, won_at, name")
      .eq("client_id", clientId)
      .eq("stage", "WON")
      .gte("won_at", monthStart.toISOString()),
    supabase
      .from("deals")
      .select("id")
      .eq("client_id", clientId)
      .eq("stage", "WON")
      .gte("won_at", prevMonthStart.toISOString())
      .lt("won_at", monthStart.toISOString()),
    supabase
      .from("deals")
      .select("id, won_value, won_at")
      .eq("client_id", clientId)
      .eq("stage", "WON")
      .gte("won_at", revenueFrom.toISOString())
      .order("won_at", { ascending: true }),
    supabase
      .from("sales_goals")
      .select("id, salesperson_id, target_value, currency, status, period_start")
      .eq("client_id", clientId)
      .eq("goal_type", "REVENUE_WON")
      .eq("status", "ACTIVE")
      .eq("period_start", goalBounds.periodStartIso),
    supabase
      .from("lead_events")
      .select(
        "id, event_type, event_data, created_at, lead_id, deal_id, actor_id, leads(name)"
      )
      .eq("client_id", clientId)
      .in("event_type", [
        "DEAL_CREATED",
        "DEAL_WON",
        "DEAL_LOST",
        "DEAL_STAGE_CHANGED",
        "QUOTE_SENT",
        "DOCUMENT_SENT",
        "FOLLOW_UP_COMPLETED",
        "LEAD_ASSIGNED",
        "CALL_LOGGED",
      ])
      .order("created_at", { ascending: false })
      .limit(40),
  ]);

  type LeadRow = {
    id: string;
    name: string | null;
    status: string;
    source: string | null;
    score: number | null;
    created_at: string;
    assigned_to_id: string | null;
    follow_up_date: string | null;
  };

  type TeamUser = {
    id: string;
    name: string | null;
    role: string;
    also_sells: boolean | null;
    avatar_url: string | null;
  };

  const leads = (leadsRes.data ?? []) as LeadRow[];
  const deals = ((dealsRes.data ?? []) as DealRow[]).filter(Boolean);
  const team = (teamRes.data ?? []) as TeamUser[];
  const clientName = (clientRes.data?.name as string) ?? "Company";
  const assignmentMode = (clientRes.data?.assignment_mode as string) ?? "direct";

  const activeDeals = deals.filter((d) =>
    (DEAL_ACTIVE_STAGES as readonly string[]).includes(d.stage)
  );

  const dealIds = activeDeals.map((d) => d.id);
  const quotesRes =
    dealIds.length > 0
      ? await supabase
          .from("quotations")
          .select("id, deal_id, lead_id, total, status, sent_at, created_at, updated_at")
          .in("deal_id", dealIds)
      : { data: [] as unknown[] };

  const quotesByDeal = new Map<string, QuotationRow[]>();
  for (const q of (quotesRes.data ?? []) as QuotationRow[]) {
    if (!q.deal_id) continue;
    const list = quotesByDeal.get(q.deal_id) ?? [];
    list.push(q);
    quotesByDeal.set(q.deal_id, list);
  }
  const quoteTotalByDealId = new Map<string, number | null>();
  for (const [id, list] of quotesByDeal) {
    quoteTotalByDealId.set(id, latestQuoteTotal(list));
  }

  let pipelineKnown = 0;
  let awaitingEstimate = 0;
  for (const d of activeDeals) {
    const { known, pending } = commercialAmount(d, quoteTotalByDealId.get(d.id) ?? null);
    if (pending) awaitingEstimate += 1;
    else pipelineKnown += known;
  }

  // --- Period lead cohorts (last 30 / prior 30) ---
  const leadsLast30 = leads.filter((l) => new Date(l.created_at) >= period30Start);
  const leadsPrev30 = leads.filter((l) => {
    const t = new Date(l.created_at);
    return t >= period60Start && t < period30Start;
  });
  const leadsThisMonth = leads.filter((l) => new Date(l.created_at) >= monthStart);

  const qualifiedIn = (rows: LeadRow[]) =>
    rows.filter((l) => QUALIFIED_LEAD_STATUSES.has(l.status)).length;

  const wonRows = (wonThisMonthRes.data ?? []) as Array<{
    id: string;
    owner_id: string | null;
    won_value: number | null;
    won_at: string | null;
    name: string | null;
  }>;
  const wonValueThisMonth = wonRows.reduce((s, w) => s + (Number(w.won_value) || 0), 0);

  // --- Response time (last 30d enquiries) ---
  const responseLeadIds = leadsLast30.map((l) => l.id);
  const prevResponseLeadIds = leadsPrev30.map((l) => l.id);

  async function loadResponseSignals(ids: string[]) {
    if (ids.length === 0) {
      return {
        callAtsByLead: new Map<string, string[]>(),
        outboundWaByLead: new Map<string, string[]>(),
        eventsByLead: new Map<string, Array<{ event_type: string; created_at: string }>>(),
      };
    }
    const chunk = ids.slice(0, 1500);
    const empty = { data: [] as unknown[] };
    const [calls, wa, events] = await Promise.all([
      Promise.resolve(
        supabase
          .from("call_logs")
          .select("lead_id, created_at")
          .in("lead_id", chunk)
          .order("created_at", { ascending: true })
          .limit(4000)
      ).catch(() => empty),
      Promise.resolve(
        supabase
          .from("whatsapp_messages")
          .select("lead_id, direction, created_at")
          .in("lead_id", chunk)
          .eq("direction", "outbound")
          .order("created_at", { ascending: true })
          .limit(4000)
      ).catch(() => empty),
      Promise.resolve(
        supabase
          .from("lead_events")
          .select("lead_id, event_type, created_at")
          .in("lead_id", chunk)
          .in("event_type", ["CALL_LOGGED", "MESSAGE_SENT"])
          .order("created_at", { ascending: true })
          .limit(4000)
      ).catch(() => empty),
    ]);
    const callAtsByLead = new Map<string, string[]>();
    const outboundWaByLead = new Map<string, string[]>();
    const eventsByLead = new Map<string, Array<{ event_type: string; created_at: string }>>();
    for (const row of (calls.data ?? []) as Array<{ lead_id: string; created_at: string }>) {
      const list = callAtsByLead.get(row.lead_id) ?? [];
      list.push(row.created_at);
      callAtsByLead.set(row.lead_id, list);
    }
    for (const row of (wa.data ?? []) as Array<{ lead_id: string; created_at: string }>) {
      const list = outboundWaByLead.get(row.lead_id) ?? [];
      list.push(row.created_at);
      outboundWaByLead.set(row.lead_id, list);
    }
    for (const row of (events.data ?? []) as Array<{
      lead_id: string;
      event_type: string;
      created_at: string;
    }>) {
      const list = eventsByLead.get(row.lead_id) ?? [];
      list.push({ event_type: row.event_type, created_at: row.created_at });
      eventsByLead.set(row.lead_id, list);
    }
    return { callAtsByLead, outboundWaByLead, eventsByLead };
  }

  const [currSignals, prevSignals] = await Promise.all([
    loadResponseSignals(responseLeadIds),
    loadResponseSignals(prevResponseLeadIds),
  ]);

  const avgResponseMinutes = firstQualifyingResponseMinutes(leadsLast30, currSignals);
  const avgResponseMinutesPrev = firstQualifyingResponseMinutes(leadsPrev30, prevSignals);

  // --- Operational signals ---
  let overdueFollowUps = 0;
  for (const l of leads) {
    if (!l.follow_up_date) continue;
    if (["WON", "LOST", "NOT_QUALIFIED", "CONVERTED_TO_DEAL"].includes(l.status)) continue;
    if (new Date(l.follow_up_date) < now) overdueFollowUps += 1;
  }
  for (const d of activeDeals) {
    if (getDealNextActionState(d).isOverdue) overdueFollowUps += 1;
  }

  const hotAwaitingContact = leads.filter(
    (l) =>
      l.status === "NEW" &&
      ((l.score ?? 0) >= HOT_SCORE_THRESHOLD || String(l.source ?? "").includes("WHATSAPP"))
  ).length;

  const unassigned = leads.filter(
    (l) =>
      !l.assigned_to_id &&
      !["WON", "LOST", "NOT_QUALIFIED", "CONVERTED_TO_DEAL"].includes(l.status)
  ).length;

  // --- At-risk deals ---
  const atRiskItems: CompanyAtRiskDeal[] = [];
  let dealsAtRiskCount = 0;
  let noNextActionCount = 0;

  for (const deal of activeDeals) {
    const att = getDealAttentionState(deal, now);
    if (att.code === "NO_NEXT_ACTION") noNextActionCount += 1;
    if (!att.atRisk && !att.needsAttention) continue;
    if (att.atRisk || att.urgency >= 70) {
      dealsAtRiskCount += 1;
      const { known, pending } = commercialAmount(
        deal,
        quoteTotalByDealId.get(deal.id) ?? null
      );
      const owner = team.find((t) => t.id === deal.owner_id);
      atRiskItems.push({
        id: deal.id,
        dealId: deal.id,
        name: deal.name,
        valueLabel: pending ? "Value not estimated" : moneyLabel(known),
        knownValue: pending ? null : known,
        reason: att.reason || reasonText(att.code as SalesActionReasonCode),
        reasonCode: att.code,
        ownerName: owner?.name?.trim() || null,
        ownerId: deal.owner_id,
        stageLabel: DEAL_STAGE_LABEL[deal.stage as DealActiveStage] ?? deal.stage,
        urgency: att.urgency,
        href: dealHref(deal, alsoSells),
      });
    }
  }

  atRiskItems.sort(
    (a, b) =>
      b.urgency - a.urgency ||
      (b.knownValue ?? 0) - (a.knownValue ?? 0) ||
      a.name.localeCompare(b.name)
  );

  const focusAreas = buildFocusSignals({
    overdueFollowUps,
    dealsAtRisk: dealsAtRiskCount,
    hotAwaitingContact,
    noNextAction: noNextActionCount,
    unassigned: assignmentMode !== "direct" || unassigned > 0 ? unassigned : 0,
    awaitingEstimate,
    hasTeam: team.length > 0,
    hasLeads: leads.length > 0,
    hasDeals: deals.length > 0,
  });

  // --- Team performance (batched, no N+1) ---
  const goalsByUser = new Map<
    string,
    { target_value: number; currency: string | null }
  >();
  for (const g of (goalsRes.data ?? []) as Array<{
    salesperson_id: string;
    target_value: number;
    currency: string | null;
  }>) {
    goalsByUser.set(g.salesperson_id, {
      target_value: Number(g.target_value) || 0,
      currency: g.currency,
    });
  }

  const wonByOwner = new Map<string, { count: number; value: number }>();
  for (const w of wonRows) {
    if (!w.owner_id) continue;
    const cur = wonByOwner.get(w.owner_id) ?? { count: 0, value: 0 };
    cur.count += 1;
    cur.value += Number(w.won_value) || 0;
    wonByOwner.set(w.owner_id, cur);
  }

  const activeByOwner = new Map<string, DealRow[]>();
  for (const d of activeDeals) {
    if (!d.owner_id) continue;
    const list = activeByOwner.get(d.owner_id) ?? [];
    list.push(d);
    activeByOwner.set(d.owner_id, list);
  }

  const followUpsByOwner = new Map<string, number>();
  for (const l of leads) {
    if (!l.assigned_to_id || !l.follow_up_date) continue;
    if (["WON", "LOST", "NOT_QUALIFIED", "CONVERTED_TO_DEAL"].includes(l.status)) continue;
    if (new Date(l.follow_up_date) <= now) {
      followUpsByOwner.set(
        l.assigned_to_id,
        (followUpsByOwner.get(l.assigned_to_id) ?? 0) + 1
      );
    }
  }
  for (const d of activeDeals) {
    if (!d.owner_id) continue;
    const next = getDealNextActionState(d);
    if (!next.at) continue;
    const at = new Date(next.at);
    const dueOrOverdue = next.isOverdue || at <= now;
    if (dueOrOverdue) {
      followUpsByOwner.set(d.owner_id, (followUpsByOwner.get(d.owner_id) ?? 0) + 1);
    }
  }

  const teamRows: CompanyTeamMemberRow[] = team.map((member) => {
    const name = member.name?.trim() || "Unnamed";
    const owned = activeByOwner.get(member.id) ?? [];
    let pipelineValue = 0;
    let pending = 0;
    for (const d of owned) {
      const { known, pending: p } = commercialAmount(
        d,
        quoteTotalByDealId.get(d.id) ?? null
      );
      if (p) pending += 1;
      else pipelineValue += known;
    }
    const won = wonByOwner.get(member.id) ?? { count: 0, value: 0 };
    const goal = goalsByUser.get(member.id);
    const hasGoal = Boolean(goal && goal.target_value > 0);
    const progress = hasGoal
      ? calcProgress(won.value, goal!.target_value)
      : null;

    return {
      id: member.id,
      name,
      initials: initials(name),
      avatarUrl: member.avatar_url,
      roleLabel: roleLabel(member.role, member.also_sells),
      activeDeals: owned.length,
      pipelineValueKnown: pipelineValue,
      pipelineValueLabel:
        owned.length > 0 && pipelineValue === 0 && pending > 0
          ? "—"
          : moneyLabel(pipelineValue),
      pipelineAwaitingEstimate: pending,
      dealsWon: won.count,
      wonValue: won.value,
      followUpsDue: followUpsByOwner.get(member.id) ?? 0,
      hasGoal,
      goalProgressPct: progress?.ringPct ?? null,
      href: `/client/team`,
    };
  });

  // Sort: members needing attention (follow-ups) then won value; preview top N
  teamRows.sort((a, b) => {
    const aAttention = a.followUpsDue > 0 ? 1 : 0;
    const bAttention = b.followUpsDue > 0 ? 1 : 0;
    if (bAttention !== aAttention) return bAttention - aAttention;
    if (b.dealsWon !== a.dealsWon) return b.dealsWon - a.dealsWon;
    if (b.pipelineValueKnown !== a.pipelineValueKnown)
      return b.pipelineValueKnown - a.pipelineValueKnown;
    return a.name.localeCompare(b.name);
  });

  const teamPreview = teamRows.slice(0, TEAM_PREVIEW_LIMIT);

  // --- Funnel ---
  const funnel = buildFunnel({ leadsThisMonth, deals, monthStart });
  const conversionRate = overallConversion(
    funnel[0]?.count ?? 0,
    funnel.find((s) => s.id === "won")?.count ?? 0
  );

  // --- Sources (this month) ---
  const sourceMap = new Map<
    string,
    { label: string; brand: CompanyLeadSourceItem["brand"]; count: number }
  >();
  for (const l of leadsThisMonth) {
    const meta = normalizeSourceKey(l.source);
    const cur = sourceMap.get(meta.key) ?? {
      label: meta.label,
      brand: meta.brand,
      count: 0,
    };
    cur.count += 1;
    sourceMap.set(meta.key, cur);
  }
  const sourceTotal = leadsThisMonth.length;
  const sources: CompanyLeadSourceItem[] = [...sourceMap.entries()]
    .map(([id, v]) => ({
      id,
      label: v.label,
      count: v.count,
      pct: sourceTotal > 0 ? Math.round((v.count / sourceTotal) * 100) : 0,
      brand: v.brand,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);

  // --- Pipeline snapshot ---
  const pipelineSnapshot: SalesPipelineSnapshotStage[] = DEAL_ACTIVE_STAGES.map((stage) => {
    const stageDeals = activeDeals.filter((d) => d.stage === stage);
    let known = 0;
    let awaiting = 0;
    for (const d of stageDeals) {
      const { known: k, pending } = commercialAmount(
        d,
        quoteTotalByDealId.get(d.id) ?? null
      );
      if (pending) awaiting += 1;
      else known += k;
    }
    return {
      id: stage,
      label: DEAL_STAGE_LABEL[stage],
      color: DEAL_STAGE_ACCENT[stage],
      dealCount: stageDeals.length,
      valueLabel:
        stageDeals.length > 0 && known === 0 && awaiting > 0 ? "—" : moneyLabel(known),
      knownValue: known,
      awaitingEstimate: awaiting,
      href: `/client/leads/pipeline`,
    };
  });

  // --- Revenue trend (last 6 months, Won Deal value) ---
  const monthKeys: string[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    monthKeys.push(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
    );
  }
  const revenueByMonth = new Map<string, number>();
  for (const key of monthKeys) revenueByMonth.set(key, 0);

  for (const w of (wonHistoryRes.data ?? []) as Array<{
    won_value: number | null;
    won_at: string | null;
  }>) {
    if (!w.won_at) continue;
    const d = new Date(w.won_at);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    if (!revenueByMonth.has(key)) continue;
    revenueByMonth.set(key, (revenueByMonth.get(key) ?? 0) + (Number(w.won_value) || 0));
  }

  const revenueTrend: CompanyRevenuePoint[] = monthKeys.map((key) => {
    const [y, m] = key.split("-").map(Number);
    const label = new Date(y!, m! - 1, 1).toLocaleDateString("en-GB", {
      month: "short",
    });
    return { monthKey: key, label, value: revenueByMonth.get(key) ?? 0 };
  });

  const revenueTotal = revenueTrend.reduce((s, p) => s + p.value, 0);
  const hasRevenueHistory = revenueTotal > 0 || wonRows.length > 0;

  // Prior 6 months comparison
  const priorRevenueFrom = startOfLocalMonth(
    new Date(now.getFullYear(), now.getMonth() - 11, 1)
  );
  const priorRevenueTo = revenueFrom;
  let priorRevenueTotal = 0;
  if (hasRevenueHistory) {
    const { data: priorWins } = await supabase
      .from("deals")
      .select("won_value, won_at")
      .eq("client_id", clientId)
      .eq("stage", "WON")
      .gte("won_at", priorRevenueFrom.toISOString())
      .lt("won_at", priorRevenueTo.toISOString());
    for (const w of (priorWins ?? []) as Array<{ won_value: number | null }>) {
      priorRevenueTotal += Number(w.won_value) || 0;
    }
  }
  const revenueTrendCompare = hasRevenueHistory
    ? trendVs(revenueTotal, priorRevenueTotal, "vs previous 6 months")
    : undefined;

  // --- Recent team activity ---
  const actorIds = [
    ...new Set(
      ((eventsRes.data ?? []) as Array<{ actor_id: string | null }>)
        .map((e) => e.actor_id)
        .filter(Boolean) as string[]
    ),
  ];
  const actorNameById = new Map(team.map((t) => [t.id, t.name?.trim() || null]));
  if (actorIds.length > 0) {
    const missing = actorIds.filter((id) => !actorNameById.has(id));
    if (missing.length > 0) {
      const { data: actors } = await supabase
        .from("users")
        .select("id, name")
        .in("id", missing);
      for (const a of (actors ?? []) as Array<{ id: string; name: string | null }>) {
        actorNameById.set(a.id, a.name?.trim() || null);
      }
    }
  }

  const recentActivity: CompanyActivityItem[] = [];
  for (const ev of (eventsRes.data ?? []) as Array<{
    id: string;
    event_type: string;
    event_data: Record<string, unknown> | null;
    created_at: string;
    lead_id: string | null;
    deal_id: string | null;
    actor_id: string | null;
    leads: { name: string | null } | { name: string | null }[] | null;
  }>) {
    const subject = leadJoinName(ev.leads) ?? "Customer";
    const mapped = activityTitle(
      ev.event_type,
      actorNameById.get(ev.actor_id ?? "") ?? null,
      subject,
      ev.event_data
    );
    let href: string | undefined;
    if (ev.deal_id && alsoSells) href = `/sales/deals/${ev.deal_id}`;
    else if (ev.lead_id) href = `/client/leads/pipeline?lead=${ev.lead_id}`;

    recentActivity.push({
      id: ev.id,
      kind: mapped.kind,
      title: mapped.title,
      detail: mapped.detail,
      timeLabel: timeAgo(ev.created_at),
      href,
      actorName: actorNameById.get(ev.actor_id ?? "") ?? null,
    });
    if (recentActivity.length >= ACTIVITY_LIMIT) break;
  }

  const kpis = buildCompanyKpis({
    newEnquiries: leadsLast30.length,
    newEnquiriesPrev: leadsPrev30.length,
    qualifiedLeads: qualifiedIn(leadsLast30),
    qualifiedLeadsPrev: qualifiedIn(leadsPrev30),
    activeDeals: activeDeals.length,
    pipelineKnown,
    awaitingEstimate,
    dealsWon: wonRows.length,
    dealsWonPrev: (wonLastMonthRes.data ?? []).length,
    wonValue: wonValueThisMonth,
    avgResponseMinutes,
    avgResponseMinutesPrev,
  });

  return {
    clientId,
    clientName,
    alsoSells,
    generatedAt: now.toISOString(),
    kpis,
    focusAreas,
    focusAreasViewAllHref: "/client/leads",
    team: teamPreview,
    teamTotal: teamRows.length,
    teamViewAllHref: "/client/team",
    funnel,
    conversionRate,
    conversionDefinition: "Won Deals this month ÷ Enquiries created this month (period counts, not cohort).",
    sources,
    sourcesEmpty: sources.length === 0,
    pipelineSnapshot,
    hasActiveDeals: activeDeals.length > 0,
    atRiskDeals: atRiskItems.slice(0, AT_RISK_PREVIEW_LIMIT),
    atRiskTotal: dealsAtRiskCount,
    atRiskViewAllHref: "/client/leads/pipeline",
    revenueTrend,
    revenueTotal,
    revenueTotalLabel: moneyLabel(revenueTotal),
    revenueTrendCompare,
    hasRevenueHistory,
    recentActivity,
    emptyState: {
      noTeam: team.length === 0,
      noLeads: leads.length === 0,
      noDeals: deals.length === 0,
      isNewCompany: team.length === 0 && leads.length === 0 && deals.length === 0,
    },
    metrics: {
      newEnquiries30d: leadsLast30.length,
      qualifiedLeads30d: qualifiedIn(leadsLast30),
      activeDeals: activeDeals.length,
      pipelineValueKnown: pipelineKnown,
      pipelineAwaitingEstimate: awaitingEstimate,
      dealsWonThisMonth: wonRows.length,
      wonValueThisMonth,
      overdueFollowUps,
      dealsAtRisk: dealsAtRiskCount,
      hotAwaitingContact,
      noNextAction: noNextActionCount,
      unassignedLeads: unassigned,
      avgResponseMinutes,
    },
  };
}
