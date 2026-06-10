import { createAdminClient } from "@/lib/supabase/admin";
import { firstCallResponseMinutes } from "@/lib/metrics";
import {
  addDays,
  addMonths,
  addWeeks,
  getISOWeek,
  getISOWeekYear,
  startOfDay,
  startOfISOWeek,
  startOfMonth,
  subDays,
  subMonths,
  subWeeks,
} from "date-fns";

export type TeamPeriodId = "this_month" | "last_month" | "last_90";

const TERMINAL = new Set(["WON", "LOST", "NOT_QUALIFIED"]);

function isActiveStatus(s: string): boolean {
  return !TERMINAL.has(s);
}

function weekKey(d: Date): string {
  return `${getISOWeekYear(d)}-W${String(getISOWeek(d)).padStart(2, "0")}`;
}

function parseBudget(s: string | null | undefined): number | null {
  if (!s) return null;
  const n = parseFloat(String(s).replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) ? n : null;
}

/** Sum deal_value or parsed budget for open pipeline stages (negotiating / proposal). */
export function pipelineValue(lead: {
  deal_value: unknown;
  budget: string | null;
}): number {
  const dv = lead.deal_value != null ? Number(lead.deal_value) : NaN;
  if (Number.isFinite(dv) && dv > 0) return dv;
  const b = parseBudget(lead.budget ?? undefined);
  return b ?? 0;
}

/** Active pipeline dollar value for a client (NEGOTIATING + PROPOSAL_SENT). */
export async function getClientActivePipelineValue(clientId: string): Promise<number> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("leads")
    .select("deal_value, budget, status")
    .eq("client_id", clientId)
    .in("status", ["NEGOTIATING", "PROPOSAL_SENT"]);
  if (error) throw new Error(error.message);
  let total = 0;
  for (const row of data ?? []) {
    total += pipelineValue(row as { deal_value: unknown; budget: string | null });
  }
  return total;
}

function rangeForPeriod(id: TeamPeriodId, now: Date): { from: Date; to: Date; label: string } {
  switch (id) {
    case "this_month": {
      const from = startOfMonth(now);
      const to = addMonths(from, 1);
      return { from, to, label: "This month" };
    }
    case "last_month": {
      const thisM = startOfMonth(now);
      const from = subMonths(thisM, 1);
      const to = thisM;
      return { from, to, label: "Last month" };
    }
    case "last_90": {
      const to = addDays(startOfDay(now), 1);
      const from = subDays(to, 90);
      return { from, to, label: "Last 90 days" };
    }
  }
}

function prevRange(id: TeamPeriodId, now: Date): { from: Date; to: Date } | null {
  const cur = rangeForPeriod(id, now);
  const ms = cur.to.getTime() - cur.from.getTime();
  const to = cur.from;
  const from = new Date(to.getTime() - ms);
  return { from, to };
}

export type ClientTeamReportPayload = {
  period: { id: TeamPeriodId; from: string; to: string; label: string };
  client: { id: string; name: string; responseTimeLimitHours: number };
  team: Array<{
    userId: string;
    name: string;
    email: string;
    phone: string | null;
    joinedAt: string;
    currentStats: {
      assignedLeads: number;
      activeLeads: number;
      thisMonthLeads: number;
      thisMonthWon: number;
      thisMonthWonValue: number;
      thisMonthContactRate: number;
      avgResponseMinutes: number | null;
      followUpsScheduled: number;
      overdueFollowUps: number;
    };
    trend: {
      leadsByWeek: Array<{ week: string; count: number }>;
      wonByWeek: Array<{ week: string; count: number; value: number }>;
    };
    recentActivity: Array<{
      leadName: string;
      outcome: string;
      notes: string | null;
      createdAt: string;
    }>;
    score: { tier: "performing" | "needs_attention" | "underperforming"; label: string };
    drillDown: {
      insights: string[];
      pipeline: Array<{
        status: string;
        leads: Array<{
          id: string;
          name: string;
          phone: string | null;
          budgetLabel: string;
          lastActivity: string;
        }>;
      }>;
      timeline: Array<{
        id: string;
        kind: "call" | "deal_won";
        title: string;
        detail: string | null;
        at: string;
      }>;
    };
  }>;
  teamAggregate: {
    avgResponseMinutes: number | null;
    winRate: number;
    totalWonValue: number;
    activePipelineValue: number;
    overdueFollowUps: number;
  };
};

type LeadRow = {
  id: string;
  assigned_to_id: string | null;
  status: string;
  name: string | null;
  phone: string | null;
  budget: string | null;
  deal_value: unknown;
  follow_up_date: string | null;
  created_at: string;
  updated_at: string;
};

