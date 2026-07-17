import type { SupabaseClient } from "@supabase/supabase-js";
import type { AttentionStatus, OverviewRecentContact } from "@/lib/customer-hub/contact-list-types";
import {
  buildContactLeadMetaByContactId,
  CLOSED_STATUSES,
  mergeContactListItems,
} from "@/lib/customer-hub/enrich-contacts-with-leads";

type RpcRecentRow = {
  id: string;
  name: string;
  initials: string;
  source: string;
  created_at: string;
  salesperson_name: string | null;
  status: string;
};

function resolveAttentionStatus(
  lead: {
    id: string;
    status: string;
    follow_up_date: string | null;
  } | undefined,
  callLogLeadIds: Set<string>,
  quotedLeadIds: Set<string>
): AttentionStatus | null {
  if (!lead) return "no_contact";

  const leadId = lead.id;
  const status = lead.status;
  const followUp = lead.follow_up_date;

  if (status === "WON") return "won";
  if (
    followUp &&
    new Date(followUp.includes("T") ? followUp : `${followUp}T12:00:00`) <= endOfToday() &&
    !CLOSED_STATUSES.has(status)
  ) {
    return "follow_up_due";
  }
  if (quotedLeadIds.has(leadId)) return "quoted";
  if (!callLogLeadIds.has(leadId)) return "no_contact";
  return null;
}

function endOfToday(): Date {
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  return today;
}

/** Enrich RPC recent rows into overview contact cards with lifecycle, active deal, and attention status. */
export async function enrichRecentContacts(
  supabase: SupabaseClient,
  clientId: string,
  recent: RpcRecentRow[]
): Promise<OverviewRecentContact[]> {
  if (!recent.length) return [];

  const contactIds = recent.map((r) => r.id);
  const [{ data: contactRows }, metaByContact] = await Promise.all([
    supabase
      .from("contacts")
      .select("id, name, phone, email, source, lifecycle, updated_at")
      .eq("client_id", clientId)
      .in("id", contactIds),
    buildContactLeadMetaByContactId(supabase, contactIds),
  ]);

  const contactsById = new Map((contactRows ?? []).map((c) => [c.id as string, c]));
  const orderedContacts = recent
    .map((r) => contactsById.get(r.id))
    .filter((c): c is NonNullable<typeof c> => !!c)
    .map((c) => ({
      id: c.id as string,
      name: (c.name as string | null) ?? null,
      phone: (c.phone as string | null) ?? null,
      email: (c.email as string | null) ?? null,
      source: (c.source as string | null) ?? null,
      lifecycle: (c.lifecycle as string) ?? "cold",
      updated_at: c.updated_at as string,
    }));

  const listItems = mergeContactListItems(orderedContacts, metaByContact);

  const { data: leads } = await supabase
    .from("leads")
    .select("id, contact_id, status, follow_up_date, created_at")
    .eq("client_id", clientId)
    .in("contact_id", contactIds)
    .order("created_at", { ascending: false });

  const latestLeadByContact = new Map<
    string,
    { id: string; status: string; follow_up_date: string | null }
  >();
  for (const lead of leads ?? []) {
    const cid = lead.contact_id as string;
    if (!latestLeadByContact.has(cid)) {
      latestLeadByContact.set(cid, {
        id: lead.id as string,
        status: lead.status as string,
        follow_up_date: (lead.follow_up_date as string | null) ?? null,
      });
    }
  }

  const latestLeadIds = Array.from(latestLeadByContact.values()).map((l) => l.id);
  const callLogLeadIds = new Set<string>();
  const quotedLeadIds = new Set<string>();

  if (latestLeadIds.length) {
    const [{ data: logs }, { data: quotes }] = await Promise.all([
      supabase.from("call_logs").select("lead_id").in("lead_id", latestLeadIds),
      supabase
        .from("quotations")
        .select("lead_id")
        .in("lead_id", latestLeadIds)
        .not("sent_at", "is", null),
    ]);
    for (const log of logs ?? []) callLogLeadIds.add(log.lead_id as string);
    for (const q of quotes ?? []) quotedLeadIds.add(q.lead_id as string);
  }

  return listItems.map((item) => ({
    ...item,
    attentionStatus: resolveAttentionStatus(
      latestLeadByContact.get(item.id),
      callLogLeadIds,
      quotedLeadIds
    ),
  }));
}

/** @deprecated Use enrichRecentContacts */
export async function enrichRecentContactStatus(
  supabase: SupabaseClient,
  clientId: string,
  recent: RpcRecentRow[]
): Promise<RpcRecentRow[]> {
  const enriched = await enrichRecentContacts(supabase, clientId, recent);
  return enriched.map((row) => ({
    id: row.id,
    name: row.name ?? "Unnamed",
    initials: "",
    source: row.source ?? "other",
    created_at: row.lastTouchedAt ?? "",
    salesperson_name: row.owner,
    status: row.attentionStatus ?? "no_contact",
  }));
}

/** Hub source labels where the rep already met/spoke to the person in real life. */
export const IN_PERSON_HUB_SOURCES = new Set(["Walk-in", "Phone call"]);
