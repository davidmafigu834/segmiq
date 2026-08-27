import { createAdminClient } from "@/lib/supabase/admin";
import type { LeadWithClientResponseLimit } from "@/lib/leadStatus";
import type { LeadRow } from "@/types";

function unwrapAssignee(
  raw: { name?: string } | { name?: string }[] | null | undefined
): { name: string } | null {
  if (!raw) return null;
  if (Array.isArray(raw)) return raw[0]?.name ? { name: String(raw[0].name) } : null;
  return raw.name ? { name: String(raw.name) } : null;
}

export type ActivePipelineLead = LeadWithClientResponseLimit & { assigneeName: string | null };

/** Active pipeline leads (max `limit`) with client SLA + assignee name for manager Kanban. */
export async function getActivePipelineLeads(clientId: string, limit = 50): Promise<ActivePipelineLead[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("leads")
    .select(
      `*, clients!leads_client_id_fkey ( response_time_limit_hours ), assigned_to:users!assigned_to_id ( name )`
    )
    .eq("client_id", clientId)
    .in("status", ["NEW", "CONTACTED", "NEGOTIATING", "PROPOSAL_SENT"])
    .order("updated_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(`active pipeline: ${error.message}`);

  return (data ?? []).map((row) => {
    const r = row as Record<string, unknown>;
    const assignee = unwrapAssignee(r.assigned_to as { name?: string } | { name?: string }[] | null);
    const { assigned_to, ...rest } = r;
    void assigned_to;
    const lead = rest as unknown as LeadRow & {
      clients: { response_time_limit_hours: number | null } | null;
    };
    return {
      ...lead,
      clients: lead.clients ?? null,
      assigneeName: assignee?.name ?? null,
    };
  });
}
