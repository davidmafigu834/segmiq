import { createAdminClient } from "@/lib/supabase/admin";
import { now } from "@/lib/clock";
import { asRows } from "@/lib/agent/rows";
import { DEAL_ACTIVE_STAGES, formatDealStage } from "@/lib/sales/deals/display";
import { getDealCommercialValue } from "@/lib/sales/deals/commercial-value";
import { getDealNextActionState } from "@/lib/sales/deals/timeline";
import { formatDealValue } from "@/lib/sales/sales-dashboard-display";
import { SCORE_HOT_MIN } from "@/lib/inbox/scoring";
import { listJobs } from "@/lib/agent/proactive/jobs";
import { REASON_CODE_LABELS } from "@/lib/agent/proactive/types";
import { reportTrend } from "@/lib/sales/company-reports/metrics";
import type { DealRow } from "@/types";
import { resolveDatePreset, type ResolvedRange } from "./dates";
import { conversationHref, managerHref } from "./hrefs";
import { MAX_QUERY_ROWS, type ManagerActor, type ResultRow, type TableBlock } from "./types";

function money(n: number | null | undefined): string | null {
  if (n == null || !Number.isFinite(n) || n <= 0) return null;
  return formatDealValue(n);
}

function dealAmount(deal: DealRow): number {
  const v = getDealCommercialValue(deal);
  if (v.kind === "amount") return v.amount;
  if (v.kind === "range") return (v.min + v.max) / 2;
  return 0;
}

async function userNames(clientId: string): Promise<Map<string, string>> {
  const supabase = createAdminClient();
  const { data } = await supabase.from("users").select("id, name").eq("client_id", clientId);
  return new Map(asRows<{ id: string; name: string | null }>(data).map((u) => [u.id, u.name ?? "Unassigned"]));
}

export async function resolveUserByName(
  actor: ManagerActor,
  name: string
): Promise<Array<{ id: string; name: string }>> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("users")
    .select("id, name")
    .eq("client_id", actor.clientId)
    .ilike("name", `%${name.trim()}%`)
    .limit(8);
  return asRows<{ id: string; name: string | null }>(data).map((u) => ({
    id: u.id,
    name: u.name || "Unnamed",
  }));
}

export async function resolveLeadsByName(
  actor: ManagerActor,
  name: string
): Promise<ResultRow[]> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("leads")
    .select("id, name, status, assigned_to_id, active_deal_id, project_type")
    .eq("client_id", actor.clientId)
    .ilike("name", `%${name.trim()}%`)
    .limit(8);
  const names = await userNames(actor.clientId);
  return asRows<{
    id: string;
    name: string | null;
    status: string | null;
    assigned_to_id: string | null;
    active_deal_id: string | null;
    project_type: string | null;
  }>(data).map((l) => ({
    id: l.id,
    entityType: "LEAD" as const,
    title: l.name || "Lead",
    subtitle: l.project_type,
    status: l.status,
    valueLabel: null,
    ownerName: l.assigned_to_id ? names.get(l.assigned_to_id) ?? null : null,
    ownerId: l.assigned_to_id,
    href: conversationHref(l.id),
    meta: { dealId: l.active_deal_id },
  }));
}

