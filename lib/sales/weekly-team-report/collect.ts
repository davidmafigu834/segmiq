import { createAdminClient } from "@/lib/supabase/admin";
import { ROUND_ROBIN_ELIGIBLE_OR } from "@/lib/auth/sales-capabilities";
import { resolveSalesTimezone } from "@/lib/sales/intelligence/timezone";
import { getDealCommercialValue, latestQuoteTotal } from "@/lib/sales/deals/commercial-value";
import { DEAL_ACTIVE_STAGES } from "@/lib/sales/deals/display";
import { deriveFirstRespondedAt } from "@/lib/sales/intelligence/meaningful-activity";
import { isContactedLead, isQualifiedLead } from "@/lib/sales/company-reports/metrics";
import { OPEN_QUOTE_STATUSES } from "@/lib/sales/intelligence/defaults";
import { resolvePipelineHealthConfig, MAX_CONVERSATION_SCAN } from "./config";
import { average, conversionRate, emptyPeriodFacts, emptyPersonFacts } from "./metrics";
import { aggregateConversationPatterns } from "./conversation";
import { hourInTimezone, isoInRange } from "./period";
import type {
  AttentionItem,
  PeriodFacts,
  PersonPeriodFacts,
  ReassignmentEvent,
  SnapshotDeal,
  SnapshotPerson,
  SnapshotQuote,
  WeeklyTeamSnapshot,
  WeekPeriod,
} from "./types";

type Admin = ReturnType<typeof createAdminClient>;

function safeName(name: string | null | undefined, fallback = "Opportunity"): string {
  const first = (name ?? "").trim().split(/\s+/)[0];
  if (!first) return fallback;
  return first.slice(0, 28);
}

async function fetchPaged<T>(
  run: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
  cap = 5000
): Promise<T[]> {
  const page = 1000;
  const rows: T[] = [];
  for (let from = 0; from < cap; from += page) {
    const { data, error } = await run(from, from + page - 1);
    if (error) throw new Error(error.message);
    const batch = data ?? [];
    rows.push(...batch);
    if (batch.length < page) break;
  }
  return rows;
}

