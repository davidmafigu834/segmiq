import { createAdminClient } from "@/lib/supabase/admin";
import { fetchLatestScheduledCallbacksByLeadId } from "@/lib/convert-later-picks";
import { planDateInTimezone, planDayBoundsUtc } from "@/lib/sales/intelligence/timezone";
import { firstQualifyingResponseMinutes } from "@/lib/sales/intelligence/meaningful-activity";
import { locationFromFormData } from "@/lib/sales/calendar/location";
import { adaptLeadToCalendarEvent } from "@/lib/sales/calendar/adapters";
import { DEAL_ACTIVE_STAGES, getDealAttentionState } from "@/lib/sales/deals";
import {
  calendarDateKey,
  canMutateCompanyCalendarLead,
  companyCalendarRangeKeys,
  companyCalendarOwnerKey,
  inferDealCalendarKind,
} from "@/lib/sales/company-calendar/format";
import {
  buildCompanyCalendarExecutionSummary,
  type CompanyCalendarSummarySignal,
} from "@/lib/sales/company-calendar/summary";
import type {
  CompanyCalendarEvent,
  CompanyCalendarEventKind,
  CompanyCalendarLeadOwner,
  CompanyCalendarOwnerOption,
  CompanyCalendarPageData,
} from "@/lib/sales/company-calendar/types";
import type { CalendarLeadRow } from "@/lib/sales/calendar/types";
import type { PriorityLead } from "@/lib/sales-priority-lead";
import type { DealRow } from "@/types";
import { addDays, format, parseISO } from "date-fns";

const CLOSED_LEAD_STATUSES = new Set(["WON", "LOST", "NOT_QUALIFIED", "CONVERTED_TO_DEAL"]);
const LEAD_SELECT =
  "id, client_id, assigned_to_id, contact_id, name, phone, email, status, source, project_type, form_data, score, is_stale, is_archived, budget, timeline, follow_up_date, created_at";

type CompanyLead = {
  id: string;
  client_id: string;
  assigned_to_id: string | null;
  contact_id: string | null;
  name: string | null;
  phone: string | null;
  email: string | null;
  status: string;
  source: string | null;
  project_type: string | null;
  form_data: Record<string, unknown> | null;
  score: number | null;
  is_stale: boolean | null;
  is_archived: boolean | null;
  budget: string | null;
  timeline: string | null;
  follow_up_date: string | null;
  created_at: string;
};

type TeamUser = {
  id: string;
  name: string | null;
  avatar_url: string | null;
  role: string;
  also_sells: boolean | null;
  is_active: boolean | null;
};

type ContactLite = {
  id: string;
  name: string | null;
  phone: string | null;
  location: string | null;
};

type ViewingRow = {
  id: string;
  contact_id: string;
  listing_id: string;
  agent_id: string | null;
  scheduled_at: string;
  status: string;
  feedback_text: string | null;
  contacts:
    | { id: string; client_id: string; name: string | null; phone: string | null; location: string | null }
    | Array<{ id: string; client_id: string; name: string | null; phone: string | null; location: string | null }>
    | null;
  listings:
    | { id: string; address: string | null; suburb: string | null }
    | Array<{ id: string; address: string | null; suburb: string | null }>
    | null;
};

type CallbackCandidateRow = {
  lead_id: string;
  callback_at: string;
  created_at: string;
  leads: CompanyLead | CompanyLead[] | null;
};

type CompletionEventRow = {
  id: string;
  lead_id: string;
  actor_id: string | null;
  event_type: string;
  event_data: Record<string, unknown> | null;
  created_at: string;
  leads: CompanyLead | CompanyLead[] | null;
};

type ResponseLead = {
  id: string;
  created_at: string;
  assigned_to_id: string | null;
};

function unwrap<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? value[0] ?? null : value;
}