export async function searchLeads(
  actor: ManagerActor,
  filters: {
    status?: string[];
    ownerId?: string | null;
    sourceContains?: string;
    hot?: boolean;
    scoreGte?: number;
    unassigned?: boolean;
    uncontacted?: boolean;
    createdRange?: ResolvedRange;
    hasDeal?: boolean;
    facebook?: boolean;
    limit?: number;
  }
): Promise<TableBlock> {
  const supabase = createAdminClient();
  const limit = Math.min(filters.limit ?? MAX_QUERY_ROWS, MAX_QUERY_ROWS);
  let q = supabase
    .from("leads")
    .select("id, name, status, source, score, assigned_to_id, follow_up_date, created_at, active_deal_id, project_type")
    .eq("client_id", actor.clientId)
    .order("created_at", { ascending: false })
    .limit(limit + 1);
  if (filters.status?.length) q = q.in("status", filters.status);
  if (filters.unassigned) q = q.is("assigned_to_id", null);
  else if (filters.ownerId) q = q.eq("assigned_to_id", filters.ownerId);
  if (filters.uncontacted) q = q.eq("status", "NEW");
  if (filters.createdRange) {
    q = q.gte("created_at", filters.createdRange.from.toISOString()).lt("created_at", filters.createdRange.to.toISOString());
  }
  if (filters.hasDeal === true) q = q.not("active_deal_id", "is", null);
  if (filters.hasDeal === false) q = q.is("active_deal_id", null);
  if (filters.sourceContains) q = q.ilike("source", `%${filters.sourceContains}%`);
  if (filters.facebook) q = q.ilike("source", "%facebook%");

  const { data } = await q;
  let rows = asRows<{
    id: string;
    name: string | null;
    status: string | null;
    source: string | null;
    score: number | null;
    assigned_to_id: string | null;
    follow_up_date: string | null;
    created_at: string;
    active_deal_id: string | null;
    project_type: string | null;
  }>(data);
  if (filters.hot) rows = rows.filter((r) => (r.score ?? 0) >= SCORE_HOT_MIN);
  if (filters.scoreGte != null) rows = rows.filter((r) => (r.score ?? 0) >= filters.scoreGte!);
  const truncated = rows.length > limit;
  rows = rows.slice(0, limit);
  const names = await userNames(actor.clientId);
  const result: ResultRow[] = rows.map((r) => ({
    id: r.id,
    entityType: "LEAD",
    title: r.name || "Lead",
    subtitle: r.source,
    status: r.status,
    valueLabel: r.score != null ? `Score ${r.score}` : null,
    ownerName: r.assigned_to_id ? names.get(r.assigned_to_id) ?? null : "Unassigned",
    ownerId: r.assigned_to_id,
    href: conversationHref(r.id),
    meta: {
      source: r.source,
      score: r.score,
      followUp: r.follow_up_date,
      createdAt: r.created_at,
    },
  }));
  return {
    type: "table",
    entityType: "LEAD",
    title: "Leads",
    columns: [
      { key: "title", label: "Customer" },
      { key: "status", label: "Status" },
      { key: "valueLabel", label: "Score" },
      { key: "ownerName", label: "Owner" },
      { key: "subtitle", label: "Source" },
    ],
    rows: result,
    truncated,
    totalMatched: result.length,
    filtersLabel: filters.hot ? "HOT leads" : filters.uncontacted ? "Not contacted" : null,
  };
}

export async function searchDeals(
  actor: ManagerActor,
  filters: {
    stage?: string[];
    ownerId?: string;
    minValue?: number;
    noNextAction?: boolean;
    noQuotation?: boolean;
    inactiveDays?: number;
    limit?: number;
  }
): Promise<TableBlock> {
  const supabase = createAdminClient();
  const limit = Math.min(filters.limit ?? MAX_QUERY_ROWS, MAX_QUERY_ROWS);
  let q = supabase
    .from("deals")
    .select(
      "id, name, stage, owner_id, originating_lead_id, estimated_value, customer_budget, won_value, value_status, next_action_at, next_action_label, last_meaningful_activity_at, updated_at, expected_decision_at"
    )
    .eq("client_id", actor.clientId)
    .order("updated_at", { ascending: false })
    .limit(400);
  if (filters.stage?.length) q = q.in("stage", filters.stage);
  else q = q.in("stage", [...DEAL_ACTIVE_STAGES]);
  if (filters.ownerId) q = q.eq("owner_id", filters.ownerId);
  const { data } = await q;
  const at = now();
  let deals = asRows<DealRow>(data);
  if (filters.minValue != null) deals = deals.filter((d) => dealAmount(d) >= filters.minValue!);
  if (filters.noNextAction) deals = deals.filter((d) => !getDealNextActionState(d).hasNextAction);
  if (filters.inactiveDays != null) {
    const cutoff = at.getTime() - filters.inactiveDays * 86_400_000;
    deals = deals.filter((d) => {
      const last = Date.parse(d.last_meaningful_activity_at || d.updated_at);
      return Number.isFinite(last) && last < cutoff;
    });
  }
  if (filters.noQuotation) {
    const ids = deals.map((d) => d.id);
    if (ids.length) {
      const { data: quotes } = await supabase
        .from("quotations")
        .select("deal_id, status")
        .eq("client_id", actor.clientId)
        .in("deal_id", ids);
      const withQuote = new Set(
        asRows<{ deal_id: string; status: string }>(quotes)
          .filter((x) => x.status !== "draft" && x.status !== "superseded")
          .map((x) => x.deal_id)
      );
      deals = deals.filter((d) => !withQuote.has(d.id));
    }
  }
  const truncated = deals.length > limit;
  deals = deals.slice(0, limit);
  const names = await userNames(actor.clientId);
  const rows: ResultRow[] = deals.map((d) => {
    const next = getDealNextActionState(d);
    return {
      id: d.id,
      entityType: "DEAL",
      title: d.name || "Deal",
      subtitle: formatDealStage(d.stage),
      status: d.stage,
      valueLabel: money(dealAmount(d)),
      ownerName: d.owner_id ? names.get(d.owner_id) ?? null : null,
      ownerId: d.owner_id,
      href: managerHref("DEAL", d.id),
      meta: {
        lastActivity: d.last_meaningful_activity_at,
        nextAction: next.hasNextAction ? next.at : "None",
        leadId: d.originating_lead_id,
      },
    };
  });
  return {
    type: "table",
    entityType: "DEAL",
    title: "Deals",
    columns: [
      { key: "title", label: "Deal" },
      { key: "subtitle", label: "Stage" },
      { key: "valueLabel", label: "Quoted / estimated value" },
      { key: "ownerName", label: "Owner" },
      { key: "meta.nextAction", label: "Next action" },
    ],
    rows,
    truncated,
    totalMatched: rows.length,
    filtersLabel: filters.noNextAction ? "No next action" : null,
  };
}