export async function collectWeeklyTeamSnapshot(opts: {
  clientId: string;
  period: WeekPeriod;
  previousPeriod: WeekPeriod;
  now?: Date;
}): Promise<WeeklyTeamSnapshot> {
  const supabase = createAdminClient();
  const now = opts.now ?? new Date();
  const { clientId, period, previousPeriod } = opts;
  const windowStart = previousPeriod.startIso;
  const windowEnd = period.endIsoExclusive;

  const [clientRes, marketingRes, quoteSettingsRes, execRes] = await Promise.all([
    supabase
      .from("clients")
      .select("id, name, logo_url, response_time_limit_hours")
      .eq("id", clientId)
      .maybeSingle(),
    supabase
      .from("client_marketing_settings")
      .select("timezone")
      .eq("client_id", clientId)
      .maybeSingle(),
    supabase
      .from("quotation_settings")
      .select("default_currency")
      .eq("client_id", clientId)
      .maybeSingle(),
    supabase
      .from("sales_execution_settings")
      .select("stage_inactivity_hours, quote_followup_hours, weekly_report_health_config")
      .eq("client_id", clientId)
      .is("salesperson_id", null)
      .maybeSingle(),
  ]);

  if (!clientRes.data) throw new Error("Organisation not found");

  const timezone = resolveSalesTimezone(
    (marketingRes.data as { timezone?: string | null } | null)?.timezone ?? period.timezone
  );
  const currency =
    ((quoteSettingsRes.data as { default_currency?: string | null } | null)?.default_currency ?? "USD") || "USD";
  const slaHours = Number((clientRes.data as { response_time_limit_hours?: number | null }).response_time_limit_hours);
  const health = resolvePipelineHealthConfig({
    weeklyReportHealthConfig: (execRes.data as { weekly_report_health_config?: unknown } | null)
      ?.weekly_report_health_config,
    stageInactivityHours: (execRes.data as { stage_inactivity_hours?: unknown } | null)?.stage_inactivity_hours,
    quoteFollowupHours: (execRes.data as { quote_followup_hours?: number | null } | null)?.quote_followup_hours,
    slaResponseHours: Number.isFinite(slaHours) && slaHours > 0 ? slaHours : undefined,
  });

  const { data: userRows } = await supabase
    .from("users")
    .select("id, name, role, also_sells, is_active")
    .eq("client_id", clientId)
    .or(ROUND_ROBIN_ELIGIBLE_OR);

  const salespeople: SnapshotPerson[] = (userRows ?? []).map((u) => ({
    id: u.id as string,
    name: (u.name as string) || "Salesperson",
    active: Boolean(u.is_active),
    role: (u.role as string) || "SALESPERSON",
  }));
  const peopleById = new Map(salespeople.map((p) => [p.id, p]));

  const leadSelect =
    "id, name, status, assigned_to_id, created_at, follow_up_date, source, client_id, is_archived";
  const leads = await fetchPaged((from, to) =>
    supabase
      .from("leads")
      .select(leadSelect)
      .eq("client_id", clientId)
      .gte("created_at", windowStart)
      .lt("created_at", windowEnd)
      .range(from, to)
  );

  const followUpLeads = await fetchPaged((from, to) =>
    supabase
      .from("leads")
      .select(leadSelect)
      .eq("client_id", clientId)
      .gte("follow_up_date", windowStart)
      .lt("follow_up_date", windowEnd)
      .range(from, to)
  );

  const activeStages = DEAL_ACTIVE_STAGES.join(",");
  const deals = await fetchPaged((from, to) =>
    supabase
      .from("deals")
      .select(
        "id, client_id, originating_lead_id, owner_id, stage, created_at, won_at, lost_at, lost_reason, last_meaningful_activity_at, next_action_at, next_action_label, expected_decision_at, value_status, value_basis, estimated_value, estimated_value_min, estimated_value_max, customer_budget, sales_estimate, won_value, metadata"
      )
      .eq("client_id", clientId)
      .or(
        `stage.in.(${activeStages}),won_at.gte.${windowStart},lost_at.gte.${windowStart},created_at.gte.${windowStart}`
      )
      .range(from, to)
  );

  const quotes = await fetchPaged((from, to) =>
    supabase
      .from("quotations")
      .select("id, client_id, deal_id, lead_id, prepared_by_id, status, total, sent_at, accepted_at, created_at")
      .eq("client_id", clientId)
      .or(`status.in.(sent,viewed),sent_at.gte.${windowStart},accepted_at.gte.${windowStart}`)
      .range(from, to)
  );

  const events = await fetchPaged((from, to) =>
    supabase
      .from("lead_events")
      .select("id, lead_id, event_type, actor_id, event_data, created_at, client_id")
      .eq("client_id", clientId)
      .gte("created_at", windowStart)
      .lt("created_at", windowEnd)
      .range(from, to),
    8000
  );

  const leadIds = [...new Set([...leads, ...followUpLeads].map((l) => l.id as string))];
  const dealLeadIds = deals
    .map((d) => d.originating_lead_id as string | null)
    .filter((id): id is string => Boolean(id));
  const extraLeadIds = dealLeadIds.filter((id) => !leadIds.includes(id));
  let extraLeads: typeof leads = [];
  if (extraLeadIds.length > 0) {
    extraLeads = (await fetchByIds(
      supabase,
      "leads",
      leadSelect,
      extraLeadIds,
      "id",
      clientId
    )) as typeof leads;
  }
  const allLeads = [...leads, ...followUpLeads, ...extraLeads];
  const leadsById = new Map<string, (typeof allLeads)[number]>();
  for (const lead of allLeads) leadsById.set(lead.id as string, lead);

  const allLeadIds = [...leadsById.keys()];
  const callLogs =
    allLeadIds.length > 0
      ? await fetchByIds(supabase, "call_logs", "id, lead_id, user_id, created_at, callback_at, follow_up_date", allLeadIds, "lead_id")
      : [];

  const waMessages = await fetchPaged((from, to) =>
    supabase
      .from("whatsapp_messages")
      .select("id, lead_id, direction, body, created_at, actor_id, client_id")
      .eq("client_id", clientId)
      .gte("created_at", windowStart)
      .lt("created_at", windowEnd)
      .range(from, to),
    MAX_CONVERSATION_SCAN
  );

  const socialMessages = await fetchSocialInbound(supabase, clientId, period.startIso, period.endIsoExclusive);

  const viewings = await fetchViewings(supabase, clientId, windowStart, windowEnd);

  const quotesByDeal = new Map<string, typeof quotes>();
  for (const q of quotes) {
    const dealId = q.deal_id as string | null;
    if (!dealId) continue;
    const list = quotesByDeal.get(dealId) ?? [];
    list.push(q);
    quotesByDeal.set(dealId, list);
  }

  const eventsByLead = new Map<string, Array<{ event_type: string; created_at: string; actor_id: string | null; event_data: unknown }>>();
  for (const ev of events) {
    const leadId = ev.lead_id as string | null;
    if (!leadId) continue;
    const list = eventsByLead.get(leadId) ?? [];
    list.push({
      event_type: ev.event_type as string,
      created_at: ev.created_at as string,
      actor_id: (ev.actor_id as string | null) ?? null,
      event_data: ev.event_data,
    });
    eventsByLead.set(leadId, list);
  }

  const callsByLead = new Map<string, string[]>();
  for (const log of callLogs) {
    const leadId = log.lead_id as string;
    const list = callsByLead.get(leadId) ?? [];
    list.push(log.created_at as string);
    callsByLead.set(leadId, list);
  }

  const waByLead = new Map<string, Array<{ direction: string; at: string; actorId: string | null }>>();
  for (const msg of waMessages) {
    const leadId = msg.lead_id as string | null;
    if (!leadId) continue;
    const list = waByLead.get(leadId) ?? [];
    list.push({
      direction: msg.direction as string,
      at: msg.created_at as string,
      actorId: (msg.actor_id as string | null) ?? null,
    });
    waByLead.set(leadId, list);
  }

  const snapshotQuotes: SnapshotQuote[] = quotes.map((q) => ({
    id: q.id as string,
    dealId: (q.deal_id as string | null) ?? null,
    leadId: (q.lead_id as string | null) ?? null,
    preparedById: (q.prepared_by_id as string | null) ?? null,
    status: q.status as string,
    total: q.total == null ? null : Number(q.total),
    sentAt: (q.sent_at as string | null) ?? null,
  }));

  const activePipeline: SnapshotDeal[] = [];
  for (const deal of deals) {
    const stage = deal.stage as string;
    const isActive = (DEAL_ACTIVE_STAGES as readonly string[]).includes(stage);
    const quoteRows = quotesByDeal.get(deal.id as string) ?? [];
    const latestTotal = latestQuoteTotal(
      quoteRows.map((q) => ({
        total: Number(q.total ?? 0),
        status: q.status as never,
        sent_at: (q.sent_at as string | null) ?? null,
        created_at: q.created_at as string,
        updated_at: q.created_at as string,
      }))
    );
    const commercial = getDealCommercialValue(deal as never, { latestQuoteTotal: latestTotal });
    const value = commercial.kind === "amount" ? commercial.amount : commercial.kind === "range" ? (commercial.min + commercial.max) / 2 : null;
    const lead = deal.originating_lead_id ? leadsById.get(deal.originating_lead_id as string) : undefined;
    const sentQuotes = quoteRows.filter((q) => q.sent_at);
    const latestSent = sentQuotes.sort((a, b) => String(b.sent_at).localeCompare(String(a.sent_at)))[0];
    const lastActivity =
      (deal.last_meaningful_activity_at as string | null) ||
      lastActivityForLead(
        eventsByLead.get((deal.originating_lead_id as string) ?? "") ?? [],
        callsByLead.get((deal.originating_lead_id as string) ?? "") ?? [],
        waByLead.get((deal.originating_lead_id as string) ?? "") ?? []
      );
    const quoteFollowedUp = Boolean(
      latestSent?.sent_at && lastActivity && lastActivity > String(latestSent.sent_at)
    );
    const wa = waByLead.get((deal.originating_lead_id as string) ?? "") ?? [];
    const lastIn = [...wa].reverse().find((m) => m.direction === "inbound");
    const lastOut = [...wa].reverse().find((m) => m.direction === "outbound");
    const customerWaiting = Boolean(lastIn && (!lastOut || lastIn.at > lastOut.at));

    const row: SnapshotDeal = {
      id: deal.id as string,
      originatingLeadId: (deal.originating_lead_id as string | null) ?? null,
      title: safeName((lead as { name?: string } | undefined)?.name, "Opportunity"),
      ownerId: (deal.owner_id as string | null) ?? null,
      ownerName: peopleById.get(deal.owner_id as string)?.name ?? null,
      stage,
      value,
      lastActivityAt: lastActivity,
      nextActionAt: (deal.next_action_at as string | null) ?? null,
      nextActionLabel: (deal.next_action_label as string | null) ?? null,
      expectedDecisionAt: (deal.expected_decision_at as string | null) ?? null,
      createdAt: deal.created_at as string,
      hasOpenQuote: quoteRows.some((q) => OPEN_QUOTE_STATUSES.has(String(q.status))),
      quoteSentAt: (latestSent?.sent_at as string | null) ?? null,
      quoteFollowedUp,
      customerWaiting,
    };
    if (isActive) activePipeline.push(row);
    if (row.ownerId && !peopleById.has(row.ownerId)) {
      const ghost: SnapshotPerson = {
        id: row.ownerId,
        name: "Former team member",
        active: false,
        role: "SALESPERSON",
      };
      salespeople.push(ghost);
      peopleById.set(ghost.id, ghost);
    }
  }

  const lostThisWeek = deals
    .filter((d) => isoInRange(d.lost_at as string | null, period.startIso, period.endIsoExclusive))
    .map((d) => toLostRow(d, leadsById, peopleById, quotesByDeal));
  const lostPreviousWeek = deals
    .filter((d) => isoInRange(d.lost_at as string | null, previousPeriod.startIso, previousPeriod.endIsoExclusive))
    .map((d) => toLostRow(d, leadsById, peopleById, quotesByDeal));

  const reassignments: ReassignmentEvent[] = events
    .filter((e) => e.event_type === "LEAD_REASSIGNED")
    .map((e) => {
      const data = (e.event_data ?? {}) as { from_id?: string; to_id?: string };
      return {
        entityId: e.lead_id as string,
        fromId: data.from_id ?? null,
        toId: data.to_id ?? null,
        at: e.created_at as string,
      };
    });

  const inboundScan = [
    ...waMessages
      .filter((m) => m.direction === "inbound" && isoInRange(m.created_at as string, period.startIso, period.endIsoExclusive))
      .map((m) => ({ id: m.id as string, body: (m.body as string | null) ?? null })),
    ...socialMessages,
  ].slice(0, MAX_CONVERSATION_SCAN);

  const conversation = {
    scannedCount: inboundScan.length,
    truncated: inboundScan.length >= MAX_CONVERSATION_SCAN,
    patterns: aggregateConversationPatterns(inboundScan),
  };

  const current = buildPeriodFacts({
    period,
    leads: [...leadsById.values()],
    deals,
    quotes,
    events,
    callLogs,
    waMessages,
    viewings,
    eventsByLead,
    callsByLead,
    waByLead,
    activePipeline,
    peopleById,
    healthSlaHours: health.slaResponseHours,
    timezone,
  });
  const previous = buildPeriodFacts({
    period: previousPeriod,
    leads: [...leadsById.values()],
    deals,
    quotes,
    events,
    callLogs,
    waMessages,
    viewings,
    eventsByLead,
    callsByLead,
    waByLead,
    activePipeline: [],
    peopleById,
    healthSlaHours: health.slaResponseHours,
    timezone,
  });
  previous.pipelineValue = 0;

  const attentionSeed: AttentionItem[] = activePipeline
    .filter((d) => d.customerWaiting)
    .map((d) => ({
      id: `wait-${d.id}`,
      entityKind: "deal" as const,
      entityId: d.id,
      displayName: d.title,
      salespersonId: d.ownerId,
      salespersonName: d.ownerName,
      value: d.value,
      stage: d.stage,
      stageLabel: d.stage,
      lastActivityAt: d.lastActivityAt,
      daysInactive: null,
      latestEvent: "Customer replied",
      reason: "Customer replied but the salesperson has not responded.",
      recommendedAction: "Reply today.",
    }));

  const activityVolume =
    current.newLeads +
    current.quotationsSent +
    current.dealsCreated +
    current.dealsWon +
    current.followUpsCompleted +
    current.inboundMessages +
    current.outboundMessages +
    callLogs.filter((c) => isoInRange(c.created_at as string, period.startIso, period.endIsoExclusive)).length;

  return {
    clientId,
    organisationName: (clientRes.data.name as string) || "Organisation",
    organisationLogoUrl: (clientRes.data.logo_url as string | null) ?? null,
    currency,
    timezone,
    period,
    previousPeriod,
    nowIso: now.toISOString(),
    health,
    salespeople,
    current,
    previous,
    activePipeline,
    openQuotes: snapshotQuotes.filter((q) => OPEN_QUOTE_STATUSES.has(q.status)),
    lostThisWeek,
    lostPreviousWeek,
    attentionSeed,
    conversation,
    reassignments: reassignments.filter((r) => isoInRange(r.at, period.startIso, period.endIsoExclusive)),
    activityVolume,
  };
}

