import { createAdminClient } from "@/lib/supabase/admin";
import { fetchLatestScheduledCallbacksByLeadId } from "@/lib/convert-later-picks";
import { planDayBoundsUtc } from "@/lib/sales/intelligence/timezone";
import { locationFromFormData } from "@/lib/sales/calendar/location";
import { adaptLeadToCalendarEvent } from "@/lib/sales/calendar/adapters";
import { DEAL_ACTIVE_STAGES } from "@/lib/sales/deals";
import {
  canMutateCompanyCalendarLead,
  inferDealCalendarKind,
} from "@/lib/sales/company-calendar/format";
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

function viewingStatus(value: string): CompanyCalendarEvent["status"] {
  if (value === "completed") return "completed";
  if (value === "cancelled" || value === "no_show") return "cancelled";
  return "scheduled";
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

  const [scheduledLeadsRes, callbackCandidatesRes, allLeadsRes, dealsRes, viewingsRes] = await Promise.all([
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
      .limit(500),
    supabase
      .from("deals")
      .select("*")
      .eq("client_id", opts.clientId)
      .in("stage", [...DEAL_ACTIVE_STAGES])
      .not("next_action_at", "is", null)
      .gte("next_action_at", rangeStartIso)
      .lt("next_action_at", rangeEndIso)
      .order("next_action_at", { ascending: true })
      .limit(1500),
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
  ]);

  const team = (teamRes.data ?? []) as TeamUser[];
  const teamById = new Map(team.map((member) => [member.id, member]));
  const scheduledLeads = (scheduledLeadsRes.data ?? []) as CompanyLead[];
  const callbackCandidates = callbackCandidatesRes.error
    ? []
    : ((callbackCandidatesRes.data ?? []) as unknown as CallbackCandidateRow[]);
  const calendarLeadById = new Map(scheduledLeads.map((lead) => [lead.id, lead]));
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
  const allLeads = ((allLeadsRes.data ?? []) as CompanyLead[]).filter(
    (lead) => !CLOSED_LEAD_STATUSES.has(lead.status)
  );
  const deals = (dealsRes.data ?? []) as DealRow[];
  const viewings = viewingsRes.error ? [] : ((viewingsRes.data ?? []) as unknown as ViewingRow[]);

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
    if (adaptedStartMs < Date.parse(rangeStartIso) || adaptedStartMs >= Date.parse(rangeEndIso)) {
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
      status: adapted.overdue ? "overdue" : "scheduled",
      sourceStatus: lead.status,
      ownerId: lead.assigned_to_id,
      ownerName: owner?.name?.trim() || null,
      ownerAvatarUrl: owner?.avatar_url ?? null,
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
      canEdit: canMutate,
      canComplete: canMutate,
    });
  }

  for (const deal of deals) {
    if (!deal.next_action_at) continue;
    const owner = deal.owner_id ? teamById.get(deal.owner_id) : null;
    const contact = deal.contact_id ? contactById.get(deal.contact_id) : null;
    const label = deal.next_action_label?.trim() || "Deal next action";
    const overdue = Date.parse(deal.next_action_at) < Date.now();
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
      status: viewingStatus(viewing.status),
      sourceStatus: viewing.status,
      ownerId: viewing.agent_id,
      ownerName: owner?.name?.trim() || null,
      ownerAvatarUrl: owner?.avatar_url ?? null,
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
    };
  }

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
  };
}
