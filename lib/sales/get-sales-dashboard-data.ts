/**
 * Salesperson Dashboard aggregator.
 * Lead acquisition metrics stay lead-based; commercial pipeline uses Deals + getDealCommercialValue.
 * Priority / Today's Focus / plan progress come from fetchDailySalesPlan (one engine).
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { fetchSalespersonDashboardData } from "@/lib/dashboard-data";
import { fetchDailySalesPlan } from "@/lib/sales/intelligence/daily-plan-service";
import { reasonText } from "@/lib/sales/intelligence/reasons";
import { firstQualifyingResponseMinutes } from "@/lib/sales/intelligence/meaningful-activity";
import type {
  DailyCommitmentProgress,
  DailySalesPlanPayload,
  FocusModeResult,
  PipelineCoverageResult,
  SalesActionRecommendation,
  SalesActionReasonCode,
} from "@/lib/sales/intelligence/types";
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
import { formatDealValue, formatResponseTime, formatTrend } from "@/lib/sales/sales-dashboard-display";
import { timeAgo } from "@/lib/sales-priority-lead";
import { leadJoinName } from "@/lib/format";
import type { DealRow, QuotationRow } from "@/types";
import type { SalesDashboardRaw } from "@/lib/sales/sales-dashboard-view";
import type {
  SalesActivityItem,
  SalesDealAttentionItem,
  SalesEnquiryPriorityItem,
  SalesFunnelStage,
  SalesKpiItem,
  SalesPipelineSnapshotStage,
  SalesPlanSummary,
  SalesActivityTodayMetric,
} from "@/components/dashboard/sales/types";

const LEAD_ENQUIRY_ACTIONS = new Set([
  "CONTACT_NEW_LEAD",
  "RESPOND_TO_CUSTOMER",
]);

const LEAD_ENQUIRY_REASONS = new Set<SalesActionReasonCode>([
  "HIGH_INTENT_NEW_LEAD",
  "CUSTOMER_WAITING",
  "FOLLOWUP_DUE_TODAY",
  "FOLLOWUP_OVERDUE",
]);

const DEAL_WORK_ACTIONS = new Set([
  "COMPLETE_FOLLOW_UP",
  "FOLLOW_UP_QUOTE",
  "FOLLOW_UP_NEGOTIATION",
  "REENGAGE_STALE_DEAL",
  "COMPLETE_SCHEDULED_CALL",
  "COMPLETE_APPOINTMENT",
  "CREATE_QUOTE",
  "SCHEDULE_NEXT_ACTION",
]);

export type SalesDashboardCommercial = {
  newEnquiriesToday: number;
  newEnquiriesYesterday: number;
  activeDeals: number;
  pipelineValueKnown: number;
  pipelineAwaitingEstimate: number;
  dealsWonThisMonth: number;
  dealsWonLastMonth: number;
  wonValueThisMonth: number;
  followUpsDueToday: number;
  followUpsOverdue: number;
  avgResponseMinutes: number | null;
};

export type SalesDashboardData = {
  legacy: SalesDashboardRaw & { retargetingStatuses?: unknown[] };
  commercial: SalesDashboardCommercial;
  kpis: SalesKpiItem[];
  plan: DailySalesPlanPayload | null;
  planError: boolean;
  focus: FocusModeResult | null;
  coverage: PipelineCoverageResult | null;
  goal: DailySalesPlanPayload["goal"] | null;
  priorityEnquiries: SalesEnquiryPriorityItem[];
  priorityDeals: SalesDealAttentionItem[];
  funnel: SalesFunnelStage[];
  activityToday: SalesActivityTodayMetric[];
  pipelineSnapshot: SalesPipelineSnapshotStage[];
  recentActivity: SalesActivityItem[];
  planSummary: SalesPlanSummary;
  hasAnyDeals: boolean;
  hasAnyLeads: boolean;
};

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

function moneyLabel(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "Value not estimated";
  return formatDealValue(n);
}

function trendVs(
  current: number,
  previous: number,
  vs: string
): SalesKpiItem["trend"] | undefined {
  const t = formatTrend(current, previous);
  if (t.direction === "none") return undefined;
  if (t.direction === "flat") return { label: t.label, direction: "flat" };
  if (t.direction === "new") return { label: `${t.label} ${vs}`.trim(), direction: "up" };
  if (t.direction === "up") return { label: `${t.label} ${vs}`, direction: "up" };
  return { label: `${t.label} ${vs}`, direction: "down" };
}

function buildCommercialKpis(c: SalesDashboardCommercial): SalesKpiItem[] {
  const pipelineSupporting =
    c.pipelineAwaitingEstimate > 0
      ? `+ ${c.pipelineAwaitingEstimate} deal${c.pipelineAwaitingEstimate === 1 ? "" : "s"} awaiting estimate`
      : "Active deals only";

  const followSupporting =
    c.followUpsOverdue > 0 ? `${c.followUpsOverdue} overdue` : "Due today";

  return [
    {
      id: "new-enquiries",
      label: "New enquiries",
      value: String(c.newEnquiriesToday),
      supporting: "Today",
      trend: trendVs(c.newEnquiriesToday, c.newEnquiriesYesterday, "vs yesterday"),
      icon: "enquiries",
      href: "/sales/call-now",
    },
    {
      id: "active-deals",
      label: "Active deals",
      value: String(c.activeDeals),
      supporting: "In pipeline",
      icon: "deals",
      href: "/sales/pipeline",
    },
    {
      id: "pipeline",
      label: "Pipeline value",
      value:
        c.pipelineValueKnown > 0 || c.activeDeals === 0
          ? moneyLabel(c.pipelineValueKnown === 0 && c.pipelineAwaitingEstimate > 0 ? null : c.pipelineValueKnown)
          : moneyLabel(null),
      supporting: pipelineSupporting,
      icon: "pipeline",
      href: "/sales/pipeline",
    },
    {
      id: "won",
      label: "Deals won",
      value: String(c.dealsWonThisMonth),
      supporting:
        c.dealsWonThisMonth === 0
          ? "This month"
          : moneyLabel(c.wonValueThisMonth),
      trend: trendVs(c.dealsWonThisMonth, c.dealsWonLastMonth, "vs last month"),
      icon: "won",
      href: "/sales/won-lost",
    },
    {
      id: "followups",
      label: "Follow-ups due",
      value: String(c.followUpsDueToday),
      supporting: followSupporting,
      trend:
        c.followUpsOverdue > 0
          ? { label: `${c.followUpsOverdue} overdue`, direction: "alert" }
          : { label: "All on track", direction: "flat" },
      icon: "followups",
      href: "/sales/tasks",
    },
    {
      id: "response",
      label: "Response time",
      value: formatResponseTime(c.avgResponseMinutes),
      supporting: "Avg. first reply",
      icon: "response",
      href: "/sales/reports",
    },
  ];
}

function mapEnquiryFromPlan(
  q: SalesActionRecommendation
): SalesEnquiryPriorityItem | null {
  const leadId = q.customer?.leadId;
  if (!leadId) return null;
  const source = String(q.customer?.source ?? "");
  const href = source.includes("WHATSAPP")
    ? `/sales/inbox?lead=${leadId}`
    : `/sales/call-now?lead=${leadId}`;
  return {
    id: q.idempotencyKey,
    leadId,
    name: q.customer?.name ?? q.title,
    projectType: q.customer?.projectType ?? q.subtitle,
    source: q.customer?.source ?? null,
    intent: q.customer?.scoreBand ?? null,
    receivedLabel: q.urgencyLabel ?? "Now",
    reason: q.reason,
    phone: q.customer?.phone ?? null,
    availableActions: q.availableActions,
    href,
  };
}

function isLeadEnquiryAction(q: SalesActionRecommendation): boolean {
  if (LEAD_ENQUIRY_ACTIONS.has(q.actionType)) return true;
  if (LEAD_ENQUIRY_REASONS.has(q.reasonCode) && q.sourceEntityType !== "deal") {
    const status = String(q.customer?.status ?? "");
    return status === "NEW" || status === "CONTACTED" || status === "QUALIFIED";
  }
  return false;
}

function isDealWorkAction(q: SalesActionRecommendation): boolean {
  return DEAL_WORK_ACTIONS.has(q.actionType) || q.reasonCode === "NO_NEXT_ACTION" || q.reasonCode === "DEAL_STALE" || q.reasonCode === "QUOTE_WAITING" || q.reasonCode === "LATE_STAGE_NEEDS_ACTION";
}

function formatNextActionLabel(
  deal: Pick<DealRow, "next_action_at" | "next_action_label" | "stage">,
  now: Date
): { label: string; when: string | null; empty: boolean; overdue: boolean } {
  const state = getDealNextActionState(deal);
  if (!state.hasNextAction) {
    return {
      label: "No next action",
      when: null,
      empty: true,
      overdue: false,
    };
  }
  const at = state.at ? new Date(state.at) : null;
  let when: string | null = null;
  if (at && !Number.isNaN(at.getTime())) {
    const sameDay =
      at.getFullYear() === now.getFullYear() &&
      at.getMonth() === now.getMonth() &&
      at.getDate() === now.getDate();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const isTomorrow =
      at.getFullYear() === tomorrow.getFullYear() &&
      at.getMonth() === tomorrow.getMonth() &&
      at.getDate() === tomorrow.getDate();
    if (sameDay) when = `Today · ${at.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false })}`;
    else if (isTomorrow) when = "Tomorrow";
    else
      when = at.toLocaleDateString("en-GB", {
        weekday: "short",
        day: "numeric",
        month: "short",
      });
  }
  return {
    label: state.label?.trim() || "Follow up",
    when,
    empty: false,
    overdue: state.isOverdue,
  };
}

function dealAttentionReason(
  deal: DealRow,
  now: Date
): { code: SalesActionReasonCode; reason: string; atRisk: boolean; urgency: number } {
  const derived = getDealAttentionState(deal, now);
  return {
    code: derived.code,
    reason: derived.reason || reasonText(derived.code),
    atRisk: derived.atRisk,
    urgency: derived.urgency,
  };
}

function buildDealAttentionItems(opts: {
  deals: DealRow[];
  customerNameByLeadId: Map<string, string>;
  quoteTotalByDealId: Map<string, number | null>;
  planQueue: SalesActionRecommendation[];
  now: Date;
  limit?: number;
}): SalesDealAttentionItem[] {
  const limit = opts.limit ?? 6;
  const planByLead = new Map<string, SalesActionRecommendation>();
  const planByDeal = new Map<string, SalesActionRecommendation>();
  for (const q of opts.planQueue) {
    if (!isDealWorkAction(q)) continue;
    if (q.sourceEntityType === "deal" && q.sourceEntityId && !planByDeal.has(q.sourceEntityId)) {
      planByDeal.set(q.sourceEntityId, q);
    }
    const leadId = q.customer?.leadId;
    if (leadId && !planByLead.has(leadId)) planByLead.set(leadId, q);
    const metaDealId = q.metadata?.dealId;
    if (typeof metaDealId === "string" && metaDealId && !planByDeal.has(metaDealId)) {
      planByDeal.set(metaDealId, q);
    }
  }

  const items: SalesDealAttentionItem[] = [];
  for (const deal of opts.deals) {
    if (!(DEAL_ACTIVE_STAGES as readonly string[]).includes(deal.stage)) continue;
    const planHit =
      planByDeal.get(deal.id) ?? planByLead.get(deal.originating_lead_id);
    const derived = dealAttentionReason(deal, opts.now);
    const needsAttention =
      Boolean(planHit) ||
      derived.urgency >= 40 ||
      !getDealNextActionState(deal).hasNextAction ||
      derived.atRisk;
    if (!needsAttention) continue;

    const commercial = getDealCommercialValue(deal, {
      latestQuoteTotal: opts.quoteTotalByDealId.get(deal.id) ?? null,
    });
    const next = formatNextActionLabel(deal, opts.now);
    const reason = planHit?.reason ?? derived.reason;
    const reasonCode = (planHit?.reasonCode ?? derived.code) as SalesActionReasonCode;

    items.push({
      id: deal.id,
      dealId: deal.id,
      name: deal.name,
      customerName:
        opts.customerNameByLeadId.get(deal.originating_lead_id) ??
        deal.decision_maker_name ??
        "Customer",
      stage: deal.stage as DealActiveStage,
      stageLabel: DEAL_STAGE_LABEL[deal.stage as DealActiveStage] ?? deal.stage,
      valueLabel: commercial.display,
      valueBasisLabel: commercial.kind === "pending" ? null : commercial.label,
      nextActionLabel: next.label,
      nextActionWhen: next.when,
      noNextAction: next.empty,
      attentionReason: reason,
      reasonCode,
      atRisk: derived.atRisk || reasonCode === "DEAL_STALE",
      urgency: planHit ? planHit.attentionScore : derived.urgency,
      href: `/sales/deals/${deal.id}`,
    });
  }

  items.sort((a, b) => b.urgency - a.urgency || a.name.localeCompare(b.name));
  return items.slice(0, limit);
}

/**
 * Funnel counts for the calendar month — period counts (not cohort conversion %).
 * Definitions documented in docs.
 */
