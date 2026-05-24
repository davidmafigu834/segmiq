import { createAdminClient } from "@/lib/supabase/admin";
import { firstCallResponseMinutes, getAvgResponseMinutes } from "@/lib/metrics";
import type { LeadSource, LeadStatus } from "@/types";
import { addMonths, startOfMonth, startOfWeek, subMonths, subWeeks } from "date-fns";

export type ClientTeamOverviewRow = {
  id: string;
  name: string;
  role: string;
  email: string;
  is_active: boolean;
  leadsThisWeek: number;
};

function startOfTodayLocal(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function startOfYesterdayLocal(): Date {
  const t = startOfTodayLocal();
  return new Date(t.getTime() - 24 * 60 * 60 * 1000);
}

export type UncontactedFlagRow = { clientName: string; count: number };

export type RecentLeadRow = {
  id: string;
  name: string | null;
  phone: string | null;
  budget: string | null;
  source: LeadSource;
  status: LeadStatus;
  createdAt: string;
  clientName: string;
  assigneeFirstName: string | null;
  assigneeFullName: string | null;
};

export type ClientPerfRow = {
  id: string;
  name: string;
  industry: string;
  is_active: boolean;
  leadsThisWeek: number;
  contactRate: number;
  /** % of this week's leads whose first call occurred within the client's SLA window. */
  slaComplianceRate: number;
  dealsWonMtd: number;
  avgResponseMinutes: number | null;
  hasFlag: boolean;
};

/** Share of leads where the first call happened within `limitHours` of `created_at`. */
function slaCompliancePercent(
  leads: { id: string; created_at: string }[],
  logsByLeadId: Map<string, Date[]>,
  limitHours: number
): number {
  if (leads.length === 0) return 0;
  const limitMin = Math.max(0.01, limitHours) * 60;
  let ok = 0;
  for (const l of leads) {
    const created = new Date(l.created_at);
    const times = (logsByLeadId.get(l.id) ?? []).filter((d) => d.getTime() >= created.getTime()).sort((a, b) => a.getTime() - b.getTime());
    if (times.length === 0) continue;
    const first = times[0]!;
    const diffMin = (first.getTime() - created.getTime()) / 60_000;
    if (diffMin >= 0 && diffMin <= limitMin) ok += 1;
  }
  return Math.round((ok / leads.length) * 100);
}

export async function fetchAgencyDashboardData() {
  const supabase = createAdminClient();
  const now = new Date();
  const todayStartD = startOfTodayLocal();
  const yesterdayStartD = startOfYesterdayLocal();
  const todayStart = todayStartD.toISOString();
  const yesterdayStart = yesterdayStartD.toISOString();
  const yesterdayEndExclusive = todayStart;
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const weekStartIso = weekStart.toISOString();
  const lastWeekStartIso = subWeeks(weekStart, 1).toISOString();
  const lastWeekEndIso = weekStart.toISOString();
  const monthStart = startOfMonth(now).toISOString();
  const nextMonthStartIso = startOfMonth(addMonths(now, 1)).toISOString();

  const [
    leadsTodayRes,
    leadsYesterdayRes,
    weekLeadsRes,
    lastWeekLeadsRes,
    wonMtdRes,
    newLeadsForFlagsRes,
    clientsRes,
    recentLeadsRaw,
    monthLeadsAllRes,
    activeClientsRes,
    pipelineLeadsRes,
  ] = await Promise.all([
    supabase.from("leads").select("id", { count: "exact", head: true }).gte("created_at", todayStart),
    supabase
      .from("leads")
      .select("id", { count: "exact", head: true })
      .gte("created_at", yesterdayStart)
      .lt("created_at", yesterdayEndExclusive),
    supabase.from("leads").select("id, status").gte("created_at", weekStartIso),
    supabase
      .from("leads")
      .select("id, status")
      .gte("created_at", lastWeekStartIso)
      .lt("created_at", lastWeekEndIso),
    supabase.from("leads").select("id, deal_value").eq("status", "WON").gte("updated_at", monthStart),
    supabase
      .from("leads")
      .select("id, created_at, client_id, clients ( name, response_time_limit_hours )")
      .eq("status", "NEW"),
    supabase.from("clients").select("id, name, response_time_limit_hours").eq("is_active", true),
    supabase
      .from("leads")
      .select("id, name, phone, budget, source, status, created_at, assigned_to_id, clients ( name )")
      .order("created_at", { ascending: false })
      .limit(10),
    supabase
      .from("leads")
      .select("id, created_at, client_id")
      .gte("created_at", monthStart)
      .lt("created_at", nextMonthStartIso),
    supabase
      .from("clients")
      .select("id, name, industry, response_time_limit_hours, is_active")
      .eq("is_archived", false)
      .order("name"),
    supabase
      .from("leads")
      .select("id, status")
      .not("status", "in", "(WON,LOST)"),
  ]);

  const batchErr =
    leadsTodayRes.error ??
    leadsYesterdayRes.error ??
    weekLeadsRes.error ??
    lastWeekLeadsRes.error ??
    wonMtdRes.error ??
    newLeadsForFlagsRes.error ??
    clientsRes.error ??
    recentLeadsRaw.error ??
    monthLeadsAllRes.error ??
    activeClientsRes.error ??
    pipelineLeadsRes.error;
  if (batchErr) {
    throw new Error(`Dashboard data (batch 1): ${batchErr.message}`);
  }

  const monthLeadRows = monthLeadsAllRes.data ?? [];
  const monthLeadIds = monthLeadRows.map((l) => l.id as string);

  const logIdSet = new Set([...monthLeadIds]);
  const callLogsRes =
    logIdSet.size > 0
      ? await supabase.from("call_logs").select("lead_id, created_at").in("lead_id", Array.from(logIdSet))
      : { data: [] as { lead_id: string; created_at: string }[], error: null };
  if (callLogsRes.error) {
    throw new Error(`Dashboard data (call logs): ${callLogsRes.error.message}`);
  }

  const logsAll = callLogsRes.data ?? [];
  const logsMonth = logsAll.filter((l) => monthLeadIds.includes(l.lead_id as string));

  const monthStartD = startOfMonth(now);
  const nextMonthStartD = startOfMonth(addMonths(now, 1));
  const prevMonthStartD = startOfMonth(subMonths(now, 1));
  const [avgResponseTime, avgPrevMonth] = await Promise.all([
    getAvgResponseMinutes(monthStartD, nextMonthStartD, {}),
    getAvgResponseMinutes(prevMonthStartD, monthStartD, {}),
  ]);

  const pipelineByStatus: Record<string, number> = {
    NEW: 0,
    CONTACTED: 0,
    QUALIFIED: 0,
    NEGOTIATING: 0,
    WON: 0,
    LOST: 0,
  };
  for (const l of pipelineLeadsRes.data ?? []) {
    const s = l.status as string;
    if (s in pipelineByStatus) pipelineByStatus[s]++;
  }

  const leadsToday = leadsTodayRes.count ?? 0;
  const leadsYesterday = leadsYesterdayRes.count ?? 0;
  const dayDeltaPct =
    leadsYesterday > 0
      ? Math.round(((leadsToday - leadsYesterday) / leadsYesterday) * 100)
      : leadsToday > 0
        ? 100
        : 0;

  const leadsDeltaNeutral = leadsToday === 0 && leadsYesterday === 0;

  const wl = weekLeadsRes.data ?? [];
  const weekTotal = wl.length;
  const weekContacted = wl.filter((r) => r.status !== "NEW").length;
  const contactRate = weekTotal ? Math.round((weekContacted / weekTotal) * 100) : 0;

  const ll = lastWeekLeadsRes.data ?? [];
  const lastWeekTotal = ll.length;
  const lastWeekContacted = ll.filter((r) => r.status !== "NEW").length;
  const contactRateLastWeek = lastWeekTotal ? Math.round((lastWeekContacted / lastWeekTotal) * 100) : 0;
  const contactRateDeltaPts = contactRate - contactRateLastWeek;

  const wonRows = wonMtdRes.data ?? [];
  const dealsWonMTD = {
    count: wonRows.length,
    valueSum: wonRows.reduce((s, r) => s + Number(r.deal_value ?? 0), 0),
  };

  const avgResponseDeltaMinutes =
    avgResponseTime != null && avgPrevMonth != null ? Math.round(avgPrevMonth - avgResponseTime) : null;

  const limitByClientId = Object.fromEntries(
    (clientsRes.data ?? []).map((c) => [c.id as string, (c.response_time_limit_hours as number) ?? 2])
  );

  const uncontactedByClient = new Map<string, { clientName: string; count: number }>();
  const newRows = newLeadsForFlagsRes.data ?? [];
  for (const row of newRows) {
    const created = new Date(row.created_at as string);
    const hours = (row as { clients?: { response_time_limit_hours?: number } | null }).clients
      ?.response_time_limit_hours;
    const limitH = typeof hours === "number" ? hours : limitByClientId[row.client_id as string] ?? 2;
    const limitMs = limitH * 60 * 60 * 1000;
    if (now.getTime() - created.getTime() <= limitMs) continue;
    const cname = (row as { clients?: { name?: string } | null }).clients?.name ?? "Unknown";
    const cid = row.client_id as string;
    const cur = uncontactedByClient.get(cid) ?? { clientName: cname, count: 0 };
    cur.count += 1;
    uncontactedByClient.set(cid, cur);
  }
  const uncontactedFlags: UncontactedFlagRow[] = Array.from(uncontactedByClient.values()).sort(
    (a, b) => b.count - a.count
  );

  let recentLeads: RecentLeadRow[] = [];
  const recentRaw = recentLeadsRaw.data ?? [];
  if (recentRaw.length > 0) {
    const assigneeIds = Array.from(
      new Set(recentRaw.map((l) => l.assigned_to_id).filter(Boolean))
    ) as string[];
    const { data: assignees } =
      assigneeIds.length > 0
        ? await supabase.from("users").select("id, name").in("id", assigneeIds)
        : { data: [] };
    const nameById = Object.fromEntries((assignees ?? []).map((u) => [u.id as string, u.name as string]));
    recentLeads = recentRaw.map((l) => {
      const full = l.assigned_to_id ? nameById[l.assigned_to_id as string] ?? null : null;
      const first = full?.split(/\s+/)[0] ?? null;
      return {
        id: l.id as string,
        name: l.name as string | null,
        phone: l.phone as string | null,
        budget: l.budget as string | null,
        source: (l.source ?? "MANUAL") as LeadSource,
        status: (l.status ?? "NEW") as LeadStatus,
        createdAt: l.created_at as string,
        clientName: (l as { clients?: { name?: string } | null }).clients?.name ?? "—",
        assigneeFirstName: first,
        assigneeFullName: full,
      };
    });
  }

  const activeClients = activeClientsRes.data ?? [];
  const weekLeadsByClient = new Map<string, { id: string; status: string; created_at: string }[]>();
  const wonByClient = new Map<string, number>();
  const [weekByClientRes, wonClientRes] = await Promise.all([
    supabase.from("leads").select("id, status, client_id, created_at").gte("created_at", weekStartIso),
    supabase.from("leads").select("id, client_id").eq("status", "WON").gte("updated_at", monthStart),
  ]);
  if (weekByClientRes.error || wonClientRes.error) {
    throw new Error(
      `Dashboard data (batch 2): ${weekByClientRes.error?.message ?? wonClientRes.error?.message}`
    );
  }
  const weekByClientData = weekByClientRes.data;
  const wonClientData = wonClientRes.data;
  for (const r of weekByClientData ?? []) {
    const cid = r.client_id as string;
    if (!weekLeadsByClient.has(cid)) weekLeadsByClient.set(cid, []);
    weekLeadsByClient.get(cid)!.push({
      id: r.id as string,
      status: r.status as string,
      created_at: r.created_at as string,
    });
  }
  for (const r of wonClientData ?? []) {
    const cid = r.client_id as string;
    wonByClient.set(cid, (wonByClient.get(cid) ?? 0) + 1);
  }

  const allWeekLeadIds = Array.from(new Set((weekByClientData ?? []).map((r) => r.id as string)));
  const weekLogsRes =
    allWeekLeadIds.length > 0
      ? await supabase.from("call_logs").select("lead_id, created_at").in("lead_id", allWeekLeadIds)
      : { data: [] as { lead_id: string; created_at: string }[], error: null };
  if (weekLogsRes.error) {
    throw new Error(`Dashboard data (week call logs): ${weekLogsRes.error.message}`);
  }
  const logsByLeadWeek = new Map<string, Date[]>();
  for (const log of weekLogsRes.data ?? []) {
    const lid = log.lead_id as string;
    if (!logsByLeadWeek.has(lid)) logsByLeadWeek.set(lid, []);
    logsByLeadWeek.get(lid)!.push(new Date(log.created_at as string));
  }

  const clientPerf: ClientPerfRow[] = activeClients.map((c) => {
    const cid = c.id as string;
    const wk = weekLeadsByClient.get(cid) ?? [];
    const lt = wk.length;
    const cr = lt ? Math.round((wk.filter((x) => x.status !== "NEW").length / lt) * 100) : 0;
    const limitH = Number((c as { response_time_limit_hours?: number }).response_time_limit_hours ?? 2);
    const sla = slaCompliancePercent(
      wk.map((x) => ({ id: x.id, created_at: x.created_at })),
      logsByLeadWeek,
      limitH
    );
    const mids = monthLeadRows.filter((m) => m.client_id === cid).map((m) => m.id as string);
    const logsC = logsMonth.filter((log) => mids.includes(log.lead_id as string));
    const mrows = monthLeadRows.filter((m) => m.client_id === cid);
    const avgR = firstCallResponseMinutes(mrows as { id: string; created_at: string }[], logsC);
    return {
      id: cid,
      name: c.name as string,
      industry: c.industry as string,
      is_active: (c as { is_active?: boolean }).is_active !== false,
      leadsThisWeek: lt,
      contactRate: cr,
      slaComplianceRate: sla,
      dealsWonMtd: wonByClient.get(cid) ?? 0,
      avgResponseMinutes: avgR,
      hasFlag: uncontactedByClient.has(cid),
    };
  });

  return {
    leadsToday,
    leadsYesterday,
    dayDeltaPct,
    leadsDeltaNeutral,
    contactRate,
    contactRateLastWeek,
    contactRateDeltaPts,
    dealsWonMTD,
    avgResponseTime,
    avgResponseDeltaMinutes,
    uncontactedFlags,
    recentLeads,
    clientPerf,
    pipelineByStatus,
  };
}

export async function fetchRecentLeadsForClient(clientId: string): Promise<RecentLeadRow[]> {
  const supabase = createAdminClient();
  const { data: recentRaw, error } = await supabase
    .from("leads")
    .select("id, name, phone, budget, source, status, created_at, assigned_to_id, clients ( name )")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false })
    .limit(10);
  if (error) {
    throw new Error(`Recent leads (client): ${error.message}`);
  }
  if (!recentRaw?.length) return [];
  const assigneeIds = Array.from(new Set(recentRaw.map((l) => l.assigned_to_id).filter(Boolean))) as string[];
  const { data: assignees } =
    assigneeIds.length > 0
      ? await supabase.from("users").select("id, name").in("id", assigneeIds)
      : { data: [] };
  const nameById = Object.fromEntries((assignees ?? []).map((u) => [u.id as string, u.name as string]));
  return recentRaw.map((l) => {
    const full = l.assigned_to_id ? nameById[l.assigned_to_id as string] ?? null : null;
    const first = full?.split(/\s+/)[0] ?? null;
    return {
      id: l.id as string,
      name: l.name as string | null,
      phone: l.phone as string | null,
      budget: l.budget as string | null,
      source: (l.source ?? "MANUAL") as LeadSource,
      status: (l.status ?? "NEW") as LeadStatus,
      createdAt: l.created_at as string,
      clientName: (l as { clients?: { name?: string } | null }).clients?.name ?? "—",
      assigneeFirstName: first,
      assigneeFullName: full,
    };
  });
}

export async function fetchClientTeamOverview(clientId: string): Promise<ClientTeamOverviewRow[]> {
  const supabase = createAdminClient();
  const weekStartIso = startOfWeek(new Date(), { weekStartsOn: 1 }).toISOString();
  const { data: users, error } = await supabase
    .from("users")
    .select("id, name, email, role, is_active")
    .eq("client_id", clientId)
    .eq("is_active", true);
  if (error) {
    throw new Error(`Client team: ${error.message}`);
  }
  const { data: weekLeads } = await supabase
    .from("leads")
    .select("assigned_to_id")
    .eq("client_id", clientId)
    .gte("created_at", weekStartIso);
  const countByAssignee = new Map<string, number>();
  for (const l of weekLeads ?? []) {
    const aid = l.assigned_to_id as string | null;
    if (!aid) continue;
    countByAssignee.set(aid, (countByAssignee.get(aid) ?? 0) + 1);
  }
  return (users ?? []).map((u) => ({
    id: u.id as string,
    name: u.name as string,
    role: u.role as string,
    email: u.email as string,
    is_active: u.is_active as boolean,
    leadsThisWeek: countByAssignee.get(u.id as string) ?? 0,
  }));
}