export async function searchQuotations(
  actor: ManagerActor,
  filters: {
    status?: string[];
    pendingApproval?: boolean;
    minTotal?: number;
    expiringDays?: number;
    sentRange?: ResolvedRange;
    declined?: boolean;
    includeMargin?: boolean;
    limit?: number;
  }
): Promise<TableBlock> {
  const supabase = createAdminClient();
  const limit = Math.min(filters.limit ?? MAX_QUERY_ROWS, MAX_QUERY_ROWS);
  let q = supabase
    .from("quotations")
    .select(
      "id, quote_number, status, approval_status, total, discount_percent, customer_name, lead_id, deal_id, prepared_by_id, sent_at, valid_until, revision_number, superseded_by_id, created_at"
    )
    .eq("client_id", actor.clientId)
    .order("updated_at", { ascending: false })
    .limit(limit + 1);
  if (filters.pendingApproval) q = q.or("approval_status.eq.pending,status.eq.pending_approval");
  else if (filters.status?.length) q = q.in("status", filters.status);
  if (filters.declined) q = q.in("status", ["rejected"]);
  if (filters.sentRange) {
    q = q
      .gte("sent_at", filters.sentRange.from.toISOString())
      .lt("sent_at", filters.sentRange.to.toISOString());
  }
  const { data } = await q;
  let quotes = asRows<{
    id: string;
    quote_number: string | null;
    status: string;
    approval_status: string | null;
    total: number | null;
    discount_percent: number | null;
    customer_name: string | null;
    lead_id: string;
    prepared_by_id: string | null;
    sent_at: string | null;
    valid_until: string | null;
    revision_number: number | null;
  }>(data);
  if (filters.minTotal != null) quotes = quotes.filter((x) => (x.total ?? 0) >= filters.minTotal!);
  if (filters.expiringDays != null) {
    const until = new Date(now().getTime() + filters.expiringDays * 86_400_000).toISOString().slice(0, 10);
    const today = now().toISOString().slice(0, 10);
    quotes = quotes.filter((x) => x.valid_until && x.valid_until >= today && x.valid_until <= until);
  }
  const truncated = quotes.length > limit;
  quotes = quotes.slice(0, limit);
  const names = await userNames(actor.clientId);
  const rows: ResultRow[] = quotes.map((x) => ({
    id: x.id,
    entityType: "QUOTATION",
    title: x.quote_number || "Quotation",
    subtitle: x.customer_name,
    status: x.approval_status === "pending" ? "Pending approval" : x.status,
    valueLabel: money(x.total),
    ownerName: x.prepared_by_id ? names.get(x.prepared_by_id) ?? null : null,
    ownerId: x.prepared_by_id,
    href: managerHref("QUOTATION", x.id),
    meta: {
      discount: x.discount_percent,
      sentAt: x.sent_at,
      validUntil: x.valid_until,
      revision: x.revision_number,
      leadId: x.lead_id,
    },
  }));
  return {
    type: "table",
    entityType: "QUOTATION",
    title: filters.pendingApproval ? "Quotations waiting for approval" : "Quotations",
    columns: [
      { key: "title", label: "Quote" },
      { key: "subtitle", label: "Customer" },
      { key: "status", label: "Status" },
      { key: "valueLabel", label: "Quoted value" },
      { key: "ownerName", label: "Prepared by" },
    ],
    rows,
    truncated,
    totalMatched: rows.length,
    filtersLabel: filters.pendingApproval ? "Pending approval" : null,
  };
}