function lastActivityForLead(
  events: Array<{ event_type: string; created_at: string }>,
  calls: string[],
  wa: Array<{ at: string }>
): string | null {
  const times = [
    ...events.map((e) => e.created_at),
    ...calls,
    ...wa.map((m) => m.at),
  ].filter(Boolean);
  if (times.length === 0) return null;
  times.sort();
  return times[times.length - 1] ?? null;
}

function toLostRow(
  deal: Record<string, unknown>,
  leadsById: Map<string, Record<string, unknown>>,
  peopleById: Map<string, SnapshotPerson>,
  quotesByDeal: Map<string, Array<Record<string, unknown>>>
) {
  const lead = deal.originating_lead_id ? leadsById.get(deal.originating_lead_id as string) : undefined;
  const quoteRows = quotesByDeal.get(deal.id as string) ?? [];
  const latestTotal = latestQuoteTotal(
    quoteRows.map((q) => ({
      total: Number(q.total ?? 0),
      status: q.status as never,
      sent_at: (q.sent_at as string | null) ?? null,
      created_at: q.created_at as string,
      updated_at: q.created_at as string,
    }))
  );
  const commercial = getDealCommercialValue(deal as never, { latestQuoteTotal: latestTotal });
  const value = commercial.kind === "amount" ? commercial.amount : commercial.kind === "range" ? (commercial.min + commercial.max) / 2 : null;
  const reason = String(deal.lost_reason ?? "").trim();
  return {
    id: deal.id as string,
    displayName: safeName(lead?.name as string | undefined, "Opportunity"),
    salespersonId: (deal.owner_id as string | null) ?? null,
    salespersonName: peopleById.get(deal.owner_id as string)?.name ?? null,
    value,
    stageAtLoss: (deal.stage as string) || "LOST",
    reason: reason || "Reason not recorded",
  };
}

