import { createAdminClient } from "@/lib/supabase/admin";
import { asRows } from "@/lib/agent/rows";
import { loadOvernightAgentSummary, type ReOvernightAgentSummary } from "./overnight-summary";

export type ReAgentTeamVisibilityRow = {
  agentId: string;
  agentName: string;
  executionsCompleted: number;
  humanHandoffs: number;
  viewingApprovalsPending: number;
};

export type ReManagerAgentDashboard = {
  overnight: ReOvernightAgentSummary;
  team: ReAgentTeamVisibilityRow[];
  agentActivityHref: string;
  viewingApprovalsHref: string;
};

export async function loadReManagerAgentDashboard(opts: {
  clientId: string;
  at?: Date;
}): Promise<ReManagerAgentDashboard> {
  const overnight = await loadOvernightAgentSummary(opts);
  const supabase = createAdminClient();

  const [{ data: usersData }, { data: statesData }, { data: executionsData }] = await Promise.all([
    supabase.from("users").select("id, name").eq("client_id", opts.clientId),
    supabase
      .from("agent_conversation_state")
      .select("lead_id, status, human_needed_reason")
      .eq("client_id", opts.clientId)
      .eq("status", "HUMAN_NEEDED"),
    supabase
      .from("agent_executions")
      .select("id, lead_id, state, created_at")
      .eq("client_id", opts.clientId)
      .eq("trigger_kind", "INBOUND")
      .gte("created_at", overnight.sinceIso)
      .lte("created_at", overnight.untilIso)
      .eq("state", "COMPLETED")
      .limit(500),
  ]);

  const users = asRows<{ id: string; name: string | null }>(usersData);
  const nameById = new Map(users.map((u) => [u.id, u.name ?? "Team member"]));
  const humanStates = asRows<{
    lead_id: string;
    status: string;
    human_needed_reason: string | null;
  }>(statesData);
  const executions = asRows<{ id: string; lead_id: string; state: string }>(executionsData);

  const leadIds = Array.from(
    new Set([
      ...humanStates.map((s) => s.lead_id),
      ...executions.map((e) => e.lead_id).filter(Boolean),
    ])
  ) as string[];

  const { data: leadsData } = leadIds.length
    ? await supabase.from("leads").select("id, assigned_to_id").in("id", leadIds)
    : { data: [] };
  const leadOwner = new Map(
    asRows<{ id: string; assigned_to_id: string | null }>(leadsData).map((l) => [l.id, l.assigned_to_id])
  );

  const teamMap = new Map<string, ReAgentTeamVisibilityRow>();
  for (const user of users) {
    teamMap.set(user.id, {
      agentId: user.id,
      agentName: user.name ?? "Team member",
      executionsCompleted: 0,
      humanHandoffs: 0,
      viewingApprovalsPending: 0,
    });
  }

  for (const execution of executions) {
    const ownerId = leadOwner.get(execution.lead_id);
    if (!ownerId) continue;
    const row = teamMap.get(ownerId);
    if (!row) continue;
    row.executionsCompleted += 1;
  }

  for (const state of humanStates) {
    const ownerId = leadOwner.get(state.lead_id);
    if (!ownerId) continue;
    const row = teamMap.get(ownerId);
    if (!row) continue;
    row.humanHandoffs += 1;
    if (state.human_needed_reason === "VIEWING_APPROVAL") {
      row.viewingApprovalsPending += 1;
    }
  }

  const team = [...teamMap.values()]
    .filter((row) => row.executionsCompleted > 0 || row.humanHandoffs > 0 || row.viewingApprovalsPending > 0)
    .sort(
      (a, b) =>
        b.viewingApprovalsPending - a.viewingApprovalsPending ||
        b.humanHandoffs - a.humanHandoffs ||
        b.executionsCompleted - a.executionsCompleted
    );

  return {
    overnight,
    team,
    agentActivityHref: "/client/agent",
    viewingApprovalsHref: "/client/inbox?filter=viewing_requests",
  };
}
