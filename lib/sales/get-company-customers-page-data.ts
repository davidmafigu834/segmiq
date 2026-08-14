/**
 * Company Customers page aggregator.
 *
 * Customers are canonical contacts with lifecycle=customer. Deal totals and
 * meaningful interactions are loaded in batches, never once per Customer.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import {
  DEAL_ACTIVE_STAGES,
  getDealCommercialValue,
} from "@/lib/sales/deals";
import { loadQuoteTotalsByDealId } from "@/lib/sales/get-company-team-page-data";
import {
  COMPANY_CUSTOMERS_CAP,
  buildCompanyCustomersKpis,
  countCompanyCustomersTabs,
  customerTypeLabel,
  customerValueLabel,
  formatCustomerDate,
  formatCustomerType,
} from "@/lib/sales/company-customers-metrics";
import type {
  CompanyCustomerActivity,
  CompanyCustomerDetail,
  CompanyCustomerRow,
  CompanyCustomersOwnerOption,
  CompanyCustomersPageData,
} from "@/components/dashboard/company/customers/types";
import type { DealRow } from "@/types";

type CustomerContact = {
  id: string;
  client_id: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  location: string | null;
  source: string | null;
  lifecycle: string;
  created_at: string;
  updated_at: string;
  customer_type?: string | null;
  industry?: string | null;
  primary_contact_name?: string | null;
  relationship_owner_id?: string | null;
};

type TeamUser = {
  id: string;
  name: string | null;
  avatar_url: string | null;
  role: string;
  also_sells: boolean | null;
  is_active: boolean | null;
};

type LeadLink = {
  id: string;
  contact_id: string | null;
  project_type?: string | null;
};

type ActivitySignal = {
  contactId: string;
  at: string;
  channel: string;
};

type DealTotals = {
  totalDeals: number;
  activeDeals: number;
  activePipelineKnown: number;
  activePipelineUnknownCount: number;
  wonDeals: number;
  wonValueKnown: number;
  wonValueUnknownCount: number;
};

const EMPTY_DEAL_TOTALS: DealTotals = {
  totalDeals: 0,
  activeDeals: 0,
  activePipelineKnown: 0,
  activePipelineUnknownCount: 0,
  wonDeals: 0,
  wonValueKnown: 0,
  wonValueUnknownCount: 0,
};

function chunks<T>(values: T[], size = 400): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < values.length; i += size) result.push(values.slice(i, i + size));
  return result;
}

function latestSignal(signals: ActivitySignal[]): Map<string, ActivitySignal> {
  const result = new Map<string, ActivitySignal>();
  for (const signal of signals) {
    const current = result.get(signal.contactId);
    if (!current || Date.parse(signal.at) > Date.parse(current.at)) result.set(signal.contactId, signal);
  }
  return result;
}

function eventChannel(eventType: string): string {
  if (eventType === "CALL_LOGGED") return "Call";
  if (eventType === "MESSAGE_SENT") return "WhatsApp";
  if (eventType.includes("QUOTE")) return "Quote";
  if (eventType.includes("MEETING") || eventType.includes("VISIT")) return "Meeting";
  return "Activity";
}

async function loadCustomerRelations(clientId: string, contacts: CustomerContact[]) {
  const supabase = createAdminClient();
  const contactIds = contacts.map((contact) => contact.id);
  if (contactIds.length === 0) {
    return {
      deals: [] as DealRow[],
      quoteTotals: new Map<string, number | null>(),
      lastByContact: new Map<string, ActivitySignal>(),
      leadLinks: [] as LeadLink[],
    };
  }

  const [dealBatches, leadBatches] = await Promise.all([
    Promise.all(
      chunks(contactIds).map((ids) =>
        supabase.from("deals").select("*").eq("client_id", clientId).in("contact_id", ids)
      )
    ),
    Promise.all(
      chunks(contactIds).map((ids) =>
        supabase
          .from("leads")
          .select("id, contact_id, project_type")
          .eq("client_id", clientId)
          .in("contact_id", ids)
      )
    ),
  ]);

  const deals = dealBatches.flatMap((result) => (result.data ?? []) as DealRow[]);
  const leadLinks = leadBatches.flatMap((result) => (result.data ?? []) as LeadLink[]);
  const quoteTotals = await loadQuoteTotalsByDealId(deals.map((deal) => deal.id));
  const leadToContact = new Map(
    leadLinks
      .filter((lead): lead is LeadLink & { contact_id: string } => Boolean(lead.contact_id))
      .map((lead) => [lead.id, lead.contact_id])
  );
  const leadIds = [...leadToContact.keys()];

  const signals: ActivitySignal[] = deals.flatMap((deal) =>
    deal.contact_id && deal.last_meaningful_activity_at
      ? [{ contactId: deal.contact_id, at: deal.last_meaningful_activity_at, channel: "Deal" }]
      : []
  );

  if (leadIds.length > 0) {
    const activityBatches = await Promise.all(
      chunks(leadIds).map(async (ids) => {
        const [calls, whatsapp, events] = await Promise.all([
          supabase.from("call_logs").select("lead_id, created_at").in("lead_id", ids),
          supabase
            .from("whatsapp_messages")
            .select("lead_id, created_at")
            .eq("client_id", clientId)
            .in("lead_id", ids),
          supabase
            .from("lead_events")
            .select("lead_id, event_type, created_at")
            .eq("client_id", clientId)
            .in("lead_id", ids),
        ]);
        return { calls: calls.data ?? [], whatsapp: whatsapp.data ?? [], events: events.data ?? [] };
      })
    );

    for (const batch of activityBatches) {
      for (const call of batch.calls as Array<{ lead_id: string; created_at: string }>) {
        const contactId = leadToContact.get(call.lead_id);
        if (contactId) signals.push({ contactId, at: call.created_at, channel: "Call" });
      }
      for (const message of batch.whatsapp as Array<{ lead_id: string; created_at: string }>) {
        const contactId = leadToContact.get(message.lead_id);
        if (contactId) signals.push({ contactId, at: message.created_at, channel: "WhatsApp" });
      }
      for (const event of batch.events as Array<{
        lead_id: string;
        event_type: string;
        created_at: string;
      }>) {
        const contactId = leadToContact.get(event.lead_id);
        if (contactId) {
          signals.push({
            contactId,
            at: event.created_at,
            channel: eventChannel(event.event_type),
          });
        }
      }
    }
  }

  return { deals, quoteTotals, lastByContact: latestSignal(signals), leadLinks };
}

function dealTotalsByContact(deals: DealRow[], quoteTotals: Map<string, number | null>) {
  const totals = new Map<string, DealTotals>();
  for (const deal of deals) {
    if (!deal.contact_id) continue;
    const current = totals.get(deal.contact_id) ?? { ...EMPTY_DEAL_TOTALS };
    current.totalDeals += 1;
    const commercial = getDealCommercialValue(deal, {
      latestQuoteTotal: quoteTotals.get(deal.id) ?? null,
    });
    const amount =
      commercial.kind === "amount"
        ? commercial.amount
        : commercial.kind === "range"
          ? (commercial.min + commercial.max) / 2
          : null;
    if ((DEAL_ACTIVE_STAGES as readonly string[]).includes(deal.stage)) {
      current.activeDeals += 1;
      if (amount == null) current.activePipelineUnknownCount += 1;
      else current.activePipelineKnown += amount;
    }
    if (deal.stage === "WON") {
      current.wonDeals += 1;
      if (amount == null) current.wonValueUnknownCount += 1;
      else current.wonValueKnown += amount;
    }
    totals.set(deal.contact_id, current);
  }
  return totals;
}

function mapCustomerRow(opts: {
  contact: CustomerContact;
  owner: TeamUser | undefined;
  dealTotals: DealTotals | undefined;
  lastSignal: ActivitySignal | undefined;
  currency: string;
  now: Date;
}): CompanyCustomerRow {
  const totals = opts.dealTotals ?? EMPTY_DEAL_TOTALS;
  const type = formatCustomerType(opts.contact.customer_type);
  return {
    id: opts.contact.id,
    name: opts.contact.name?.trim() || opts.contact.phone?.trim() || "Unnamed Customer",
    customerType: type,
    customerTypeLabel: customerTypeLabel(type),
    industry: opts.contact.industry?.trim() || null,
    primaryContactName: opts.contact.primary_contact_name?.trim() || null,
    phone: opts.contact.phone?.trim() || null,
    email: opts.contact.email?.trim() || null,
    location: opts.contact.location?.trim() || null,
    source: opts.contact.source?.trim() || null,
    ownerId: opts.contact.relationship_owner_id ?? null,
    ownerName: opts.owner?.name?.trim() || null,
    ownerAvatarUrl: opts.owner?.avatar_url ?? null,
    customerSince: opts.contact.created_at,
    customerSinceLabel: formatCustomerDate(opts.contact.created_at, opts.now),
    lastInteractionAt: opts.lastSignal?.at ?? null,
    lastInteractionLabel: formatCustomerDate(opts.lastSignal?.at ?? null, opts.now),
    lastInteractionChannel: opts.lastSignal?.channel ?? null,
    ...totals,
    customerValueLabel: customerValueLabel({
      wonDeals: totals.wonDeals,
      knownValue: totals.wonValueKnown,
      unknownCount: totals.wonValueUnknownCount,
      currency: opts.currency,
    }),
  };
}

export async function getCompanyCustomersPageData(opts: {
  clientId: string;
}): Promise<CompanyCustomersPageData> {
  const supabase = createAdminClient();
  const now = new Date();
  const currency = "USD";
  const [clientRes, teamRes, contactsRes] = await Promise.all([
    supabase.from("clients").select("id, name").eq("id", opts.clientId).maybeSingle(),
    supabase
      .from("users")
      .select("id, name, avatar_url, role, also_sells, is_active")
      .eq("client_id", opts.clientId)
      .in("role", ["SALESPERSON", "CLIENT_MANAGER"])
      .order("name", { ascending: true }),
    supabase
      .from("contacts")
      .select("*")
      .eq("client_id", opts.clientId)
      .eq("lifecycle", "customer")
      .order("created_at", { ascending: false })
      .limit(COMPANY_CUSTOMERS_CAP),
  ]);

  const contacts = (contactsRes.data ?? []) as CustomerContact[];
  const team = (teamRes.data ?? []) as TeamUser[];
  const teamById = new Map(team.map((member) => [member.id, member]));
  const relations = await loadCustomerRelations(opts.clientId, contacts);
  const totalsByContact = dealTotalsByContact(relations.deals, relations.quoteTotals);
  const rows = contacts.map((contact) =>
    mapCustomerRow({
      contact,
      owner: contact.relationship_owner_id
        ? teamById.get(contact.relationship_owner_id)
        : undefined,
      dealTotals: totalsByContact.get(contact.id),
      lastSignal: relations.lastByContact.get(contact.id),
      currency,
      now,
    })
  );

  const activeDeals = rows.reduce((sum, row) => sum + row.activeDeals, 0);
  const activePipelineKnown = rows.reduce((sum, row) => sum + row.activePipelineKnown, 0);
  const activePipelineUnknownCount = rows.reduce(
    (sum, row) => sum + row.activePipelineUnknownCount,
    0
  );
  const tabCounts = countCompanyCustomersTabs(rows, now);
  const owners: CompanyCustomersOwnerOption[] = team
    .filter((member) => member.is_active !== false)
    .filter((member) => member.role === "SALESPERSON" || Boolean(member.also_sells))
    .map((member) => ({
      id: member.id,
      name: member.name?.trim() || "Team member",
      avatarUrl: member.avatar_url,
    }));

  return {
    clientId: opts.clientId,
    clientName: (clientRes.data?.name as string | undefined) ?? "Company",
    currency,
    canAddCustomer: true,
    rows,
    tabCounts,
    owners,
    kpis: buildCompanyCustomersKpis({
      totalCustomers: rows.length,
      companies: tabCounts.companies,
      individuals: tabCounts.individuals,
      activeDeals,
      customersWithActiveDeals: rows.filter((row) => row.activeDeals > 0).length,
      activePipelineKnown,
      activePipelineUnknownCount,
      currency,
    }),
  };
}

function textValue(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function activityTitle(eventType: string): { kind: CompanyCustomerActivity["kind"]; title: string } {
  if (eventType === "CALL_LOGGED") return { kind: "call", title: "Phone call" };
  if (eventType === "MESSAGE_SENT") return { kind: "whatsapp", title: "WhatsApp conversation" };
  if (eventType.includes("QUOTE")) return { kind: "quote", title: "Quotation update" };
  if (eventType.includes("DEAL") || eventType.includes("STAGE")) {
    return { kind: "deal", title: "Deal update" };
  }
  return {
    kind: "other",
    title: eventType.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase()),
  };
}

export async function getCompanyCustomerDetail(opts: {
  clientId: string;
  customerId: string;
}): Promise<CompanyCustomerDetail | null> {
  const supabase = createAdminClient();
  const now = new Date();
  const currency = "USD";
  const [contactRes, teamRes] = await Promise.all([
    supabase
      .from("contacts")
      .select("*")
      .eq("id", opts.customerId)
      .eq("client_id", opts.clientId)
      .eq("lifecycle", "customer")
      .maybeSingle(),
    supabase
      .from("users")
      .select("id, name, avatar_url, role, also_sells, is_active")
      .eq("client_id", opts.clientId),
  ]);
  if (!contactRes.data) return null;

  const contact = contactRes.data as CustomerContact;
  const team = (teamRes.data ?? []) as TeamUser[];
  const relations = await loadCustomerRelations(opts.clientId, [contact]);
  const totalsByContact = dealTotalsByContact(relations.deals, relations.quoteTotals);
  const owner = contact.relationship_owner_id
    ? team.find((member) => member.id === contact.relationship_owner_id)
    : undefined;
  const row = mapCustomerRow({
    contact,
    owner,
    dealTotals: totalsByContact.get(contact.id),
    lastSignal: relations.lastByContact.get(contact.id),
    currency,
    now,
  });

  const leadIds = relations.leadLinks.map((lead) => lead.id);
  const activities: CompanyCustomerActivity[] = [];
  if (leadIds.length > 0) {
    const [callsRes, whatsappRes, eventsRes] = await Promise.all([
      supabase
        .from("call_logs")
        .select("id, lead_id, outcome, notes, created_at")
        .in("lead_id", leadIds)
        .order("created_at", { ascending: false })
        .limit(20),
      supabase
        .from("whatsapp_messages")
        .select("id, lead_id, direction, body, created_at")
        .eq("client_id", opts.clientId)
        .in("lead_id", leadIds)
        .order("created_at", { ascending: false })
        .limit(20),
      supabase
        .from("lead_events")
        .select("id, lead_id, event_type, event_data, created_at")
        .eq("client_id", opts.clientId)
        .in("lead_id", leadIds)
        .order("created_at", { ascending: false })
        .limit(30),
    ]);

    for (const call of (callsRes.data ?? []) as Array<{
      id: string;
      outcome: string | null;
      notes: string | null;
      created_at: string;
    }>) {
      activities.push({
        id: `call-${call.id}`,
        kind: "call",
        title: "Phone call",
        detail: textValue(call.notes) ?? (call.outcome ? call.outcome.replace(/_/g, " ").toLowerCase() : null),
        createdAt: call.created_at,
        timeLabel: formatCustomerDate(call.created_at, now),
      });
    }
    for (const message of (whatsappRes.data ?? []) as Array<{
      id: string;
      direction: string;
      body: string | null;
      created_at: string;
    }>) {
      activities.push({
        id: `wa-${message.id}`,
        kind: "whatsapp",
        title: "WhatsApp conversation",
        detail: textValue(message.body) ?? (message.direction === "inbound" ? "Customer message" : "Message sent"),
        createdAt: message.created_at,
        timeLabel: formatCustomerDate(message.created_at, now),
      });
    }
    for (const event of (eventsRes.data ?? []) as Array<{
      id: string;
      event_type: string;
      event_data: Record<string, unknown> | null;
      created_at: string;
    }>) {
      if (event.event_type === "CALL_LOGGED" || event.event_type === "MESSAGE_SENT") continue;
      const view = activityTitle(event.event_type);
      activities.push({
        id: `event-${event.id}`,
        kind: view.kind,
        title: view.title,
        detail:
          textValue(event.event_data?.notes) ??
          textValue(event.event_data?.description) ??
          textValue(event.event_data?.reason),
        createdAt: event.created_at,
        timeLabel: formatCustomerDate(event.created_at, now),
      });
    }
  }

  for (const deal of relations.deals) {
    if (!deal.last_meaningful_activity_at) continue;
    activities.push({
      id: `deal-${deal.id}-${deal.last_meaningful_activity_at}`,
      kind: "deal",
      title: "Deal activity",
      detail: deal.name?.trim() || null,
      createdAt: deal.last_meaningful_activity_at,
      timeLabel: formatCustomerDate(deal.last_meaningful_activity_at, now),
    });
  }

  activities.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  const deduped = activities.filter(
    (activity, index, all) =>
      all.findIndex(
        (candidate) =>
          candidate.kind === activity.kind &&
          Math.abs(Date.parse(candidate.createdAt) - Date.parse(activity.createdAt)) < 1000
      ) === index
  );

  const digits = row.phone?.replace(/[^\d]/g, "") ?? "";
  return {
    ...row,
    telHref: row.phone ? `tel:${row.phone}` : null,
    mailtoHref: row.email ? `mailto:${row.email}` : null,
    whatsappHref: digits ? `https://wa.me/${digits}` : null,
    canCall: Boolean(row.phone),
    canWhatsApp: Boolean(digits),
    canEmail: Boolean(row.email),
    recentActivity: deduped.slice(0, 3),
    viewDetailsHref: `/client/contacts/${row.id}`,
    viewDealsHref: `/client/pipeline?customerId=${encodeURIComponent(row.id)}`,
  };
}