export async function searchFollowUps(
  actor: ManagerActor,
  filters: { overdue?: boolean; ownerId?: string; limit?: number }
): Promise<TableBlock> {
  const supabase = createAdminClient();
  const today = now().toISOString().slice(0, 10);
  let q = supabase
    .from("leads")
    .select("id, name, follow_up_date, assigned_to_id, status")
    .eq("client_id", actor.clientId)
    .not("follow_up_date", "is", null)
    .order("follow_up_date", { ascending: true })
    .limit(MAX_QUERY_ROWS);
  if (filters.ownerId) q = q.eq("assigned_to_id", filters.ownerId);
  if (filters.overdue) q = q.lt("follow_up_date", today);
  const { data } = await q;
  const names = await userNames(actor.clientId);
  const rows: ResultRow[] = asRows<{
    id: string;
    name: string | null;
    follow_up_date: string | null;
    assigned_to_id: string | null;
    status: string | null;
  }>(data).map((l) => ({
    id: l.id,
    entityType: "TASK",
    title: l.name || "Follow-up",
    subtitle: l.follow_up_date,
    status: l.follow_up_date && l.follow_up_date < today ? "Overdue" : "Upcoming",
    valueLabel: null,
    ownerName: l.assigned_to_id ? names.get(l.assigned_to_id) ?? null : null,
    ownerId: l.assigned_to_id,
    href: conversationHref(l.id),
    meta: { due: l.follow_up_date },
  }));
  return {
    type: "table",
    entityType: "TASK",
    title: filters.overdue ? "Overdue follow-ups" : "Follow-ups",
    columns: [
      { key: "title", label: "Customer" },
      { key: "status", label: "Status" },
      { key: "subtitle", label: "Due" },
      { key: "ownerName", label: "Owner" },
    ],
    rows,
    truncated: false,
    totalMatched: rows.length,
    filtersLabel: null,
  };
}

export async function searchAppointments(actor: ManagerActor, range?: ResolvedRange): Promise<TableBlock> {
  const supabase = createAdminClient();
  const window = range ?? resolveDatePreset("today");
  const { data: logs } = await supabase
    .from("call_logs")
    .select("id, lead_id, callback_at, user_id, notes")
    .not("callback_at", "is", null)
    .gte("callback_at", window.from.toISOString())
    .lt("callback_at", window.to.toISOString())
    .order("callback_at", { ascending: true })
    .limit(MAX_QUERY_ROWS);
  const logsRows = asRows<{ id: string; lead_id: string; callback_at: string; user_id: string | null; notes: string | null }>(
    logs
  );
  const leadIds = [...new Set(logsRows.map((l) => l.lead_id))];
  const { data: leads } = leadIds.length
    ? await supabase.from("leads").select("id, name, client_id").in("id", leadIds).eq("client_id", actor.clientId)
    : { data: [] };
  const leadMap = new Map(asRows<{ id: string; name: string | null }>(leads).map((l) => [l.id, l.name]));
  const scoped = logsRows.filter((l) => leadMap.has(l.lead_id));
  const names = await userNames(actor.clientId);
  const rows: ResultRow[] = scoped.map((l) => ({
    id: l.id,
    entityType: "APPOINTMENT",
    title: leadMap.get(l.lead_id) || "Appointment",
    subtitle: new Date(l.callback_at).toLocaleString("en-GB", {
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
    }),
    status: "Scheduled",
    valueLabel: null,
    ownerName: l.user_id ? names.get(l.user_id) ?? null : null,
    ownerId: l.user_id,
    href: conversationHref(l.lead_id),
    meta: { at: l.callback_at, leadId: l.lead_id },
  }));
  return {
    type: "table",
    entityType: "APPOINTMENT",
    title: `Appointments · ${window.label}`,
    columns: [
      { key: "title", label: "Customer" },
      { key: "subtitle", label: "When" },
      { key: "ownerName", label: "Owner" },
    ],
    rows,
    truncated: false,
    totalMatched: rows.length,
    filtersLabel: window.label,
  };
}