function buildPeriodFacts(input: {
  period: WeekPeriod;
  leads: Array<Record<string, unknown>>;
  deals: Array<Record<string, unknown>>;
  quotes: Array<Record<string, unknown>>;
  events: Array<Record<string, unknown>>;
  callLogs: Array<Record<string, unknown>>;
  waMessages: Array<Record<string, unknown>>;
  viewings: Array<{ scheduled_at: string }>;
  eventsByLead: Map<string, Array<{ event_type: string; created_at: string }>>;
  callsByLead: Map<string, string[]>;
  waByLead: Map<string, Array<{ direction: string; at: string; actorId: string | null }>>;
  activePipeline: SnapshotDeal[];
  peopleById: Map<string, SnapshotPerson>;
  healthSlaHours: number;
  timezone: string;
}): PeriodFacts {
  const { period } = input;
  const facts = emptyPeriodFacts();
  const cohort = input.leads.filter((l) => isoInRange(l.created_at as string, period.startIso, period.endIsoExclusive));
  facts.newLeads = cohort.length;
  facts.contactedLeads = cohort.filter((l) => isContactedLead(String(l.status))).length;
  facts.qualifiedLeads = cohort.filter((l) => isQualifiedLead(String(l.status))).length;
  facts.dealsCreated = input.deals.filter((d) => isoInRange(d.created_at as string, period.startIso, period.endIsoExclusive)).length;
  facts.quotationsSent = input.quotes.filter((q) => isoInRange(q.sent_at as string | null, period.startIso, period.endIsoExclusive)).length;
  facts.quotationsAccepted = input.quotes.filter((q) =>
    isoInRange(q.accepted_at as string | null, period.startIso, period.endIsoExclusive)
  ).length;
  const won = input.deals.filter((d) => isoInRange(d.won_at as string | null, period.startIso, period.endIsoExclusive));
  const lost = input.deals.filter((d) => isoInRange(d.lost_at as string | null, period.startIso, period.endIsoExclusive));
  facts.dealsWon = won.length;
  facts.dealsLost = lost.length;
  facts.revenueWon = won.reduce((sum, d) => {
    const n = Number(d.won_value);
    return sum + (Number.isFinite(n) ? n : 0);
  }, 0);
  facts.pipelineValue = input.activePipeline.reduce((sum, d) => sum + (d.value ?? 0), 0);
  facts.dealsProgressed = input.events.filter(
    (e) =>
      e.event_type === "DEAL_STAGE_CHANGED" &&
      isoInRange(e.created_at as string, period.startIso, period.endIsoExclusive)
  ).length;
  facts.inboundMessages = input.waMessages.filter(
    (m) => m.direction === "inbound" && isoInRange(m.created_at as string, period.startIso, period.endIsoExclusive)
  ).length;
  facts.outboundMessages = input.waMessages.filter(
    (m) => m.direction === "outbound" && isoInRange(m.created_at as string, period.startIso, period.endIsoExclusive)
  ).length;
  facts.appointments =
    input.viewings.filter((v) => isoInRange(v.scheduled_at, period.startIso, period.endIsoExclusive)).length +
    input.callLogs.filter((c) => isoInRange(c.callback_at as string | null, period.startIso, period.endIsoExclusive)).length;

  const responseMinutes: number[] = [];
  let delayed = 0;
  let onTime = 0;
  const delayedByHour: Record<string, number> = {};
  const slaMinutes = input.healthSlaHours * 60;

  for (const lead of cohort) {
    const id = lead.id as string;
    const outbound = (input.waByLead.get(id) ?? []).filter((m) => m.direction === "outbound").map((m) => m.at);
    const first = deriveFirstRespondedAt(input.eventsByLead.get(id) ?? [], input.callsByLead.get(id) ?? [], outbound);
    const minutes = responseMinutesSince(lead.created_at as string, first);
    const personId = (lead.assigned_to_id as string | null) ?? "_unassigned";
    const person = ensurePerson(facts, personId);
    person.leadsAssigned += 1;
    if (isContactedLead(String(lead.status))) person.leadsContacted += 1;
    if (minutes != null) {
      responseMinutes.push(minutes);
      if (minutes > slaMinutes) {
        delayed += 1;
        const hour = hourInTimezone(first!, input.timezone);
        if (hour != null) delayedByHour[String(hour)] = (delayedByHour[String(hour)] ?? 0) + 1;
      } else {
        onTime += 1;
      }
    } else {
      delayed += 1;
    }
  }

  facts.avgFirstResponseMinutes = average(responseMinutes);
  facts.delayedResponses = delayed;
  facts.onTimeResponses = onTime;
  facts.delayedByHour = delayedByHour;

  let followCompleted = 0;
  let followMissed = 0;
  let overdue = 0;
  for (const lead of input.leads) {
    const due = lead.follow_up_date as string | null;
    if (!due) continue;
    const dueIso = due.length === 10 ? `${due}T00:00:00.000Z` : due;
    if (!isoInRange(dueIso, period.startIso, period.endIsoExclusive) && dueIso >= period.endIsoExclusive) continue;
    const id = lead.id as string;
    const last = lastActivityForLead(
      input.eventsByLead.get(id) ?? [],
      input.callsByLead.get(id) ?? [],
      input.waByLead.get(id) ?? []
    );
    const completed = Boolean(last && last >= dueIso && last < period.endIsoExclusive);
    const personId = (lead.assigned_to_id as string | null) ?? "_unassigned";
    const person = ensurePerson(facts, personId);
    if (isoInRange(dueIso, period.startIso, period.endIsoExclusive)) {
      if (completed) {
        followCompleted += 1;
        person.followUpsCompleted += 1;
      } else {
        followMissed += 1;
        person.missedFollowUps += 1;
      }
    }
    if (!completed && dueIso < period.endIsoExclusive && !["WON", "LOST", "NOT_QUALIFIED"].includes(String(lead.status))) {
      overdue += 1;
      person.overdueActivities += 1;
    }
  }
  facts.followUpsCompleted = followCompleted;
  facts.followUpsMissed = followMissed;
  facts.overdueTasks = overdue;

  for (const deal of input.deals) {
    const ownerId = (deal.owner_id as string | null) ?? "_unassigned";
    const person = ensurePerson(facts, ownerId);
    if (isoInRange(deal.created_at as string, period.startIso, period.endIsoExclusive)) person.dealsCreated += 1;
    if (isoInRange(deal.won_at as string | null, period.startIso, period.endIsoExclusive)) {
      person.dealsWon += 1;
      const n = Number(deal.won_value);
      if (Number.isFinite(n)) person.revenueWon += n;
    }
    if (isoInRange(deal.lost_at as string | null, period.startIso, period.endIsoExclusive)) person.dealsLost += 1;
  }
  for (const quote of input.quotes) {
    if (!isoInRange(quote.sent_at as string | null, period.startIso, period.endIsoExclusive)) continue;
    const person = ensurePerson(facts, (quote.prepared_by_id as string | null) ?? "_unassigned");
    person.quotationsSent += 1;
  }
  for (const deal of input.activePipeline) {
    const person = ensurePerson(facts, deal.ownerId ?? "_unassigned");
    person.activePipelineValue += deal.value ?? 0;
    const hours = deal.lastActivityAt
      ? (new Date(period.endIsoExclusive).getTime() - new Date(deal.lastActivityAt).getTime()) / 3_600_000
      : 999;
    if (hours >= 8 * 24) person.staleDeals += 1;
  }

  for (const [id, person] of Object.entries(facts.leadsByPerson)) {
    if (id === "_unassigned") continue;
    person.conversionRate = conversionRate(person.dealsWon, person.leadsAssigned);
    const minutes: number[] = [];
    for (const lead of cohort) {
      if (lead.assigned_to_id !== id) continue;
      const lid = lead.id as string;
      const outbound = (input.waByLead.get(lid) ?? []).filter((m) => m.direction === "outbound").map((m) => m.at);
      const first = deriveFirstRespondedAt(input.eventsByLead.get(lid) ?? [], input.callsByLead.get(lid) ?? [], outbound);
      const value = responseMinutesSince(lead.created_at as string, first);
      if (value != null) minutes.push(value);
    }
    person.avgFirstResponseMinutes = average(minutes);
  }

  facts.conversionRate = conversionRate(facts.dealsWon, facts.newLeads);
  facts.quotationToWinRate = conversionRate(facts.dealsWon, facts.quotationsSent);
  return facts;
}

