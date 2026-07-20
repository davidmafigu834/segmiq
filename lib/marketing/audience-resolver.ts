import { createAdminClient } from "@/lib/supabase/admin";
import { resolveSegmentLeads, type SegmentFilter } from "@/lib/audience-segments";
import {
  canSendMarketing,
  defaultConsentForContact,
  getContactPrefsBatch,
  type CommunicationPrefsRow,
} from "./consent";
import type { AudiencePreview, ConsentStatus, MarketingRecipient } from "./types";

type SegmentOptions = {
  minScore?: number | null;
  dateRangeDays?: number | null;
  minAgeDays?: number | null;
};

type ContactRow = {
  id: string;
  phone: string | null;
  name: string | null;
  lifecycle: string | null;
};

type LeadForContact = {
  id: string;
  contact_id: string | null;
  phone: string | null;
  name: string | null;
  status: string;
  created_at: string;
};

const CLOSED_STATUSES = new Set(["WON", "LOST", "NOT_QUALIFIED"]);

function normalizePhone(phone: string | null | undefined): string | null {
  if (!phone?.trim()) return null;
  const digits = phone.replace(/\D/g, "");
  if (!digits) return null;
  return digits.startsWith("+") ? digits : digits;
}

function pickBestLead(leads: LeadForContact[]): LeadForContact | null {
  if (leads.length === 0) return null;
  const active = leads.find((l) => !CLOSED_STATUSES.has(l.status));
  if (active) return active;
  return leads[0];
}

export async function resolveMarketingAudience(
  clientId: string,
  filters: SegmentFilter[],
  filterLogic: "and" | "or",
  options?: SegmentOptions
): Promise<{ recipients: MarketingRecipient[]; preview: AudiencePreview }> {
  const leads = await resolveSegmentLeads(clientId, filters, filterLogic, options);
  const supabase = createAdminClient();

  const leadIds = leads.map((l) => l.id);
  const leadContactMap = new Map<string, string>();

  if (leadIds.length > 0) {
    const { data: leadRows } = await supabase
      .from("leads")
      .select("id, contact_id, phone, name, status, created_at")
      .in("id", leadIds);

    for (const row of (leadRows ?? []) as LeadForContact[]) {
      if (row.contact_id) leadContactMap.set(row.id, row.contact_id);
    }
  }

  const contactIdsFromLeads = Array.from(new Set(Array.from(leadContactMap.values())));
  const phonesFromLeads = leads
    .map((l) => normalizePhone(l.phone))
    .filter(Boolean) as string[];

  let contacts: ContactRow[] = [];

  if (contactIdsFromLeads.length > 0) {
    const { data } = await supabase
      .from("contacts")
      .select("id, phone, name, lifecycle")
      .eq("client_id", clientId)
      .in("id", contactIdsFromLeads);
    contacts = (data ?? []) as ContactRow[];
  }

  if (contacts.length === 0 && phonesFromLeads.length > 0) {
    const { data } = await supabase
      .from("contacts")
      .select("id, phone, name, lifecycle")
      .eq("client_id", clientId);
    const allContacts = (data ?? []) as ContactRow[];
    contacts = allContacts.filter((c) => {
      const cp = normalizePhone(c.phone);
      return cp && phonesFromLeads.some((p) => p === cp || p.endsWith(cp) || cp.endsWith(p));
    });
  }

  const contactIds = contacts.map((c) => c.id);
  const prefsMap = await getContactPrefsBatch(contactIds);

  const leadsByContact = new Map<string, LeadForContact[]>();
  if (contactIds.length > 0) {
    const { data: allLeads } = await supabase
      .from("leads")
      .select("id, contact_id, phone, name, status, created_at")
      .eq("client_id", clientId)
      .in("contact_id", contactIds)
      .order("created_at", { ascending: false });

    for (const lead of (allLeads ?? []) as LeadForContact[]) {
      if (!lead.contact_id) continue;
      const list = leadsByContact.get(lead.contact_id) ?? [];
      list.push(lead);
      leadsByContact.set(lead.contact_id, list);
    }
  }

  const preview: AudiencePreview = {
    total: contacts.length,
    whatsappEligible: 0,
    optedIn: 0,
    optedOut: 0,
    unknownConsent: 0,
    suppressed: 0,
    noPhone: 0,
  };

  const recipients: MarketingRecipient[] = [];
  const seenContacts = new Set<string>();

  for (const contact of contacts) {
    if (seenContacts.has(contact.id)) continue;
    seenContacts.add(contact.id);

    const phone = contact.phone?.trim() || null;
    if (!phone) {
      preview.noPhone++;
      continue;
    }

    const prefs: CommunicationPrefsRow | undefined = prefsMap.get(contact.id);
    const consent: ConsentStatus =
      prefs?.whatsapp_marketing ?? defaultConsentForContact().whatsapp_marketing;
    const suppressed = prefs?.suppressed ?? false;

    if (suppressed) preview.suppressed++;
    if (consent === "opted_in") preview.optedIn++;
    else if (consent === "opted_out") preview.optedOut++;
    else preview.unknownConsent++;

    if (canSendMarketing(consent, suppressed)) {
      preview.whatsappEligible++;
    }

    const contactLeads = leadsByContact.get(contact.id) ?? [];
    const bestLead = pickBestLead(contactLeads);

    recipients.push({
      contactId: contact.id,
      leadId: bestLead?.id ?? null,
      phone,
      name: contact.name,
      consentStatus: consent,
    });
  }

  return { recipients, preview };
}

export async function resolveSegmentAudience(
  clientId: string,
  segmentId: string
): Promise<{ recipients: MarketingRecipient[]; preview: AudiencePreview }> {
  const supabase = createAdminClient();
  const { data: segment, error } = await supabase
    .from("audience_segments")
    .select("*")
    .eq("id", segmentId)
    .eq("client_id", clientId)
    .maybeSingle();

  if (error || !segment) {
    throw new Error("Segment not found");
  }

  return resolveMarketingAudience(
    clientId,
    (segment.filters as SegmentFilter[]) ?? [],
    (segment.filter_logic as "and" | "or") ?? "and",
    {
      minScore: segment.min_score as number | null,
      dateRangeDays: segment.date_range_days as number | null,
      minAgeDays: (segment as { min_age_days?: number | null }).min_age_days ?? null,
    }
  );
}

export function filterEligibleRecipients(
  recipients: MarketingRecipient[]
): MarketingRecipient[] {
  return recipients.filter((r) => r.consentStatus === "opted_in");
}
