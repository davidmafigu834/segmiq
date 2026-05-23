import { createAdminClient } from "@/lib/supabase/admin";
import { fetchCallLogsForLeadIds } from "@/lib/agency-report";
import { firstCallResponseMinutes } from "@/lib/metrics";
import type { CohortLeadRow } from "@/lib/agency-report";
import { eachDayOfInterval, format, subDays, subMilliseconds } from "date-fns";

function isContacted(status: string): boolean {
  return status !== "NEW";
}

function firstWonAt(
  leadId: string,
  logs: Array<{ lead_id: string; created_at: string; outcome: string }>
): string | null {
  const times = logs
    .filter((l) => l.lead_id === leadId && l.outcome === "WON")
    .map((l) => new Date(l.created_at).getTime());
  if (times.length === 0) return null;
  return new Date(Math.min(...times)).toISOString();
}

export type ClientReportPayload = {
  period: { from: string; to: string; label: string };
  client: { id: string; name: string; industry: string; logoUrl: string | null; responseTimeLimitHours: number };
  headline: {
    leads: number;
    wonCount: number;
    wonValue: number;
    contactRate: number;
    avgResponseMinutes: number | null;
  };
  deltas: {
    leadsPct: number;
    wonCountPct: number;
    wonValuePct: number;
    contactRatePts: number;
    avgResponseMinutesDiff: number | null;
  };
  bySource: {
    FACEBOOK: { leads: number; won: number };
    LANDING_PAGE: { leads: number; won: number };
    MANUAL: { leads: number; won: number };
    REFERRAL: { leads: number; won: number };
  };
  pipeline: Record<
    "NEW" | "CONTACTED" | "NEGOTIATING" | "PROPOSAL_SENT" | "WON" | "LOST" | "NOT_QUALIFIED",
    number
  >;
  funnelCaption: { contactedPct: number; proposalPct: number; wonPct: number };
  /** Single-line funnel summary for dashboards. */
  pipelineCaption: string;
  comparison: {
    priorLeads: number;
    priorWonCount: number;
    priorWonValue: number;
  };
  team: Array<{
    userId: string;
    name: string;
    leads: number;
    contacted: number;
    won: number;
    wonValue: number;
    avgResponseMinutes: number | null;
    last14DaysLeads: number[];
  }>;
  recentWins: Array<{
    leadId: string;
    leadName: string;
    dealValue: number | null;
    salespersonName: string;
    closedAt: string;
  }>;
  leadsOverTime: Array<{ date: string; leads: number; won: number }>;
};

async function fetchCohort(clientId: string, fromIso: string, toIso: string): Promise<CohortLeadRow[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("leads")
    .select(
      "id, client_id, assigned_to_id, source, status, name, phone, created_at, updated_at, deal_value, not_qualified_reason, lost_reason"
    )
    .eq("client_id", clientId)
    .gte("created_at", fromIso)
    .lt("created_at", toIso);
  if (error) throw new Error(`client report leads: ${error.message}`);
  return (data ?? []) as CohortLeadRow[];
}

function pctDelta(cur: number, prev: number): number {
  if (prev === 0 && cur === 0) return 0;
  if (prev === 0) return 100;
  return Math.round(((cur - prev) / prev) * 1000) / 10;
}

