import { createAdminClient } from "@/lib/supabase/admin";
import { computeMarketingReports } from "./attribution";

export type MarketingOverview = {
  activeCampaigns: number;
  activeJourneys: number;
  pendingApproval: number;
  responsesAwaitingFollowUp: number;
  totalCampaigns: number;
  revenueWon: number;
  pipelineValue: number;
  estimatedSpend: number | null;
  avgOptOutRate: number;
  recentCampaigns: {
    id: string;
    name: string;
    status: string;
    stats: Record<string, number>;
    created_at: string;
    revenueWon?: number;
    replies?: number;
  }[];
  bestCampaign: {
    id: string;
    name: string;
    revenueWon: number;
  } | null;
};

export async function fetchMarketingOverview(clientId: string): Promise<MarketingOverview> {
  const supabase = createAdminClient();

  const [reports, campaignsResult, activeCount, journeyCount, pendingCount, awaitingCount, totalCount] =
    await Promise.all([
      computeMarketingReports(clientId),
      supabase
        .from("whatsapp_campaigns")
        .select("id, name, status, stats, created_at")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false })
        .limit(5),
      supabase
        .from("whatsapp_campaigns")
        .select("*", { count: "exact", head: true })
        .eq("client_id", clientId)
        .in("status", ["sending", "scheduled"]),
      supabase
        .from("marketing_journeys")
        .select("*", { count: "exact", head: true })
        .eq("client_id", clientId)
        .eq("is_active", true),
      supabase
        .from("whatsapp_campaigns")
        .select("*", { count: "exact", head: true })
        .eq("client_id", clientId)
        .eq("status", "pending_approval"),
      supabase
        .from("whatsapp_campaign_recipients")
        .select("*", { count: "exact", head: true })
        .eq("client_id", clientId)
        .eq("response_classification", "interested")
        .not("replied_at", "is", null),
      supabase
        .from("whatsapp_campaigns")
        .select("*", { count: "exact", head: true })
        .eq("client_id", clientId),
    ]);

  const attrByCampaign = new Map(
    reports.campaignSummaries.map((a) => [a.campaignId, a])
  );

  const recentCampaigns = (campaignsResult.data ?? []).map((c) => {
    const attr = attrByCampaign.get(c.id as string);
    const stats = (c.stats as Record<string, number>) ?? {};
    return {
      id: c.id as string,
      name: c.name as string,
      status: c.status as string,
      stats,
      created_at: c.created_at as string,
      revenueWon: attr?.revenueWon ?? 0,
      replies: attr?.replies ?? stats.replied ?? 0,
    };
  });

  const best = reports.bestCampaigns[0] ?? null;

  return {
    activeCampaigns: activeCount.count ?? 0,
    activeJourneys: journeyCount.count ?? 0,
    pendingApproval: pendingCount.count ?? 0,
    responsesAwaitingFollowUp: awaitingCount.count ?? 0,
    totalCampaigns: totalCount.count ?? 0,
    revenueWon: reports.totalRevenueWon,
    pipelineValue: reports.totalPipeline,
    estimatedSpend: reports.estimatedTotalSpend,
    avgOptOutRate: reports.avgOptOutRate,
    recentCampaigns,
    bestCampaign: best
      ? { id: best.campaignId, name: best.campaignName, revenueWon: best.revenueWon }
      : null,
  };
}
