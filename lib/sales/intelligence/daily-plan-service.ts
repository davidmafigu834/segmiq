/**
 * Daily Sales Plan service — assemble plan from real DB signals + priority engine.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { getAgencySettings } from "@/lib/agency-settings";
import { fetchLatestScheduledCallbacksByLeadId } from "@/lib/convert-later-picks";
import { leadCardDisplayName } from "@/lib/leads/whatsapp-lead-display";
import { SCORE_HOT_MIN } from "@/lib/inbox/scoring";
import { goalPeriodBounds, parseGoalPeriodKey } from "@/lib/sales/goals/period";
import { calcProgress } from "@/lib/sales/goals/progress";
import {
  ACTIVE_DEAL_STAGES,
  ACTIVE_LEAD_LIFECYCLE_STATUSES,
  ACTIVE_PIPELINE_STATUSES,
  DEFAULT_PRIORITY_WEIGHTS,
  DEFAULT_QUOTE_FOLLOWUP_HOURS,
  DEFAULT_STAGE_INACTIVITY_HOURS,
  FIRST_RESPONSE_EVENT_TYPES,
  OPEN_QUOTE_STATUSES,
} from "./defaults";
import { getDealNumericValueForCoverage } from "@/lib/sales/deals/commercial-value";
import type { DealRow } from "@/types";
import {
  buildCommitmentProgress,
  hasAnyCommitmentConfigured,
  mergeExecutionSettings,
  type CommitmentCounts,
} from "./commitments";
import {
  buildDailyFocusStatus,
  lookbackStartDate,
  trackingStartDate,
  type DailyFocusLog,
} from "./daily-focus";
import { deriveFocusMode } from "./focus-mode";
import {
  deriveFirstRespondedAt,
  deriveLastMeaningfulActivityAt,
  minutesSince,
} from "./meaningful-activity";
import {
  countGoalWorkingDaysLeft,
  formatDaysLeftLabel,
  formatHoursLeftLabel,
  resolveOperatingHours,
  resolveWorkdayState,
  scheduleSummaryLine,
} from "./operating-hours";
import { calcPipelineCoverage, sumActivePipelineValue } from "./pipeline-coverage";
import { rankSalesActions, shouldResolveRecommendation } from "./priority-engine";
import { planDayBoundsUtc, resolveSalesTimezone } from "./timezone";
import { countValidProspects, type ProspectCandidate } from "./valid-prospect";
import type {
  ActionStateRow,
  DailyFocusStatusPayload,
  DailyPlanSchedule,
  DailySalesPlanPayload,
  LeadIntelligenceSignal,
  PriorityWeights,
  SalesActionRecommendation,
  SalesExecutionSettingsRow,
} from "./types";

type LeadRow = {
  id: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  source: string | null;
  status: string;
  score: number | null;
  manual_priority: string | null;
  project_type: string | null;
  deal_value: number | null;
  budget: string | null;
  created_at: string;
  follow_up_date: string | null;
  assigned_to_id: string;
  form_data: Record<string, unknown> | null;
  is_archived: boolean | null;
};

type QuoteRow = {
  id: string;
  lead_id: string;
  deal_id?: string | null;
  quote_number: string | null;
  total: number | null;
  status: string;
  created_at: string;
  updated_at: string;
  sent_at?: string | null;
  viewed_at?: string | null;
  valid_until?: string | null;
  approval_status?: string | null;
  responded_at?: string | null;
  declined_category?: string | null;
};

type EventRow = {
  lead_id: string;
  event_type: string;
  created_at: string;
  actor_id: string | null;
  event_data: Record<string, unknown> | null;
};

type WaRow = {
  lead_id: string;
  direction: string;
  created_at: string;
};

type CallRow = {
  lead_id: string;
  created_at: string;
};

function mapSettings(row: Record<string, unknown> | null): SalesExecutionSettingsRow | null {
  if (!row) return null;
  return {
    id: String(row.id),
    clientId: String(row.client_id),
    salespersonId: row.salesperson_id ? String(row.salesperson_id) : null,
    dailyProspectTarget:
      row.daily_prospect_target != null ? Number(row.daily_prospect_target) : null,
    dailyCallTarget: row.daily_call_target != null ? Number(row.daily_call_target) : null,
    dailyFollowupTarget:
      row.daily_followup_target != null ? Number(row.daily_followup_target) : null,
    dailyQuoteTarget: row.daily_quote_target != null ? Number(row.daily_quote_target) : null,
    dailyAppointmentTarget:
      row.daily_appointment_target != null ? Number(row.daily_appointment_target) : null,
    stageInactivityHours: (row.stage_inactivity_hours as Record<string, number> | null) ?? null,
    quoteFollowupHours:
      row.quote_followup_hours != null ? Number(row.quote_followup_hours) : null,
    priorityWeights: (row.priority_weights as Partial<PriorityWeights> | null) ?? null,
    workingDays: Array.isArray(row.working_days)
      ? (row.working_days as number[]).map((n) => Number(n))
      : null,
    workStartTime: row.work_start_time != null ? String(row.work_start_time).slice(0, 5) : null,
    workEndTime: row.work_end_time != null ? String(row.work_end_time).slice(0, 5) : null,
  };
}

function mapActionState(row: Record<string, unknown>): ActionStateRow {
  return {
    id: String(row.id),
    idempotencyKey: String(row.idempotency_key),
    actionType: row.action_type as ActionStateRow["actionType"],
    reasonCode: row.reason_code as ActionStateRow["reasonCode"],
    sourceEntityType: row.source_entity_type as ActionStateRow["sourceEntityType"],
    sourceEntityId: row.source_entity_id ? String(row.source_entity_id) : null,
    state: row.state as ActionStateRow["state"],
    snoozedUntil: row.snoozed_until ? String(row.snoozed_until) : null,
    skipReason: row.skip_reason ? String(row.skip_reason) : null,
    completedAt: row.completed_at ? String(row.completed_at) : null,
    resolvedAt: row.resolved_at ? String(row.resolved_at) : null,
    metadata: (row.metadata as Record<string, unknown> | null) ?? null,
  };
}

export async function fetchExecutionSettings(opts: {
  clientId: string;
  salespersonId: string;
}): Promise<SalesExecutionSettingsRow | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("sales_execution_settings")
    .select("*")
    .eq("client_id", opts.clientId)
    .or(`salesperson_id.is.null,salesperson_id.eq.${opts.salespersonId}`);

  if (error) {
    if (/sales_execution_settings|does not exist|relation/i.test(error.message)) {
      return null;
    }
    throw new Error(error.message);
  }

  const rows = (data ?? []).map((r) => mapSettings(r as Record<string, unknown>));
  const baseline = rows.find((r) => r && !r.salespersonId) ?? null;
  const override = rows.find((r) => r && r.salespersonId === opts.salespersonId) ?? null;
  return mergeExecutionSettings(baseline, override);
}

export async function upsertExecutionSettings(opts: {
  clientId: string;
  salespersonId: string | null;
  patch: Partial<{
    dailyProspectTarget: number | null;
    dailyCallTarget: number | null;
    dailyFollowupTarget: number | null;
    dailyQuoteTarget: number | null;
    dailyAppointmentTarget: number | null;
    workingDays: number[] | null;
    workStartTime: string | null;
    workEndTime: string | null;
  }>;
}): Promise<SalesExecutionSettingsRow> {
  const supabase = createAdminClient();
  const payload: Record<string, unknown> = {
    client_id: opts.clientId,
    salesperson_id: opts.salespersonId,
    updated_at: new Date().toISOString(),
  };
  if ("dailyProspectTarget" in opts.patch) payload.daily_prospect_target = opts.patch.dailyProspectTarget;
  if ("dailyCallTarget" in opts.patch) payload.daily_call_target = opts.patch.dailyCallTarget;
  if ("dailyFollowupTarget" in opts.patch) payload.daily_followup_target = opts.patch.dailyFollowupTarget;
  if ("dailyQuoteTarget" in opts.patch) payload.daily_quote_target = opts.patch.dailyQuoteTarget;
  if ("dailyAppointmentTarget" in opts.patch) {
    payload.daily_appointment_target = opts.patch.dailyAppointmentTarget;
  }
  if ("workingDays" in opts.patch) payload.working_days = opts.patch.workingDays;
  if ("workStartTime" in opts.patch) payload.work_start_time = opts.patch.workStartTime;
  if ("workEndTime" in opts.patch) payload.work_end_time = opts.patch.workEndTime;

  // Find existing
  let existingQuery = supabase
    .from("sales_execution_settings")
    .select("id")
    .eq("client_id", opts.clientId);
  existingQuery = opts.salespersonId
    ? existingQuery.eq("salesperson_id", opts.salespersonId)
    : existingQuery.is("salesperson_id", null);
  const { data: existing } = await existingQuery.maybeSingle();

  if (existing?.id) {
    const { data, error } = await supabase
      .from("sales_execution_settings")
      .update(payload)
      .eq("id", existing.id)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return mapSettings(data as Record<string, unknown>)!;
  }

  const { data, error } = await supabase
    .from("sales_execution_settings")
    .insert(payload)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return mapSettings(data as Record<string, unknown>)!;
}

export async function resolveClientSalesTimezone(clientId: string): Promise<string> {
  const supabase = createAdminClient();
  const [marketingRes, agency] = await Promise.all([
    supabase
      .from("client_marketing_settings")
      .select("timezone")
      .eq("client_id", clientId)
      .maybeSingle(),
    getAgencySettings(),
  ]);
  return resolveSalesTimezone(
    (marketingRes.data?.timezone as string | null) ?? agency.default_timezone
  );
}

export async function fetchClientBaselineSettings(
  clientId: string
): Promise<SalesExecutionSettingsRow | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("sales_execution_settings")
    .select("*")
    .eq("client_id", clientId)
    .is("salesperson_id", null)
    .maybeSingle();
  if (error) {
    if (/sales_execution_settings|does not exist|relation|working_days/i.test(error.message)) {
      return null;
    }
    throw new Error(error.message);
  }
  return data ? mapSettings(data as Record<string, unknown>) : null;
}

function toSchedulePayload(state: ReturnType<typeof resolveWorkdayState>): DailyPlanSchedule {
  return {
    timezone: state.timezone,
    planDate: state.planDate,
    weekdayLabel: state.weekdayLabel,
    dateLabel: state.dateLabel,
    isWorkingDay: state.isWorkingDay,
    withinHours: state.withinHours,
    beforeStart: state.beforeStart,
    afterEnd: state.afterEnd,
    workStartLabel: state.workStartLabel,
    workEndLabel: state.workEndLabel,
    workingDaysLabel: state.workingDaysLabel,
    minutesLeftInWorkday: state.minutesLeftInWorkday,
    hoursLeftLabel: formatHoursLeftLabel(state.minutesLeftInWorkday),
    summary: scheduleSummaryLine(state),
  };
}

export async function loadDailyFocusLogs(opts: {
  clientId: string;
  salespersonId: string;
  fromDate: string;
  toDate: string;
}): Promise<DailyFocusLog[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("sales_daily_focus_log")
    .select("plan_date, plan_complete")
    .eq("client_id", opts.clientId)
    .eq("salesperson_id", opts.salespersonId)
    .gte("plan_date", opts.fromDate)
    .lte("plan_date", opts.toDate)
    .order("plan_date", { ascending: true });
  if (error) {
    if (/sales_daily_focus_log|does not exist|relation/i.test(error.message)) return [];
    throw new Error(error.message);
  }
  return (data ?? []).map((row) => ({
    planDate: String(row.plan_date).slice(0, 10),
    planComplete: Boolean(row.plan_complete),
  }));
}

async function upsertDailyFocusLog(opts: {
  clientId: string;
  salespersonId: string;
  planDate: string;
  planComplete: boolean;
  freezeIncomplete: boolean;
}): Promise<void> {
  const supabase = createAdminClient();
  const now = new Date().toISOString();
  let planComplete = opts.planComplete;
  if (opts.freezeIncomplete && !planComplete) {
    const { data: existing } = await supabase
      .from("sales_daily_focus_log")
      .select("plan_complete")
      .eq("client_id", opts.clientId)
      .eq("salesperson_id", opts.salespersonId)
      .eq("plan_date", opts.planDate)
      .maybeSingle();
    if (existing?.plan_complete) planComplete = true;
  }
  const { error } = await supabase.from("sales_daily_focus_log").upsert(
    {
      client_id: opts.clientId,
      salesperson_id: opts.salespersonId,
      plan_date: opts.planDate,
      plan_complete: planComplete,
      completed_at: planComplete ? now : null,
      updated_at: now,
    },
    { onConflict: "client_id,salesperson_id,plan_date" }
  );
  if (error && !/sales_daily_focus_log|does not exist|relation/i.test(error.message)) {
    console.error("daily focus log upsert failed:", error.message);
  }
}

async function loadActionStates(
  salespersonId: string,
  planDate: string
): Promise<ActionStateRow[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("sales_action_states")
    .select("*")
    .eq("salesperson_id", salespersonId)
    .eq("plan_date", planDate);
  if (error) {
    if (/sales_action_states|does not exist|relation/i.test(error.message)) return [];
    throw new Error(error.message);
  }
  return (data ?? []).map((r) => mapActionState(r as Record<string, unknown>));
}

export async function mutateActionState(opts: {
  clientId: string;
  salespersonId: string;
  planDate: string;
  idempotencyKey: string;
  actionType: string;
  reasonCode: string;
  sourceEntityType: string;
  sourceEntityId: string | null;
  state: "completed" | "snoozed" | "skipped" | "resolved" | "active";
  snoozedUntil?: string | null;
  skipReason?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const supabase = createAdminClient();
  const now = new Date().toISOString();
  const row = {
    client_id: opts.clientId,
    salesperson_id: opts.salespersonId,
    plan_date: opts.planDate,
    idempotency_key: opts.idempotencyKey,
    action_type: opts.actionType,
    reason_code: opts.reasonCode,
    source_entity_type: opts.sourceEntityType,
    source_entity_id: opts.sourceEntityId,
    state: opts.state,
    snoozed_until: opts.snoozedUntil ?? null,
    skip_reason: opts.skipReason ?? null,
    completed_at: opts.state === "completed" ? now : null,
    resolved_at: opts.state === "resolved" ? now : null,
    metadata: opts.metadata ?? null,
    updated_at: now,
  };

  const { error } = await supabase.from("sales_action_states").upsert(row, {
    onConflict: "salesperson_id,plan_date,idempotency_key",
  });
  if (error) throw new Error(error.message);
}

/** Resolve states whose underlying condition no longer holds. */
async function reconcileActionStates(
  states: ActionStateRow[],
  signalsById: Map<string, LeadIntelligenceSignal>,
  clientId: string,
  salespersonId: string,
  planDate: string
): Promise<ActionStateRow[]> {
  const remaining: ActionStateRow[] = [];
  for (const state of states) {
    if (state.state !== "active" && state.state !== "snoozed") {
      remaining.push(state);
      continue;
    }
    const lead = state.sourceEntityId ? signalsById.get(state.sourceEntityId) ?? null : null;
    if (
      shouldResolveRecommendation(
        {
          actionType: state.actionType,
          reasonCode: state.reasonCode,
          sourceEntityId: state.sourceEntityId,
        },
        lead
      )
    ) {
      try {
        await mutateActionState({
          clientId,
          salespersonId,
          planDate,
          idempotencyKey: state.idempotencyKey,
          actionType: state.actionType,
          reasonCode: state.reasonCode,
          sourceEntityType: state.sourceEntityType,
          sourceEntityId: state.sourceEntityId,
          state: "resolved",
        });
      } catch {
        // non-fatal
      }
      continue;
    }
    remaining.push(state);
  }
  return remaining;
}

