import { createAdminClient } from "@/lib/supabase/admin";
import { firstCallResponseMinutes } from "@/lib/metrics";
import type { LeadSource, LeadStatus } from "@/types";
import { eachDayOfInterval, format, subMilliseconds } from "date-fns";

export type AgencyReportFilters = {
  clientIds?: string[];
  sources?: LeadSource[];
  statuses?: LeadStatus[];
  assignedToIds?: string[];
};

export type AgencyReport = {
  period: { from: string; to: string; label: string };
  totals: {
    leads: number;
    contacted: number;
    contactRate: number;
    won: number;
    lost: number;
    wonValue: number;
    avgResponseMinutes: number | null;
    avgTimeToCloseDays: number | null;
  };
  previousTotals: {
    leads: number;
    contacted: number;
    contactRate: number;
    won: number;
    lost: number;
    wonValue: number;
    avgResponseMinutes: number | null;
    avgTimeToCloseDays: number | null;
  };
  bySource: Record<
    LeadSource,
    { leads: number; contacted: number; won: number; wonValue: number; contactRate: number; winRate: number }
  >;
  byClient: Array<{
    clientId: string;
    clientName: string;
    industry: string;
    leads: number;
    contacted: number;
    won: number;
    wonValue: number;
    contactRate: number;
    avgResponseMinutes: number | null;
    rank: number;
  }>;
  bySalesperson: Array<{
    userId: string;
    name: string;
    clientName: string;
    leads: number;
    contacted: number;
    won: number;
    wonValue: number;
    contactRate: number;
    avgResponseMinutes: number | null;
    winRate: number;
  }>;
  byDay: Array<{ date: string; leads: number; contacted: number; won: number }>;
  byNotQualifiedReason: Array<{ reason: string; count: number }>;
};

const SOURCES: LeadSource[] = ["FACEBOOK", "LANDING_PAGE", "MANUAL", "REFERRAL"];

function isContacted(status: string): boolean {
  return status !== "NEW";
}

export type CohortLeadRow = {
  id: string;
  client_id: string;
  assigned_to_id: string | null;
  source: string;
  status: string;
  name: string | null;
  phone: string | null;
  created_at: string;
  updated_at: string;
  deal_value: number | null;
  not_qualified_reason: string | null;
  lost_reason: string | null;
};

async function fetchLeadsInRange(
  fromIso: string,
  toIso: string,
  filters: AgencyReportFilters
): Promise<CohortLeadRow[]> {
  const supabase = createAdminClient();
  let q = supabase
    .from("leads")
    .select(
      "id, client_id, assigned_to_id, source, status, name, phone, created_at, updated_at, deal_value, not_qualified_reason, lost_reason"
    )
    .gte("created_at", fromIso)
    .lt("created_at", toIso);
  if (filters.clientIds?.length) {
    q = q.in("client_id", filters.clientIds);
  }
  if (filters.sources?.length) {
    q = q.in("source", filters.sources);
  }
  const { data, error } = await q;
  if (error) throw new Error(`agency report leads: ${error.message}`);
  return (data ?? []) as CohortLeadRow[];
}

export async function fetchCallLogsForLeadIds(
  leadIds: string[]
): Promise<Array<{ lead_id: string; created_at: string; outcome: string }>> {
  if (leadIds.length === 0) return [];
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("call_logs")
    .select("lead_id, created_at, outcome")
    .in("lead_id", leadIds);
  if (error) throw new Error(`agency report call_logs: ${error.message}`);
  return (data ?? []) as Array<{ lead_id: string; created_at: string; outcome: string }>;
}

function avgTimeToCloseDays(
  wonLeadRows: { id: string; created_at: string }[],
  wonLogs: Map<string, Date>
): number | null {
  const deltas: number[] = [];
  for (const l of wonLeadRows) {
    const w = wonLogs.get(l.id);
    if (!w) continue;
    const created = new Date(l.created_at).getTime();
    const diffDays = (w.getTime() - created) / (24 * 60 * 60 * 1000);
    if (diffDays >= 0 && Number.isFinite(diffDays)) deltas.push(diffDays);
  }
  if (deltas.length === 0) return null;
  return deltas.reduce((a, b) => a + b, 0) / deltas.length;
}