export async function searchConversations(
  actor: ManagerActor,
  filters: { waiting?: boolean; humanNeeded?: boolean; support?: boolean }
): Promise<TableBlock> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("agent_conversation_state")
    .select("lead_id, status, human_needed_reason, last_customer_message_at, last_human_message_at, last_agent_message_at")
    .eq("client_id", actor.clientId)
    .limit(200);
  const states = asRows<{
    lead_id: string;
    status: string;
    human_needed_reason: string | null;
    last_customer_message_at: string | null;
    last_human_message_at: string | null;
    last_agent_message_at: string | null;
  }>(data);
  let picked = states;
  if (filters.humanNeeded) picked = picked.filter((s) => s.status === "HUMAN_NEEDED");
  if (filters.waiting) {
    picked = picked.filter((s) => {
      const c = Date.parse(s.last_customer_message_at ?? "") || 0;
      const h = Date.parse(s.last_human_message_at ?? "") || 0;
      const a = Date.parse(s.last_agent_message_at ?? "") || 0;
      return c > h && c > a;
    });
  }
  const leadIds = picked.map((s) => s.lead_id);
  const { data: leads } = leadIds.length
    ? await supabase.from("leads").select("id, name, assigned_to_id, whatsapp_conversation_type").in("id", leadIds)
    : { data: [] };
  const leadMap = new Map(
    asRows<{
      id: string;
      name: string | null;
      assigned_to_id: string | null;
      whatsapp_conversation_type: string | null;
    }>(leads).map((l) => [l.id, l])
  );
  if (filters.support) {
    picked = picked.filter((s) => leadMap.get(s.lead_id)?.whatsapp_conversation_type === "SUPPORT");
  }
  const names = await userNames(actor.clientId);
  const rows: ResultRow[] = picked.slice(0, MAX_QUERY_ROWS).map((s) => {
    const lead = leadMap.get(s.lead_id);
    return {
      id: s.lead_id,
      entityType: "CONVERSATION",
      title: lead?.name || "Conversation",
      subtitle: s.human_needed_reason || s.status,
      status: s.status,
      valueLabel: null,
      ownerName: lead?.assigned_to_id ? names.get(lead.assigned_to_id) ?? null : null,
      ownerId: lead?.assigned_to_id ?? null,
      href: conversationHref(s.lead_id),
      meta: { lastCustomer: s.last_customer_message_at },
    };
  });
  return {
    type: "table",
    entityType: "CONVERSATION",
    title: filters.humanNeeded ? "Human needed" : "Conversations",
    columns: [
      { key: "title", label: "Customer" },
      { key: "status", label: "State" },
      { key: "ownerName", label: "Owner" },
      { key: "subtitle", label: "Reason" },
    ],
    rows,
    truncated: picked.length > MAX_QUERY_ROWS,
    totalMatched: rows.length,
    filtersLabel: null,
  };
}

export async function searchSupport(actor: ManagerActor): Promise<TableBlock> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("support_cases")
    .select("id, lead_id, status, reason, reason_category, created_at")
    .eq("client_id", actor.clientId)
    .neq("status", "RESOLVED")
    .order("created_at", { ascending: false })
    .limit(MAX_QUERY_ROWS);
  const cases = asRows<{
    id: string;
    lead_id: string | null;
    status: string;
    reason: string | null;
    reason_category: string | null;
  }>(data);
  const leadIds = cases.map((c) => c.lead_id).filter(Boolean) as string[];
  const { data: leads } = leadIds.length
    ? await supabase.from("leads").select("id, name").in("id", leadIds)
    : { data: [] };
  const names = new Map(asRows<{ id: string; name: string | null }>(leads).map((l) => [l.id, l.name]));
  const rows: ResultRow[] = cases.map((c) => ({
    id: c.id,
    entityType: "SUPPORT_CASE",
    title: (c.lead_id && names.get(c.lead_id)) || "Support case",
    subtitle: c.reason,
    status: c.status,
    valueLabel: c.reason_category,
    ownerName: null,
    ownerId: null,
    href: managerHref("SUPPORT_CASE", c.lead_id || c.id),
    meta: {},
  }));
  return {
    type: "table",
    entityType: "SUPPORT_CASE",
    title: "Open support cases",
    columns: [
      { key: "title", label: "Customer" },
      { key: "status", label: "Status" },
      { key: "valueLabel", label: "Priority" },
      { key: "subtitle", label: "Summary" },
    ],
    rows,
    truncated: false,
    totalMatched: rows.length,
    filtersLabel: null,
  };
}