function buildAwaitingReplyMap(
  messages: WaRow[],
  now: Date
): Map<string, number> {
  const byLead = new Map<string, WaRow[]>();
  for (const m of messages) {
    if (!m.lead_id) continue;
    const list = byLead.get(m.lead_id) ?? [];
    list.push(m);
    byLead.set(m.lead_id, list);
  }
  const awaiting = new Map<string, number>();
  for (const [leadId, list] of byLead) {
    list.sort((a, b) => b.created_at.localeCompare(a.created_at));
    const last = list[0];
    if (!last || last.direction !== "inbound") continue;
    const mins = minutesSince(last.created_at, now);
    if (mins != null) awaiting.set(leadId, mins);
  }
  return awaiting;
}

export async function fetchDailySalesPlan(opts: {
  userId: string;
  clientId: string;
  now?: Date;
}): Promise<DailySalesPlanPayload> {
  const now = opts.now ?? new Date();
  const supabase = createAdminClient();
  const timezone = await resolveClientSalesTimezone(opts.clientId);
  const settings = await fetchExecutionSettings({
    clientId: opts.clientId,
    salespersonId: opts.userId,
  });
  const hours = resolveOperatingHours(settings);
  const schedule = resolveWorkdayState(now, timezone, hours);
  const planDate = schedule.planDate;
  const dayBounds = planDayBoundsUtc(planDate, timezone);

  const periodKey = parseGoalPeriodKey(null);
  const bounds = goalPeriodBounds(periodKey);

  const [
    leadsRes,
    dealsRes,
    goalRes,
    winsRes,
    quotesRes,
    eventsRes,
    waRes,
    callsRes,
    actionStates,
    focusLogs,
  ] = await Promise.all([
    supabase
      .from("leads")
      .select(
        "id, name, phone, email, source, status, score, manual_priority, project_type, deal_value, budget, created_at, follow_up_date, assigned_to_id, form_data, is_archived"
      )
      .eq("client_id", opts.clientId)
      .eq("assigned_to_id", opts.userId)
      .or("is_archived.is.null,is_archived.eq.false")
      .in("status", [...ACTIVE_LEAD_LIFECYCLE_STATUSES, ...ACTIVE_PIPELINE_STATUSES])
      .order("created_at", { ascending: false })
      .limit(500),
    supabase
      .from("deals")
      .select("*")
      .eq("client_id", opts.clientId)
      .eq("owner_id", opts.userId)
      .in("stage", [...ACTIVE_DEAL_STAGES])
      .limit(500),
    supabase
      .from("sales_goals")
      .select("id, target_value, currency, period_start, period_end, status, created_at")
      .eq("client_id", opts.clientId)
      .eq("salesperson_id", opts.userId)
      .eq("goal_type", "REVENUE_WON")
      .eq("period_start", bounds.periodStartIso)
      .eq("status", "ACTIVE")
      .maybeSingle(),
    supabase
      .from("win_analysis")
      .select("deal_value")
      .eq("client_id", opts.clientId)
      .eq("salesperson_id", opts.userId)
      .gte("created_at", bounds.from.toISOString())
      .lt("created_at", bounds.toExclusive.toISOString()),
    supabase
      .from("quotations")
      .select("id, lead_id, deal_id, quote_number, total, status, created_at, updated_at, sent_at, viewed_at, valid_until, approval_status, responded_at")
      .eq("client_id", opts.clientId)
      .in("status", [...OPEN_QUOTE_STATUSES, "draft"])
      .order("updated_at", { ascending: false })
      .limit(300),
    // recent events for active assigned leads — bounded
    supabase
      .from("lead_events")
      .select("lead_id, event_type, created_at, actor_id, event_data")
      .eq("client_id", opts.clientId)
      .gte("created_at", new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString())
      .order("created_at", { ascending: false })
      .limit(2000),
    supabase
      .from("whatsapp_messages")
      .select("lead_id, direction, created_at")
      .eq("client_id", opts.clientId)
      .gte("created_at", new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString())
      .order("created_at", { ascending: false })
      .limit(2000),
    supabase
      .from("call_logs")
      .select("lead_id, created_at, user_id")
      .eq("user_id", opts.userId)
      .gte("created_at", new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString())
      .order("created_at", { ascending: false })
      .limit(1000),
    loadActionStates(opts.userId, planDate),
    loadDailyFocusLogs({
      clientId: opts.clientId,
      salespersonId: opts.userId,
      fromDate: lookbackStartDate(planDate),
      toDate: planDate,
    }),
  ]);

  if (leadsRes.error) throw new Error(leadsRes.error.message);

  const allLeads = (leadsRes.data ?? []) as LeadRow[];
  // Exclude converted leads from lead-level priority actions (deals own commercial work)
  const leads = allLeads.filter((l) => l.status !== "CONVERTED_TO_DEAL");
  const deals = ((dealsRes.data ?? []) as DealRow[]).filter((d) =>
    ACTIVE_DEAL_STAGES.has(d.stage)
  );
  const dealOriginLeadIds = [...new Set(deals.map((d) => d.originating_lead_id).filter(Boolean))];

  // Contact rows for Deal-originating leads (often CONVERTED_TO_DEAL — not in active lead query)
  const missingOriginIds = dealOriginLeadIds.filter((id) => !allLeads.some((l) => l.id === id));
  const originLeadsRes =
    missingOriginIds.length > 0
      ? await supabase
          .from("leads")
          .select(
            "id, name, phone, email, source, status, score, manual_priority, project_type, deal_value, budget, created_at, follow_up_date, assigned_to_id, form_data, is_archived"
          )
          .in("id", missingOriginIds)
      : { data: [] as LeadRow[] };
  const originLeads = (originLeadsRes.data ?? []) as LeadRow[];
  const leadContactById = new Map<string, LeadRow>();
  for (const l of [...allLeads, ...originLeads]) leadContactById.set(l.id, l);

  const leadIds = leads.map((l) => l.id);
  const activityLeadIds = [...new Set([...leadIds, ...dealOriginLeadIds])];
  const activityLeadIdSet = new Set(activityLeadIds);
  const callbacks = await fetchLatestScheduledCallbacksByLeadId(supabase, activityLeadIds);

  const allQuotes = (quotesRes.data ?? []) as QuoteRow[];
  const openQuoteByLead = new Map<string, QuoteRow>();
  const openQuoteByDeal = new Map<string, QuoteRow>();
  for (const q of allQuotes) {
    const isOpen = OPEN_QUOTE_STATUSES.has(q.status);
    const needsApprovalWork =
      q.status === "draft" &&
      ["pending", "required", "changes_requested", "rejected"].includes(String(q.approval_status ?? ""));
    if (!isOpen && !needsApprovalWork) continue;
    if (q.deal_id && !openQuoteByDeal.has(q.deal_id)) openQuoteByDeal.set(q.deal_id, q);
    if (activityLeadIdSet.has(q.lead_id) && !openQuoteByLead.has(q.lead_id)) {
      openQuoteByLead.set(q.lead_id, q);
    }
  }

  const events = ((eventsRes.data ?? []) as EventRow[]).filter((e) =>
    activityLeadIdSet.has(e.lead_id)
  );
  const eventsByLead = new Map<string, EventRow[]>();
  const followUpCreatorByLead = new Map<string, string>();
  for (const e of events) {
    const list = eventsByLead.get(e.lead_id) ?? [];
    list.push(e);
    eventsByLead.set(e.lead_id, list);
    if (e.event_type === "FOLLOW_UP_SET" && e.actor_id && !followUpCreatorByLead.has(e.lead_id)) {
      followUpCreatorByLead.set(e.lead_id, e.actor_id);
    }
  }

  const calls = ((callsRes.data ?? []) as CallRow[]).filter((c) =>
    activityLeadIdSet.has(c.lead_id)
  );
  const callsByLead = new Map<string, string[]>();
  for (const c of calls) {
    const list = callsByLead.get(c.lead_id) ?? [];
    list.push(c.created_at);
    callsByLead.set(c.lead_id, list);
  }

  const waMessages = ((waRes.data ?? []) as WaRow[]).filter((m) =>
    activityLeadIdSet.has(m.lead_id)
  );
  const awaitingMap = buildAwaitingReplyMap(waMessages, now);
  const waByLead = new Map<string, WaRow[]>();
  for (const m of waMessages) {
    const list = waByLead.get(m.lead_id) ?? [];
    list.push(m);
    waByLead.set(m.lead_id, list);
  }

  function toSignalFromLead(l: LeadRow): LeadIntelligenceSignal {
    const leadEvents = eventsByLead.get(l.id) ?? [];
    const callAts = callsByLead.get(l.id) ?? [];
    const wa = waByLead.get(l.id) ?? [];
    const outboundWa = wa.filter((m) => m.direction === "outbound").map((m) => m.created_at);
    const allWaAts = wa.map((m) => m.created_at);
    const firstRespondedAt = deriveFirstRespondedAt(leadEvents, callAts, outboundWa);
    const lastMeaningfulActivityAt = deriveLastMeaningfulActivityAt(
      leadEvents,
      callAts,
      allWaAts
    );
    const callbackAt = callbacks[l.id] ?? null;
    const followUpDate = l.follow_up_date;
    const hasFutureNextAction = Boolean(
      (followUpDate && new Date(followUpDate).getTime() > now.getTime()) ||
        (callbackAt && new Date(callbackAt).getTime() > now.getTime())
    );
    const openQuote = openQuoteByLead.get(l.id);
    const displayName = leadCardDisplayName({
      name: l.name,
      phone: l.phone,
      source: l.source,
      form_data: l.form_data,
    });

    return {
      id: l.id,
      name: displayName,
      phone: l.phone,
      email: l.email,
      source: l.source,
      status: l.status,
      score: l.score,
      manualPriority:
        l.manual_priority === "hot" || l.manual_priority === "warm" || l.manual_priority === "cold"
          ? l.manual_priority
          : null,
      projectType: l.project_type,
      dealValue: l.deal_value != null && Number(l.deal_value) > 0 ? Number(l.deal_value) : null,
      budget: l.budget,
      createdAt: l.created_at,
      followUpDate,
      callbackAt,
      assignedToId: l.assigned_to_id,
      followUpCreatedById: followUpCreatorByLead.get(l.id) ?? null,
      firstRespondedAt,
      lastMeaningfulActivityAt,
      awaitingReplyMinutes: awaitingMap.get(l.id) ?? null,
      hasFutureNextAction,
      openQuote: openQuote
        ? {
            id: openQuote.id,
            quoteNumber: openQuote.quote_number,
            total: openQuote.total != null ? Number(openQuote.total) : null,
            status: openQuote.status,
            sentAt: openQuote.sent_at || openQuote.updated_at || openQuote.created_at,
            approvalStatus: openQuote.approval_status ?? null,
            viewedAt: openQuote.viewed_at ?? null,
            validUntil: openQuote.valid_until ?? null,
            customerResponded: Boolean(openQuote.responded_at),
          }
        : null,
      isWhatsAppCapable: Boolean(l.phone) || String(l.source ?? "").includes("WHATSAPP"),
      dealId: null,
    };
  }

  const leadSignals: LeadIntelligenceSignal[] = leads.map(toSignalFromLead);

  const dealSignals: LeadIntelligenceSignal[] = deals.map((d) => {
    const origin = leadContactById.get(d.originating_lead_id);
    const leadEvents = eventsByLead.get(d.originating_lead_id) ?? [];
    const callAts = callsByLead.get(d.originating_lead_id) ?? [];
    const wa = waByLead.get(d.originating_lead_id) ?? [];
    const outboundWa = wa.filter((m) => m.direction === "outbound").map((m) => m.created_at);
    const allWaAts = wa.map((m) => m.created_at);
    const derivedFirst = deriveFirstRespondedAt(leadEvents, callAts, outboundWa);
    const derivedLast = deriveLastMeaningfulActivityAt(leadEvents, callAts, allWaAts);
    const nextAt = d.next_action_at;
    const hasFutureNextAction = Boolean(
      nextAt && Number.isFinite(Date.parse(nextAt)) && Date.parse(nextAt) > now.getTime()
    );
    const openQuote =
      openQuoteByDeal.get(d.id) ?? openQuoteByLead.get(d.originating_lead_id) ?? null;
    const commercial = getDealNumericValueForCoverage(d);
    const displayName =
      d.name?.trim() ||
      (origin
        ? leadCardDisplayName({
            name: origin.name,
            phone: origin.phone,
            source: origin.source,
            form_data: origin.form_data,
          })
        : "Deal");

    return {
      id: d.originating_lead_id,
      name: displayName,
      phone: origin?.phone ?? null,
      email: origin?.email ?? null,
      source: origin?.source ?? null,
      status: d.stage,
      score: origin?.score ?? null,
      manualPriority:
        origin?.manual_priority === "hot" ||
        origin?.manual_priority === "warm" ||
        origin?.manual_priority === "cold"
          ? origin.manual_priority
          : null,
      projectType: d.service_summary ?? origin?.project_type ?? null,
      dealValue: commercial,
      budget: origin?.budget ?? null,
      createdAt: d.created_at,
      followUpDate: d.next_action_at,
      callbackAt: null,
      assignedToId: d.owner_id ?? opts.userId,
      followUpCreatedById: null,
      // Deals are past first contact by definition
      firstRespondedAt: derivedFirst ?? d.created_at,
      lastMeaningfulActivityAt:
        d.last_meaningful_activity_at ?? derivedLast ?? null,
      awaitingReplyMinutes: awaitingMap.get(d.originating_lead_id) ?? null,
      hasFutureNextAction,
      openQuote: openQuote
        ? {
            id: openQuote.id,
            quoteNumber: openQuote.quote_number,
            total: openQuote.total != null ? Number(openQuote.total) : null,
            status: openQuote.status,
            sentAt: openQuote.sent_at || openQuote.updated_at || openQuote.created_at,
            approvalStatus: openQuote.approval_status ?? null,
            viewedAt: openQuote.viewed_at ?? null,
            validUntil: openQuote.valid_until ?? null,
            customerResponded: Boolean(openQuote.responded_at),
          }
        : null,
      isWhatsAppCapable:
        Boolean(origin?.phone) || String(origin?.source ?? "").includes("WHATSAPP"),
      dealId: d.id,
    };
  });

  const signals: LeadIntelligenceSignal[] = [...leadSignals, ...dealSignals];

  const signalsById = new Map(signals.map((s) => [s.dealId ?? s.id, s]));
  // Also index by lead id for reconcile of lead-only states
  for (const s of leadSignals) signalsById.set(s.id, s);

  const reconciledStates = await reconcileActionStates(
    actionStates,
    signalsById,
    opts.clientId,
    opts.userId,
    planDate
  );

  // Goal progress
  const goal = goalRes.data as {
    target_value: number;
    currency: string;
    period_start: string;
    period_end: string;
    created_at?: string;
  } | null;
  const wins = (winsRes.data ?? []) as Array<{ deal_value: number | null }>;
  const achieved = wins.reduce((s, w) => s + (Number(w.deal_value) || 0), 0);
  const target = goal ? Number(goal.target_value) : 0;
  const progress = calcProgress(achieved, target || 0);
  const remaining = goal ? progress.remaining : null;

  const pipelineValues = deals.map((d) => getDealNumericValueForCoverage(d));
  const pendingDealValues = deals.filter(
    (d) => getDealNumericValueForCoverage(d) == null
  ).length;
  const { total: pipelineTotal, counted: pipelineCounted } = sumActivePipelineValue(pipelineValues);
  const coverage = calcPipelineCoverage({
    remainingGoalValue: remaining,
    activePipelineValue: pipelineCounted > 0 ? pipelineTotal : null,
    hasReliablePipelineValues: pipelineCounted > 0,
  });
  // pendingDealValues available for attention copy in metadata
  void pendingDealValues;

  // Commitment counts for today
  const todayLeadsRes = await supabase
    .from("leads")
    .select("id, name, phone, email, source, assigned_to_id, created_at, is_archived")
    .eq("client_id", opts.clientId)
    .eq("assigned_to_id", opts.userId)
    .gte("created_at", dayBounds.startIso)
    .lt("created_at", dayBounds.endIsoExclusive)
    .limit(200);

  const todayCallsRes = await supabase
    .from("call_logs")
    .select("id, lead_id, created_at")
    .eq("user_id", opts.userId)
    .gte("created_at", dayBounds.startIso)
    .lt("created_at", dayBounds.endIsoExclusive)
    .limit(500);

  const todayCallCount = (todayCallsRes.data ?? []).length;

  const todayQuotesRes = await supabase
    .from("quotations")
    .select("id")
    .eq("client_id", opts.clientId)
    .eq("prepared_by_id", opts.userId)
    .gte("created_at", dayBounds.startIso)
    .lt("created_at", dayBounds.endIsoExclusive);

  const todayLeadRows = (todayLeadsRes.data ?? []) as Array<{
    id: string;
    name: string | null;
    phone: string | null;
    email: string | null;
    source: string | null;
    assigned_to_id: string | null;
    created_at: string;
    is_archived: boolean | null;
  }>;

  const phones = new Set<string>();
  const emails = new Set<string>();
  const prospectCandidates: ProspectCandidate[] = todayLeadRows.map((l) => {
    const phoneKey = (l.phone ?? "").replace(/\D/g, "");
    const emailKey = (l.email ?? "").trim().toLowerCase();
    const isDuplicate =
      (phoneKey.length >= 7 && phones.has(phoneKey)) ||
      (emailKey.includes("@") && emails.has(emailKey));
    if (phoneKey.length >= 7) phones.add(phoneKey);
    if (emailKey.includes("@")) emails.add(emailKey);
    const hasOutreach = (callsByLead.get(l.id) ?? []).some(
      (at) => at >= dayBounds.startIso && at < dayBounds.endIsoExclusive
    );
    return {
      id: l.id,
      name: l.name,
      phone: l.phone,
      email: l.email,
      source: l.source,
      assignedToId: l.assigned_to_id,
      createdAt: l.created_at,
      isArchived: l.is_archived,
      isDuplicate,
      hasOutreachActivity: hasOutreach || String(l.source).toUpperCase() === "REFERRAL",
    };
  });

  const prospectsCompleted = countValidProspects(prospectCandidates, opts.userId);

  // Follow-ups completed today ≈ CALL_LOGGED or FOLLOW_UP cleared events today
  const followUpsCompleted = events.filter(
    (e) =>
      e.actor_id === opts.userId &&
      e.created_at >= dayBounds.startIso &&
      e.created_at < dayBounds.endIsoExclusive &&
      (e.event_type === "CALL_LOGGED" || FIRST_RESPONSE_EVENT_TYPES.has(e.event_type))
  ).length;

  const commitmentCounts: CommitmentCounts = {
    prospects: prospectsCompleted,
    calls: todayCallCount,
    followUps: followUpsCompleted,
    quotes: (todayQuotesRes.data ?? []).length,
    appointments: 0,
    outreach: todayCallCount,
  };

  const commitments = buildCommitmentProgress(settings, commitmentCounts);
  const stageHours = {
    ...DEFAULT_STAGE_INACTIVITY_HOURS,
    ...(settings?.stageInactivityHours ?? {}),
  };
  const weights: PriorityWeights = {
    ...DEFAULT_PRIORITY_WEIGHTS,
    ...(settings?.priorityWeights ?? {}),
  };

  const ranked = rankSalesActions({
    leads: signals,
    ctx: {
      now,
      salespersonId: opts.userId,
      planDate,
      remainingGoalValue: remaining,
      activePipelineValue: pipelineCounted > 0 ? pipelineTotal : null,
      hasConfiguredProspectTarget: settings?.dailyProspectTarget != null,
      prospectTarget: settings?.dailyProspectTarget ?? null,
      prospectsCompletedToday: prospectsCompleted,
      stageInactivityHours: stageHours,
      quoteFollowupHours: settings?.quoteFollowupHours ?? DEFAULT_QUOTE_FOLLOWUP_HOURS,
      weights,
    },
    actionStates: reconciledStates,
  });

  const lateStageCount = signals.filter(
    (s) => s.status === "NEGOTIATING" || s.status === "PROPOSAL_SENT"
  ).length;

  const focus = deriveFocusMode({
    priorityActions: ranked.queue,
    coverage,
    lateStageCount,
    activeDealCount:
      deals.length +
      leadSignals.filter(
        (s) => s.status === "NEGOTIATING" || s.status === "PROPOSAL_SENT"
      ).length,
  });

  const completedPriority = reconciledStates.filter(
    (s) => s.state === "completed" || s.state === "resolved"
  ).length;
  const priorityTotal = Math.max(ranked.dealActionCount, ranked.queue.filter((q) => q.actionType !== "PROSPECT_NEW_CUSTOMERS").length);
  const priorityCompleted = Math.min(completedPriority, priorityTotal);

  const commitmentsDone = commitments.length > 0 && commitments.every((c) => c.status === "completed");
  const dealQueueClear = ranked.dealActionCount === 0;
  const planComplete = dealQueueClear && (commitments.length === 0 || commitmentsDone);

  const whatNeedsAttention: DailySalesPlanPayload["whatNeedsAttention"] = [];
  const overdueCount = ranked.all.filter((a) => a.reasonCode === "FOLLOWUP_OVERDUE").length;
  const waitingCount = ranked.all.filter((a) => a.reasonCode === "CUSTOMER_WAITING").length;
  const noNext = ranked.all.filter((a) => a.reasonCode === "NO_NEXT_ACTION").length;
  const quoteWaiting = ranked.all.filter((a) => a.reasonCode === "QUOTE_WAITING").length;
  const hotUncontacted = ranked.all.filter((a) => a.reasonCode === "HIGH_INTENT_NEW_LEAD").length;

  if (overdueCount > 0) {
    whatNeedsAttention.push({
      id: "overdue",
      text: `${overdueCount} overdue follow-up${overdueCount === 1 ? "" : "s"}`,
      href: "/sales/tasks",
    });
  }
  if (waitingCount > 0) {
    whatNeedsAttention.push({
      id: "waiting",
      text: `${waitingCount} active thread${waitingCount === 1 ? "" : "s"} waiting for your reply`,
      href: "/sales/inbox/needs-reply",
    });
  }
  const newEnquiryCount = ranked.newEnquiries.length;
  if (newEnquiryCount > 0) {
    whatNeedsAttention.push({
      id: "new_enquiries",
      text: `${newEnquiryCount} new enquir${newEnquiryCount === 1 ? "y" : "ies"} ready to draft`,
      href: "/sales/command?view=focus",
    });
  }
  if (quoteWaiting > 0) {
    whatNeedsAttention.push({
      id: "quotes",
      text: `${quoteWaiting} proposal${quoteWaiting === 1 ? "" : "s"} waiting for follow-up`,
      href: "/sales/quotes",
    });
  }
  if (hotUncontacted > 0) {
    whatNeedsAttention.push({
      id: "hot",
      text: `${hotUncontacted} high-intent enquir${hotUncontacted === 1 ? "y" : "ies"} not yet contacted`,
      href: "/sales/call-now",
    });
  }
  if (noNext > 0) {
    whatNeedsAttention.push({
      id: "no-next",
      text: `${noNext} active deal${noNext === 1 ? "" : "s"} with no next action`,
      href: "/sales/pipeline",
    });
  }
  if (coverage.available && coverage.coverageRatio != null && coverage.coverageRatio < 1) {
    whatNeedsAttention.push({
      id: "coverage",
      text: "Pipeline coverage below remaining target",
      href: "/sales/goals",
    });
  }

  const workingDaysLeft = goal
    ? countGoalWorkingDaysLeft({
        schedule,
        periodEndInclusive: String(goal.period_end).slice(0, 10),
      })
    : null;
  const dailyFocus = goal
    ? buildDailyFocusStatus({
        schedule,
        logs: focusLogs,
        todayComplete: planComplete,
        trackingStartDate: trackingStartDate({
          periodStart: String(goal.period_start).slice(0, 10),
          goalCreatedAt: goal.created_at ?? null,
          planDate,
        }),
      })
    : null;
  const dailyFocusPayload: DailyFocusStatusPayload | null = dailyFocus
    ? {
        yesterdayMissed: dailyFocus.yesterdayMissed,
        yesterdayLabel: dailyFocus.yesterdayLabel,
        missedStreak: dailyFocus.missedStreak,
        headline: dailyFocus.headline,
        supporting: dailyFocus.supporting,
      }
    : null;

  void upsertDailyFocusLog({
    clientId: opts.clientId,
    salespersonId: opts.userId,
    planDate,
    planComplete,
    freezeIncomplete: schedule.afterEnd || !schedule.isWorkingDay,
  });

  if (dailyFocusPayload?.headline) {
    whatNeedsAttention.unshift({
      id: "daily-focus",
      text: dailyFocusPayload.headline,
      href: "/sales/tasks",
    });
  }

  // Enrich display names on recommendations
  const decorate = (rec: SalesActionRecommendation): SalesActionRecommendation => rec;

  return {
    generatedAt: now.toISOString(),
    planDate,
    timezone,
    schedule: toSchedulePayload(schedule),
    focus,
    coverage,
    progress: {
      priorityCompleted,
      priorityTotal,
      commitments,
      planComplete,
    },
    nextBestAction: ranked.nextBestAction ? decorate(ranked.nextBestAction) : null,
    queue: ranked.queue.map(decorate),
    newEnquiries: ranked.newEnquiries.map(decorate),
    whatNeedsAttention: whatNeedsAttention.slice(0, 6),
    goal: {
      hasGoal: Boolean(goal),
      targetValue: goal ? target : null,
      achievedValue: goal ? achieved : null,
      remainingValue: remaining,
      currency: goal?.currency ?? null,
      workingDaysLeft,
      daysLeftLabel: formatDaysLeftLabel(workingDaysLeft),
      dailyFocus: dailyFocusPayload,
    },
    settingsConfigured: hasAnyCommitmentConfigured(settings),
    capabilities: {
      hasFocusMode: true,
      hasCommitments: hasAnyCommitmentConfigured(settings),
    },
  };
}