export async function computeClientReport(
  clientId: string,
  from: Date,
  to: Date,
  label: string
): Promise<ClientReportPayload> {
  const fromIso = from.toISOString();
  const toIso = to.toISOString();
  const ms = to.getTime() - from.getTime();
  const prevTo = new Date(from.getTime());
  const prevFrom = new Date(from.getTime() - ms);
  const prevFromIso = prevFrom.toISOString();
  const prevToIso = prevTo.toISOString();

  const supabase = createAdminClient();
  const { data: clientRow, error: cErr } = await supabase
    .from("clients")
    .select("id, name, industry, logo_url, response_time_limit_hours")
    .eq("id", clientId)
    .maybeSingle();
  if (cErr || !clientRow) {
    throw new Error("Client not found");
  }

  const limitH = Number((clientRow.response_time_limit_hours as number) ?? 2);

  const [cohort, prevCohort] = await Promise.all([
    fetchCohort(clientId, fromIso, toIso),
    fetchCohort(clientId, prevFromIso, prevToIso),
  ]);

  const allIds = Array.from(new Set([...cohort.map((l) => l.id), ...prevCohort.map((l) => l.id)]));
  const logs = await fetchCallLogsForLeadIds(allIds);
  const cohortLogs = logs.filter((l) => cohort.some((x) => x.id === l.lead_id));
  const prevLogs = logs.filter((l) => prevCohort.some((x) => x.id === l.lead_id));

  const leads = cohort.length;
  const contacted = cohort.filter((l) => isContacted(l.status)).length;
  const contactRate = leads ? Math.round((contacted / leads) * 1000) / 10 : 0;
  const wonRows = cohort.filter((l) => l.status === "WON");
  const wonCount = wonRows.length;
  const wonValue = wonRows.reduce((s, l) => s + Number(l.deal_value ?? 0), 0);
  const avgResp = firstCallResponseMinutes(
    cohort as { id: string; created_at: string }[],
    cohortLogs.map((x) => ({ lead_id: x.lead_id, created_at: x.created_at }))
  );

  const pLeads = prevCohort.length;
  const pContacted = prevCohort.filter((l) => isContacted(l.status)).length;
  const pContactRate = pLeads ? Math.round((pContacted / pLeads) * 1000) / 10 : 0;
  const pWonRows = prevCohort.filter((l) => l.status === "WON");
  const pWonCount = pWonRows.length;
  const pWonValue = pWonRows.reduce((s, l) => s + Number(l.deal_value ?? 0), 0);
  const pAvgResp = firstCallResponseMinutes(
    prevCohort as { id: string; created_at: string }[],
    prevLogs.map((x) => ({ lead_id: x.lead_id, created_at: x.created_at }))
  );

  const deltas = {
    leadsPct: pctDelta(leads, pLeads),
    wonCountPct: pctDelta(wonCount, pWonCount),
    wonValuePct: pctDelta(wonValue, pWonValue),
    contactRatePts: Math.round((contactRate - pContactRate) * 10) / 10,
    avgResponseMinutesDiff:
      avgResp != null && pAvgResp != null ? Math.round((pAvgResp - avgResp) * 10) / 10 : null,
  };

  const bySource = {
    FACEBOOK: {
      leads: cohort.filter((l) => l.source === "FACEBOOK").length,
      won: cohort.filter((l) => l.source === "FACEBOOK" && l.status === "WON").length,
    },
    LANDING_PAGE: {
      leads: cohort.filter((l) => l.source === "LANDING_PAGE").length,
      won: cohort.filter((l) => l.source === "LANDING_PAGE" && l.status === "WON").length,
    },
    MANUAL: {
      leads: cohort.filter((l) => l.source === "MANUAL").length,
      won: cohort.filter((l) => l.source === "MANUAL" && l.status === "WON").length,
    },
    REFERRAL: {
      leads: cohort.filter((l) => l.source === "REFERRAL").length,
      won: cohort.filter((l) => l.source === "REFERRAL" && l.status === "WON").length,
    },
  };

  const pipeline = {
    NEW: 0,
    CONTACTED: 0,
    NEGOTIATING: 0,
    PROPOSAL_SENT: 0,
    WON: 0,
    LOST: 0,
    NOT_QUALIFIED: 0,
  } as ClientReportPayload["pipeline"];
  for (const l of cohort) {
    const st = l.status as keyof typeof pipeline;
    if (st in pipeline) pipeline[st] += 1;
  }

  const proposalPlus =
    pipeline.PROPOSAL_SENT + pipeline.WON + pipeline.LOST + pipeline.NOT_QUALIFIED;
  const funnelCaption = {
    contactedPct: leads ? Math.round((contacted / leads) * 1000) / 10 : 0,
    proposalPct: leads ? Math.round((proposalPlus / leads) * 1000) / 10 : 0,
    wonPct: leads ? Math.round((pipeline.WON / leads) * 1000) / 10 : 0,
  };
  const pipelineCaption = `${funnelCaption.contactedPct}% reach contacted. ${funnelCaption.proposalPct}% reach proposal. ${funnelCaption.wonPct}% convert to won.`;

  const { data: salespeople } = await supabase
    .from("users")
    .select("id, name")
    .eq("client_id", clientId)
    .eq("role", "SALESPERSON")
    .eq("is_active", true);

  const spList = salespeople ?? [];
  const team: ClientReportPayload["team"] = [];

  const dayEnd = subMilliseconds(to, 1);
  const chartDays = eachDayOfInterval({ start: from, end: dayEnd });
  const leadsOverTime: ClientReportPayload["leadsOverTime"] = chartDays.map((d) => {
    const key = format(d, "yyyy-MM-dd");
    const dayStart = new Date(d);
    dayStart.setHours(0, 0, 0, 0);
    const next = new Date(dayStart);
    next.setDate(next.getDate() + 1);
    const d0 = dayStart.toISOString();
    const d1 = next.toISOString();
    const dayLeads = cohort.filter((l) => l.created_at >= d0 && l.created_at < d1);
    return {
      date: key,
      leads: dayLeads.length,
      won: dayLeads.filter((l) => l.status === "WON").length,
    };
  });

  const sparkStart = subDays(to, 14);
  const { data: sparkLeads } = await supabase
    .from("leads")
    .select("id, assigned_to_id, created_at")
    .eq("client_id", clientId)
    .gte("created_at", sparkStart.toISOString())
    .lt("created_at", toIso);

  const sparkByUser = new Map<string, Map<string, number>>();
  for (const row of sparkLeads ?? []) {
    const uid = row.assigned_to_id as string | null;
    if (!uid) continue;
    const day = format(new Date(row.created_at as string), "yyyy-MM-dd");
    if (!sparkByUser.has(uid)) sparkByUser.set(uid, new Map());
    const m = sparkByUser.get(uid)!;
    m.set(day, (m.get(day) ?? 0) + 1);
  }

  for (const u of spList) {
    const uid = u.id as string;
    const assigned = cohort.filter((l) => l.assigned_to_id === uid);
    const spLogs = cohortLogs.filter((log) => assigned.some((lead) => lead.id === log.lead_id));
    const avgR = firstCallResponseMinutes(
      assigned as { id: string; created_at: string }[],
      spLogs.map((x) => ({ lead_id: x.lead_id, created_at: x.created_at }))
    );

    const last14: number[] = [];
    const userSpark = sparkByUser.get(uid);
    for (let i = 0; i < 14; i++) {
      const day = subDays(to, 14 - i);
      const key = format(day, "yyyy-MM-dd");
      last14.push(userSpark?.get(key) ?? 0);
    }

    team.push({
      userId: uid,
      name: u.name as string,
      leads: assigned.length,
      contacted: assigned.filter((l) => isContacted(l.status)).length,
      won: assigned.filter((l) => l.status === "WON").length,
      wonValue: assigned.filter((l) => l.status === "WON").reduce((s, l) => s + Number(l.deal_value ?? 0), 0),
      avgResponseMinutes: avgR,
      last14DaysLeads: last14,
    });
  }

  team.sort((a, b) => b.wonValue - a.wonValue);

  const wonLeads = cohort.filter((l) => l.status === "WON");
  const recentWins: ClientReportPayload["recentWins"] = wonLeads
    .map((l) => {
      const closed = firstWonAt(l.id, logs);
      const sp = spList.find((x) => x.id === l.assigned_to_id);
      return {
        leadId: l.id as string,
        leadName: l.name ?? "Lead",
        dealValue: l.deal_value != null ? Number(l.deal_value) : null,
        salespersonName: sp?.name ? (sp.name as string) : "—",
        closedAt: closed ?? l.updated_at,
      };
    })
    .sort((a, b) => new Date(b.closedAt).getTime() - new Date(a.closedAt).getTime())
    .slice(0, 12);

  return {
    period: { from: fromIso, to: toIso, label },
    client: {
      id: clientRow.id as string,
      name: clientRow.name as string,
      industry: clientRow.industry as string,
      logoUrl: (clientRow.logo_url as string | null) ?? null,
      responseTimeLimitHours: limitH,
    },
    headline: {
      leads,
      wonCount,
      wonValue,
      contactRate,
      avgResponseMinutes: avgResp,
    },
    deltas,
    bySource,
    pipeline,
    funnelCaption,
    pipelineCaption,
    comparison: {
      priorLeads: pLeads,
      priorWonCount: pWonCount,
      priorWonValue: pWonValue,
    },
    team,
    recentWins,
    leadsOverTime,
  };
}