function leadKind(lead: CompanyLead, adaptedKind: string): CompanyCalendarEventKind {
  if (adaptedKind === "CALL") return "call";
  if (adaptedKind === "QUOTE_REVIEW") return "quote_review";
  if (String(lead.source ?? "").toUpperCase().includes("WHATSAPP")) return "whatsapp";
  return "follow_up";
}

function isDateOnlyTimestamp(value: string): boolean {
  return /T00:00:00(?:\.000)?(?:Z|[+-]\d\d:\d\d)$/.test(value);
}

function viewingStatus(
  value: string,
  scheduledAt: string,
  nowMs: number
): CompanyCalendarEvent["status"] {
  if (value === "completed") return "completed";
  if (value === "cancelled" || value === "no_show") return "cancelled";
  if (Date.parse(scheduledAt) < nowMs) return "overdue";
  return "scheduled";
}

function teamRoleLabel(member: TeamUser | null | undefined): string | null {
  if (!member) return null;
  if (member.role === "CLIENT_MANAGER") {
    return member.also_sells ? "Company Manager · Sales" : "Company Manager";
  }
  return "Sales Executive";
}

function isCompletionEvent(row: CompletionEventRow): boolean {
  return row.event_type === "FOLLOW_UP_COMPLETED" || row.event_data?.completed === true;
}

function toPriorityLead(lead: CompanyLead): PriorityLead {
  return {
    id: lead.id,
    name: lead.name,
    phone: lead.phone,
    email: lead.email,
    status: lead.status,
    score: lead.score,
    is_stale: lead.is_stale,
    budget: lead.budget,
    project_type: lead.project_type,
    timeline: lead.timeline,
    form_data: lead.form_data,
    created_at: lead.created_at,
    follow_up_date: lead.follow_up_date,
    followUpDue: false,
    priorityLabel: "",
    priorityColor: "",
    priorityOrder: 0,
    client_id: lead.client_id,
    source: lead.source,
  };
}