export async function searchProactive(actor: ManagerActor, opts?: { failed?: boolean; skipped?: boolean; range?: ResolvedRange }) {
  const statuses = opts?.failed
    ? (["FAILED", "EXPIRED"] as const)
    : opts?.skipped
      ? (["SKIPPED"] as const)
      : (["SCHEDULED", "WAITING_FOR_CHANNEL", "WAITING_FOR_HUMAN"] as const);
  const jobs = await listJobs({
    clientId: actor.clientId,
    statuses: [...statuses],
    scheduledFrom: opts?.range?.from.toISOString(),
    scheduledTo: opts?.range?.to.toISOString(),
    limit: MAX_QUERY_ROWS,
  });
  const rows: ResultRow[] = jobs.map((j) => ({
    id: j.id,
    entityType: "PROACTIVE_ACTION",
    title: j.triggerType,
    subtitle: j.decisionSummary || (j.reasonCode ? REASON_CODE_LABELS[j.reasonCode as keyof typeof REASON_CODE_LABELS] : j.status),
    status: j.status,
    valueLabel: null,
    ownerName: null,
    ownerId: null,
    href: managerHref("PROACTIVE_ACTION", j.id),
    meta: {
      scheduledAt: j.scheduledAt,
      reason: j.reasonCode,
      leadId: j.leadId,
    },
  }));
  return {
    type: "table" as const,
    entityType: "PROACTIVE_ACTION" as const,
    title: opts?.failed ? "Failed proactive actions" : opts?.skipped ? "Skipped follow-ups" : "Scheduled Agent evaluations",
    columns: [
      { key: "title", label: "Trigger" },
      { key: "status", label: "Status" },
      { key: "subtitle", label: "Detail" },
    ],
    rows,
    truncated: false,
    totalMatched: rows.length,
    filtersLabel: null,
  };
}

export async function getPipelineSummary(actor: ManagerActor) {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("deals")
    .select(
      "id, stage, estimated_value, customer_budget, won_value, value_status, next_action_at, last_meaningful_activity_at, updated_at, expected_decision_at, next_action_label"
    )
    .eq("client_id", actor.clientId)
    .in("stage", [...DEAL_ACTIVE_STAGES]);
  const deals = asRows<DealRow>(data);
  const byStage: Record<string, { count: number; value: number; noNext: number }> = {};
  for (const stage of DEAL_ACTIVE_STAGES) byStage[stage] = { count: 0, value: 0, noNext: 0 };
  for (const d of deals) {
    const bucket = byStage[d.stage] ?? (byStage[d.stage] = { count: 0, value: 0, noNext: 0 });
    bucket.count += 1;
    bucket.value += dealAmount(d);
    if (!getDealNextActionState(d).hasNextAction) bucket.noNext += 1;
  }
  return {
    activeDeals: deals.length,
    stages: Object.entries(byStage).map(([stage, v]) => ({
      stage,
      label: formatDealStage(stage),
      count: v.count,
      quotedValue: v.value,
      quotedValueLabel: money(v.value) ?? "$0",
      noNextAction: v.noNext,
    })),
  };
}