function buildFunnel(opts: {
  leadsThisMonth: Array<{ status: string; created_at: string }>;
  deals: DealRow[];
  monthStart: Date;
}): SalesFunnelStage[] {
  const leads = opts.leadsThisMonth;
  const enquiries = leads.length;
  const contacted = leads.filter((l) =>
    ["CONTACTED", "QUALIFIED", "CONVERTED_TO_DEAL", "PROPOSAL_SENT", "NEGOTIATING", "WON", "LOST"].includes(
      l.status
    )
  ).length;
  const qualified = leads.filter((l) =>
    ["QUALIFIED", "CONVERTED_TO_DEAL", "PROPOSAL_SENT", "NEGOTIATING", "WON"].includes(l.status)
  ).length;
  const dealsCreated = opts.deals.filter(
    (d) => new Date(d.created_at) >= opts.monthStart
  ).length;
  const proposalSent = opts.deals.filter(
    (d) =>
      d.stage === "PROPOSAL_SENT" || d.stage === "NEGOTIATING" || d.stage === "WON"
  ).length;
  const won = opts.deals.filter(
    (d) => d.stage === "WON" && d.won_at && new Date(d.won_at) >= opts.monthStart
  ).length;

  return [
    { id: "enquiries", label: "Enquiries", count: enquiries, icon: "enquiries" },
    { id: "contacted", label: "Contacted", count: contacted, icon: "contacted" },
    { id: "qualified", label: "Qualified leads", count: qualified, icon: "qualified" },
    { id: "deals", label: "Deals created", count: dealsCreated, icon: "deals" },
    { id: "proposal", label: "Proposal sent", count: proposalSent, icon: "proposal" },
    { id: "won", label: "Won", count: won, icon: "won" },
  ];
}

