/**
 * Company Team member overview — independent of the table aggregator.
 * Server-authorizes that the member belongs to the requesting company.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { firstQualifyingResponseMinutes } from "@/lib/sales/intelligence/meaningful-activity";
import {
  DEAL_ACTIVE_STAGES,
  getDealAttentionState,
  getDealNextActionState,
} from "@/lib/sales/deals";
import { calcProgress } from "@/lib/sales/goals/progress";
import { goalPeriodBounds, parseGoalPeriodKey } from "@/lib/sales/goals/period";
import { formatResponseTime } from "@/lib/sales/sales-dashboard-display";
import { formatDealCurrency } from "@/lib/sales/format";
import { timeAgo } from "@/lib/sales-priority-lead";
import { leadJoinName } from "@/lib/format";
import type { DealRow } from "@/types";
import type { CompanyActivityItem, CompanyRevenuePoint } from "@/components/dashboard/company/types";
import type {
  CompanyTeamMemberOverview,
  CompanyTeamNeedsAttentionItem,
} from "@/components/dashboard/company/team/types";
import {
  HOT_LEAD_SCORE_THRESHOLD,
  companyTeamAttentionLabel,
  companyTeamInitials,
  companyTeamRoleColumn,
  companyTeamTitleLabel,
  companyTeamWinRate,
  deriveCompanyTeamAttention,
} from "@/lib/sales/company-team-metrics";
import {
  commercialAmount,
  loadQuoteTotalsByDealId,
  loadResponseSignals,
} from "@/lib/sales/get-company-team-page-data";

const CLOSED_LEAD = new Set(["WON", "LOST", "NOT_QUALIFIED", "CONVERTED_TO_DEAL"]);
const ACTIVITY_TYPES = [
  "DEAL_CREATED",
  "DEAL_WON",
  "DEAL_LOST",
  "DEAL_STAGE_CHANGED",
  "QUOTE_SENT",
  "DOCUMENT_SENT",
  "FOLLOW_UP_COMPLETED",
  "LEAD_ASSIGNED",
  "CALL_LOGGED",
];

function startOfLocalMonth(d: Date): Date {
  const x = new Date(d);
  x.setDate(1);
  x.setHours(0, 0, 0, 0);
  return x;
}

function daysAgo(d: Date, n: number): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - n);
  return x;
}

function moneyLabel(n: number | null | undefined, currency: string): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return formatDealCurrency(n, { currency });
}

function memberActivity(
  eventType: string,
  subjectName: string,
  eventData: Record<string, unknown> | null
): { kind: CompanyActivityItem["kind"]; title: string; detail: string | null } {
  switch (eventType) {
    case "DEAL_WON": {
      const value = eventData?.won_value ?? eventData?.deal_value;
      const valueLabel =
        value != null && Number(value) > 0 ? moneyLabel(Number(value), "USD") : null;
      return {
        kind: "won",
        title: valueLabel ? `Won a Deal worth ${valueLabel}` : "Won a Deal",
        detail: subjectName,
      };
    }
    case "DEAL_CREATED":
      return { kind: "deal", title: "Created a Deal", detail: subjectName };
    case "DEAL_LOST":
      return { kind: "other", title: "Marked a Deal lost", detail: subjectName };
    case "DEAL_STAGE_CHANGED": {
      const to = String(eventData?.to_stage ?? "").replace(/_/g, " ");
      const stageLabel = to
        ? to.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())
        : "next stage";
      return { kind: "deal", title: `Moved a Deal to ${stageLabel}`, detail: subjectName };
    }
    case "QUOTE_SENT":
    case "DOCUMENT_SENT":
      return { kind: "quote", title: "Sent a Quote", detail: subjectName };
    case "FOLLOW_UP_COMPLETED":
      return { kind: "call", title: "Completed a follow-up", detail: subjectName };
    case "LEAD_ASSIGNED":
    case "ASSIGNED":
      return { kind: "lead", title: "Was assigned a Lead", detail: subjectName };
    case "CALL_LOGGED":
      return { kind: "call", title: "Logged a call", detail: subjectName };
    default:
      return {
        kind: "other",
        title: eventType
          .replace(/_/g, " ")
          .toLowerCase()
          .replace(/\b\w/g, (c) => c.toUpperCase()),
        detail: subjectName,
      };
  }
}

export async function getCompanyTeamMemberOverview(opts: {
  clientId: string;
  memberId: string;
  alsoSells?: boolean;
  now?: Date;
}): Promise<CompanyTeamMemberOverview | null> {
  const now = opts.now ?? new Date();
  const alsoSells = Boolean(opts.alsoSells);
  const supabase = createAdminClient();
  const monthStart = startOfLocalMonth(now);
  const period30Start = daysAgo(now, 30);
  const revenueFrom = startOfLocalMonth(new Date(now.getFullYear(), now.getMonth() - 5, 1));
  const closedFrom = revenueFrom;
  const goalBounds = goalPeriodBounds(parseGoalPeriodKey(null, now));
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const dayOfMonth = now.getDate();

  const { data: memberRow } = await supabase
    .from("users")
    .select("id, name, email, phone, role, also_sells, avatar_url, is_active, client_id")
    .eq("id", opts.memberId)
    .maybeSingle();

  if (!memberRow || (memberRow.client_id as string) !== opts.clientId) {
    return null;
  }
  if (!["SALESPERSON", "CLIENT_MANAGER"].includes(memberRow.role as string)) {
    return null;
  }

  const memberId = memberRow.id as string;
  const name = (memberRow.name as string | null)?.trim() || "Unnamed";
  const isActive = memberRow.is_active !== false;

  const [leadsRes, dealsRes, wonRes, lostRes, wonHistoryRes, goalsRes, eventsRes] =
    await Promise.all([
      supabase
        .from("leads")
        .select("id, name, status, source, score, created_at, assigned_to_id, follow_up_date")
        .eq("client_id", opts.clientId)
        .eq("assigned_to_id", memberId)
        .or("is_archived.is.null,is_archived.eq.false")
        .limit(2000),
      supabase
        .from("deals")
        .select("*")
        .eq("client_id", opts.clientId)
        .eq("owner_id", memberId)
        .limit(1000),
      supabase
        .from("deals")
        .select("id, won_value, won_at")
        .eq("client_id", opts.clientId)
        .eq("owner_id", memberId)
        .eq("stage", "WON")
        .gte("won_at", monthStart.toISOString()),
      supabase
        .from("deals")
        .select("id")
        .eq("client_id", opts.clientId)
        .eq("owner_id", memberId)
        .eq("stage", "LOST")
        .gte("lost_at", closedFrom.toISOString()),
      supabase
        .from("deals")
        .select("id, won_value, won_at")
        .eq("client_id", opts.clientId)
        .eq("owner_id", memberId)
        .eq("stage", "WON")
        .gte("won_at", revenueFrom.toISOString())
        .order("won_at", { ascending: true }),
      supabase
        .from("sales_goals")
        .select("id, salesperson_id, target_value, currency, status, period_start")
        .eq("client_id", opts.clientId)
        .eq("salesperson_id", memberId)
        .eq("goal_type", "REVENUE_WON")
        .eq("status", "ACTIVE")
        .eq("period_start", goalBounds.periodStartIso)
        .maybeSingle(),
      supabase
        .from("lead_events")
        .select("id, event_type, event_data, created_at, lead_id, deal_id, actor_id, leads(name)")
        .eq("client_id", opts.clientId)
        .eq("actor_id", memberId)
        .in("event_type", ACTIVITY_TYPES)
        .order("created_at", { ascending: false })
        .limit(12),
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

  const leads = (leadsRes.data ?? []) as LeadRow[];
  const deals = ((dealsRes.data ?? []) as DealRow[]).filter(Boolean);
  const activeDeals = deals.filter((d) =>
    (DEAL_ACTIVE_STAGES as readonly string[]).includes(d.stage)
  );
  const quoteTotalByDealId = await loadQuoteTotalsByDealId(activeDeals.map((d) => d.id));

  let pipelineValue = 0;
  let pending = 0;
  for (const d of activeDeals) {
    const { known, pending: p } = commercialAmount(d, quoteTotalByDealId.get(d.id) ?? null);
    if (p) pending += 1;
    else pipelineValue += known;
  }

  const wonThisMonth = (wonRes.data ?? []) as Array<{ won_value: number | null }>;
  const wonValue = wonThisMonth.reduce((s, w) => s + (Number(w.won_value) || 0), 0);
  const dealsWon = wonThisMonth.length;
  const lostCount = (lostRes.data ?? []).length;
  const wonLast6 = (wonHistoryRes.data ?? []) as Array<{ won_value: number | null; won_at: string | null }>;
  const winRate = companyTeamWinRate(wonLast6.length, lostCount);

  const goal = goalsRes.data as {
    id: string;
    target_value: number;
    currency: string | null;
  } | null;
  const currency = goal?.currency || "USD";
  const hasGoal = Boolean(goal && Number(goal.target_value) > 0);
  const progress = hasGoal ? calcProgress(wonValue, Number(goal!.target_value)) : null;

  let overdueFollowUps = 0;
  let followUpsDue = 0;
  for (const l of leads) {
    if (!l.follow_up_date || CLOSED_LEAD.has(l.status)) continue;
    const due = new Date(l.follow_up_date);
    if (due <= now) followUpsDue += 1;
    if (due < now) overdueFollowUps += 1;
  }
  let noNextAction = 0;
  let dealsAtRisk = 0;
  for (const d of activeDeals) {
    const next = getDealNextActionState(d);
    if (next.at) {
      const at = new Date(next.at);
      if (next.isOverdue || at <= now) followUpsDue += 1;
      if (next.isOverdue || at < now) overdueFollowUps += 1;
    }
    const att = getDealAttentionState(d, now);
    if (att.code === "NO_NEXT_ACTION") noNextAction += 1;
    if (att.atRisk || att.urgency >= 70) dealsAtRisk += 1;
  }

  const hotAwaitingContact = leads.filter(
    (l) =>
      l.status === "NEW" &&
      ((l.score ?? 0) >= HOT_LEAD_SCORE_THRESHOLD ||
        String(l.source ?? "").toUpperCase().includes("WHATSAPP"))
  ).length;

  const derived = deriveCompanyTeamAttention({
    overdueFollowUps,
    dealsAtRisk,
    hotAwaitingContact,
    noNextAction,
    hasGoal,
    goalProgressPct: progress?.ringPct ?? null,
    dayOfMonth,
    daysInMonth,
  });

  const leadsLast30 = leads.filter((l) => new Date(l.created_at) >= period30Start);
  const signals = await loadResponseSignals(leadsLast30.map((l) => l.id));
  const avgResponseMinutes = firstQualifyingResponseMinutes(leadsLast30, signals);

  const monthKeys: string[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    monthKeys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  const revenueByMonth = new Map<string, number>();
  for (const key of monthKeys) revenueByMonth.set(key, 0);
  for (const w of wonLast6) {
    if (!w.won_at) continue;
    const d = new Date(w.won_at);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    if (!revenueByMonth.has(key)) continue;
    revenueByMonth.set(key, (revenueByMonth.get(key) ?? 0) + (Number(w.won_value) || 0));
  }
  const performanceTrend: CompanyRevenuePoint[] = monthKeys.map((key) => {
    const [y, m] = key.split("-").map(Number);
    const label = new Date(y!, m! - 1, 1).toLocaleDateString("en-GB", { month: "short" });
    return { monthKey: key, label, value: revenueByMonth.get(key) ?? 0 };
  });
  const hasPerformanceHistory = performanceTrend.some((p) => p.value > 0) || dealsWon > 0;

  const needsAttention: CompanyTeamNeedsAttentionItem[] = [];
  if (overdueFollowUps > 0) {
    needsAttention.push({
      id: "overdue-followups",
      label: `${overdueFollowUps} overdue follow-up${overdueFollowUps === 1 ? "" : "s"}`,
      href: `/client/leads?filter=follow_up&assignedToId=${memberId}`,
      severity: overdueFollowUps >= 3 ? "critical" : "high",
    });
  }
  if (dealsAtRisk > 0) {
    needsAttention.push({
      id: "deals-at-risk",
      label: `${dealsAtRisk} Deal${dealsAtRisk === 1 ? "" : "s"} at risk`,
      href: `/client/leads/pipeline`,
      severity: "high",
    });
  }
  if (hotAwaitingContact > 0) {
    needsAttention.push({
      id: "hot-leads",
      label: `${hotAwaitingContact} Hot Lead${hotAwaitingContact === 1 ? "" : "s"} awaiting first contact`,
      href: `/client/leads?status=NEW&assignedToId=${memberId}`,
      severity: "high",
    });
  }
  if (noNextAction > 0 && needsAttention.length < 3) {
    needsAttention.push({
      id: "no-next-action",
      label: `${noNextAction} Deal${noNextAction === 1 ? "" : "s"} ${noNextAction === 1 ? "has" : "have"} no next action`,
      href: `/client/leads/pipeline`,
      severity: "medium",
    });
  }

  const recentActivity: CompanyActivityItem[] = [];
  for (const ev of (eventsRes.data ?? []) as Array<{
    id: string;
    event_type: string;
    event_data: Record<string, unknown> | null;
    created_at: string;
    lead_id: string | null;
    deal_id: string | null;
    leads: { name: string | null } | { name: string | null }[] | null;
  }>) {
    const subject = leadJoinName(ev.leads) ?? "Customer";
    const mapped = memberActivity(ev.event_type, subject, ev.event_data);
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
      actorName: name,
    });
    if (recentActivity.length >= 3) break;
  }

  void followUpsDue;

  return {
    id: memberId,
    name,
    initials: companyTeamInitials(name),
    avatarUrl: (memberRow.avatar_url as string | null) ?? null,
    email: (memberRow.email as string | null) ?? null,
    phone: (memberRow.phone as string | null) ?? null,
    titleLabel: companyTeamTitleLabel(memberRow.role as string, memberRow.also_sells as boolean),
    roleColumn: companyTeamRoleColumn(memberRow.role as string, memberRow.also_sells as boolean),
    isActive,
    accountStatusLabel: isActive ? "Active" : "Inactive",
    alsoSells: Boolean(memberRow.also_sells),
    attention: derived.attention,
    attentionLabel: companyTeamAttentionLabel(derived.attention),
    hasGoal,
    goalId: hasGoal ? goal!.id : null,
    goalTarget: hasGoal ? Number(goal!.target_value) : null,
    goalAchieved: wonValue,
    goalCurrency: currency,
    goalProgressPct: progress?.ringPct ?? null,
    goalTargetLabel: hasGoal ? moneyLabel(Number(goal!.target_value), currency) : null,
    goalAchievedLabel: moneyLabel(wonValue, currency),
    activeDeals: activeDeals.length,
    pipelineValueKnown: pipelineValue,
    pipelineValueLabel:
      activeDeals.length > 0 && pipelineValue === 0 && pending > 0
        ? "—"
        : moneyLabel(pipelineValue, currency),
    dealsWon,
    overdueFollowUps,
    avgResponseMinutes,
    avgResponseLabel: formatResponseTime(avgResponseMinutes),
    winRate,
    winRateLabel: winRate == null ? "—" : `${winRate}%`,
    closedDealsCount: wonLast6.length + lostCount,
    performanceTrend,
    hasPerformanceHistory,
    needsAttention: needsAttention.slice(0, 3),
    recentActivity,
  };
}