export async function comparePeriods(actor: ManagerActor, current: ResolvedRange, previous: ResolvedRange) {
  const supabase = createAdminClient();
  async function slice(range: ResolvedRange) {
    const [leads, deals, quotes, won] = await Promise.all([
      supabase
        .from("leads")
        .select("id", { count: "exact", head: true })
        .eq("client_id", actor.clientId)
        .gte("created_at", range.from.toISOString())
        .lt("created_at", range.to.toISOString()),
      supabase
        .from("deals")
        .select("id", { count: "exact", head: true })
        .eq("client_id", actor.clientId)
        .gte("created_at", range.from.toISOString())
        .lt("created_at", range.to.toISOString()),
      supabase
        .from("quotations")
        .select("id, total")
        .eq("client_id", actor.clientId)
        .not("sent_at", "is", null)
        .gte("sent_at", range.from.toISOString())
        .lt("sent_at", range.to.toISOString()),
      supabase
        .from("deals")
        .select("won_value")
        .eq("client_id", actor.clientId)
        .eq("stage", "WON")
        .gte("won_at", range.from.toISOString())
        .lt("won_at", range.to.toISOString()),
    ]);
    const quoteRows = asRows<{ total: number | null }>(quotes.data);
    const quotedValue = quoteRows.reduce((s, q) => s + (Number(q.total) || 0), 0);
    const wonValue = asRows<{ won_value: number | null }>(won.data).reduce((s, d) => s + (Number(d.won_value) || 0), 0);
    return {
      newLeads: leads.count ?? 0,
      dealsCreated: deals.count ?? 0,
      quotationsSent: quoteRows.length,
      quotedValue,
      wonDealValue: wonValue,
    };
  }
  const [a, b] = await Promise.all([slice(current), slice(previous)]);
  const metric = (key: keyof typeof a, label: string, isMoney = false) => {
    const trend = reportTrend(a[key], b[key]);
    return {
      label,
      current: isMoney ? money(a[key]) ?? "$0" : a[key],
      previous: isMoney ? money(b[key]) ?? "$0" : b[key],
      change: trend.label,
    };
  };
  return {
    currentLabel: current.label,
    previousLabel: previous.label,
    metrics: [
      metric("newLeads", "New Leads"),
      metric("dealsCreated", "Deals created"),
      metric("quotationsSent", "Quotations sent"),
      metric("quotedValue", "Quoted value", true),
      metric("wonDealValue", "Won Deal value", true),
    ],
  };
}

export async function getCustomer360(actor: ManagerActor, leadId: string) {
  const supabase = createAdminClient();
  const { data: lead } = await supabase
    .from("leads")
    .select("id, name, status, source, assigned_to_id, follow_up_date, active_deal_id, client_id, score")
    .eq("id", leadId)
    .eq("client_id", actor.clientId)
    .maybeSingle();
  if (!lead) return null;
  const [{ data: deal }, { data: quotes }, { data: support }, state, { data: jobs }] = await Promise.all([
    lead.active_deal_id
      ? supabase.from("deals").select("*").eq("id", lead.active_deal_id as string).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from("quotations")
      .select("id, quote_number, status, total, sent_at, revision_number")
      .eq("lead_id", leadId)
      .order("created_at", { ascending: false })
      .limit(5),
    supabase.from("support_cases").select("id, status, summary").eq("lead_id", leadId).neq("status", "RESOLVED").limit(5),
    (await import("@/lib/agent/conversation-state")).getConversationAgentState(actor.clientId, leadId),
    supabase
      .from("agent_proactive_jobs")
      .select("id, trigger_type, status, scheduled_at, reason_code, decision_summary")
      .eq("lead_id", leadId)
      .in("status", ["SCHEDULED", "SKIPPED", "COMPLETED", "WAITING_FOR_HUMAN"])
      .order("scheduled_at", { ascending: false })
      .limit(5),
  ]);
  const d = deal as DealRow | null;
  return {
    customer: lead.name,
    leadId,
    status: lead.status,
    score: lead.score,
    source: lead.source,
    nextAction: lead.follow_up_date,
    deal: d
      ? {
          id: d.id,
          name: d.name,
          stage: formatDealStage(d.stage),
          value: money(dealAmount(d)),
          href: managerHref("DEAL", d.id),
        }
      : null,
    latestQuote: asRows(quotes)[0] ?? null,
    support: asRows(support),
    agent: state
      ? { status: state.status, paused: Boolean(state.pauseReason), humanTakeover: state.humanTakeover }
      : null,
    proactive: asRows(jobs),
    href: conversationHref(leadId),
  };
}