function buildPipelineSnapshot(opts: {
  deals: DealRow[];
  quoteTotalByDealId: Map<string, number | null>;
}): SalesPipelineSnapshotStage[] {
  return DEAL_ACTIVE_STAGES.map((stage) => {
    const stageDeals = opts.deals.filter((d) => d.stage === stage);
    let known = 0;
    let awaiting = 0;
    for (const d of stageDeals) {
      const n = getDealCommercialValue(d, {
        latestQuoteTotal: opts.quoteTotalByDealId.get(d.id) ?? null,
      });
      if (n.kind === "pending") awaiting += 1;
      else if (n.kind === "amount") known += n.amount;
      else known += (n.min + n.max) / 2;
    }
    return {
      id: stage,
      label: DEAL_STAGE_LABEL[stage],
      color: DEAL_STAGE_ACCENT[stage],
      dealCount: stageDeals.length,
      valueLabel: known > 0 || stageDeals.length === 0 ? moneyLabel(known === 0 && awaiting > 0 ? null : known) : moneyLabel(null),
      knownValue: known,
      awaitingEstimate: awaiting,
      href: `/sales/pipeline?stage=${stage}`,
    };
  });
}

function buildActivityToday(
  commitments: DailyCommitmentProgress[] | undefined,
  fallback: { calls: number; followUps: number }
): SalesActivityTodayMetric[] {
  if (commitments && commitments.length > 0) {
    return commitments.map((c) => ({
      id: c.kind,
      label: c.label,
      completed: c.completed,
      target: c.target > 0 ? c.target : null,
      status: c.status,
    }));
  }
  return [
    {
      id: "CALLS",
      label: "Calls logged",
      completed: fallback.calls,
      target: null,
      status: fallback.calls > 0 ? "in_progress" : "not_started",
    },
    {
      id: "FOLLOW_UPS",
      label: "Follow-ups",
      completed: fallback.followUps,
      target: null,
      status: fallback.followUps > 0 ? "in_progress" : "not_started",
    },
  ];
}

