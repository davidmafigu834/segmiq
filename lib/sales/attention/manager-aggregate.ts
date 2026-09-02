/**
 * Manager aggregate attention queries (authorized summaries — not private focus dumps).
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { getManagerAttention } from "@/lib/agent/manager/attention";
import type { ManagerActor } from "@/lib/agent/manager/types";

export type ManagerSalesAttentionAggregate = {
  generatedAt: string;
  totals: {
    customersWaiting: number;
    overdueFollowUps: number;
    dealsNoNextAction: number;
    openFocusItems: number;
    openCommitmentsDue: number;
    humanHandoffs: number;
  };
  bySalesperson: Array<{
    salespersonId: string;
    name: string;
    customersWaiting: number;
    overdueFollowUps: number;
    dealsNoNextAction: number;
    openFocusItems: number;
    openCommitmentsDue: number;
  }>;
  legacyBrief: Awaited<ReturnType<typeof getManagerAttention>>["brief"] | null;
};

export async function getManagerSalesAttentionAggregate(opts: {
  actor: ManagerActor;
}): Promise<ManagerSalesAttentionAggregate> {
  const supabase = createAdminClient();
  const clientId = opts.actor.clientId;

  const [usersRes, waitingRes, overdueRes, dealsRes, focusRes, commitRes, managerSnap] =
    await Promise.all([
      supabase
        .from("users")
        .select("id, name, role")
        .eq("client_id", clientId)
        .in("role", ["SALESPERSON", "CLIENT_MANAGER"]),
      supabase
        .from("agent_conversation_state")
        .select("lead_id, last_customer_message_at, last_human_message_at, last_agent_message_at, status")
        .eq("client_id", clientId)
        .limit(500),
      supabase
        .from("leads")
        .select("id, assigned_to_id, follow_up_date, follow_up_source")
        .eq("client_id", clientId)
        .not("follow_up_date", "is", null)
        .lt("follow_up_date", new Date().toISOString().slice(0, 10))
        .limit(500),
      supabase
        .from("deals")
        .select("id, owner_id, next_action_at, stage")
        .eq("client_id", clientId)
        .in("stage", ["QUALIFIED", "SCOPING", "PROPOSAL_SENT", "NEGOTIATING"])
        .is("next_action_at", null)
        .limit(500),
      supabase
        .from("sales_attention_items")
        .select("salesperson_id, priority_class, attention_type")
        .eq("client_id", clientId)
        .eq("state", "OPEN")
        .limit(1000),
      supabase
        .from("sales_customer_commitments")
        .select("salesperson_id, due_at, committed_by")
        .eq("client_id", clientId)
        .eq("status", "OPEN")
        .lte("due_at", new Date().toISOString())
        .limit(500),
      getManagerAttention(opts.actor).catch(() => null),
    ]);

  const leadsById = new Map<string, string>();
  // Map waiting conversations → owner via lead assignment
  const waitingLeadIds = new Set<string>();
  for (const row of waitingRes.data ?? []) {
    const lastCust = row.last_customer_message_at ? Date.parse(String(row.last_customer_message_at)) : 0;
    const lastHuman = row.last_human_message_at ? Date.parse(String(row.last_human_message_at)) : 0;
    const lastAgent = row.last_agent_message_at ? Date.parse(String(row.last_agent_message_at)) : 0;
    const lastOut = Math.max(lastHuman, lastAgent);
    if (lastCust > lastOut && Date.now() - lastCust > 10 * 60_000) {
      waitingLeadIds.add(String(row.lead_id));
    }
  }

  if (waitingLeadIds.size) {
    const { data: leadOwners } = await supabase
      .from("leads")
      .select("id, assigned_to_id")
      .eq("client_id", clientId)
      .in("id", [...waitingLeadIds]);
    for (const l of leadOwners ?? []) {
      if (l.assigned_to_id) leadsById.set(String(l.id), String(l.assigned_to_id));
    }
  }

  type Acc = {
    salespersonId: string;
    name: string;
    customersWaiting: number;
    overdueFollowUps: number;
    dealsNoNextAction: number;
    openFocusItems: number;
    openCommitmentsDue: number;
  };

  const byId = new Map<string, Acc>();
  for (const u of usersRes.data ?? []) {
    byId.set(String(u.id), {
      salespersonId: String(u.id),
      name: String(u.name || "Salesperson"),
      customersWaiting: 0,
      overdueFollowUps: 0,
      dealsNoNextAction: 0,
      openFocusItems: 0,
      openCommitmentsDue: 0,
    });
  }

  for (const leadId of waitingLeadIds) {
    const owner = leadsById.get(leadId);
    if (owner && byId.has(owner)) byId.get(owner)!.customersWaiting += 1;
  }
  for (const row of overdueRes.data ?? []) {
    const owner = row.assigned_to_id ? String(row.assigned_to_id) : null;
    if (owner && byId.has(owner)) byId.get(owner)!.overdueFollowUps += 1;
  }
  for (const row of dealsRes.data ?? []) {
    const owner = row.owner_id ? String(row.owner_id) : null;
    if (owner && byId.has(owner)) byId.get(owner)!.dealsNoNextAction += 1;
  }
  for (const row of focusRes.data ?? []) {
    const owner = row.salesperson_id ? String(row.salesperson_id) : null;
    if (owner && byId.has(owner)) byId.get(owner)!.openFocusItems += 1;
  }
  for (const row of commitRes.data ?? []) {
    const owner = row.salesperson_id ? String(row.salesperson_id) : null;
    if (owner && byId.has(owner)) byId.get(owner)!.openCommitmentsDue += 1;
  }

  const bySalesperson = [...byId.values()].sort(
    (a, b) =>
      b.customersWaiting +
      b.overdueFollowUps -
      (a.customersWaiting + a.overdueFollowUps)
  );

  const totals = bySalesperson.reduce(
    (acc, row) => {
      acc.customersWaiting += row.customersWaiting;
      acc.overdueFollowUps += row.overdueFollowUps;
      acc.dealsNoNextAction += row.dealsNoNextAction;
      acc.openFocusItems += row.openFocusItems;
      acc.openCommitmentsDue += row.openCommitmentsDue;
      return acc;
    },
    {
      customersWaiting: 0,
      overdueFollowUps: 0,
      dealsNoNextAction: 0,
      openFocusItems: 0,
      openCommitmentsDue: 0,
      humanHandoffs: managerSnap?.brief?.humanNeeded ?? 0,
    }
  );

  return {
    generatedAt: new Date().toISOString(),
    totals,
    bySalesperson,
    legacyBrief: managerSnap?.brief ?? null,
  };
}
