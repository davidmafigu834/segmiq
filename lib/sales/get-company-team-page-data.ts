/**
 * Company Team page aggregator.
 * Batched, tenant-scoped — no per-member N+1 for Deals, Goals, or follow-ups.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { canManageClientTeam, canReassignLeads } from "@/lib/auth/permissions";
import { firstQualifyingResponseMinutes } from "@/lib/sales/intelligence/meaningful-activity";
import {
  DEAL_ACTIVE_STAGES,
  getDealAttentionState,
  getDealCommercialValue,
  getDealNextActionState,
  latestQuoteTotal,
} from "@/lib/sales/deals";
import { calcProgress } from "@/lib/sales/goals/progress";
import { goalPeriodBounds, parseGoalPeriodKey } from "@/lib/sales/goals/period";
import {
  formatResponseTime,
  formatTrend,
} from "@/lib/sales/sales-dashboard-display";
import { formatDealCurrency } from "@/lib/sales/format";
import type { DealRow, QuotationRow, UserRole } from "@/types";
import { normalizeBusinessType } from "@/lib/terminology";
import type { SalesKpiItem } from "@/components/dashboard/sales/types";
import type {
  CompanyTeamMemberTableRow,
  CompanyTeamPageData,
  CompanyTeamSupportPerson,
} from "@/components/dashboard/company/team/types";
import {
  HOT_LEAD_SCORE_THRESHOLD,
  companyTeamAttentionLabel,
  companyTeamAvgGoalProgress,
  companyTeamComposition,
  companyTeamGoalCoverage,
  companyTeamInitials,
  companyTeamRoleColumn,
  companyTeamRoleGroup,
  companyTeamTitleLabel,
  deriveCompanyTeamAttention,
} from "@/lib/sales/company-team-metrics";
import { derivePresenceState } from "@/lib/presence/derive-presence";
import type { AvailabilityOverride, PresenceState } from "@/lib/presence/constants";

const CLOSED_LEAD = new Set(["WON", "LOST", "NOT_QUALIFIED", "CONVERTED_TO_DEAL"]);

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

function moneyLabel(n: number | null | undefined, currency: string): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return formatDealCurrency(n, { currency });
}

export function commercialAmount(
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
    if (t.direction === "down") {
      return { label: `${t.label} faster ${vs}`.trim(), direction: "up" };
    }
    return { label: `${t.label} slower ${vs}`.trim(), direction: "down" };
  }
  if (t.direction === "up") return { label: `${t.label} ${vs}`, direction: "up" };
  return { label: `${t.label} ${vs}`, direction: "down" };
}

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
  email: string | null;
  phone: string | null;
  role: string;
  also_sells: boolean | null;
  avatar_url: string | null;
  is_active: boolean | null;
  last_seen_at: string | null;
  availability_override: string | null;
};

export async function loadQuoteTotalsByDealId(
  dealIds: string[]
): Promise<Map<string, number | null>> {
  const quoteTotalByDealId = new Map<string, number | null>();
  if (dealIds.length === 0) return quoteTotalByDealId;
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("quotations")
    .select("id, deal_id, lead_id, total, status, sent_at, created_at, updated_at")
    .in("deal_id", dealIds);
  const quotesByDeal = new Map<string, QuotationRow[]>();
  for (const q of (data ?? []) as QuotationRow[]) {
    if (!q.deal_id) continue;
    const list = quotesByDeal.get(q.deal_id) ?? [];
    list.push(q);
    quotesByDeal.set(q.deal_id, list);
  }
  for (const [id, list] of quotesByDeal) {
    quoteTotalByDealId.set(id, latestQuoteTotal(list));
  }
  return quoteTotalByDealId;
}

export async function loadResponseSignals(ids: string[]) {
  if (ids.length === 0) {
    return {
      callAtsByLead: new Map<string, string[]>(),
      outboundWaByLead: new Map<string, string[]>(),
      eventsByLead: new Map<string, Array<{ event_type: string; created_at: string }>>(),
    };
  }
  const supabase = createAdminClient();
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

function buildTeamKpis(opts: {
  teamMembers: number;
  activeDeals: number;
  pipelineKnown: number;
  awaitingEstimate: number;
  dealsWon: number;
  dealsWonPrev: number;
  wonValue: number;
  avgResponseMinutes: number | null;
  avgResponseMinutesPrev: number | null;
  currency: string;
}): SalesKpiItem[] {
  const pipelineSupporting =
    opts.awaitingEstimate > 0
      ? `${opts.awaitingEstimate} Deal${opts.awaitingEstimate === 1 ? "" : "s"} awaiting estimate`
      : "Active Deals only";
  const pipelineValue =
    opts.activeDeals > 0 && opts.pipelineKnown === 0 && opts.awaitingEstimate > 0
      ? "—"
      : moneyLabel(opts.pipelineKnown, opts.currency);
  const responseTrend =
    opts.avgResponseMinutes != null && opts.avgResponseMinutesPrev != null
      ? trendVs(opts.avgResponseMinutes, opts.avgResponseMinutesPrev, "vs last 30 days", {
          invertGood: true,
        })
      : undefined;

  return [
    {
      id: "team-members",
      label: "Team members",
      value: String(opts.teamMembers),
      supporting: "Active",
      icon: "enquiries",
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
      label: "Team Pipeline Value",
      value: pipelineValue,
      supporting: pipelineSupporting,
      icon: "pipeline",
      href: "/client/leads/pipeline",
    },
    {
      id: "won",
      label: "Deals Won",
      value: String(opts.dealsWon),
      supporting: opts.dealsWon === 0 ? "This month" : moneyLabel(opts.wonValue, opts.currency),
      trend: trendVs(opts.dealsWon, opts.dealsWonPrev, "vs last month"),
      icon: "won",
      href: "/client/reports",
    },
    {
      id: "response",
      label: "Avg. response time",
      value: formatResponseTime(opts.avgResponseMinutes),
      supporting: "Avg. first contact",
      trend: responseTrend,
      icon: "response",
      href: "/client/reports",
    },
  ];
}

export async function getCompanyTeamPageData(opts: {
  clientId: string;
  actor: {
    userId: string;
    role: UserRole;
    clientId: string | null;
  };
  alsoSells?: boolean;
  now?: Date;
}): Promise<CompanyTeamPageData> {
  const now = opts.now ?? new Date();
  const alsoSells = Boolean(opts.alsoSells);
  const clientId = opts.clientId;
  const supabase = createAdminClient();

  const monthStart = startOfLocalMonth(now);
  const prevMonthStart = new Date(monthStart);
  prevMonthStart.setMonth(prevMonthStart.getMonth() - 1);
  const period30Start = daysAgo(now, 30);
  const period60Start = daysAgo(now, 60);
  const goalBounds = goalPeriodBounds(parseGoalPeriodKey(null, now));
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const dayOfMonth = now.getDate();

  const canManage = canManageClientTeam(opts.actor, clientId);
  const canReassign = canReassignLeads(opts.actor, clientId);

  const [
    clientRes,
    teamRes,
    leadsRes,
    dealsRes,
    wonThisMonthRes,
    wonLastMonthRes,
    goalsRes,
  ] = await Promise.all([
    supabase
      .from("clients")
      .select("id, name, business_type")
      .eq("id", clientId)
      .maybeSingle(),
    supabase
      .from("users")
      .select("id, name, email, phone, role, also_sells, avatar_url, is_active, last_seen_at, availability_override")
      .eq("client_id", clientId)
      .in("role", ["SALESPERSON", "CLIENT_MANAGER"])
      .order("name", { ascending: true }),
    supabase
      .from("leads")
      .select("id, name, status, source, score, created_at, assigned_to_id, follow_up_date")
      .eq("client_id", clientId)
      .or("is_archived.is.null,is_archived.eq.false")
      .order("created_at", { ascending: false })
      .limit(5000),
    supabase.from("deals").select("*").eq("client_id", clientId).limit(2000),
    supabase
      .from("deals")
      .select("id, owner_id, won_value, won_at")
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
      .from("sales_goals")
      .select("id, salesperson_id, target_value, currency, status, period_start")
      .eq("client_id", clientId)
      .eq("goal_type", "REVENUE_WON")
      .eq("status", "ACTIVE")
      .eq("period_start", goalBounds.periodStartIso),
  ]);

  const leads = (leadsRes.data ?? []) as LeadRow[];
  const deals = ((dealsRes.data ?? []) as DealRow[]).filter(Boolean);
  const team = (teamRes.data ?? []) as TeamUser[];
  const clientName = (clientRes.data?.name as string) ?? "Company";
  const businessType = normalizeBusinessType(
    (clientRes.data as { business_type?: string } | null)?.business_type
  );

  const activeDeals = deals.filter((d) =>
    (DEAL_ACTIVE_STAGES as readonly string[]).includes(d.stage)
  );

  const quoteTotalByDealId = await loadQuoteTotalsByDealId(activeDeals.map((d) => d.id));

  let pipelineKnown = 0;
  let awaitingEstimate = 0;
  for (const d of activeDeals) {
    const { known, pending } = commercialAmount(d, quoteTotalByDealId.get(d.id) ?? null);
    if (pending) awaitingEstimate += 1;
    else pipelineKnown += known;
  }

  const leadsLast30 = leads.filter((l) => new Date(l.created_at) >= period30Start);
  const leadsPrev30 = leads.filter((l) => {
    const t = new Date(l.created_at);
    return t >= period60Start && t < period30Start;
  });

  const [currSignals, prevSignals] = await Promise.all([
    loadResponseSignals(leadsLast30.map((l) => l.id)),
    loadResponseSignals(leadsPrev30.map((l) => l.id)),
  ]);
  const avgResponseMinutes = firstQualifyingResponseMinutes(leadsLast30, currSignals);
  const avgResponseMinutesPrev = firstQualifyingResponseMinutes(leadsPrev30, prevSignals);

  const wonRows = (wonThisMonthRes.data ?? []) as Array<{
    owner_id: string | null;
    won_value: number | null;
  }>;
  const wonValueThisMonth = wonRows.reduce((s, w) => s + (Number(w.won_value) || 0), 0);

  const goalsByUser = new Map<
    string,
    { id: string; target_value: number; currency: string | null }
  >();
  for (const g of (goalsRes.data ?? []) as Array<{
    id: string;
    salesperson_id: string;
    target_value: number;
    currency: string | null;
  }>) {
    goalsByUser.set(g.salesperson_id, {
      id: g.id,
      target_value: Number(g.target_value) || 0,
      currency: g.currency,
    });
  }

  const currency =
    [...goalsByUser.values()].find((g) => g.currency)?.currency || "USD";

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

  const followUpsDueByOwner = new Map<string, number>();
  const overdueByOwner = new Map<string, number>();
  for (const l of leads) {
    if (!l.assigned_to_id || !l.follow_up_date) continue;
    if (CLOSED_LEAD.has(l.status)) continue;
    const due = new Date(l.follow_up_date);
    if (due <= now) {
      followUpsDueByOwner.set(
        l.assigned_to_id,
        (followUpsDueByOwner.get(l.assigned_to_id) ?? 0) + 1
      );
    }
    if (due < now) {
      overdueByOwner.set(l.assigned_to_id, (overdueByOwner.get(l.assigned_to_id) ?? 0) + 1);
    }
  }
  for (const d of activeDeals) {
    if (!d.owner_id) continue;
    const next = getDealNextActionState(d);
    if (!next.at) continue;
    const at = new Date(next.at);
    if (next.isOverdue || at <= now) {
      followUpsDueByOwner.set(d.owner_id, (followUpsDueByOwner.get(d.owner_id) ?? 0) + 1);
    }
    if (next.isOverdue || at < now) {
      overdueByOwner.set(d.owner_id, (overdueByOwner.get(d.owner_id) ?? 0) + 1);
    }
  }

  const atRiskByOwner = new Map<string, number>();
  const noNextByOwner = new Map<string, number>();
  for (const deal of activeDeals) {
    if (!deal.owner_id) continue;
    const att = getDealAttentionState(deal, now);
    if (att.code === "NO_NEXT_ACTION") {
      noNextByOwner.set(deal.owner_id, (noNextByOwner.get(deal.owner_id) ?? 0) + 1);
    }
    if (att.atRisk || att.urgency >= 70) {
      atRiskByOwner.set(deal.owner_id, (atRiskByOwner.get(deal.owner_id) ?? 0) + 1);
    }
  }

  const hotByOwner = new Map<string, number>();
  for (const l of leads) {
    if (!l.assigned_to_id) continue;
    if (l.status !== "NEW") continue;
    const hot =
      (l.score ?? 0) >= HOT_LEAD_SCORE_THRESHOLD ||
      String(l.source ?? "").toUpperCase().includes("WHATSAPP");
    if (!hot) continue;
    hotByOwner.set(l.assigned_to_id, (hotByOwner.get(l.assigned_to_id) ?? 0) + 1);
  }

  const members: CompanyTeamMemberTableRow[] = team.map((member) => {
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
    const progress = hasGoal ? calcProgress(won.value, goal!.target_value) : null;
    const overdueFollowUps = overdueByOwner.get(member.id) ?? 0;
    const dealsAtRisk = atRiskByOwner.get(member.id) ?? 0;
    const hotAwaitingContact = hotByOwner.get(member.id) ?? 0;
    const noNextAction = noNextByOwner.get(member.id) ?? 0;
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
    const isActive = member.is_active !== false;
    const roleGroup = companyTeamRoleGroup(member.role);
    const availabilityOverride =
      (member.availability_override as AvailabilityOverride | null) ?? null;
    const presence: PresenceState = isActive
      ? derivePresenceState({
          lastSeenAt: member.last_seen_at,
          availabilityOverride,
        })
      : "offline";

    return {
      id: member.id,
      name,
      initials: companyTeamInitials(name),
      avatarUrl: member.avatar_url,
      email: member.email,
      phone: member.phone,
      lastSeenAt: member.last_seen_at,
      availabilityOverride,
      presence,
      roleColumn: companyTeamRoleColumn(member.role, member.also_sells),
      titleLabel: companyTeamTitleLabel(member.role, member.also_sells),
      roleGroup,
      isActive,
      alsoSells: Boolean(member.also_sells),
      activeDeals: owned.length,
      pipelineValueKnown: pipelineValue,
      pipelineValueLabel:
        owned.length > 0 && pipelineValue === 0 && pending > 0
          ? "—"
          : moneyLabel(pipelineValue, goal?.currency || currency),
      pipelineAwaitingEstimate: pending,
      dealsWon: won.count,
      wonValue: won.value,
      followUpsDue: followUpsDueByOwner.get(member.id) ?? 0,
      overdueFollowUps,
      hasGoal,
      goalId: hasGoal ? goal!.id : null,
      goalTarget: hasGoal ? goal!.target_value : null,
      goalCurrency: hasGoal ? goal!.currency : null,
      goalProgressPct: progress?.ringPct ?? null,
      attention: derived.attention,
      attentionLabel: companyTeamAttentionLabel(derived.attention),
      supportReason: derived.reason,
      dealsAtRisk,
      hotAwaitingContact,
    };
  });

  members.sort((a, b) => {
    const rank = (x: CompanyTeamMemberTableRow) =>
      x.attention === "needs_attention" ? 2 : x.attention === "watch" ? 1 : 0;
    if (rank(b) !== rank(a)) return rank(b) - rank(a);
    if (b.overdueFollowUps !== a.overdueFollowUps) return b.overdueFollowUps - a.overdueFollowUps;
    if (b.dealsWon !== a.dealsWon) return b.dealsWon - a.dealsWon;
    return a.name.localeCompare(b.name);
  });

  const { slices: composition, total: compositionTotal } = companyTeamComposition(members);
  const teamAvgPct = companyTeamAvgGoalProgress(members);
  const coverageBuckets = companyTeamGoalCoverage(members);

  const needingSupport: CompanyTeamSupportPerson[] = members
    .filter((m) => m.isActive && m.attention !== "on_track" && m.supportReason)
    .sort((a, b) => {
      const rank = (x: CompanyTeamMemberTableRow) =>
        x.attention === "needs_attention" ? 2 : 1;
      if (rank(b) !== rank(a)) return rank(b) - rank(a);
      return b.overdueFollowUps - a.overdueFollowUps;
    })
    .slice(0, 3)
    .map((m) => ({
      id: m.id,
      name: m.name,
      initials: m.initials,
      avatarUrl: m.avatarUrl,
      reason: m.supportReason ?? m.attentionLabel,
      attention: m.attention,
      attentionLabel: m.attentionLabel,
      goalProgressPct: m.goalProgressPct,
    }));

  const activeCount = members.filter((m) => m.isActive).length;

  const kpis = buildTeamKpis({
    teamMembers: activeCount,
    activeDeals: activeDeals.length,
    pipelineKnown,
    awaitingEstimate,
    dealsWon: wonRows.length,
    dealsWonPrev: (wonLastMonthRes.data ?? []).length,
    wonValue: wonValueThisMonth,
    avgResponseMinutes,
    avgResponseMinutesPrev,
    currency,
  });

  return {
    clientId,
    clientName,
    businessType,
    alsoSells,
    canManageTeam: canManage,
    canReassignLeads: canReassign,
    canSetGoals: canManage,
    generatedAt: now.toISOString(),
    currency,
    kpis,
    members,
    composition,
    compositionTotal,
    goalCoverage: {
      teamAvgPct,
      buckets: coverageBuckets,
    },
    needingSupport,
    emptyState: {
      noTeam: members.filter((m) => m.isActive).length === 0,
    },
  };
}