function buildPlanSummary(
  plan: DailySalesPlanPayload | null,
  enquiryCount: number,
  dealCount: number
): SalesPlanSummary {
  if (!plan) {
    const total = enquiryCount + dealCount;
    return {
      state: total === 0 ? "complete" : "active",
      headline:
        total === 0
          ? "Today's sales plan is complete ✓"
          : `You have ${total} priority action${total === 1 ? "" : "s"} today — ${enquiryCount} Lead action${enquiryCount === 1 ? "" : "s"} and ${dealCount} Deal action${dealCount === 1 ? "" : "s"}.`,
      supporting:
        total === 0
          ? "All priority actions and today's commitments are complete."
          : "Focus on these to keep Pipeline and new opportunities moving.",
      ctaLabel: total === 0 ? null : "View my plan →",
      ctaHref: total === 0 ? null : "/sales/tasks",
      remainingPriority: total,
      prospectRemaining: null,
    };
  }

  if (plan.progress.planComplete) {
    return {
      state: "complete",
      headline: "Today's sales plan is complete ✓",
      supporting: "All priority actions and today's commitments are complete.",
      ctaLabel: null,
      ctaHref: null,
      remainingPriority: 0,
      prospectRemaining: null,
    };
  }

  const prospect = plan.progress.commitments.find((c) => c.kind === "NEW_PROSPECTS");
  const prospectRemaining = prospect
    ? Math.max(0, prospect.target - prospect.completed)
    : null;
  const remainingPriority = Math.max(
    0,
    plan.progress.priorityTotal - plan.progress.priorityCompleted
  );

  if (
    remainingPriority === 0 &&
    prospectRemaining != null &&
    prospectRemaining > 0
  ) {
    return {
      state: "build",
      headline: `Your Deal queue is clear — ${prospectRemaining} prospect${prospectRemaining === 1 ? "" : "s"} remain in today's Pipeline-building commitment.`,
      supporting: "Continue prospecting to create new commercial opportunities.",
      ctaLabel: "Continue prospecting",
      ctaHref: "/sales/tasks",
      remainingPriority: 0,
      prospectRemaining,
    };
  }

  return {
    state: "active",
    headline: `You have ${remainingPriority || enquiryCount + dealCount} priority action${(remainingPriority || enquiryCount + dealCount) === 1 ? "" : "s"} today — ${enquiryCount} Lead action${enquiryCount === 1 ? "" : "s"} and ${dealCount} Deal action${dealCount === 1 ? "" : "s"}.`,
    supporting: "Focus on these to keep Pipeline and new opportunities moving.",
    ctaLabel: "View my plan →",
    ctaHref: "/sales/tasks",
    remainingPriority,
    prospectRemaining,
  };
}

