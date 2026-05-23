import { createAdminClient } from "@/lib/supabase/admin";
import { isLeadSlow } from "@/lib/leadStatus";
import type { LeadSource, LeadStatus } from "@/types";
import { endOfMonth, endOfDay, startOfDay, startOfMonth, subDays, subMonths } from "date-fns";

export type LeadFilters = {
  status: LeadStatus | "all" | "uncontacted";
  clientIds: string[];
  sources: LeadSource[];
  assigneeIds: string[];
  dateRange: "all" | "this_month" | "last_month" | "90d" | "custom";
  from?: string;
  to?: string;
  search?: string;
  sortBy: "created_at" | "name" | "last_activity" | "deal_value" | "status" | "client";
  sortDir: "asc" | "desc";
  page: number;
  pageSize: number;
};

export type LeadListClient = {
  id: string;
  name: string;
  slug: string | null;
  logo_url: string | null;
  response_time_limit_hours: number | null;
};

export type LeadListAssignee = {
  id: string;
  name: string;
  avatar_url: string | null;
};

export type LeadListRow = {
  id: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  budget: string | null;
  project_type: string | null;
  source: LeadSource;
  status: LeadStatus;
  deal_value: number | null;
  created_at: string;
  updated_at: string;
  follow_up_date: string | null;
  assigned_to_id: string | null;
  client_id: string;
  form_data: Record<string, unknown>;
  magic_token: string | null;
  clients: LeadListClient | null;
  assigned_to: LeadListAssignee | null;
  /** Latest call log time for this lead (agency all-leads UI). */
  last_call_at?: string | null;
};

export type StatusCounts = {
  total: number;
  NEW: number;
  CONTACTED: number;
  NEGOTIATING: number;
  PROPOSAL_SENT: number;
  WON: number;
  LOST: number;
  NOT_QUALIFIED: number;
  uncontacted: number;
};

const STATUSES: LeadStatus[] = [
  "NEW",
  "CONTACTED",
  "NEGOTIATING",
  "PROPOSAL_SENT",
  "WON",
  "LOST",
  "NOT_QUALIFIED",
];

