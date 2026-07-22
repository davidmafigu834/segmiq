import type { SupabaseClient } from "@supabase/supabase-js";
import { logLeadReassigned } from "@/lib/lead-events";
import { fetchRoundRobinEligibleUsers } from "@/lib/auth/sales-capabilities";

type ActiveRep = { id: string; name: string };

export type MigrateUncontactedResult = {
  migrated: number;
  unassigned: number;
};

/**
 * Reassign uncontacted leads (status NEW) from one rep to remaining active salespeople.
 * Distributes round-robin; leaves leads unassigned if no active reps remain.
 */
export async function migrateUncontactedLeads(
  supabase: SupabaseClient,
  options: {
    clientId: string;
    fromUserId: string;
    actor?: { id: string; name: string; role: string };
    handoverNotes?: string;
  }
): Promise<MigrateUncontactedResult> {
  const { clientId, fromUserId, actor, handoverNotes } = options;

  const { data: remaining } = await fetchRoundRobinEligibleUsers(supabase, clientId, {
    excludeUserId: fromUserId,
  });

  const activeReps: ActiveRep[] = ((remaining ?? []) as unknown as Array<{ id: string; name?: string }>).map((r) => ({
    id: r.id,
    name: r.name ?? "Unknown",
  }));

  const { data: newLeads } = await supabase
    .from("leads")
    .select("id")
    .eq("client_id", clientId)
    .eq("assigned_to_id", fromUserId)
    .eq("status", "NEW")
    .eq("is_archived", false);

  const leads = newLeads ?? [];
  let migrated = 0;
  let unassigned = 0;

  const { data: fromUser } = await supabase.from("users").select("name").eq("id", fromUserId).maybeSingle();
  const fromName = (fromUser as { name?: string } | null)?.name ?? "Unknown";

  for (let i = 0; i < leads.length; i++) {
    const lead = leads[i];
    const leadId = lead.id as string;

    if (activeReps.length === 0) {
      await supabase.from("leads").update({ assigned_to_id: null }).eq("id", leadId);
      unassigned += 1;
      if (actor) {
        await logLeadReassigned({
          leadId,
          clientId,
          actor,
          fromId: fromUserId,
          fromName,
          toId: null,
          toName: "Unassigned",
          handoverNotes: handoverNotes ?? "Uncontacted leads redistributed — no active salespeople available.",
        });
      }
      continue;
    }

    const assignee = activeReps[i % activeReps.length];
    await supabase.from("leads").update({ assigned_to_id: assignee.id }).eq("id", leadId);
    migrated += 1;

    if (actor) {
      await logLeadReassigned({
        leadId,
        clientId,
        actor,
        fromId: fromUserId,
        fromName,
        toId: assignee.id,
        toName: assignee.name,
        handoverNotes: handoverNotes ?? null,
      });
    }
  }

  if (activeReps.length > 0) {
    for (let i = 0; i < activeReps.length; i++) {
      await supabase.from("users").update({ round_robin_order: i }).eq("id", activeReps[i].id);
    }
    await supabase.from("clients").update({ round_robin_index: 0 }).eq("id", clientId);
  }

  return { migrated, unassigned };
}

/** Count uncontacted (NEW) leads assigned to a user. */
export async function countUncontactedLeadsForUser(
  supabase: SupabaseClient,
  clientId: string,
  userId: string
): Promise<number> {
  const { count } = await supabase
    .from("leads")
    .select("id", { count: "exact", head: true })
    .eq("client_id", clientId)
    .eq("assigned_to_id", userId)
    .eq("status", "NEW")
    .eq("is_archived", false);

  return count ?? 0;
}