function enrichRecentActivity(
  legacy: SalesDashboardRaw,
  dealEvents: Array<{
    id: string;
    event_type: string;
    event_data: Record<string, unknown> | null;
    created_at: string;
    lead_id: string | null;
    deal_id: string | null;
    leads: { name: string | null } | { name: string | null }[] | null;
  }>
): SalesActivityItem[] {
  const items: SalesActivityItem[] = [];

  for (const event of legacy.recentActivity) {
    const name = leadJoinName(event.leads) ?? "Unknown";
    const channel = event.channel ?? (event.event_data?.channel as string | undefined);
    let kind: SalesActivityItem["kind"] = "other";
    let title = "";
    let detail: string | null = null;

    switch (event.event_type) {
      case "CALL_LOGGED":
        kind = channel === "whatsapp" ? "whatsapp" : "call";
        title =
          kind === "whatsapp" ? `${name} replied on WhatsApp` : `Call logged with ${name}`;
        detail = String(event.event_data?.outcome ?? "").toLowerCase().replace(/_/g, " ") || null;
        break;
      case "DOCUMENT_SENT":
      case "QUOTE_SENT":
        kind = "quote";
        title = `Quote sent to ${name}`;
        detail = String(event.event_data?.document_name ?? event.event_data?.quote_number ?? "") || null;
        break;
      case "DEAL_CREATED":
        kind = "deal";
        title = `New Deal created: ${name}`;
        break;
      case "DEAL_WON":
        kind = "won";
        title = `Deal won — ${name}`;
        break;
      case "DEAL_LOST":
        kind = "other";
        title = `Deal lost — ${name}`;
        break;
      case "DEAL_STAGE_CHANGED":
        kind = "deal";
        title = `${name} — stage moved`;
        detail = String(event.event_data?.to_stage ?? "").replace(/_/g, " ").toLowerCase() || null;
        break;
      case "FOLLOW_UP_COMPLETED":
        kind = "call";
        title = `Follow-up completed with ${name}`;
        break;
      case "FOLLOW_UP_SET":
        kind = "call";
        title = `Follow-up scheduled for ${name}`;
        break;
      case "STATUS_CHANGED": {
        const to = String(event.event_data?.to_status ?? "").toUpperCase();
        if (to === "WON") {
          kind = "won";
          title = `${name} won`;
        } else if (to === "CONVERTED_TO_DEAL") {
          kind = "deal";
          title = `Deal created from ${name}`;
        } else {
          kind = "other";
          title = `Lead updated — ${name}`;
          detail = to.toLowerCase().replace(/_/g, " ");
        }
        break;
      }
      case "LEAD_CREATED":
        kind = "lead";
        title = `Lead captured — ${name}`;
        break;
      default:
        kind = "other";
        title = event.event_type
          .replace(/_/g, " ")
          .toLowerCase()
          .replace(/\b\w/g, (c) => c.toUpperCase());
        detail = name;
    }

    items.push({
      id: event.id,
      kind,
      title,
      detail,
      timeLabel: timeAgo(event.created_at),
      href: `/sales/call-now?lead=${event.lead_id}`,
    });
  }

  for (const ev of dealEvents) {
    if (items.some((i) => i.id === ev.id)) continue;
    const name = leadJoinName(ev.leads) ?? "Deal";
    let kind: SalesActivityItem["kind"] = "deal";
    let title = ev.event_type.replace(/_/g, " ");
    if (ev.event_type === "DEAL_WON") {
      kind = "won";
      title = `Deal won — ${name}`;
    } else if (ev.event_type === "DEAL_CREATED") {
      title = `New Deal created: ${name}`;
    } else if (ev.event_type === "QUOTE_SENT") {
      kind = "quote";
      title = `Quote sent to ${name}`;
    } else if (ev.event_type === "DEAL_STAGE_CHANGED") {
      title = `${name} — stage moved`;
    }
    items.push({
      id: ev.id,
      kind,
      title,
      detail: null,
      timeLabel: timeAgo(ev.created_at),
      href: ev.deal_id ? `/sales/deals/${ev.deal_id}` : undefined,
    });
  }

  for (const win of legacy.recentWins.slice(0, 3)) {
    const name = leadJoinName(win.leads) ?? "Unknown";
    const value =
      win.deal_value != null && Number(win.deal_value) > 0
        ? formatDealValue(Number(win.deal_value))
        : null;
    items.push({
      id: `win-${win.id}`,
      kind: "won",
      title: value ? `${name} won Deal worth ${value}` : `Deal won — ${name}`,
      detail: win.days_to_close != null ? `${win.days_to_close}d to close` : null,
      timeLabel: timeAgo(win.created_at),
      href: win.lead_id ? `/sales/call-now?lead=${win.lead_id}` : "/sales/won-lost",
    });
  }

  return items.slice(0, 8);
}