type LogRow = {
  id: string;
  lead_id: string;
  user_id: string;
  outcome: string;
  notes: string | null;
  created_at: string;
};

export async function computeClientTeamReport(
  clientId: string,
  periodId: TeamPeriodId
): Promise<ClientTeamReportPayload> {
  const now = new Date();
  const { from, to, label } = rangeForPeriod(periodId, now);
  const fromIso = from.toISOString();
  const toIso = to.toISOString();
  const prev = prevRange(periodId, now);

  const supabase = createAdminClient();

  const { data: clientRow, error: cErr } = await supabase
    .from("clients")
    .select("id, name, response_time_limit_hours")
    .eq("id", clientId)
    .maybeSingle();
  if (cErr || !clientRow) throw new Error("Client not found");

  const slaMinutes = Number((clientRow.response_time_limit_hours as number) ?? 2) * 60;

  const { data: salespeople, error: spErr } = await supabase
    .from("users")
    .select("id, name, email, phone, created_at")
    .eq("client_id", clientId)
    .eq("role", "SALESPERSON")
    .eq("is_active", true)
    .order("name");
  if (spErr) throw new Error(spErr.message);

  const spList = salespeople ?? [];
  const spIds = spList.map((u) => u.id as string);

  const { data: leadRows, error: lErr } = await supabase
    .from("leads")
    .select(
      "id, assigned_to_id, status, name, phone, budget, deal_value, follow_up_date, created_at, updated_at"
    )
    .eq("client_id", clientId);
  if (lErr) throw new Error(lErr.message);

  const allLeads = (leadRows ?? []) as LeadRow[];
  const leadIds = allLeads.map((l) => l.id);

  let logs: LogRow[] = [];
  if (leadIds.length > 0) {
    const { data: logRows, error: logErr } = await supabase
      .from("call_logs")
      .select("id, lead_id, user_id, outcome, notes, created_at")
      .in("lead_id", leadIds);
    if (logErr) throw new Error(logErr.message);
    logs = (logRows ?? []) as LogRow[];
  }
  const logsByLead = new Map<string, LogRow[]>();
  for (const log of logs) {
    const lid = log.lead_id;
    if (!logsByLead.has(lid)) logsByLead.set(lid, []);
    logsByLead.get(lid)!.push(log);
  }

  const today = startOfDay(now);

  /** Team-wide pipeline $ for pulse */
  let activePipelineValue = 0;
  let overdueFollowUpsTotal = 0;
  for (const l of allLeads) {
    if (l.status === "NEGOTIATING" || l.status === "PROPOSAL_SENT") {
      activePipelineValue += pipelineValue(l);
    }
    if (l.follow_up_date) {
      const fu = startOfDay(new Date(l.follow_up_date + "T12:00:00"));
      if (fu < today && isActiveStatus(l.status)) overdueFollowUpsTotal += 1;
    }
  }

  /** Win rate in period: WON / (WON + LOST) for leads that closed in range */
  let wonClose = 0;
  let lostClose = 0;
  let totalWonValuePeriod = 0;
  for (const l of allLeads) {
    if (l.status !== "WON" && l.status !== "LOST") continue;
    const t = new Date(l.updated_at);
    if (t >= from && t < to) {
      if (l.status === "WON") {
        wonClose += 1;
        totalWonValuePeriod += Number(l.deal_value ?? 0);
      } else lostClose += 1;
    }
  }
  const winDenom = wonClose + lostClose;
  const winRate = winDenom > 0 ? Math.round((wonClose / winDenom) * 1000) / 10 : 0;

  /** Team avg response: leads created in period, first call */
  const cohortPeriod = allLeads.filter(
    (l) => l.created_at >= fromIso && l.created_at < toIso && spIds.includes(l.assigned_to_id ?? "")
  );
  const cohortIds = cohortPeriod.map((l) => l.id);
  const cohortLogs = logs.filter((x) => cohortIds.includes(x.lead_id));
  const teamAvgResponse = firstCallResponseMinutes(
    cohortPeriod.map((l) => ({ id: l.id, created_at: l.created_at })),
    cohortLogs.map((x) => ({ lead_id: x.lead_id, created_at: x.created_at }))
  );

  const trendAnchor = startOfISOWeek(subWeeks(to, 11));
  const trendEnd = addWeeks(trendAnchor, 12);
  const weekKeys: string[] = [];
  for (let i = 0; i < 12; i++) {
    weekKeys.push(weekKey(addWeeks(trendAnchor, i)));
  }

  const team: ClientTeamReportPayload["team"] = [];

  for (const u of spList) {
    const uid = u.id as string;
    const assigned = allLeads.filter((l) => l.assigned_to_id === uid);
    const assignedLeads = assigned.length;
    const activeLeads = assigned.filter((l) => isActiveStatus(l.status)).length;

    const periodLeads = assigned.filter((l) => l.created_at >= fromIso && l.created_at < toIso);
    const periodWon = assigned.filter(
      (l) => l.status === "WON" && l.updated_at >= fromIso && l.updated_at < toIso
    );
    const thisMonthLeads = periodLeads.length;
    const thisMonthWon = periodWon.length;
    const thisMonthWonValue = periodWon.reduce((s, l) => s + Number(l.deal_value ?? 0), 0);

    const contacted = periodLeads.filter((l) => l.status !== "NEW").length;
    const thisMonthContactRate =
      periodLeads.length > 0 ? Math.round((contacted / periodLeads.length) * 1000) / 10 : 0;

    const plogs = logs.filter((x) => periodLeads.some((pl) => pl.id === x.lead_id));
    const avgResponseMinutes = firstCallResponseMinutes(
      periodLeads.map((l) => ({ id: l.id, created_at: l.created_at })),
      plogs.map((x) => ({ lead_id: x.lead_id, created_at: x.created_at }))
    );

    let followUpsScheduled = 0;
    let overdueFollowUps = 0;
    for (const l of assigned) {
      if (!l.follow_up_date || !isActiveStatus(l.status)) continue;
      const fu = startOfDay(new Date(l.follow_up_date + "T12:00:00"));
      if (fu > today) followUpsScheduled += 1;
      else if (fu < today) overdueFollowUps += 1;
    }

    const leadsByWeekMap = new Map<string, number>();
    const wonByWeekMap = new Map<string, { count: number; value: number }>();
    for (const k of weekKeys) {
      leadsByWeekMap.set(k, 0);
      wonByWeekMap.set(k, { count: 0, value: 0 });
    }
    for (const l of assigned) {
      const c = new Date(l.created_at);
      if (c >= trendAnchor && c < trendEnd) {
        const k = weekKey(startOfISOWeek(c));
        leadsByWeekMap.set(k, (leadsByWeekMap.get(k) ?? 0) + 1);
      }
      if (l.status === "WON") {
        const w = new Date(l.updated_at);
        if (w >= trendAnchor && w < trendEnd) {
          const k = weekKey(startOfISOWeek(w));
          const cur = wonByWeekMap.get(k) ?? { count: 0, value: 0 };
          cur.count += 1;
          cur.value += Number(l.deal_value ?? 0);
          wonByWeekMap.set(k, cur);
        }
      }
    }
    const leadsByWeek = weekKeys.map((wk) => ({ week: wk, count: leadsByWeekMap.get(wk) ?? 0 }));
    const wonByWeek = weekKeys.map((wk) => {
      const o = wonByWeekMap.get(wk) ?? { count: 0, value: 0 };
      return { week: wk, count: o.count, value: o.value };
    });

    const userLogs = logs
      .filter((x) => x.user_id === uid)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 10);
    const recentActivity = userLogs.map((log) => {
      const lead = allLeads.find((l) => l.id === log.lead_id);
      return {
        leadName: lead?.name ?? "Lead",
        outcome: String(log.outcome),
        notes: log.notes ?? null,
        createdAt: log.created_at,
      };
    });

    let tier: "performing" | "needs_attention" | "underperforming" = "performing";
    let scoreLabel = "Performing";
    const overSla = avgResponseMinutes != null && avgResponseMinutes > slaMinutes;
    if (thisMonthContactRate < 50 || overdueFollowUps > 5) {
      tier = "underperforming";
      scoreLabel = "Underperforming";
    } else if (thisMonthContactRate <= 80 || overSla) {
      tier = "needs_attention";
      scoreLabel = "Needs attention";
    } else {
      tier = "performing";
      scoreLabel = "Performing";
    }

    /** Stale NEW leads 3+ days */
    const staleNew = assigned.filter((l) => {
      if (l.status !== "NEW") return false;
      const created = new Date(l.created_at);
      const ageDays = (now.getTime() - created.getTime()) / (24 * 60 * 60 * 1000);
      if (ageDays < 3) return false;
      const ls = logsByLead.get(l.id) ?? [];
      return ls.length === 0;
    }).length;

    let prevWon = 0;
    if (prev) {
      prevWon = assigned.filter(
        (l) => l.status === "WON" && l.updated_at >= prev.from.toISOString() && l.updated_at < prev.to.toISOString()
      ).length;
    }

    const firstName = (u.name as string).split(/\s+/)[0] ?? "This rep";
    const insights: string[] = [];
    if (avgResponseMinutes != null) {
      if (!overSla) {
        insights.push(
          `${firstName}'s avg response is ${formatMinutes(avgResponseMinutes)}, within the ${Number(clientRow.response_time_limit_hours)}h SLA.`
        );
      } else {
        insights.push(
          `Avg response is ${formatMinutes(avgResponseMinutes)}, above the ${Number(clientRow.response_time_limit_hours)}h target.`
        );
      }
    }
    if (staleNew > 0) {
      insights.push(`${staleNew} lead(s) haven’t been contacted in 3+ days.`);
    }
    if (prev && thisMonthWon !== prevWon) {
      const pct =
        prevWon > 0
          ? Math.round(((thisMonthWon - prevWon) / prevWon) * 100)
          : thisMonthWon > 0
            ? 100
            : 0;
      insights.push(
        `Won deals this period (${thisMonthWon}) vs previous (${prevWon})${prevWon > 0 ? ` — ${pct >= 0 ? "+" : ""}${pct}%` : ""}.`
      );
    }
    if (insights.length < 3) {
      insights.push(`Contact rate for this period: ${thisMonthContactRate}%.`);
    }

    const PIPE_STATUSES = ["NEW", "CONTACTED", "NEGOTIATING", "PROPOSAL_SENT"] as const;
    const pipeline = PIPE_STATUSES.map((status) => {
      const ls = assigned.filter((l) => l.status === status && isActiveStatus(l.status));
      return {
        status,
        leads: ls.map((l) => {
          const lsLogs = logsByLead.get(l.id) ?? [];
          const lastLog = lsLogs.reduce((mx, cl) => Math.max(mx, new Date(cl.created_at).getTime()), 0);
          const lastActivity = new Date(
            Math.max(new Date(l.updated_at).getTime(), lastLog)
          ).toISOString();
          const budgetLabel =
            l.deal_value != null && Number(l.deal_value) > 0
              ? `$${Number(l.deal_value).toLocaleString()}`
              : l.budget ?? "—";
          return {
            id: l.id,
            name: l.name ?? "—",
            phone: l.phone,
            budgetLabel,
            lastActivity,
          };
        }),
      };
    });

    const timelineCalls = logs
      .filter((x) => x.user_id === uid)
      .map((x) => ({
        id: `call-${x.id}`,
        kind: "call" as const,
        title: `Call · ${String(x.outcome)}`,
        detail: x.notes || null,
        at: x.created_at,
      }));
    const timelineWins = assigned
      .filter((l) => l.status === "WON")
      .map((l) => ({
        id: `won-${l.id}`,
        kind: "deal_won" as const,
        title: `Deal won · ${l.name ?? "Lead"}`,
        detail: l.deal_value != null ? `$${Number(l.deal_value).toLocaleString()}` : null,
        at: l.updated_at,
      }));
    const timeline = [...timelineCalls, ...timelineWins]
      .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
      .slice(0, 20);

    team.push({
      userId: uid,
      name: u.name as string,
      email: u.email as string,
      phone: (u.phone as string | null) ?? null,
      joinedAt: u.created_at as string,
      currentStats: {
        assignedLeads,
        activeLeads,
        thisMonthLeads,
        thisMonthWon,
        thisMonthWonValue,
        thisMonthContactRate,
        avgResponseMinutes,
        followUpsScheduled,
        overdueFollowUps,
      },
      trend: { leadsByWeek, wonByWeek },
      recentActivity,
      score: { tier, label: scoreLabel },
      drillDown: { insights: insights.slice(0, 3), pipeline, timeline },
    });
  }

  return {
    period: { id: periodId, from: fromIso, to: toIso, label },
    client: {
      id: clientRow.id as string,
      name: clientRow.name as string,
      responseTimeLimitHours: Number(clientRow.response_time_limit_hours ?? 2),
    },
    team,
    teamAggregate: {
      avgResponseMinutes: teamAvgResponse,
      winRate,
      totalWonValue: totalWonValuePeriod,
      activePipelineValue,
      overdueFollowUps: overdueFollowUpsTotal,
    },
  };
}

function formatMinutes(m: number): string {
  if (m < 60) return `${Math.round(m)}m`;
  const h = Math.floor(m / 60);
  const min = Math.round(m % 60);
  return min > 0 ? `${h}h ${min}m` : `${h}h`;
}
