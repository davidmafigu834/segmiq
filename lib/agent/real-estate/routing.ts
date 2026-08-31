import { createAdminClient } from "@/lib/supabase/admin";
import { isRoundRobinEligibleUserId } from "@/lib/auth/sales-capabilities";
import { getLeadAttribution } from "@/lib/real-estate/marketing-service";
import { phoneDigitsOnly } from "@/lib/real-estate/helpers";
import { findReturningAssignee, pickAssigneeForInbound } from "@/lib/whatsapp/assignment";

export type ViewingAgentRoute = {
  agentId: string | null;
  agentName: string | null;
  reason: string;
};

type RouteCandidate = { agentId: string; reason: string };

async function loadAgentName(agentId: string): Promise<string | null> {
  const supabase = createAdminClient();
  const { data } = await supabase.from("users").select("name").eq("id", agentId).maybeSingle();
  return (data?.name as string | null) ?? null;
}

async function isEligible(clientId: string, agentId: string): Promise<boolean> {
  const supabase = createAdminClient();
  return isRoundRobinEligibleUserId(supabase, clientId, agentId);
}

/** Pick the first eligible candidate in deterministic priority order. */
export function pickViewingAgentRoute(
  candidates: RouteCandidate[],
  eligible: (agentId: string) => boolean
): ViewingAgentRoute | null {
  for (const candidate of candidates) {
    if (!eligible(candidate.agentId)) continue;
    return { agentId: candidate.agentId, agentName: null, reason: candidate.reason };
  }
  return null;
}

/**
 * Deterministic viewing-agent routing (Build 1 Phase 3).
 * Priority: lead owner → listing agent → returning assignee → campaign default → round-robin.
 */
export async function resolveViewingAgent(opts: {
  clientId: string;
  leadId: string;
  contactId: string | null;
  listingId: string | null;
  phone: string | null;
}): Promise<ViewingAgentRoute> {
  const supabase = createAdminClient();
  const candidates: RouteCandidate[] = [];

  const { data: lead } = await supabase
    .from("leads")
    .select("assigned_to_id, linked_listing_id")
    .eq("id", opts.leadId)
    .eq("client_id", opts.clientId)
    .maybeSingle();

  const leadOwnerId = (lead?.assigned_to_id as string | null) ?? null;
  if (leadOwnerId) candidates.push({ agentId: leadOwnerId, reason: "lead_owner" });

  const effectiveListingId =
    opts.listingId ?? (lead?.linked_listing_id as string | null) ?? null;
  if (effectiveListingId) {
    const { data: listing } = await supabase
      .from("listings")
      .select("agent_id")
      .eq("id", effectiveListingId)
      .eq("client_id", opts.clientId)
      .maybeSingle();
    const listingAgentId = (listing?.agent_id as string | null) ?? null;
    if (listingAgentId) {
      candidates.push({ agentId: listingAgentId, reason: "listing_agent" });
    }
  }

  const phoneDigits = phoneDigitsOnly(opts.phone);
  if (phoneDigits) {
    const returningId = await findReturningAssignee({ supabase, clientId: opts.clientId, phoneDigits });
    if (returningId) candidates.push({ agentId: returningId, reason: "returning_assignee" });
  }

  const attribution = await getLeadAttribution({ clientId: opts.clientId, leadId: opts.leadId });
  if (attribution?.campaignId) {
    const { data: campaign } = await supabase
      .from("marketing_acquisition_campaigns")
      .select("default_agent_id")
      .eq("id", attribution.campaignId)
      .eq("client_id", opts.clientId)
      .maybeSingle();
    const campaignAgentId = (campaign?.default_agent_id as string | null) ?? null;
    if (campaignAgentId) {
      candidates.push({ agentId: campaignAgentId, reason: "campaign_default_agent" });
    }
  }

  const { data: client } = await supabase
    .from("clients")
    .select("whatsapp_assignment_mode")
    .eq("id", opts.clientId)
    .maybeSingle();
  const { assigneeId } = await pickAssigneeForInbound({
    supabase,
    clientId: opts.clientId,
    assignmentMode: (client?.whatsapp_assignment_mode as string) ?? "round_robin",
    phoneDigits,
  });
  if (assigneeId) candidates.push({ agentId: assigneeId, reason: "round_robin" });

  const seen = new Set<string>();
  const deduped = candidates.filter((c) => {
    if (seen.has(c.agentId)) return false;
    seen.add(c.agentId);
    return true;
  });

  for (const candidate of deduped) {
    if (!(await isEligible(opts.clientId, candidate.agentId))) continue;
    const agentName = await loadAgentName(candidate.agentId);
    return {
      agentId: candidate.agentId,
      agentName,
      reason: candidate.reason,
    };
  }

  return { agentId: null, agentName: null, reason: "unassigned" };
}

export const VIEWING_ROUTE_REASON_LABELS: Record<string, string> = {
  lead_owner: "conversation owner",
  listing_agent: "listing agent",
  returning_assignee: "returning salesperson",
  campaign_default_agent: "campaign default agent",
  round_robin: "round-robin assignee",
  unassigned: "no eligible agent",
};
