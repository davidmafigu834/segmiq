import type { SupabaseClient } from "@supabase/supabase-js";
import { phonesMatch } from "@/lib/leads/phone-match";

type Salesperson = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  notification_prefs: unknown;
  round_robin_order: number;
};

async function countOpenLeadsByRep(
  supabase: SupabaseClient,
  clientId: string,
  repIds: string[]
): Promise<Map<string, number>> {
  if (!repIds.length) return new Map();
  const { data } = await supabase
    .from("leads")
    .select("assigned_to_id")
    .eq("client_id", clientId)
    .in("assigned_to_id", repIds)
    .or("is_archived.is.null,is_archived.eq.false")
    .not("status", "in", '("WON","LOST","NOT_QUALIFIED")');

  const counts = new Map<string, number>();
  for (const id of repIds) counts.set(id, 0);
  for (const row of data ?? []) {
    const id = row.assigned_to_id as string | null;
    if (!id) continue;
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return counts;
}

export async function findReturningAssignee(opts: {
  supabase: SupabaseClient;
  clientId: string;
  phoneDigits: string;
}): Promise<string | null> {
  const { supabase, clientId, phoneDigits } = opts;
  if (!phoneDigits) return null;

  const { data: priorLeads } = await supabase
    .from("leads")
    .select("assigned_to_id, phone, status, updated_at")
    .eq("client_id", clientId)
    .not("assigned_to_id", "is", null)
    .order("updated_at", { ascending: false })
    .limit(50);

  const matched = (priorLeads ?? []).find((l) => phonesMatch(l.phone as string | null, phoneDigits));

  const assigneeId = (matched?.assigned_to_id as string | null) ?? null;
  if (!assigneeId) return null;

  const { data: user } = await supabase
    .from("users")
    .select("id")
    .eq("id", assigneeId)
    .eq("client_id", clientId)
    .eq("role", "SALESPERSON")
    .eq("is_active", true)
    .maybeSingle();

  return user?.id ? (user.id as string) : null;
}

export async function pickAssigneeForInbound(opts: {
  supabase: SupabaseClient;
  clientId: string;
  assignmentMode: string;
  phoneDigits?: string | null;
}): Promise<{ assigneeId: string | null; salespeople: Salesperson[] }> {
  const { supabase, clientId, assignmentMode, phoneDigits } = opts;
  const mode = assignmentMode === "pool" || assignmentMode === "round_robin" ? assignmentMode : "direct";

  const { data: salespeople } = await supabase
    .from("users")
    .select("id, name, email, phone, notification_prefs, round_robin_order")
    .eq("client_id", clientId)
    .eq("role", "SALESPERSON")
    .eq("is_active", true)
    .order("round_robin_order", { ascending: true });

  const list = (salespeople ?? []) as Salesperson[];
  if (list.length === 0) {
    return { assigneeId: null, salespeople: list };
  }

  if (phoneDigits) {
    const returningId = await findReturningAssignee({ supabase, clientId, phoneDigits });
    if (returningId && list.some((s) => s.id === returningId)) {
      return { assigneeId: returningId, salespeople: list };
    }
  }

  if (mode !== "round_robin") {
    return { assigneeId: null, salespeople: list };
  }

  const { data: client } = await supabase
    .from("clients")
    .select("round_robin_index")
    .eq("id", clientId)
    .maybeSingle();

  let rr = (client?.round_robin_index as number) ?? 0;
  const loads = await countOpenLeadsByRep(
    supabase,
    clientId,
    list.map((s) => s.id)
  );

  let bestIdx = rr % list.length;
  let bestLoad = loads.get(list[bestIdx].id) ?? 0;
  for (let offset = 1; offset < list.length; offset += 1) {
    const idx = (rr + offset) % list.length;
    const load = loads.get(list[idx].id) ?? 0;
    if (load < bestLoad) {
      bestLoad = load;
      bestIdx = idx;
    }
  }

  const assigneeId = list[bestIdx].id;
  rr = (bestIdx + 1) % list.length;

  await supabase
    .from("clients")
    .update({ round_robin_index: rr, updated_at: new Date().toISOString() })
    .eq("id", clientId);

  return { assigneeId, salespeople: list };
}
