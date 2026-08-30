import { createAdminClient } from "@/lib/supabase/admin";
import { ROUND_ROBIN_ELIGIBLE_OR } from "@/lib/auth/sales-capabilities";

export type AgentSupervisionRow = {
  id: string;
  name: string;
  inquiries: number;
  viewings: number;
  followUpsDue: number;
  offers: number;
  concluded: number;
};

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export async function getAgentSupervision(clientId: string): Promise<AgentSupervisionRow[]> {
  const supabase = createAdminClient();
  const today = startOfToday().toISOString();

  const { data: users } = await supabase
    .from("users")
    .select("id, name, role, also_sells, is_active")
    .eq("client_id", clientId)
    .eq("is_active", true)
    .or(ROUND_ROBIN_ELIGIBLE_OR);

  const agents = (users ?? []).map((u) => ({
    id: u.id as string,
    name: (u.name as string | null) || "Agent",
  }));
  if (agents.length === 0) return [];

  const ids = agents.map((a) => a.id);

  const [{ data: leads }, { data: listings }, { data: offers }] = await Promise.all([
    supabase
      .from("leads")
      .select("id, assigned_to_id, status, follow_up_date")
      .eq("client_id", clientId)
      .in("assigned_to_id", ids)
      .or("is_archived.is.null,is_archived.eq.false"),
    supabase
      .from("listings")
      .select("id, agent_id, status")
      .eq("client_id", clientId)
      .in("agent_id", ids),
    supabase
      .from("real_estate_offers")
      .select("id, buyer_agent_id, listing_agent_id, status")
      .eq("client_id", clientId),
  ]);

  const listingIds = (listings ?? []).map((l) => l.id as string);
  const { data: viewings } =
    listingIds.length > 0
      ? await supabase
          .from("viewings")
          .select("id, agent_id, status")
          .in("listing_id", listingIds)
          .in("agent_id", ids)
      : { data: [] as Array<Record<string, unknown>> };

  return agents.map((agent) => {
    const agentLeads = (leads ?? []).filter((l) => l.assigned_to_id === agent.id);
    const agentViewings = (viewings ?? []).filter((v) => v.agent_id === agent.id);
    const agentOffers = (offers ?? []).filter(
      (o) => o.buyer_agent_id === agent.id || o.listing_agent_id === agent.id
    );
    const agentListings = (listings ?? []).filter((l) => l.agent_id === agent.id);
    const concludedLeads = agentLeads.filter((l) => l.status === "WON").length;
    const concludedListings = agentListings.filter(
      (l) => l.status === "sold" || l.status === "let" || l.status === "rented"
    ).length;
    const acceptedOffers = agentOffers.filter((o) => o.status === "accepted").length;

    return {
      id: agent.id,
      name: agent.name,
      inquiries: agentLeads.length,
      viewings: agentViewings.length,
      followUpsDue: agentLeads.filter(
        (l) => l.follow_up_date && String(l.follow_up_date) <= today && l.status !== "WON" && l.status !== "LOST"
      ).length,
      offers: agentOffers.filter((o) => o.status !== "draft" && o.status !== "withdrawn").length,
      concluded: Math.max(concludedLeads, acceptedOffers, concludedListings),
    };
  });
}
