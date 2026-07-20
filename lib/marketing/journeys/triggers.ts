import { createAdminClient } from "@/lib/supabase/admin";
import { canSendMarketing, getContactPrefs } from "../consent";
import type { JourneyRow } from "./types";

type Candidate = {
  contactId: string;
  leadId: string;
  phone: string;
  context: Record<string, unknown>;
};

async function alreadyEnrolled(journeyId: string, contactId: string): Promise<boolean> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("marketing_journey_enrollments")
    .select("id")
    .eq("journey_id", journeyId)
    .eq("contact_id", contactId)
    .in("status", ["active", "completed"])
    .limit(1)
    .maybeSingle();
  return !!data;
}

async function filterConsented(clientId: string, candidates: Candidate[]): Promise<Candidate[]> {
  const eligible: Candidate[] = [];
  for (const c of candidates) {
    const prefs = await getContactPrefs(c.contactId);
    if (canSendMarketing(prefs?.whatsapp_marketing ?? "unknown", prefs?.suppressed ?? false)) {
      eligible.push(c);
    }
  }
  return eligible;
}

async function scanQuotationNoResponse(journey: JourneyRow): Promise<Candidate[]> {
  const days = Number(journey.trigger_config.days_since_sent ?? 3);
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);

  const supabase = createAdminClient();
  const { data: quotations } = await supabase
    .from("quotations")
    .select("id, lead_id, sent_at, leads!inner(id, contact_id, phone, client_id, status)")
    .eq("client_id", journey.client_id)
    .eq("status", "sent")
    .not("sent_at", "is", null)
    .lte("sent_at", cutoff.toISOString());

  const candidates: Candidate[] = [];

  for (const q of quotations ?? []) {
    const leadRaw = q.leads as
      | { id: string; contact_id: string | null; phone: string | null; status: string }
      | { id: string; contact_id: string | null; phone: string | null; status: string }[]
      | null;
    const lead = Array.isArray(leadRaw) ? leadRaw[0] : leadRaw;
    if (!lead?.contact_id || !lead.phone) continue;
    if (!["PROPOSAL_SENT", "NEGOTIATING", "CONTACTED"].includes(lead.status)) continue;

    const { count } = await supabase
      .from("whatsapp_messages")
      .select("*", { count: "exact", head: true })
      .eq("lead_id", lead.id)
      .eq("direction", "inbound")
      .gte("created_at", q.sent_at as string);

    if ((count ?? 0) > 0) continue;

    candidates.push({
      contactId: lead.contact_id,
      leadId: lead.id,
      phone: lead.phone,
      context: { quotation_id: q.id, quotation_sent_at: q.sent_at },
    });
  }

  return candidates;
}

async function scanDormantLeads(journey: JourneyRow): Promise<Candidate[]> {
  const inactiveDays = Number(journey.trigger_config.inactive_days ?? 60);
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - inactiveDays);

  const supabase = createAdminClient();
  const { data: leads } = await supabase
    .from("leads")
    .select("id, contact_id, phone, status, updated_at, is_stale")
    .eq("client_id", journey.client_id)
    .in("status", ["NEW", "CONTACTED", "NEGOTIATING", "PROPOSAL_SENT"])
    .not("contact_id", "is", null)
    .not("phone", "is", null)
    .lte("updated_at", cutoff.toISOString());

  return (leads ?? [])
    .filter((l) => l.is_stale === true || new Date(l.updated_at as string) <= cutoff)
    .map((l) => ({
      contactId: l.contact_id as string,
      leadId: l.id as string,
      phone: l.phone as string,
      context: { dormant_since: l.updated_at },
    }));
}

