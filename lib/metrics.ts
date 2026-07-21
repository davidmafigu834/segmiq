import { createAdminClient } from "@/lib/supabase/admin";
import { fetchCallLogsByLeadIds } from "@/lib/call-logs";

export type AvgResponseScope = { clientId?: string };

/** First-call response in minutes; only leads with ≥1 call log in range. Null if none. */
export function firstCallResponseMinutes(
  leads: { id: string; created_at: string }[],
  logs: { lead_id: string; created_at: string }[]
): number | null {
  const byLead = new Map<string, Date[]>();
  for (const l of logs) {
    const lid = l.lead_id as string;
    if (!byLead.has(lid)) byLead.set(lid, []);
    byLead.get(lid)!.push(new Date(l.created_at as string));
  }
  const deltas: number[] = [];
  const leadById = new Map(leads.map((l) => [l.id as string, new Date(l.created_at as string)]));
  byLead.forEach((times, leadId) => {
    const created = leadById.get(leadId);
    if (!created || times.length === 0) return;
    times.sort((a, b) => a.getTime() - b.getTime());
    const first = times[0]!;
    const diffMin = (first.getTime() - created.getTime()) / 60_000;
    if (diffMin >= 0 && Number.isFinite(diffMin)) deltas.push(diffMin);
  });
  if (deltas.length === 0) return null;
  return deltas.reduce((a, b) => a + b, 0) / deltas.length;
}

/**
 * Average minutes from lead.created_at to first call_logs.created_at for leads created in [from, to).
 * Only leads with at least one call log are included.
 */
export async function getAvgResponseMinutes(
  from: Date,
  to: Date,
  scope: AvgResponseScope = {}
): Promise<number | null> {
  const supabase = createAdminClient();
  let q = supabase
    .from("leads")
    .select("id, created_at")
    .gte("created_at", from.toISOString())
    .lt("created_at", to.toISOString());
  if (scope.clientId) {
    q = q.eq("client_id", scope.clientId);
  }
  const { data: leadRows, error } = await q;
  if (error) throw new Error(`getAvgResponseMinutes: ${error.message}`);
  const leads = (leadRows ?? []) as { id: string; created_at: string }[];
  if (leads.length === 0) return null;

  const ids = leads.map((l) => l.id);
  const logRows = await fetchCallLogsByLeadIds(supabase, ids);

  return firstCallResponseMinutes(leads, logRows);
}

export { startOfMonth, endOfMonth } from "date-fns";
