import type { SupabaseClient } from "@supabase/supabase-js";
import { phoneOrFilter, phonesMatch } from "@/lib/leads/phone-match";

export type OpenLeadMatch = {
  id: string;
  assigned_to_id: string | null;
  contact_id: string | null;
  form_data: Record<string, unknown> | null;
  name: string | null;
  phone: string | null;
  email: string | null;
  budget: string | null;
  project_type: string | null;
  timeline: string | null;
  magic_token: string | null;
  status: string;
};

const OPEN_LEAD_SELECT =
  "id, assigned_to_id, name, phone, status, contact_id, form_data, email, budget, project_type, timeline, magic_token, updated_at, created_at";

function pickBestOpenLead(
  rows: Array<Record<string, unknown>>,
  phoneDigits: string
): OpenLeadMatch | null {
  const matched = rows.filter((lead) => phonesMatch(lead.phone as string | null, phoneDigits));
  if (!matched.length) return null;
  // Prefer the original open conversation (earliest created_at), not a newer
  // duplicate created after a sticky-match miss + round-robin.
  matched.sort((a, b) => {
    const aAssigned = a.assigned_to_id ? 1 : 0;
    const bAssigned = b.assigned_to_id ? 1 : 0;
    if (aAssigned !== bAssigned) return bAssigned - aAssigned;
    const aCreated = Date.parse(String(a.created_at ?? a.updated_at ?? "")) || 0;
    const bCreated = Date.parse(String(b.created_at ?? b.updated_at ?? "")) || 0;
    return aCreated - bCreated;
  });
  const best = matched[0]!;
  return {
    id: best.id as string,
    assigned_to_id: (best.assigned_to_id as string | null) ?? null,
    contact_id: (best.contact_id as string | null) ?? null,
    form_data: (best.form_data as Record<string, unknown> | null) ?? null,
    name: (best.name as string | null) ?? null,
    phone: (best.phone as string | null) ?? null,
    email: (best.email as string | null) ?? null,
    budget: (best.budget as string | null) ?? null,
    project_type: (best.project_type as string | null) ?? null,
    timeline: (best.timeline as string | null) ?? null,
    magic_token: (best.magic_token as string | null) ?? null,
    status: best.status as string,
  };
}

/**
 * Find an open Lead for this phone within a client.
 *
 * IMPORTANT: must not rely on "last N updated leads" — quiet WhatsApp threads fall
 * out of that window and get re-created + round-robined to another rep.
 */
export async function findOpenLeadByPhone(opts: {
  supabase: SupabaseClient;
  clientId: string;
  phoneDigits: string;
}): Promise<OpenLeadMatch | null> {
  const { supabase, clientId, phoneDigits } = opts;
  if (!phoneDigits) return null;

  const phoneFilter = phoneOrFilter(phoneDigits, ["phone"]);
  const contactFilter = phoneOrFilter(phoneDigits, ["phone", "whatsapp_wa_id"]);

  // 1) Prefer contact-linked open leads (canonical WhatsApp identity).
  const { data: contacts } = await supabase
    .from("contacts")
    .select("id, phone, whatsapp_wa_id")
    .eq("client_id", clientId)
    .or(contactFilter)
    .limit(25);

  const contactIds = (contacts ?? [])
    .filter(
      (c) =>
        phonesMatch(c.phone as string | null, phoneDigits) ||
        phonesMatch(c.whatsapp_wa_id as string | null, phoneDigits)
    )
    .map((c) => c.id as string);

  if (contactIds.length) {
    const { data: byContact } = await supabase
      .from("leads")
      .select(OPEN_LEAD_SELECT)
      .eq("client_id", clientId)
      .in("contact_id", contactIds)
      .or("is_archived.is.null,is_archived.eq.false")
      .not("status", "in", '("WON","LOST","NOT_QUALIFIED")')
      .order("updated_at", { ascending: false })
      .limit(50);

    const fromContact = pickBestOpenLead((byContact ?? []) as Array<Record<string, unknown>>, phoneDigits);
    if (fromContact) return fromContact;

    // Contact matched but lead.phone may differ slightly — still prefer any open lead on that contact.
    const anyOpen = (byContact ?? [])[0] as Record<string, unknown> | undefined;
    if (anyOpen?.id) {
      return {
        id: anyOpen.id as string,
        assigned_to_id: (anyOpen.assigned_to_id as string | null) ?? null,
        contact_id: (anyOpen.contact_id as string | null) ?? null,
        form_data: (anyOpen.form_data as Record<string, unknown> | null) ?? null,
        name: (anyOpen.name as string | null) ?? null,
        phone: (anyOpen.phone as string | null) ?? null,
        email: (anyOpen.email as string | null) ?? null,
        budget: (anyOpen.budget as string | null) ?? null,
        project_type: (anyOpen.project_type as string | null) ?? null,
        timeline: (anyOpen.timeline as string | null) ?? null,
        magic_token: (anyOpen.magic_token as string | null) ?? null,
        status: anyOpen.status as string,
      };
    }
  }

  // 2) Direct phone match on open leads (phone-keyed, not "recent N" scan).
  const { data: byPhone } = await supabase
    .from("leads")
    .select(OPEN_LEAD_SELECT)
    .eq("client_id", clientId)
    .or("is_archived.is.null,is_archived.eq.false")
    .not("status", "in", '("WON","LOST","NOT_QUALIFIED")')
    .or(phoneFilter)
    .order("updated_at", { ascending: false })
    .limit(50);

  return pickBestOpenLead((byPhone ?? []) as Array<Record<string, unknown>>, phoneDigits);
}
