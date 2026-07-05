import type { SupabaseClient } from "@supabase/supabase-js";

type Salesperson = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  notification_prefs: unknown;
  round_robin_order: number;
};

export async function pickAssigneeForInbound(opts: {
  supabase: SupabaseClient;
  clientId: string;
  assignmentMode: string;
}): Promise<{ assigneeId: string | null; salespeople: Salesperson[] }> {
  const { supabase, clientId, assignmentMode } = opts;
  const mode = assignmentMode === "pool" || assignmentMode === "round_robin" ? assignmentMode : "direct";

  const { data: salespeople } = await supabase
    .from("users")
    .select("id, name, email, phone, notification_prefs, round_robin_order")
    .eq("client_id", clientId)
    .eq("role", "SALESPERSON")
    .eq("is_active", true)
    .order("round_robin_order", { ascending: true });

  const list = (salespeople ?? []) as Salesperson[];
  if (mode !== "round_robin" || list.length === 0) {
    return { assigneeId: null, salespeople: list };
  }

  const { data: client } = await supabase
    .from("clients")
    .select("round_robin_index")
    .eq("id", clientId)
    .maybeSingle();

  let rr = (client?.round_robin_index as number) ?? 0;
  const idx = rr % list.length;
  const assigneeId = list[idx].id;
  rr = (rr + 1) % list.length;

  await supabase
    .from("clients")
    .update({ round_robin_index: rr, updated_at: new Date().toISOString() })
    .eq("id", clientId);

  return { assigneeId, salespeople: list };
}