export async function getCompanyCalendarData(opts: {
  clientId: string;
  rangeStartKey: string;
  rangeEndKey: string;
  actorId: string;
  timezone: string;
  canManageAny: boolean;
  canActAsSalesperson: boolean;
}): Promise<CompanyCalendarPageData> {
  const supabase = createAdminClient();
  const [clientRes, teamRes] = await Promise.all([
    supabase.from("clients").select("id, name").eq("id", opts.clientId).maybeSingle(),
    supabase
      .from("users")
      .select("id, name, avatar_url, role, also_sells, is_active")
      .eq("client_id", opts.clientId)
      .order("name", { ascending: true }),
  ]);
  const timezone = opts.timezone;
  const rangeStartIso = planDayBoundsUtc(opts.rangeStartKey, timezone).startIso;
  const rangeEndIso = planDayBoundsUtc(opts.rangeEndKey, timezone).startIso;
  const now = new Date();
  const nowMs = now.getTime();
  const todayKey = planDateInTimezone(now, timezone);
  const todayStartIso = planDayBoundsUtc(todayKey, timezone).startIso;
  const nextSevenEndKey = format(addDays(parseISO(`${todayKey}T12:00:00`), 7), "yyyy-MM-dd");
  const nextSevenEndIso = planDayBoundsUtc(nextSevenEndKey, timezone).startIso;
  const currentWeek = companyCalendarRangeKeys(todayKey, "week");
  const weekStartIso = planDayBoundsUtc(currentWeek.startKey, timezone).startIso;
  const weekEndIso = planDayBoundsUtc(currentWeek.endKey, timezone).startIso;
  const summaryRangeStartIso = weekStartIso < todayStartIso ? weekStartIso : todayStartIso;
  const summaryRangeEndIso = weekEndIso > nextSevenEndIso ? weekEndIso : nextSevenEndIso;
  const sixtyDaysAgoIso = new Date(nowMs - 60 * 86_400_000).toISOString();

  const [
    scheduledLeadsRes,
    overdueLeadsRes,
    callbackCandidatesRes,
    allLeadsRes,
    dealsRes,
    viewingsRes,
    summaryViewingsRes,
    visibleCompletionsRes,
    weekCompletionsRes,
    responseLeadsRes,
  ] = await Promise.all([
    supabase
      .from("leads")
      .select(LEAD_SELECT)
      .eq("client_id", opts.clientId)
      .not("follow_up_date", "is", null)
      .gte("follow_up_date", opts.rangeStartKey)
      .lt("follow_up_date", opts.rangeEndKey)
      .or("is_archived.is.null,is_archived.eq.false")
      .order("follow_up_date", { ascending: true })
      .limit(2500),
    supabase
      .from("leads")
      .select(LEAD_SELECT)
      .eq("client_id", opts.clientId)
      .not("follow_up_date", "is", null)
      .lt("follow_up_date", todayKey)
      .or("is_archived.is.null,is_archived.eq.false")
      .order("follow_up_date", { ascending: true })
      .limit(1000),
    supabase
      .from("call_logs")
      .select(`lead_id, callback_at, created_at, leads!inner(${LEAD_SELECT})`)
      .eq("leads.client_id", opts.clientId)
      .not("callback_at", "is", null)
      .gte("callback_at", rangeStartIso)
      .lt("callback_at", rangeEndIso)
      .order("created_at", { ascending: false })
      .limit(2500),
    supabase
      .from("leads")
      .select(LEAD_SELECT)
      .eq("client_id", opts.clientId)
      .or("is_archived.is.null,is_archived.eq.false")
      .order("updated_at", { ascending: false })
      .limit(2500),
    supabase
      .from("deals")
      .select("*")
      .eq("client_id", opts.clientId)
      .in("stage", [...DEAL_ACTIVE_STAGES])
      .order("updated_at", { ascending: false })
      .limit(2000),
    supabase
      .from("viewings")
      .select(
        "id, contact_id, listing_id, agent_id, scheduled_at, status, feedback_text, contacts!inner(id, client_id, name, phone, location), listings(id, address, suburb)"
      )
      .eq("contacts.client_id", opts.clientId)
      .gte("scheduled_at", rangeStartIso)
      .lt("scheduled_at", rangeEndIso)
      .order("scheduled_at", { ascending: true })
      .limit(1500),
    supabase
      .from("viewings")
      .select(
        "id, contact_id, listing_id, agent_id, scheduled_at, status, feedback_text, contacts!inner(id, client_id, name, phone, location), listings(id, address, suburb)"
      )
      .eq("contacts.client_id", opts.clientId)
      .gte("scheduled_at", summaryRangeStartIso)
      .lt("scheduled_at", summaryRangeEndIso)
      .order("scheduled_at", { ascending: true })
      .limit(1500),
    supabase
      .from("lead_events")
      .select(`id, lead_id, actor_id, event_type, event_data, created_at, leads!inner(${LEAD_SELECT})`)
      .eq("leads.client_id", opts.clientId)
      .in("event_type", ["FOLLOW_UP_SET", "FOLLOW_UP_COMPLETED"])
      .gte("created_at", rangeStartIso)
      .lt("created_at", rangeEndIso)
      .order("created_at", { ascending: true })
      .limit(2500),
    supabase
      .from("lead_events")
      .select(`id, lead_id, actor_id, event_type, event_data, created_at, leads!inner(${LEAD_SELECT})`)
      .eq("leads.client_id", opts.clientId)
      .in("event_type", ["FOLLOW_UP_SET", "FOLLOW_UP_COMPLETED"])
      .gte("created_at", weekStartIso)
      .lt("created_at", weekEndIso)
      .order("created_at", { ascending: true })
      .limit(2500),
    supabase
      .from("leads")
      .select("id, created_at, assigned_to_id")
      .eq("client_id", opts.clientId)
      .gte("created_at", sixtyDaysAgoIso)
      .order("created_at", { ascending: false })
      .limit(3000),
  ]);

  const team = (teamRes.data ?? []) as TeamUser[];
  const teamById = new Map(team.map((member) => [member.id, member]));
  const scheduledLeads = (scheduledLeadsRes.data ?? []) as CompanyLead[];
  const overdueLeads = (overdueLeadsRes.data ?? []) as CompanyLead[];
  const callbackCandidates = callbackCandidatesRes.error
    ? []
    : ((callbackCandidatesRes.data ?? []) as unknown as CallbackCandidateRow[]);
  const calendarLeadById = new Map(
    [...scheduledLeads, ...overdueLeads].map((lead) => [lead.id, lead])
  );
  for (const row of callbackCandidates) {
    const lead = unwrap(row.leads);
    if (
      lead &&
      lead.client_id === opts.clientId &&
      lead.is_archived !== true &&
      !CLOSED_LEAD_STATUSES.has(lead.status)
    ) {
      calendarLeadById.set(lead.id, lead);
    }
  }
  const calendarLeads = [...calendarLeadById.values()];
  const allLeadById = new Map(
    [...((allLeadsRes.data ?? []) as CompanyLead[]), ...overdueLeads].map((lead) => [lead.id, lead])
  );
  const allLeads = [...allLeadById.values()].filter(
    (lead) => !CLOSED_LEAD_STATUSES.has(lead.status) && lead.is_archived !== true
  );
  const allDeals = (dealsRes.data ?? []) as DealRow[];
  const deals = allDeals.filter((deal) => {
    if (!deal.next_action_at) return false;
    const start = Date.parse(deal.next_action_at);
    return start >= Date.parse(rangeStartIso) && start < Date.parse(rangeEndIso);
  });
  const viewings = viewingsRes.error ? [] : ((viewingsRes.data ?? []) as unknown as ViewingRow[]);
  const summaryViewings = summaryViewingsRes.error
    ? []
    : ((summaryViewingsRes.data ?? []) as unknown as ViewingRow[]);
  const visibleCompletions = visibleCompletionsRes.error
    ? []
    : ((visibleCompletionsRes.data ?? []) as unknown as CompletionEventRow[]).filter(isCompletionEvent);
  const weekCompletions = weekCompletionsRes.error
    ? []
    : ((weekCompletionsRes.data ?? []) as unknown as CompletionEventRow[]).filter(isCompletionEvent);
  const responseLeads = (responseLeadsRes.data ?? []) as ResponseLead[];

  const leadIds = calendarLeads.map((lead) => lead.id);
  const contactIds = new Set<string>();
  for (const lead of calendarLeads) if (lead.contact_id) contactIds.add(lead.contact_id);
  for (const deal of deals) if (deal.contact_id) contactIds.add(deal.contact_id);

  const [callbacksByLeadId, quotesRes, contactsRes] = await Promise.all([
    fetchLatestScheduledCallbacksByLeadId(supabase, leadIds),
    leadIds.length
      ? supabase
          .from("quotations")
          .select("lead_id, quote_number, status, total, created_at")
          .in("lead_id", leadIds)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [] as Array<Record<string, unknown>> }),
    contactIds.size
      ? supabase
          .from("contacts")
          .select("id, name, phone, location")
          .eq("client_id", opts.clientId)
          .in("id", [...contactIds])
      : Promise.resolve({ data: [] as ContactLite[] }),
  ]);

  const contacts = (contactsRes.data ?? []) as ContactLite[];
  const contactById = new Map(contacts.map((contact) => [contact.id, contact]));
  const latestQuoteByLead = new Map<
    string,
    { quote_number: string | null; status: string | null; total: number | null }
  >();
  for (const raw of quotesRes.data ?? []) {
    const row = raw as Record<string, unknown>;
    const leadId = String(row.lead_id ?? "");
    if (!leadId || latestQuoteByLead.has(leadId)) continue;
    latestQuoteByLead.set(leadId, {
      quote_number: typeof row.quote_number === "string" ? row.quote_number : null,
      status: typeof row.status === "string" ? row.status : null,
      total: row.total == null ? null : Number(row.total) || null,
    });
  }

  const responseLeadIds = responseLeads.map((lead) => lead.id).slice(0, 1500);
  const emptyResponseRows = { data: [] as unknown[] };
  const [responseCallsRes, responseWhatsappRes, responseEventsRes] = responseLeadIds.length
    ? await Promise.all([
        Promise.resolve(
          supabase
            .from("call_logs")
            .select("lead_id, created_at")
            .in("lead_id", responseLeadIds)
            .order("created_at", { ascending: true })
            .limit(5000)
        ).catch(() => emptyResponseRows),
        Promise.resolve(
          supabase
            .from("whatsapp_messages")
            .select("lead_id, created_at")
            .in("lead_id", responseLeadIds)
            .eq("direction", "outbound")
            .order("created_at", { ascending: true })
            .limit(5000)
        ).catch(() => emptyResponseRows),
        Promise.resolve(
          supabase
            .from("lead_events")
            .select("lead_id, event_type, created_at")
            .in("lead_id", responseLeadIds)
            .in("event_type", ["CALL_LOGGED", "MESSAGE_SENT"])
            .order("created_at", { ascending: true })
            .limit(5000)
        ).catch(() => emptyResponseRows),
      ])
    : [emptyResponseRows, emptyResponseRows, emptyResponseRows];

  const responseCallAts = new Map<string, string[]>();
  const responseWhatsappAts = new Map<string, string[]>();
  const responseEvents = new Map<string, Array<{ event_type: string; created_at: string }>>();
  for (const row of (responseCallsRes.data ?? []) as Array<{ lead_id: string; created_at: string }>) {
    const list = responseCallAts.get(row.lead_id) ?? [];
    list.push(row.created_at);
    responseCallAts.set(row.lead_id, list);
  }
  for (const row of (responseWhatsappRes.data ?? []) as Array<{ lead_id: string; created_at: string }>) {
    const list = responseWhatsappAts.get(row.lead_id) ?? [];
    list.push(row.created_at);
    responseWhatsappAts.set(row.lead_id, list);
  }
  for (const row of (responseEventsRes.data ?? []) as Array<{
    lead_id: string;
    event_type: string;
    created_at: string;
  }>) {
    const list = responseEvents.get(row.lead_id) ?? [];
    list.push({ event_type: row.event_type, created_at: row.created_at });
    responseEvents.set(row.lead_id, list);
  }
  const responseInputs = {
    eventsByLead: responseEvents,
    callAtsByLead: responseCallAts,
    outboundWaByLead: responseWhatsappAts,
  };
  const thirtyDaysAgoMs = nowMs - 30 * 86_400_000;
  const responseCurrentLeads = responseLeads.filter(
    (lead) => Date.parse(lead.created_at) >= thirtyDaysAgoMs
  );
  const responsePreviousLeads = responseLeads.filter(
    (lead) => Date.parse(lead.created_at) < thirtyDaysAgoMs
  );
  const responseAll = {
    current: firstQualifyingResponseMinutes(responseCurrentLeads, responseInputs),
    previous: firstQualifyingResponseMinutes(responsePreviousLeads, responseInputs),
  };
  const responseByOwner: Record<string, { current: number | null; previous: number | null }> = {};
  for (const member of team) {
    responseByOwner[member.id] = {
      current: firstQualifyingResponseMinutes(
        responseCurrentLeads.filter((lead) => lead.assigned_to_id === member.id),
        responseInputs
      ),
      previous: firstQualifyingResponseMinutes(
        responsePreviousLeads.filter((lead) => lead.assigned_to_id === member.id),
        responseInputs
      ),
    };
  }

  const events: CompanyCalendarEvent[] = [];
  for (const lead of calendarLeads) {
    if (CLOSED_LEAD_STATUSES.has(lead.status)) continue;
    const quote = latestQuoteByLead.get(lead.id);
    const contact = lead.contact_id ? contactById.get(lead.contact_id) : null;
    const calendarLead: CalendarLeadRow = {
      id: lead.id,
      name: lead.name,
      phone: lead.phone,
      location: contact?.location?.trim() || locationFromFormData(lead.form_data),
      follow_up_date: lead.follow_up_date,
      status: lead.status,
      source: lead.source,
      project_type: lead.project_type,
      form_data: lead.form_data,
      score: lead.score,
      latestQuoteNumber: quote?.quote_number ?? null,
      latestQuoteStatus: quote?.status ?? null,
      latestQuoteTotal: quote?.total ?? null,
    };
    const adapted = adaptLeadToCalendarEvent(calendarLead, callbacksByLeadId[lead.id]);
    if (!adapted) continue;
    const adaptedStartMs = Date.parse(adapted.startAt);
    const overdue = adapted.hasTimedCallback
      ? adaptedStartMs < nowMs
      : calendarDateKey(adapted.startAt, timezone) < todayKey;
    const outsideVisibleRange =
      adaptedStartMs < Date.parse(rangeStartIso) || adaptedStartMs >= Date.parse(rangeEndIso);
    if (outsideVisibleRange && !overdue) {
      continue;
    }
    const owner = lead.assigned_to_id ? teamById.get(lead.assigned_to_id) : null;
    const canMutate = canMutateCompanyCalendarLead({
      canManageAny: opts.canManageAny,
      canActAsSalesperson: opts.canActAsSalesperson,
      actorId: opts.actorId,
      ownerId: lead.assigned_to_id,
    });
    const kind = leadKind(lead, adapted.kind);
    events.push({
      id: adapted.id,
      sourceType: "lead_follow_up",
      sourceId: lead.id,
      kind,
      title: adapted.title,
      startAt: adapted.startAt,
      endAt: adapted.endAt ?? null,
      allDay: !adapted.hasTimedCallback,
      status: overdue ? "overdue" : "scheduled",
      sourceStatus: lead.status,
      ownerId: lead.assigned_to_id,
      ownerName: owner?.name?.trim() || null,
      ownerAvatarUrl: owner?.avatar_url ?? null,
      ownerRoleLabel: teamRoleLabel(owner),
      relationType: "lead",
      relatedId: lead.id,
      relatedLabel: adapted.customerName || "Lead",
      relatedSecondary: adapted.pipelineStage,
      relatedHref: `/client/leads?lead=${encodeURIComponent(lead.id)}`,
      leadId: lead.id,
      dealId: null,
      customerId: lead.contact_id,
      phone: lead.phone,
      location: adapted.location,
      description: adapted.projectType,
      attentionReason: overdue
        ? "The canonical follow-up due date has passed and the follow-up remains unresolved."
        : null,
      canEdit: canMutate,
      canComplete: canMutate,
    });
  }

  for (const completion of visibleCompletions) {
    const lead = unwrap(completion.leads);
    if (!lead || lead.client_id !== opts.clientId || lead.is_archived === true) continue;
    const owner = lead.assigned_to_id ? teamById.get(lead.assigned_to_id) : null;
    events.push({
      id: `lead-followup-completed-${completion.id}`,
      sourceType: "lead_follow_up",
      sourceId: lead.id,
      kind: "follow_up",
      title: "Follow-up completed",
      startAt: completion.created_at,
      endAt: null,
      allDay: false,
      status: "completed",
      sourceStatus: lead.status,
      ownerId: lead.assigned_to_id,
      ownerName: owner?.name?.trim() || null,
      ownerAvatarUrl: owner?.avatar_url ?? null,
      ownerRoleLabel: teamRoleLabel(owner),
      relationType: "lead",
      relatedId: lead.id,
      relatedLabel: lead.name?.trim() || "Lead",
      relatedSecondary: "Completed follow-up",
      relatedHref: `/client/leads?lead=${encodeURIComponent(lead.id)}`,
      leadId: lead.id,
      dealId: null,
      customerId: lead.contact_id,
      phone: lead.phone,
      location: locationFromFormData(lead.form_data),
      description: null,
      attentionReason: null,
      canEdit: false,
      canComplete: false,
    });
  }

  for (const deal of deals) {
    if (!deal.next_action_at) continue;
    const owner = deal.owner_id ? teamById.get(deal.owner_id) : null;
    const contact = deal.contact_id ? contactById.get(deal.contact_id) : null;
    const label = deal.next_action_label?.trim() || "Deal next action";
    const overdue = Date.parse(deal.next_action_at) < nowMs;
    const attention = getDealAttentionState(deal, now);
    events.push({
      id: `deal-action-${deal.id}`,
      sourceType: "deal_next_action",
      sourceId: deal.id,
      kind: inferDealCalendarKind(label),
      title: label,
      startAt: deal.next_action_at,
      endAt: null,
      allDay: isDateOnlyTimestamp(deal.next_action_at),
      status: overdue ? "overdue" : "scheduled",
      sourceStatus: deal.stage,
      ownerId: deal.owner_id,
      ownerName: owner?.name?.trim() || null,
      ownerAvatarUrl: owner?.avatar_url ?? null,
      ownerRoleLabel: teamRoleLabel(owner),
      relationType: "deal",
      relatedId: deal.id,
      relatedLabel: deal.name,
      relatedSecondary: contact?.name?.trim() || deal.service_summary?.trim() || null,
      relatedHref: `/client/deals/${deal.id}`,
      leadId: deal.originating_lead_id,
      dealId: deal.id,
      customerId: deal.contact_id,
      phone: contact?.phone?.trim() || null,
      location: deal.location?.trim() || contact?.location?.trim() || null,
      description: deal.service_summary?.trim() || null,
      attentionReason: attention.atRisk ? attention.reason : null,
      canEdit: false,
      canComplete: false,
    });
  }

  for (const viewing of viewings) {
    const contact = unwrap(viewing.contacts);
    const listing = unwrap(viewing.listings);
    if (!contact || contact.client_id !== opts.clientId) continue;
    const owner = viewing.agent_id ? teamById.get(viewing.agent_id) : null;
    const location = [listing?.address, listing?.suburb].filter(Boolean).join(", ") || contact.location;
    events.push({
      id: `viewing-${viewing.id}`,
      sourceType: "viewing",
      sourceId: viewing.id,
      kind: "site_visit",
      title: "Site visit",
      startAt: viewing.scheduled_at,
      endAt: null,
      allDay: false,
      status: viewingStatus(viewing.status, viewing.scheduled_at, nowMs),
      sourceStatus: viewing.status,
      ownerId: viewing.agent_id,
      ownerName: owner?.name?.trim() || null,
      ownerAvatarUrl: owner?.avatar_url ?? null,
      ownerRoleLabel: teamRoleLabel(owner),
      relationType: "customer",
      relatedId: contact.id,
      relatedLabel: contact.name?.trim() || "Customer",
      relatedSecondary: location || null,
      relatedHref: `/client/contacts/${contact.id}`,
      leadId: null,
      dealId: null,
      customerId: contact.id,
      phone: contact.phone?.trim() || null,
      location: location || null,
      description: viewing.feedback_text?.trim() || null,
      attentionReason:
        viewingStatus(viewing.status, viewing.scheduled_at, nowMs) === "overdue"
          ? "The scheduled visit time has passed without a completed or cancelled state."
          : null,
      canEdit: false,
      canComplete: false,
    });
  }

  events.sort((a, b) => a.startAt.localeCompare(b.startAt));
  const eventOwnerIds = new Set(events.map((event) => event.ownerId).filter(Boolean));
  const owners: CompanyCalendarOwnerOption[] = team
    .filter(
      (member) =>
        member.is_active !== false &&
        (member.role === "SALESPERSON" || Boolean(member.also_sells) || eventOwnerIds.has(member.id))
    )
    .map((member) => ({
      id: member.id,
      name: member.name?.trim() || "Team member",
      avatarUrl: member.avatar_url,
      roleLabel: teamRoleLabel(member) ?? "Sales Executive",
    }));

  const manageableLeads = allLeads.filter(
    (lead) => opts.canManageAny || (opts.canActAsSalesperson && lead.assigned_to_id === opts.actorId)
  );
  const leadOwners: Record<string, CompanyCalendarLeadOwner> = {};
  for (const lead of manageableLeads) {
    const owner = lead.assigned_to_id ? teamById.get(lead.assigned_to_id) : null;
    leadOwners[lead.id] = {
      id: lead.assigned_to_id,
      name: owner?.name?.trim() || null,
      avatarUrl: owner?.avatar_url ?? null,
      roleLabel: teamRoleLabel(owner),
    };
  }

  const summarySignals: CompanyCalendarSummarySignal[] = [];
  for (const lead of allLeads) {
    if (!lead.follow_up_date) continue;
    const raw = lead.follow_up_date;
    const dueKey = /^\d{4}-\d{2}-\d{2}/.test(raw)
      ? raw.slice(0, 10)
      : calendarDateKey(raw, timezone);
    const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(raw) || isDateOnlyTimestamp(raw);
    const startAt = dateOnly
      ? new Date(Date.parse(planDayBoundsUtc(dueKey, timezone).startIso) + 12 * 3_600_000).toISOString()
      : raw;
    const overdue = dateOnly ? dueKey < todayKey : Date.parse(raw) < nowMs;
    summarySignals.push({
      ownerId: lead.assigned_to_id,
      sourceType: "lead_follow_up",
      startAt,
      completedAt: null,
      status: overdue ? "overdue" : "scheduled",
      atRisk: overdue,
    });
  }
  for (const deal of allDeals) {
    if (!deal.next_action_at) continue;
    const attention = getDealAttentionState(deal, now);
    summarySignals.push({
      ownerId: deal.owner_id,
      sourceType: "deal_next_action",
      startAt: deal.next_action_at,
      completedAt: null,
      status: Date.parse(deal.next_action_at) < nowMs ? "overdue" : "scheduled",
      atRisk: attention.atRisk,
    });
  }
  const summaryViewingById = new Map(summaryViewings.map((viewing) => [viewing.id, viewing]));
  for (const viewing of summaryViewingById.values()) {
    const status = viewingStatus(viewing.status, viewing.scheduled_at, nowMs);
    summarySignals.push({
      ownerId: viewing.agent_id,
      sourceType: "viewing",
      startAt: viewing.scheduled_at,
      completedAt: status === "completed" ? viewing.scheduled_at : null,
      status,
      atRisk: status === "overdue",
    });
  }
  for (const completion of weekCompletions) {
    const lead = unwrap(completion.leads);
    if (!lead || lead.client_id !== opts.clientId || lead.is_archived === true) continue;
    summarySignals.push({
      ownerId: lead.assigned_to_id,
      sourceType: "lead_follow_up",
      startAt: completion.created_at,
      completedAt: completion.created_at,
      status: "completed",
      atRisk: false,
    });
  }
  const summaryOwnerIds = owners.map((owner) => owner.id);
  if (summarySignals.some((signal) => signal.ownerId == null)) {
    summaryOwnerIds.push(companyCalendarOwnerKey(null));
  }
  const summary = buildCompanyCalendarExecutionSummary({
    signals: summarySignals,
    ownerIds: summaryOwnerIds,
    period: {
      nowIso: now.toISOString(),
      todayKey,
      nextSevenDaysEndIso: nextSevenEndIso,
      weekStartIso,
      weekEndIso,
      timezone,
    },
    responseAll,
    responseByOwner,
  });

  return {
    clientId: opts.clientId,
    clientName:
      (clientRes.data as { name?: string | null } | null)?.name?.trim() || "Company",
    timezone,
    rangeStartKey: opts.rangeStartKey,
    rangeEndKey: opts.rangeEndKey,
    events,
    owners,
    scheduleableLeads: manageableLeads.map(toPriorityLead),
    leadOwners,
    summary,
  };
}