function parseCsvIds(raw: string | undefined): string[] {
  if (!raw?.trim()) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function parseSources(raw: string | undefined): LeadSource[] {
  const allowed: LeadSource[] = ["FACEBOOK", "LANDING_PAGE", "MANUAL", "REFERRAL"];
  if (!raw?.trim()) return [];
  const parts = raw.split(",").map((s) => s.trim().toUpperCase());
  return parts.filter((p): p is LeadSource => allowed.includes(p as LeadSource));
}

export function parseLeadFilters(sp: Record<string, string | undefined>): LeadFilters {
  const statusRaw = (sp.status ?? sp.filter ?? "all").toUpperCase();
  let status: LeadFilters["status"] = "all";
  if (statusRaw === "UNCONTACTED") status = "uncontacted";
  else if (STATUSES.includes(statusRaw as LeadStatus)) status = statusRaw as LeadStatus;

  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
  const pageSize = 50;

  const sortRaw = (sp.sort ?? "created_at").toLowerCase();
  const sortBy: LeadFilters["sortBy"] =
    sortRaw === "name" ||
    sortRaw === "last_activity" ||
    sortRaw === "deal_value" ||
    sortRaw === "status" ||
    sortRaw === "client"
      ? (sortRaw as LeadFilters["sortBy"])
      : "created_at";
  const sortDir = sp.dir === "asc" ? "asc" : "desc";

  const dr = (sp.range ?? sp.date ?? "all") as LeadFilters["dateRange"];
  const dateRange: LeadFilters["dateRange"] =
    dr === "this_month" || dr === "last_month" || dr === "90d" || dr === "custom" ? dr : "all";

  return {
    status,
    clientIds: parseCsvIds(sp.clients),
    sources: parseSources(sp.sources),
    assigneeIds: parseCsvIds(sp.assignees),
    dateRange,
    from: sp.from,
    to: sp.to,
    search: sp.q?.trim() || undefined,
    sortBy,
    sortDir,
    page,
    pageSize,
  };
}

function dateBounds(f: LeadFilters): { from: Date | null; to: Date | null } {
  const now = new Date();
  if (f.dateRange === "this_month") {
    return { from: startOfMonth(now), to: endOfMonth(now) };
  }
  if (f.dateRange === "last_month") {
    const lm = subMonths(now, 1);
    return { from: startOfMonth(lm), to: endOfMonth(lm) };
  }
  if (f.dateRange === "90d") {
    return { from: startOfDay(subDays(now, 90)), to: endOfDay(now) };
  }
  if (f.dateRange === "custom" && f.from && f.to) {
    const a = new Date(f.from);
    const b = new Date(f.to);
    if (!isNaN(a.getTime()) && !isNaN(b.getTime())) {
      return { from: startOfDay(a), to: endOfDay(b) };
    }
  }
  return { from: null, to: null };
}

export function filtersToSearchParams(f: LeadFilters): URLSearchParams {
  const p = new URLSearchParams();
  if (f.status !== "all") {
    if (f.status === "uncontacted") p.set("status", "uncontacted");
    else p.set("status", f.status);
  }
  if (f.clientIds.length) p.set("clients", f.clientIds.join(","));
  if (f.sources.length) p.set("sources", f.sources.join(","));
  if (f.assigneeIds.length) p.set("assignees", f.assigneeIds.join(","));
  if (f.dateRange !== "all") p.set("range", f.dateRange);
  if (f.dateRange === "custom" && f.from && f.to) {
    p.set("from", f.from);
    p.set("to", f.to);
  }
  if (f.search) p.set("q", f.search);
  if (f.sortBy !== "created_at" || f.sortDir !== "desc") {
    p.set("sort", f.sortBy);
    p.set("dir", f.sortDir);
  }
  if (f.page > 1) p.set("page", String(f.page));
  return p;
}

export async function fetchLastCallTimes(leadIds: string[]): Promise<Record<string, string>> {
  if (!leadIds.length) return {};
  const supabase = createAdminClient();
  const { data } = await supabase.from("call_logs").select("lead_id, created_at").in("lead_id", leadIds);
  const best: Record<string, string> = {};
  for (const row of data ?? []) {
    const lid = row.lead_id as string;
    const t = row.created_at as string;
    if (!best[lid] || new Date(t) > new Date(best[lid])) best[lid] = t;
  }
  return best;
}

type FetchResult = {
  rows: LeadListRow[];
  totalCount: number;
};

const MAX_SCAN = 8000;
let shouldFilterArchivedLeads = true;

function isMissingArchivedColumnError(error: unknown): boolean {
  const msg =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : (error as { message?: unknown } | null)?.message;
  if (typeof msg !== "string") return false;
  return msg.includes("column leads.is_archived does not exist");
}

async function runWithArchivedFallback<T>(runner: () => Promise<T>): Promise<T> {
  try {
    return await runner();
  } catch (error) {
    if (shouldFilterArchivedLeads && isMissingArchivedColumnError(error)) {
      shouldFilterArchivedLeads = false;
      return runner();
    }
    throw error;
  }
}

function applyCommonFilters(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  q: any,
  f: Pick<LeadFilters, "clientIds" | "sources" | "assigneeIds" | "search">,
  from: Date | null,
  to: Date | null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): any {
  let out = q;
  if (shouldFilterArchivedLeads) out = out.eq("is_archived", false);
  if (f.clientIds.length) out = out.in("client_id", f.clientIds);
  if (f.sources.length) out = out.in("source", f.sources);
  if (f.assigneeIds.length) {
    const hasUnassigned = f.assigneeIds.includes("__unassigned__");
    const realIds = f.assigneeIds.filter((id) => id !== "__unassigned__");
    if (hasUnassigned && realIds.length) {
      out = out.or(`assigned_to_id.is.null,assigned_to_id.in.(${realIds.join(",")})`);
    } else if (hasUnassigned) {
      out = out.is("assigned_to_id", null);
    } else {
      out = out.in("assigned_to_id", realIds);
    }
  }
  if (from) out = out.gte("created_at", from.toISOString());
  if (to) out = out.lte("created_at", to.toISOString());
  if (f.search) {
    const esc = f.search.replace(/%/g, "").replace(/,/g, "");
    const s = `%${esc}%`;
    out = out.or(`name.ilike.${s},phone.ilike.${s},email.ilike.${s},project_type.ilike.${s}`);
  }
  return out;
}

function mergeLastCallAt(rows: LeadListRow[], lastMap: Record<string, string>): LeadListRow[] {
  return rows.map((r) => ({ ...r, last_call_at: lastMap[r.id] ?? null }));
}

async function attachAssignees(rows: LeadListRow[]): Promise<LeadListRow[]> {
  const supabase = createAdminClient();
  const assigneeIds = Array.from(new Set(rows.map((r) => r.assigned_to_id).filter(Boolean))) as string[];
  if (!assigneeIds.length) return rows.map((r) => ({ ...r, assigned_to: null }));
  const { data: users } = await supabase.from("users").select("id, name, avatar_url").in("id", assigneeIds);
  const assigneeMap = Object.fromEntries(
    (users ?? []).map((u) => [
      u.id as string,
      { id: u.id as string, name: u.name as string, avatar_url: (u.avatar_url as string | null) ?? null },
    ])
  );
  return rows.map((r) => ({
    ...r,
    assigned_to: r.assigned_to_id ? assigneeMap[r.assigned_to_id] ?? null : null,
  }));
}

async function loadLeadsWithMemoryPipeline(
  f: LeadFilters,
  maxScan: number
): Promise<LeadListRow[]> {
  const supabase = createAdminClient();
  const { from, to } = dateBounds(f);
  const select =
    "id, name, phone, email, budget, project_type, source, status, deal_value, created_at, updated_at, follow_up_date, assigned_to_id, client_id, form_data, magic_token, clients ( id, name, slug, logo_url, response_time_limit_hours )";

  let q = applyCommonFilters(supabase.from("leads").select(select), f, from, to);
  if (f.status !== "all" && f.status !== "uncontacted") q = q.eq("status", f.status);
  else if (f.status === "uncontacted") q = q.eq("status", "NEW");

  const { data: rawRows, error } = await q.order("created_at", { ascending: false }).limit(maxScan);
  if (error) throw new Error(error.message);

  let rows = (rawRows ?? []) as unknown as LeadListRow[];
  if (f.status === "uncontacted") {
    rows = rows.filter((r) =>
      isLeadSlow(
        r.status,
        r.created_at,
        (r.clients as { response_time_limit_hours?: number | null } | null)?.response_time_limit_hours
      )
    );
  }

  rows = await attachAssignees(rows);
  const lastMap = await fetchLastCallTimes(rows.map((r) => r.id));
  sortLeads(rows, f, lastMap);
  return mergeLastCallAt(rows, lastMap);
}

function sortLeads(rows: LeadListRow[], f: LeadFilters, lastMap: Record<string, string>) {
  const clientName = (r: LeadListRow) => (r.clients?.name ?? "").toLowerCase();
  rows.sort((a, b) => {
    let cmp = 0;
    switch (f.sortBy) {
      case "name":
        cmp = (a.name ?? "").localeCompare(b.name ?? "");
        break;
      case "deal_value":
        cmp = (a.deal_value ?? 0) - (b.deal_value ?? 0);
        break;
      case "status":
        cmp = a.status.localeCompare(b.status);
        break;
      case "client":
        cmp = clientName(a).localeCompare(clientName(b));
        break;
      case "last_activity": {
        const ta = lastMap[a.id] ? new Date(lastMap[a.id]).getTime() : new Date(a.created_at).getTime();
        const tb = lastMap[b.id] ? new Date(lastMap[b.id]).getTime() : new Date(b.created_at).getTime();
        cmp = ta - tb;
        break;
      }
      case "created_at":
      default:
        cmp = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    }
    return f.sortDir === "asc" ? cmp : -cmp;
  });
  return rows;
}

export async function fetchFilteredLeads(f: LeadFilters): Promise<FetchResult> {
  return runWithArchivedFallback(async () => {
    const supabase = createAdminClient();
    const { from, to } = dateBounds(f);
    const select =
      "id, name, phone, email, budget, project_type, source, status, deal_value, created_at, updated_at, follow_up_date, assigned_to_id, client_id, form_data, magic_token, clients ( id, name, slug, logo_url, response_time_limit_hours )";

    const needsMemorySort =
      f.status === "uncontacted" ||
      f.sortBy === "last_activity" ||
      f.sortBy === "client" ||
      (f.sortBy !== "created_at" && f.sortBy !== "name" && f.sortBy !== "deal_value" && f.sortBy !== "status");

    if (!needsMemorySort) {
      let q = applyCommonFilters(supabase.from("leads").select(select, { count: "exact" }), f, from, to);
      if (f.status !== "all" && f.status !== "uncontacted") {
        q = q.eq("status", f.status);
      }
      const ascending = f.sortDir === "asc";
      const col =
        f.sortBy === "name"
          ? "name"
          : f.sortBy === "deal_value"
            ? "deal_value"
            : f.sortBy === "status"
              ? "status"
              : "created_at";
      const start = (f.page - 1) * f.pageSize;
      const end = start + f.pageSize - 1;
      const { data, error, count } = await q.order(col, { ascending, nullsFirst: false }).range(start, end);
      if (error) throw new Error(error.message);
      const rowsRaw = await attachAssignees((data ?? []) as unknown as LeadListRow[]);
      const lastMap = await fetchLastCallTimes(rowsRaw.map((r) => r.id));
      const rows = mergeLastCallAt(rowsRaw, lastMap);
      return { rows, totalCount: count ?? rows.length };
    }

    const rows = await loadLeadsWithMemoryPipeline(f, MAX_SCAN);
    const totalCount = rows.length;
    const start = (f.page - 1) * f.pageSize;
    const pageRows = rows.slice(start, start + f.pageSize);
    return { rows: pageRows, totalCount };
  });
}

/** Full filtered list for CSV (same ordering as table when possible), capped at `maxRows`. */
export async function fetchLeadsForExport(f: LeadFilters, maxRows = 10_000): Promise<LeadListRow[]> {
  return runWithArchivedFallback(async () => {
    const supabase = createAdminClient();
    const { from, to } = dateBounds(f);
    const select =
      "id, name, phone, email, budget, source, status, deal_value, created_at, updated_at, follow_up_date, assigned_to_id, client_id, form_data, magic_token, project_type, clients ( id, name, slug, logo_url, response_time_limit_hours )";

    const needsMemorySort =
      f.status === "uncontacted" ||
      f.sortBy === "last_activity" ||
      f.sortBy === "client" ||
      (f.sortBy !== "created_at" && f.sortBy !== "name" && f.sortBy !== "deal_value" && f.sortBy !== "status");

    if (!needsMemorySort) {
      let q = applyCommonFilters(supabase.from("leads").select(select), f, from, to);
      if (f.status !== "all" && f.status !== "uncontacted") {
        q = q.eq("status", f.status);
      }
      const ascending = f.sortDir === "asc";
      const col =
        f.sortBy === "name"
          ? "name"
          : f.sortBy === "deal_value"
            ? "deal_value"
            : f.sortBy === "status"
              ? "status"
              : "created_at";
      const { data, error } = await q.order(col, { ascending, nullsFirst: false }).limit(maxRows);
      if (error) throw new Error(error.message);
      return attachAssignees((data ?? []) as unknown as LeadListRow[]);
    }

    const rows = await loadLeadsWithMemoryPipeline(f, maxRows);
    return rows.slice(0, maxRows);
  });
}

export async function getStatusCounts(fBase: LeadFilters): Promise<StatusCounts> {
  return runWithArchivedFallback(async () => {
    const supabase = createAdminClient();
    const { from, to } = dateBounds(fBase);
    const common = { ...fBase, status: "all" as const };

    const { count: total } = await applyCommonFilters(
      supabase.from("leads").select("id", { count: "exact", head: true }),
      common,
      from,
      to
    );

    const c: StatusCounts = {
      total: total ?? 0,
      NEW: 0,
      CONTACTED: 0,
      NEGOTIATING: 0,
      PROPOSAL_SENT: 0,
      WON: 0,
      LOST: 0,
      NOT_QUALIFIED: 0,
      uncontacted: 0,
    };

    for (const st of STATUSES) {
      const { count } = await applyCommonFilters(
        supabase.from("leads").select("id", { count: "exact", head: true }),
        common,
        from,
        to
      ).eq("status", st);
      (c as Record<string, number>)[st] = count ?? 0;
    }

    const { data: newRows } = await applyCommonFilters(
      supabase.from("leads").select("id, created_at, clients ( response_time_limit_hours )"),
      common,
      from,
      to
    )
      .eq("status", "NEW")
      .limit(5000);

    for (const r of newRows ?? []) {
      if (
        isLeadSlow(
          "NEW",
          r.created_at as string,
          (r as { clients?: { response_time_limit_hours?: number | null } | null }).clients?.response_time_limit_hours
        )
      ) {
        c.uncontacted += 1;
      }
    }

    return c;
  });
}

export function buildFilterDescription(f: LeadFilters, clientNames: Map<string, string>): string {
  const parts: string[] = [];
  if (f.dateRange === "this_month") parts.push("this month");
  else if (f.dateRange === "last_month") parts.push("last month");
  else if (f.dateRange === "90d") parts.push("last 90 days");
  else if (f.dateRange === "custom" && f.from && f.to) parts.push(`${f.from} – ${f.to}`);
  else parts.push("all time");

  if (f.clientIds.length) {
    const names = f.clientIds.map((id) => clientNames.get(id) ?? "Client").slice(0, 3);
    parts.push(
      `${f.clientIds.length} client${f.clientIds.length > 1 ? "s" : ""}${f.clientIds.length > 3 ? "+" : ""}${names.length ? ` (${names.join(", ")})` : ""}`
    );
  }
  if (f.sources.length) parts.push(f.sources.join(", ").toLowerCase().replaceAll("_", " "));
  if (f.assigneeIds.length) parts.push(`${f.assigneeIds.length} assignee filter`);
  if (f.search) parts.push(`search “${f.search}”`);
  if (f.status !== "all" && f.status !== "uncontacted") parts.push(String(f.status).toLowerCase().replaceAll("_", " "));
  if (f.status === "uncontacted") parts.push("uncontacted");
  return parts.join(" · ");
}