export async function explainDeal(actor: ManagerActor, dealId: string) {
  const supabase = createAdminClient();
  const { data: deal } = await supabase.from("deals").select("*").eq("id", dealId).eq("client_id", actor.clientId).maybeSingle();
  if (!deal) return null;
  const d = deal as DealRow;
  const next = getDealNextActionState(d);
  const { data: quotes } = await supabase
    .from("quotations")
    .select("id, quote_number, status, sent_at, created_at")
    .eq("deal_id", dealId)
    .order("created_at", { ascending: false })
    .limit(5);
  const { data: events } = await supabase
    .from("lead_events")
    .select("event_type, created_at, event_data")
    .eq("deal_id", dealId)
    .order("created_at", { ascending: false })
    .limit(12);
  const evidence: string[] = [];
  evidence.push(`The Deal is in ${formatDealStage(d.stage)}.`);
  if (d.last_meaningful_activity_at) {
    const days = Math.round((now().getTime() - Date.parse(d.last_meaningful_activity_at)) / 86_400_000);
    evidence.push(`Last meaningful activity was ${days} day${days === 1 ? "" : "s"} ago.`);
  }
  if (!next.hasNextAction) evidence.push("No upcoming task or next action exists.");
  else evidence.push(`Next action is scheduled for ${next.at}.`);
  const quoteRows = asRows<{ status: string; quote_number: string | null }>(quotes);
  if (!quoteRows.length) evidence.push("No quotation has been created.");
  else evidence.push(`Latest quotation ${quoteRows[0]!.quote_number || ""} is ${quoteRows[0]!.status}.`);
  return {
    dealId,
    name: d.name,
    stage: formatDealStage(d.stage),
    value: money(dealAmount(d)),
    evidence,
    inference: !next.hasNextAction
      ? "Likely operational gap: no next action exists after the current stage."
      : null,
    href: managerHref("DEAL", dealId),
    recentEvents: asRows(events).length,
  };
}

export async function searchProducts(
  actor: ManagerActor,
  q: string
): Promise<TableBlock> {
  const { results } = await import("@/lib/products/search").then((m) =>
    m.searchCommercialItems({
      clientId: actor.clientId,
      q,
      types: ["PRODUCT", "SERVICE"],
      limit: 12,
      canSeeCost: true,
    })
  );
  return {
    type: "table",
    entityType: "PRODUCT",
    title: "Products",
    columns: [
      { key: "title", label: "Name" },
      { key: "subtitle", label: "SKU" },
      { key: "status", label: "Type" },
      { key: "valueLabel", label: "Price" },
    ],
    rows: results.map((r) => ({
      id: r.id,
      entityType: "PRODUCT" as const,
      title: r.name,
      subtitle: r.sku ?? null,
      status: r.type,
      valueLabel: r.price != null ? formatDealValue(r.price) : null,
      ownerName: null,
      ownerId: null,
      href: `/client/products/${r.id}`,
      meta: {},
    })),
    truncated: false,
    totalMatched: results.length,
    filtersLabel: q || null,
  };
}

export async function searchPackages(
  actor: ManagerActor,
  q: string
): Promise<TableBlock> {
  const { results } = await import("@/lib/products/search").then((m) =>
    m.searchCommercialItems({
      clientId: actor.clientId,
      q,
      types: ["PACKAGE"],
      limit: 12,
      canSeeCost: true,
    })
  );
  return {
    type: "table",
    entityType: "PACKAGE",
    title: "Packages",
    columns: [
      { key: "title", label: "Name" },
      { key: "subtitle", label: "Availability" },
      { key: "valueLabel", label: "Price" },
    ],
    rows: results.map((r) => ({
      id: r.id,
      entityType: "PACKAGE" as const,
      title: r.name,
      subtitle: r.availability ?? null,
      status: r.status,
      valueLabel: r.price != null ? formatDealValue(r.price) : null,
      ownerName: null,
      ownerId: null,
      href: `/client/packages/${r.id}`,
      meta: {},
    })),
    truncated: false,
    totalMatched: results.length,
    filtersLabel: q || null,
  };
}

export async function getInventoryAvailability(
  actor: ManagerActor,
  productId: string
) {
  const { getAvailability } = await import("@/lib/inventory/service");
  return getAvailability({ clientId: actor.clientId, productId });
}