async function scanCustomerAnniversary(journey: JourneyRow): Promise<Candidate[]> {
  const months = Number(journey.trigger_config.months_since_won ?? 12);
  const windowDays = Number(journey.trigger_config.window_days ?? 14);

  const target = new Date();
  target.setMonth(target.getMonth() - months);
  const windowStart = new Date(target);
  windowStart.setDate(windowStart.getDate() - windowDays);
  const windowEnd = new Date(target);
  windowEnd.setDate(windowEnd.getDate() + windowDays);

  const supabase = createAdminClient();
  const { data: wonLeads } = await supabase
    .from("leads")
    .select("id, contact_id, phone, updated_at")
    .eq("client_id", journey.client_id)
    .eq("status", "WON")
    .not("contact_id", "is", null)
    .not("phone", "is", null)
    .gte("updated_at", windowStart.toISOString())
    .lte("updated_at", windowEnd.toISOString());

  const byContact = new Map<string, Candidate>();
  for (const l of wonLeads ?? []) {
    const cid = l.contact_id as string;
    if (!byContact.has(cid)) {
      byContact.set(cid, {
        contactId: cid,
        leadId: l.id as string,
        phone: l.phone as string,
        context: { won_at: l.updated_at },
      });
    }
  }
  return Array.from(byContact.values());
}

async function scanLostDealFunds(journey: JourneyRow): Promise<Candidate[]> {
  const days = Number(journey.trigger_config.days_since_lost ?? 30);
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);

  const supabase = createAdminClient();
  const { data: leads } = await supabase
    .from("leads")
    .select("id, contact_id, phone, lost_reason, updated_at")
    .eq("client_id", journey.client_id)
    .eq("status", "LOST")
    .not("contact_id", "is", null)
    .not("phone", "is", null)
    .lte("updated_at", cutoff.toISOString());

  const fundPattern = /fund|budget|money|afford|payment|finance/i;

  return (leads ?? [])
    .filter((l) => fundPattern.test(String(l.lost_reason ?? "")))
    .map((l) => ({
      contactId: l.contact_id as string,
      leadId: l.id as string,
      phone: l.phone as string,
      context: { lost_reason: l.lost_reason, lost_at: l.updated_at },
    }));
}

export async function scanJourneyEnrollments(journey: JourneyRow): Promise<number> {
  if (!journey.is_active || !journey.template_name) return 0;

  let candidates: Candidate[] = [];

  switch (journey.trigger_type) {
    case "quotation_no_response":
      candidates = await scanQuotationNoResponse(journey);
      break;
    case "dormant_lead":
      candidates = await scanDormantLeads(journey);
      break;
    case "customer_anniversary":
      candidates = await scanCustomerAnniversary(journey);
      break;
    case "lost_deal_funds":
      candidates = await scanLostDealFunds(journey);
      break;
    default:
      return 0;
  }

  const consented = await filterConsented(journey.client_id, candidates);
  const supabase = createAdminClient();
  let enrolled = 0;
  const now = new Date().toISOString();

  for (const c of consented) {
    if (await alreadyEnrolled(journey.id, c.contactId)) continue;

    const { error } = await supabase.from("marketing_journey_enrollments").insert({
      journey_id: journey.id,
      client_id: journey.client_id,
      contact_id: c.contactId,
      lead_id: c.leadId,
      phone: c.phone,
      status: "active",
      current_step_index: 0,
      next_run_at: now,
      context: c.context,
    });

    if (!error) {
      enrolled++;
      const stats = journey.stats ?? { enrolled: 0, completed: 0, cancelled: 0, messages_sent: 0 };
      stats.enrolled = (stats.enrolled ?? 0) + 1;
      await supabase
        .from("marketing_journeys")
        .update({ stats, updated_at: now })
        .eq("id", journey.id);
    }
  }

  return enrolled;
}

export async function scanAllActiveJourneys(clientId?: string): Promise<number> {
  const supabase = createAdminClient();
  let query = supabase
    .from("marketing_journeys")
    .select("*")
    .eq("is_active", true)
    .not("template_name", "is", null);

  if (clientId) query = query.eq("client_id", clientId);

  const { data: journeys } = await query;
  let total = 0;

  for (const row of (journeys ?? []) as JourneyRow[]) {
    total += await scanJourneyEnrollments(row);
  }

  return total;
}