/** Lightweight reconcile hook after mutations — best-effort. */
export async function reconcileLeadActionStates(opts: {
  clientId: string;
  salespersonId: string;
  leadId: string;
}): Promise<void> {
  try {
    const timezone = await resolveClientSalesTimezone(opts.clientId);
    const planDate = resolveWorkdayState(
      new Date(),
      timezone,
      resolveOperatingHours(null)
    ).planDate;
    const states = await loadActionStates(opts.salespersonId, planDate);
    const relevant = states.filter((s) => s.sourceEntityId === opts.leadId && s.state === "active");
    if (relevant.length === 0) return;
    // Full plan refresh is heavy; mark first-response / waiting resolutions via re-fetch plan lazily.
    // Callers should invalidate daily-plan SWR. Soft resolve CONTACT_NEW_LEAD on call log:
    for (const s of relevant) {
      if (s.reasonCode === "HIGH_INTENT_NEW_LEAD" || s.reasonCode === "CUSTOMER_WAITING") {
        await mutateActionState({
          clientId: opts.clientId,
          salespersonId: opts.salespersonId,
          planDate,
          idempotencyKey: s.idempotencyKey,
          actionType: s.actionType,
          reasonCode: s.reasonCode,
          sourceEntityType: s.sourceEntityType,
          sourceEntityId: s.sourceEntityId,
          state: "resolved",
        });
      }
    }
  } catch {
    // never break primary mutation path
  }
}

export { SCORE_HOT_MIN };
