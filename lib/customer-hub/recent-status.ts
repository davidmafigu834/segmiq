import type { SupabaseClient } from "@supabase/supabase-js";

type RecentRow = {
  id: string;
  name: string;
  initials: string;
  source: string;
  created_at: string;
  salesperson_name: string | null;
  status: string;
};

/** Status chip for recent contacts — based on the latest lead only, not whole contact history. */
export async function enrichRecentContactStatus(
  supabase: SupabaseClient,
  clientId: string,
  recent: RecentRow[]
): Promise<RecentRow[]> {
  if (!recent.length) return recent;

  const contactIds = recent.map((r) => r.id);
  const { data: leads } = await supabase
    .from("leads")
    .select("id, contact_id, status, follow_up_date, created_at")
    .eq("client_id", clientId)
    .in("contact_id", contactIds)
    .order("created_at", { ascending: false });

  const latestLeadByContact = new Map<
    string,
    { id: string; contact_id: string; status: string; follow_up_date: string | null }
  >();
  for (const lead of leads ?? []) {
    const cid = lead.contact_id as string;
    if (!latestLeadByContact.has(cid)) latestLeadByContact.set(cid, lead);
  }

  const latestLeadIds = [...latestLeadByContact.values()].map((l) => l.id as string);
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

  const today = new Date();
  today.setHours(23, 59, 59, 999);

  return recent.map((row) => {
    const lead = latestLeadByContact.get(row.id);
    if (!lead) return { ...row, status: "no_contact" };

    const leadId = lead.id as string;
    const status = lead.status as string;
    const followUp = lead.follow_up_date as string | null;

    if (status === "WON") return { ...row, status: "won" };
    if (
      followUp &&
      new Date(followUp.includes("T") ? followUp : `${followUp}T12:00:00`) <= today &&
      !["WON", "LOST", "NOT_QUALIFIED"].includes(status)
    ) {
      return { ...row, status: "follow_up_due" };
    }
    if (quotedLeadIds.has(leadId)) return { ...row, status: "quoted" };
    if (!callLogLeadIds.has(leadId)) return { ...row, status: "no_contact" };
    return { ...row, status: "no_contact" };
  });
}

/** Hub source labels where the rep already met/spoke to the person in real life. */
export const IN_PERSON_HUB_SOURCES = new Set(["Walk-in", "Phone call"]);
