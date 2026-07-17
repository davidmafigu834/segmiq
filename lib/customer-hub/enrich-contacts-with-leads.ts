import type { SupabaseClient } from "@supabase/supabase-js";
import type { ContactListActiveLead, ContactListItem } from "@/lib/customer-hub/contact-list-types";

export const CLOSED_STATUSES = new Set(["WON", "LOST", "NOT_QUALIFIED"]);

export function assigneeName(raw: unknown): string | null {
  const a = raw as { name?: string } | { name?: string }[] | null | undefined;
  return Array.isArray(a) ? (a[0]?.name ?? null) : (a?.name ?? null);
}

type ContactRow = {
  id: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  source: string | null;
  lifecycle: string;
  updated_at: string;
};

type LeadMeta = {
  owner: string | null;
  lastTouchedAt: string | null;
  activeLead: ContactListActiveLead | null;
};

export async function buildContactLeadMetaByContactId(
  supabase: SupabaseClient,
  contactIds: string[]
): Promise<Map<string, LeadMeta>> {
  const metaByContact = new Map<string, LeadMeta>();
  if (!contactIds.length) return metaByContact;

  const { data: leadRows } = await supabase
    .from("leads")
    .select(
      "id, contact_id, status, project_type, follow_up_date, updated_at, assigned_to:users!assigned_to_id ( name )"
    )
    .in("contact_id", contactIds)
    .order("updated_at", { ascending: false });

  for (const lr of leadRows ?? []) {
    if (!lr.contact_id) continue;
    const cid = lr.contact_id as string;
    const owner = assigneeName(lr.assigned_to);
    const updated = (lr.updated_at as string | null) ?? null;

    let meta = metaByContact.get(cid);
    if (!meta) {
      meta = { owner, lastTouchedAt: updated, activeLead: null };
      metaByContact.set(cid, meta);
    }

    if (!CLOSED_STATUSES.has(lr.status as string) && !meta.activeLead) {
      meta.activeLead = {
        id: lr.id as string,
        status: lr.status as string,
        project_type: (lr.project_type as string | null) ?? null,
        follow_up_date: (lr.follow_up_date as string | null) ?? null,
        assigneeName: owner,
      };
      if (owner) meta.owner = owner;
    }
  }

  return metaByContact;
}

export function mergeContactListItems<T extends ContactRow>(
  contacts: T[],
  metaByContact: Map<string, LeadMeta>
): (T & Pick<ContactListItem, "owner" | "lastTouchedAt" | "activeLead">)[] {
  return contacts.map((c) => {
    const meta = metaByContact.get(c.id);
    return {
      ...c,
      owner: meta?.owner ?? null,
      lastTouchedAt: meta?.lastTouchedAt ?? c.updated_at,
      activeLead: meta?.activeLead ?? null,
    };
  });
}

export async function enrichContactsWithLeads<T extends ContactRow>(
  supabase: SupabaseClient,
  contacts: T[]
): Promise<(T & Pick<ContactListItem, "owner" | "lastTouchedAt" | "activeLead">)[]> {
  const ids = contacts.map((c) => c.id);
  const metaByContact = await buildContactLeadMetaByContactId(supabase, ids);
  return mergeContactListItems(contacts, metaByContact);
}
