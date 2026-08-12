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
  DEFAULT_SALES_EXECUTION,
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
import { deriveFocusMode } from "./focus-mode";
import {
  deriveFirstRespondedAt,
  deriveLastMeaningfulActivityAt,
  minutesSince,
} from "./meaningful-activity";
import { calcPipelineCoverage, sumActivePipelineValue } from "./pipeline-coverage";
import { rankSalesActions, shouldResolveRecommendation } from "./priority-engine";
import {
  countWorkingDaysLeft,
  planDateInTimezone,
  planDayBoundsUtc,
  resolveSalesTimezone,
} from "./timezone";
import { countValidProspects, type ProspectCandidate } from "./valid-prospect";
import type {
  ActionStateRow,
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
  quote_number: string | null;
  total: number | null;
  status: string;
  created_at: string;
  updated_at: string;
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
  const agency = await getAgencySettings();
  const timezone = resolveSalesTimezone(agency.default_timezone);
  const planDate = planDateInTimezone(now, timezone);
  const dayBounds = planDayBoundsUtc(planDate, timezone);

  const settings = await fetchExecutionSettings({
    clientId: opts.clientId,
    salespersonId: opts.userId,
  });

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
      .select("id, target_value, currency, period_start, period_end, status")
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
      .select("id, lead_id, deal_id, quote_number, total, status, created_at, updated_at")
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
  ]);

  if (leadsRes.error) throw new Error(leadsRes.error.message);

  const allLeads = (leadsRes.data ?? []) as LeadRow[];
  // Exclude converted leads from lead-level priority actions (deals own commercial work)
  const leads = allLeads.filter((l) => l.status !== "CONVERTED_TO_DEAL");
  const deals = ((dealsRes.data ?? []) as DealRow[]).filter((d) =>
    ACTIVE_DEAL_STAGES.has(d.stage)
  );
  const leadIds = leads.map((l) => l.id);
  const leadIdSet = new Set(leadIds);
  const callbacks = await fetchLatestScheduledCallbacksByLeadId(supabase, leadIds);

  const quotes = ((quotesRes.data ?? []) as QuoteRow[]).filter((q) => leadIdSet.has(q.lead_id));
  const openQuoteByLead = new Map<string, QuoteRow>();
  for (const q of quotes) {
    if (!OPEN_QUOTE_STATUSES.has(q.status)) continue;
    if (!openQuoteByLead.has(q.lead_id)) openQuoteByLead.set(q.lead_id, q);
  }

  const events = ((eventsRes.data ?? []) as EventRow[]).filter((e) => leadIdSet.has(e.lead_id));
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

  const calls = ((callsRes.data ?? []) as CallRow[]).filter((c) => leadIdSet.has(c.lead_id));
  const callsByLead = new Map<string, string[]>();
  for (const c of calls) {
    const list = callsByLead.get(c.lead_id) ?? [];
    list.push(c.created_at);
    callsByLead.set(c.lead_id, list);
  }

  const waMessages = ((waRes.data ?? []) as WaRow[]).filter((m) => leadIdSet.has(m.lead_id));
  const awaitingMap = buildAwaitingReplyMap(waMessages, now);
  const waByLead = new Map<string, WaRow[]>();
  for (const m of waMessages) {
    const list = waByLead.get(m.lead_id) ?? [];
    list.push(m);
    waByLead.set(m.lead_id, list);
  }

  const signals: LeadIntelligenceSignal[] = leads.map((l) => {
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
            sentAt: openQuote.updated_at || openQuote.created_at,
          }
        : null,
      isWhatsAppCapable: Boolean(l.phone) || String(l.source ?? "").includes("WHATSAPP"),
    };
  });

  const signalsById = new Map(signals.map((s) => [s.id, s]));
  const reconciledStates = await reconcileActionStates(
    actionStates,
    signalsById,
    opts.clientId,
    opts.userId,
    planDate
  );

  // Goal progress
  const goal = goalRes.data as { target_value: number; currency: string; period_end: string } | null;
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
    activeDealCount: signals.length,
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
      text: `${waitingCount} customer${waitingCount === 1 ? "" : "s"} waiting for a reply`,
      href: "/sales/inbox/needs-reply",
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
      href: "/sales/leads",
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
    ? countWorkingDaysLeft(planDate, String(goal.period_end).slice(0, 10), DEFAULT_SALES_EXECUTION.workingDays)
    : null;

  // Enrich display names on recommendations
  const decorate = (rec: SalesActionRecommendation): SalesActionRecommendation => rec;

  return {
    generatedAt: now.toISOString(),
    planDate,
    timezone,
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
    whatNeedsAttention: whatNeedsAttention.slice(0, 6),
    goal: {
      hasGoal: Boolean(goal),
      targetValue: goal ? target : null,
      achievedValue: goal ? achieved : null,
      remainingValue: remaining,
      currency: goal?.currency ?? null,
      workingDaysLeft,
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
    const agency = await getAgencySettings();
    const timezone = resolveSalesTimezone(agency.default_timezone);
    const planDate = planDateInTimezone(new Date(), timezone);
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