function responseMinutesSince(createdAt: string, first: string | null): number | null {
  if (!first) return null;
  const mins = (Date.parse(first) - Date.parse(createdAt)) / 60_000;
  return Number.isFinite(mins) && mins >= 0 ? Math.round(mins * 10) / 10 : null;
}

function ensurePerson(facts: PeriodFacts, id: string): PersonPeriodFacts {
  if (!facts.leadsByPerson[id]) facts.leadsByPerson[id] = emptyPersonFacts();
  return facts.leadsByPerson[id]!;
}

async function fetchByIds(
  supabase: Admin,
  table: string,
  columns: string,
  ids: string[],
  column = "id",
  clientId?: string
): Promise<Array<Record<string, unknown>>> {
  const rows: Array<Record<string, unknown>> = [];
  for (let i = 0; i < ids.length; i += 200) {
    const chunk = ids.slice(i, i + 200);
    let query = supabase.from(table).select(columns).in(column, chunk);
    if (clientId) query = query.eq("client_id", clientId);
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    const batch = (data ?? []) as unknown as Array<Record<string, unknown>>;
    rows.push(...batch);
  }
  return rows;
}

async function fetchViewings(
  supabase: Admin,
  clientId: string,
  start: string,
  end: string
): Promise<Array<{ scheduled_at: string }>> {
  try {
    const { data, error } = await supabase
      .from("viewings")
      .select("scheduled_at, client_id")
      .eq("client_id", clientId)
      .gte("scheduled_at", start)
      .lt("scheduled_at", end);
    if (error) return [];
    return (data ?? []) as unknown as Array<{ scheduled_at: string }>;
  } catch {
    return [];
  }
}

async function fetchSocialInbound(
  supabase: Admin,
  clientId: string,
  start: string,
  end: string
): Promise<Array<{ id: string; body: string | null }>> {
  try {
    const { data, error } = await supabase
      .from("social_messages")
      .select("id, body, direction, created_at, client_id")
      .eq("client_id", clientId)
      .eq("direction", "inbound")
      .gte("created_at", start)
      .lt("created_at", end)
      .limit(400);
    if (error) return [];
    return (data ?? []).map((row) => ({
      id: row.id as string,
      body: (row.body as string | null) ?? null,
    }));
  } catch {
    return [];
  }
}