/** First WON log time per lead. */
function firstWonLogTime(logs: Array<{ lead_id: string; created_at: string; outcome: string }>): Map<string, Date> {
  const m = new Map<string, Date>();
  for (const log of logs) {
    if (log.outcome !== "WON") continue;
    const t = new Date(log.created_at);
    const prev = m.get(log.lead_id);
    if (!prev || t < prev) m.set(log.lead_id, t);
  }
  return m;
}

function aggregateReasons(
  leads: Array<{ status: string; not_qualified_reason: string | null; lost_reason: string | null }>
): Array<{ reason: string; count: number }> {
  const counts = new Map<string, number>();
  for (const l of leads) {
    if (l.status === "NOT_QUALIFIED") {
      const r = (l.not_qualified_reason ?? "").trim() || "—";
      counts.set(r, (counts.get(r) ?? 0) + 1);
    } else if (l.status === "LOST") {
      const r = (l.lost_reason ?? "").trim() || "—";
      counts.set(r, (counts.get(r) ?? 0) + 1);
    }
  }
  return Array.from(counts.entries())
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count);
}

export async function computeAgencyReport(
  from: Date,
  to: Date,
  periodLabel: string,
  filters: AgencyReportFilters
): Promise<AgencyReport> {
  const fromIso = from.toISOString();
  const toIso = to.toISOString();
  const ms = to.getTime() - from.getTime();
  const prevTo = new Date(from.getTime());
  const prevFrom = new Date(from.getTime() - ms);

  const prevFromIso = prevFrom.toISOString();
  const prevToIso = prevTo.toISOString();

  const supabase = createAdminClient();
  const { data: clientsRaw } = await supabase
    .from("clients")
    .select("id, name, industry")
    .eq("is_active", true)
    .order("name");
  const clients = clientsRaw ?? [];
  const clientById = Object.fromEntries(clients.map((c) => [c.id as string, c]));

  const [cohortLeads, prevCohortLeads] = await Promise.all([
    fetchLeadsInRange(fromIso, toIso, filters),
    fetchLeadsInRange(prevFromIso, prevToIso, filters),
  ]);

  const cohortIds = cohortLeads.map((l) => l.id);
  const prevCohortIds = prevCohortLeads.map((l) => l.id);
  const allIdsForLogs = Array.from(new Set([...cohortIds, ...prevCohortLeads.map((l) => l.id)]));

  const logs = await fetchCallLogsForLeadIds(allIdsForLogs);
  const cohortLogs = logs.filter((l) => cohortIds.includes(l.lead_id));
  const prevLogs = logs.filter((l) => prevCohortIds.includes(l.lead_id));

  const contactedCount = (rows: CohortLeadRow[]) => rows.filter((r) => isContacted(r.status)).length;

  const totalsLeads = cohortLeads.length;
  const totalsContacted = contactedCount(cohortLeads);
  const contactRate = totalsLeads ? Math.round((totalsContacted / totalsLeads) * 1000) / 10 : 0;

  const wonRows = cohortLeads.filter((l) => l.status === "WON");
  const wonValue = wonRows.reduce((s, r) => s + Number(r.deal_value ?? 0), 0);
  const wonCount = wonRows.length;
  const lostCount = cohortLeads.filter((l) => l.status === "LOST").length;

  const wonLeadMeta = cohortLeads.filter((l) => l.status === "WON");
  const wonLogTimes = firstWonLogTime(logs.filter((x) => cohortIds.includes(x.lead_id)));
  const avgClose = avgTimeToCloseDays(wonLeadMeta, wonLogTimes);

  const avgResp = firstCallResponseMinutes(
    cohortLeads as { id: string; created_at: string }[],
    cohortLogs.map((l) => ({ lead_id: l.lead_id, created_at: l.created_at }))
  );

  const prevTotalsLeads = prevCohortLeads.length;
  const prevContacted = contactedCount(prevCohortLeads);
  const prevContactRate = prevTotalsLeads ? Math.round((prevContacted / prevTotalsLeads) * 1000) / 10 : 0;
  const prevWonRows = prevCohortLeads.filter((l) => l.status === "WON");
  const prevWonValue = prevWonRows.reduce((s, r) => s + Number(r.deal_value ?? 0), 0);
  const prevWonCount = prevWonRows.length;
  const prevLostCount = prevCohortLeads.filter((l) => l.status === "LOST").length;
  const prevWonLeadMeta = prevCohortLeads.filter((l) => l.status === "WON");
  const prevWonLogTimes = firstWonLogTime(logs.filter((x) => prevCohortIds.includes(x.lead_id)));
  const prevAvgClose = avgTimeToCloseDays(prevWonLeadMeta, prevWonLogTimes);
  const prevAvgResp = firstCallResponseMinutes(
    prevCohortLeads as { id: string; created_at: string }[],
    prevLogs.map((l) => ({ lead_id: l.lead_id, created_at: l.created_at }))
  );

  const bySource = {} as AgencyReport["bySource"];
  for (const src of SOURCES) {
    const sub = cohortLeads.filter((l) => l.source === src);
    const ld = sub.length;
    const co = sub.filter((l) => isContacted(l.status)).length;
    const wn = sub.filter((l) => l.status === "WON").length;
    const wv = sub.filter((l) => l.status === "WON").reduce((s, l) => s + Number(l.deal_value ?? 0), 0);
    const cr = ld ? Math.round((co / ld) * 1000) / 10 : 0;
    const wr = ld ? Math.round((wn / ld) * 1000) / 10 : 0;
    bySource[src] = { leads: ld, contacted: co, won: wn, wonValue: wv, contactRate: cr, winRate: wr };
  }

  const byClientMap = new Map<
    string,
    {
      clientId: string;
      clientName: string;
      industry: string;
      leads: number;
      contacted: number;
      won: number;
      wonValue: number;
      leadRows: CohortLeadRow[];
    }
  >();

  for (const c of clients) {
    const id = c.id as string;
    byClientMap.set(id, {
      clientId: id,
      clientName: c.name as string,
      industry: c.industry as string,
      leads: 0,
      contacted: 0,
      won: 0,
      wonValue: 0,
      leadRows: [],
    });
  }

  for (const l of cohortLeads) {
    const cid = l.client_id as string;
    if (!byClientMap.has(cid)) {
      const cl = clientById[cid];
      byClientMap.set(cid, {
        clientId: cid,
        clientName: (cl?.name as string) ?? "—",
        industry: (cl?.industry as string) ?? "—",
        leads: 0,
        contacted: 0,
        won: 0,
        wonValue: 0,
        leadRows: [],
      });
    }
    const row = byClientMap.get(cid)!;
    row.leads += 1;
    row.leadRows.push(l);
    if (isContacted(l.status)) row.contacted += 1;
    if (l.status === "WON") {
      row.won += 1;
      row.wonValue += Number(l.deal_value ?? 0);
    }
  }

  const byClient = Array.from(byClientMap.values())
    .filter((r) => r.leads > 0)
    .map((r) => {
      const cr = r.leads ? Math.round((r.contacted / r.leads) * 1000) / 10 : 0;
      const lr = r.leadRows;
      const logsForClient = cohortLogs.filter((log) => lr.some((lead) => lead.id === log.lead_id));
      const avgR = firstCallResponseMinutes(
        lr as { id: string; created_at: string }[],
        logsForClient.map((x) => ({ lead_id: x.lead_id, created_at: x.created_at }))
      );
      return {
        clientId: r.clientId,
        clientName: r.clientName,
        industry: r.industry,
        leads: r.leads,
        contacted: r.contacted,
        won: r.won,
        wonValue: r.wonValue,
        contactRate: cr,
        avgResponseMinutes: avgR,
        rank: 0,
      };
    })
    .sort((a, b) => b.leads - a.leads);

  byClient.forEach((r, i) => {
    r.rank = i + 1;
  });

  const spMap = new Map<
    string,
    {
      userId: string;
      name: string;
      clientName: string;
      leads: number;
      contacted: number;
      won: number;
      wonValue: number;
      leadRows: CohortLeadRow[];
    }
  >();

  const assigneeIds = Array.from(
    new Set(cohortLeads.map((l) => l.assigned_to_id).filter(Boolean))
  ) as string[];
  const { data: usersData } =
    assigneeIds.length > 0
      ? await supabase.from("users").select("id, name, client_id, clients ( name )").in("id", assigneeIds)
      : { data: [] as { id: string; name: string; client_id: string | null; clients: { name: string } | null }[] };

  const userById = Object.fromEntries(
    (usersData ?? []).map((u) => [
      u.id as string,
      {
        name: u.name as string,
        clientName: (u as { clients?: { name?: string } | null }).clients?.name ?? "—",
      },
    ])
  );

  for (const l of cohortLeads) {
    const uid = l.assigned_to_id as string | null;
    if (!uid) continue;
    if (!spMap.has(uid)) {
      const u = userById[uid] ?? { name: "—", clientName: "—" };
      spMap.set(uid, {
        userId: uid,
        name: u.name,
        clientName: u.clientName,
        leads: 0,
        contacted: 0,
        won: 0,
        wonValue: 0,
        leadRows: [],
      });
    }
    const s = spMap.get(uid)!;
    s.leads += 1;
    s.leadRows.push(l);
    if (isContacted(l.status)) s.contacted += 1;
    if (l.status === "WON") {
      s.won += 1;
      s.wonValue += Number(l.deal_value ?? 0);
    }
  }

  const bySalesperson = Array.from(spMap.values())
    .map((r) => {
      const cr = r.leads ? Math.round((r.contacted / r.leads) * 1000) / 10 : 0;
      const wr = r.leads ? Math.round((r.won / r.leads) * 1000) / 10 : 0;
      const logsForSp = cohortLogs.filter((log) => r.leadRows.some((lead) => lead.id === log.lead_id));
      const avgR = firstCallResponseMinutes(
        r.leadRows as { id: string; created_at: string }[],
        logsForSp.map((x) => ({ lead_id: x.lead_id, created_at: x.created_at }))
      );
      return {
        userId: r.userId,
        name: r.name,
        clientName: r.clientName,
        leads: r.leads,
        contacted: r.contacted,
        won: r.won,
        wonValue: r.wonValue,
        contactRate: cr,
        avgResponseMinutes: avgR,
        winRate: wr,
      };
    })
    .filter((r) => r.contacted >= 5)
    .sort((a, b) => b.winRate - a.winRate);

  const dayEnd = subMilliseconds(to, 1);
  const days = eachDayOfInterval({ start: from, end: dayEnd });
  const byDay: AgencyReport["byDay"] = days.map((d) => {
    const key = format(d, "yyyy-MM-dd");
    const dayStart = new Date(d);
    dayStart.setHours(0, 0, 0, 0);
    const next = new Date(dayStart);
    next.setDate(next.getDate() + 1);
    const d0 = dayStart.toISOString();
    const d1 = next.toISOString();

    const dayLeads = cohortLeads.filter((l) => l.created_at >= d0 && l.created_at < d1);
    const leads = dayLeads.length;
    const contacted = dayLeads.filter((l) => isContacted(l.status)).length;
    const won = dayLeads.filter((l) => l.status === "WON").length;
    return { date: key, leads, contacted, won };
  });

  const nqLeads = cohortLeads.filter((l) => l.status === "NOT_QUALIFIED" || l.status === "LOST");
  const byNotQualifiedReason = aggregateReasons(
    nqLeads.map((l) => ({
      status: l.status,
      not_qualified_reason: l.not_qualified_reason,
      lost_reason: l.lost_reason,
    }))
  ).slice(0, 20);

  return {
    period: { from: fromIso, to: toIso, label: periodLabel },
    totals: {
      leads: totalsLeads,
      contacted: totalsContacted,
      contactRate,
      won: wonCount,
      lost: lostCount,
      wonValue,
      avgResponseMinutes: avgResp,
      avgTimeToCloseDays: avgClose,
    },
    previousTotals: {
      leads: prevTotalsLeads,
      contacted: prevContacted,
      contactRate: prevContactRate,
      won: prevWonCount,
      lost: prevLostCount,
      wonValue: prevWonValue,
      avgResponseMinutes: prevAvgResp,
      avgTimeToCloseDays: prevAvgClose,
    },
    bySource,
    byClient,
    bySalesperson,
    byDay,
    byNotQualifiedReason,
  };
}

/** Parse multi-value query: clientId=a&clientId=b or clientIds=a,b */
export function parseClientIds(searchParams: URLSearchParams): string[] | undefined {
  const multi = searchParams.getAll("clientId");
  if (multi.length) return multi;
  const csv = searchParams.get("clientIds");
  if (csv) return csv.split(",").map((s) => s.trim()).filter(Boolean);
  return undefined;
}

export function parseSources(searchParams: URLSearchParams): LeadSource[] | undefined {
  const single = searchParams.get("source");
  if (single && single !== "ALL" && (SOURCES as string[]).includes(single)) {
    return [single as LeadSource];
  }
  const s = searchParams.get("sources");
  if (!s || s === "ALL") return undefined;
  const parts = s.split(",").map((x) => x.trim()) as LeadSource[];
  const ok = parts.filter((p): p is LeadSource => (SOURCES as string[]).includes(p));
  return ok.length ? ok : undefined;
}