export async function getSalesDashboardData(opts: {
  userId: string;
  clientId: string | null;
  now?: Date;
}): Promise<SalesDashboardData> {
  const now = opts.now ?? new Date();
  const todayStart = startOfLocalDay(now);
  const yesterdayStart = new Date(todayStart);
  yesterdayStart.setDate(yesterdayStart.getDate() - 1);
  const monthStart = startOfLocalMonth(now);
  const prevMonthStart = new Date(monthStart);
  prevMonthStart.setMonth(prevMonthStart.getMonth() - 1);

  const legacy = await fetchSalespersonDashboardData(opts.userId);
  const supabase = createAdminClient();

  const dealsBase = () => {
    let q = supabase
      .from("deals")
      .select("*")
      .eq("owner_id", opts.userId)
      .order("updated_at", { ascending: false })
      .limit(500);
    if (opts.clientId) q = q.eq("client_id", opts.clientId);
    return q;
  };

  const [
    dealsRes,
    wonThisMonthRes,
    wonLastMonthRes,
    leadsMonthRes,
    newTodayRes,
    newYesterdayRes,
    dealEventsRes,
    planResult,
  ] = await Promise.all([
    Promise.resolve(dealsBase()).catch(() => ({ data: null as DealRow[] | null, error: { message: "deals unavailable" } })),
    Promise.resolve(
      supabase
        .from("deals")
        .select("id, won_value, won_at")
        .eq("owner_id", opts.userId)
        .eq("stage", "WON")
        .gte("won_at", monthStart.toISOString())
    ).catch(() => ({ data: [] as Array<{ id: string; won_value: number | null; won_at: string | null }> })),
    Promise.resolve(
      supabase
        .from("deals")
        .select("id")
        .eq("owner_id", opts.userId)
        .eq("stage", "WON")
        .gte("won_at", prevMonthStart.toISOString())
        .lt("won_at", monthStart.toISOString())
    ).catch(() => ({ data: [] as Array<{ id: string }> })),
    supabase
      .from("leads")
      .select("id, status, created_at, source")
      .eq("assigned_to_id", opts.userId)
      .gte("created_at", monthStart.toISOString())
      .or("is_archived.is.null,is_archived.eq.false"),
    supabase
      .from("leads")
      .select("id", { count: "exact", head: true })
      .eq("assigned_to_id", opts.userId)
      .gte("created_at", todayStart.toISOString())
      .or("is_archived.is.null,is_archived.eq.false"),
    supabase
      .from("leads")
      .select("id", { count: "exact", head: true })
      .eq("assigned_to_id", opts.userId)
      .gte("created_at", yesterdayStart.toISOString())
      .lt("created_at", todayStart.toISOString())
      .or("is_archived.is.null,is_archived.eq.false"),
    Promise.resolve(
      supabase
        .from("lead_events")
        .select("id, event_type, event_data, created_at, lead_id, deal_id, leads(name)")
        .eq("actor_id", opts.userId)
        .in("event_type", [
          "DEAL_CREATED",
          "DEAL_WON",
          "DEAL_LOST",
          "DEAL_STAGE_CHANGED",
          "QUOTE_SENT",
          "DEAL_MIGRATED",
        ])
        .order("created_at", { ascending: false })
        .limit(12)
    ).catch(() => ({ data: [] as unknown[] })),
    opts.clientId
      ? fetchDailySalesPlan({ userId: opts.userId, clientId: opts.clientId, now })
          .then((plan) => ({ plan, error: false as const }))
          .catch(() => ({ plan: null, error: true as const }))
      : Promise.resolve({ plan: null, error: false as const }),
  ]);

  const deals = ((dealsRes.data ?? []) as DealRow[]).filter(Boolean);
  const activeDeals = deals.filter((d) =>
    (DEAL_ACTIVE_STAGES as readonly string[]).includes(d.stage)
  );

  const dealIds = activeDeals.map((d) => d.id);
  const leadIds = [...new Set(deals.map((d) => d.originating_lead_id))];

  const [{ data: quotes }, { data: leadNames }] = await Promise.all([
    dealIds.length
      ? supabase
          .from("quotations")
          .select("id, deal_id, lead_id, total, status, sent_at, created_at, updated_at")
          .in("deal_id", dealIds)
      : Promise.resolve({ data: [] as unknown[] }),
    leadIds.length
      ? supabase.from("leads").select("id, name").in("id", leadIds)
      : Promise.resolve({ data: [] as unknown[] }),
  ]);

  const quotesByDeal = new Map<string, QuotationRow[]>();
  for (const q of (quotes ?? []) as QuotationRow[]) {
    if (!q.deal_id) continue;
    const list = quotesByDeal.get(q.deal_id) ?? [];
    list.push(q);
    quotesByDeal.set(q.deal_id, list);
  }
  const quoteTotalByDealId = new Map<string, number | null>();
  for (const [id, list] of quotesByDeal) {
    quoteTotalByDealId.set(id, latestQuoteTotal(list));
  }

  const customerNameByLeadId = new Map(
    ((leadNames ?? []) as Array<{ id: string; name: string | null }>).map((l) => [
      l.id,
      l.name?.trim() || "Customer",
    ])
  );

  let pipelineKnown = 0;
  let awaitingEstimate = 0;
  for (const d of activeDeals) {
    const v = getDealCommercialValue(d, {
      latestQuoteTotal: quoteTotalByDealId.get(d.id) ?? null,
    });
    if (v.kind === "pending") awaitingEstimate += 1;
    else if (v.kind === "amount") pipelineKnown += v.amount;
    else pipelineKnown += (v.min + v.max) / 2;
  }

  const wonRows = (wonThisMonthRes.data ?? []) as Array<{
    id: string;
    won_value: number | null;
    won_at: string | null;
  }>;
  const wonValueThisMonth = wonRows.reduce(
    (s, w) => s + (Number(w.won_value) || 0),
    0
  );

  // Follow-ups: prefer plan queue + deal next_action_at due today/overdue
  const followUpsDueToday = (() => {
    let n = 0;
    for (const d of activeDeals) {
      const state = getDealNextActionState(d);
      if (!state.at) continue;
      const at = new Date(state.at);
      const isToday =
        at.getFullYear() === now.getFullYear() &&
        at.getMonth() === now.getMonth() &&
        at.getDate() === now.getDate();
      if (isToday || state.isOverdue) n += 1;
    }
    // Include legacy lead follow-ups still in active (non-converted) set
    n += legacy.numbers.followUpToday + legacy.numbers.callNow;
    return n;
  })();

  const followUpsOverdue = (() => {
    let n = legacy.insights?.overdueFollowUps ?? 0;
    for (const d of activeDeals) {
      if (getDealNextActionState(d).isOverdue) n += 1;
    }
    return n;
  })();

  const monthLeadIds = (
    (leadsMonthRes.data ?? []) as Array<{ id: string; status: string; created_at: string }>
  ).map((l) => l.id);

  const responseSignals =
    monthLeadIds.length > 0
      ? await Promise.all([
          supabase
            .from("call_logs")
            .select("lead_id, created_at")
            .in("lead_id", monthLeadIds)
            .order("created_at", { ascending: true })
            .limit(2000),
          supabase
            .from("whatsapp_messages")
            .select("lead_id, direction, created_at")
            .in("lead_id", monthLeadIds)
            .eq("direction", "outbound")
            .order("created_at", { ascending: true })
            .limit(2000),
          supabase
            .from("lead_events")
            .select("lead_id, event_type, created_at")
            .in("lead_id", monthLeadIds)
            .in("event_type", ["CALL_LOGGED", "MESSAGE_SENT"])
            .order("created_at", { ascending: true })
            .limit(2000),
        ])
      : null;

  const callAtsByLead = new Map<string, string[]>();
  const outboundWaByLead = new Map<string, string[]>();
  const eventsByLead = new Map<string, Array<{ event_type: string; created_at: string }>>();
  if (responseSignals) {
    for (const row of (responseSignals[0].data ?? []) as Array<{
      lead_id: string;
      created_at: string;
    }>) {
      const list = callAtsByLead.get(row.lead_id) ?? [];
      list.push(row.created_at);
      callAtsByLead.set(row.lead_id, list);
    }
    for (const row of (responseSignals[1].data ?? []) as Array<{
      lead_id: string;
      created_at: string;
    }>) {
      const list = outboundWaByLead.get(row.lead_id) ?? [];
      list.push(row.created_at);
      outboundWaByLead.set(row.lead_id, list);
    }
    for (const row of (responseSignals[2].data ?? []) as Array<{
      lead_id: string;
      event_type: string;
      created_at: string;
    }>) {
      const list = eventsByLead.get(row.lead_id) ?? [];
      list.push({ event_type: row.event_type, created_at: row.created_at });
      eventsByLead.set(row.lead_id, list);
    }
  }

  const avgResponseMinutes =
    firstQualifyingResponseMinutes(
      (leadsMonthRes.data ?? []) as Array<{ id: string; created_at: string }>,
      { eventsByLead, callAtsByLead, outboundWaByLead }
    ) ??
    legacy.insights?.avgResponseMinutes ??
    null;

  const commercial: SalesDashboardCommercial = {
    newEnquiriesToday: newTodayRes.count ?? 0,
    newEnquiriesYesterday: newYesterdayRes.count ?? 0,
    activeDeals: activeDeals.length,
    pipelineValueKnown: pipelineKnown,
    pipelineAwaitingEstimate: awaitingEstimate,
    dealsWonThisMonth: wonRows.length,
    dealsWonLastMonth: (wonLastMonthRes.data ?? []).length,
    wonValueThisMonth,
    followUpsDueToday,
    followUpsOverdue,
    avgResponseMinutes,
  };

  // Fix pipeline KPI display when all pending
  const kpis = buildCommercialKpis(commercial).map((k) => {
    if (k.id !== "pipeline") return k;
    if (commercial.activeDeals > 0 && commercial.pipelineValueKnown === 0 && commercial.pipelineAwaitingEstimate > 0) {
      return {
        ...k,
        value: "—",
        supporting: `${commercial.pipelineAwaitingEstimate} deal${commercial.pipelineAwaitingEstimate === 1 ? "" : "s"} awaiting estimate`,
      };
    }
    if (commercial.pipelineValueKnown > 0) {
      return {
        ...k,
        value: moneyLabel(commercial.pipelineValueKnown),
      };
    }
    return k;
  });

  const plan = planResult.plan as DailySalesPlanPayload | null;
  const planQueue: SalesActionRecommendation[] = plan?.queue ?? [];

  const priorityEnquiries = planQueue
    .filter(isLeadEnquiryAction)
    .map(mapEnquiryFromPlan)
    .filter((x: SalesEnquiryPriorityItem | null): x is SalesEnquiryPriorityItem => Boolean(x))
    .slice(0, 6);

  // Fallback: if plan empty/error, use call-now style leads from legacy
  if (priorityEnquiries.length === 0 && !planResult.error) {
    const fallback = legacy.priorityLeads
      .filter((l) => l.status === "NEW" || l.priorityOrder <= 2)
      .slice(0, 6)
      .map((l): SalesEnquiryPriorityItem => {
        const actions: SalesEnquiryPriorityItem["availableActions"] = ["open_lead"];
        if (l.phone) actions.unshift("call");
        if (l.phone || String(l.source ?? "").includes("WHATSAPP")) {
          if (!actions.includes("whatsapp")) actions.splice(actions.length - 1, 0, "whatsapp");
        }
        return {
          id: l.id,
          leadId: l.id,
          name: l.name?.trim() || "Unnamed lead",
          projectType: l.project_type ?? null,
          source: l.source ?? null,
          intent: null,
          receivedLabel: timeAgo(l.created_at),
          reason: l.priorityLabel || "Needs attention",
          phone: l.phone,
          availableActions: actions,
          href: `/sales/call-now?lead=${l.id}`,
        };
      });
    priorityEnquiries.push(...fallback);
  }

  const priorityDeals = buildDealAttentionItems({
    deals: activeDeals,
    customerNameByLeadId,
    quoteTotalByDealId,
    planQueue,
    now,
    limit: 6,
  });

  const focusBody =
    plan?.focus ??
    ({
      mode: "MOVE" as const,
      title: "Move deals",
      body: "Here's what needs attention across your enquiries and deals today.",
      priorityActionCount: priorityEnquiries.length + priorityDeals.length,
    } satisfies FocusModeResult);

  // Dynamic focus sentence from real categories
  const hotEnquiries = planQueue.filter((q) => q.reasonCode === "HIGH_INTENT_NEW_LEAD").length;
  const dealMoves = priorityDeals.length;
  let focus: FocusModeResult = { ...focusBody };
  if (plan) {
    if (plan.focus.mode === "MOVE") {
      focus = {
        ...plan.focus,
        body:
          hotEnquiries > 0 || dealMoves > 0
            ? `${hotEnquiries || priorityEnquiries.length} high-intent enquir${(hotEnquiries || priorityEnquiries.length) === 1 ? "y" : "ies"} need first contact and ${dealMoves} active Deal${dealMoves === 1 ? "" : "s"} need movement.`
            : plan.focus.body,
      };
    } else if (plan.focus.mode === "BUILD") {
      const prospect = plan.progress.commitments.find((c) => c.kind === "NEW_PROSPECTS");
      focus = {
        ...plan.focus,
        body:
          prospect && prospect.target > 0
            ? `Your priority deal queue is clear. Build new opportunities today.`
            : plan.focus.body,
      };
    } else if (plan.focus.mode === "CLOSE") {
      focus = {
        ...plan.focus,
        body:
          dealMoves > 0
            ? `You have ${dealMoves} late-stage Deal${dealMoves === 1 ? "" : "s"} requiring follow-up.`
            : plan.focus.body,
      };
    }
  }

  const funnel = buildFunnel({
    leadsThisMonth: (leadsMonthRes.data ?? []) as Array<{
      status: string;
      created_at: string;
    }>,
    deals,
    monthStart,
  });

  const activityToday = buildActivityToday(plan?.progress.commitments, {
    calls: legacy.numbers.calledToday,
    followUps: Math.max(0, legacy.numbers.followUpToday),
  });

  const pipelineSnapshot = buildPipelineSnapshot({
    deals: activeDeals,
    quoteTotalByDealId,
  });

  const recentActivity = enrichRecentActivity(
    legacy,
    (dealEventsRes.data ?? []) as Array<{
      id: string;
      event_type: string;
      event_data: Record<string, unknown> | null;
      created_at: string;
      lead_id: string | null;
      deal_id: string | null;
      leads: { name: string | null } | { name: string | null }[] | null;
    }>
  );

  const planSummary = buildPlanSummary(
    plan,
    priorityEnquiries.length,
    priorityDeals.length
  );

  return {
    legacy: legacy as SalesDashboardData["legacy"],
    commercial,
    kpis,
    plan,
    planError: planResult.error,
    focus,
    coverage: plan?.coverage ?? null,
    goal: plan?.goal ?? null,
    priorityEnquiries,
    priorityDeals,
    funnel,
    activityToday,
    pipelineSnapshot,
    recentActivity,
    planSummary,
    hasAnyDeals: deals.length > 0,
    hasAnyLeads: legacy.numbers.totalActive > 0 || (leadsMonthRes.data?.length ?? 0) > 0,
  };
}
