import { createAdminClient } from "@/lib/supabase/admin";
import { getMarketingSettings } from "./settings";

export type CampaignAttribution = {
  campaignId: string;
  campaignName: string;
  status: string;
  startedAt: string | null;
  messagesSent: number;
  delivered: number;
  read: number;
  replies: number;
  interested: number;
  optOuts: number;
  quotationsIssued: number;
  activeOpportunities: number;
  dealsWon: number;
  pipelineValue: number;
  revenueWon: number;
  estimatedCost: number | null;
  costPerOpportunity: number | null;
  returnOnSpend: number | null;
  bySalesperson: SalespersonAttribution[];
};

export type SalespersonAttribution = {
  userId: string | null;
  name: string;
  replies: number;
  interested: number;
  quotationsIssued: number;
  dealsWon: number;
  pipelineValue: number;
  revenueWon: number;
};

export type MarketingReportsSummary = {
  totalRevenueWon: number;
  totalPipeline: number;
  totalCampaigns: number;
  totalReplies: number;
  totalInterested: number;
  avgOptOutRate: number;
  responsesAwaitingFollowUp: number;
  estimatedTotalSpend: number | null;
  bestCampaigns: CampaignAttribution[];
  campaignSummaries: CampaignAttribution[];
  bySalesperson: SalespersonAttribution[];
};

const ACTIVE_STATUSES = new Set(["NEW", "CONTACTED", "NEGOTIATING", "PROPOSAL_SENT"]);

type RecipientRow = {
  id: string;
  lead_id: string | null;
  sent_at: string | null;
  replied_at: string | null;
  response_classification: string | null;
};

type LeadRow = {
  id: string;
  status: string;
  deal_value: number | null;
  assigned_to_id: string | null;
  updated_at: string;
  users?: { name: string } | { name: string }[] | null;
};

function unwrapName(raw: LeadRow["users"]): string {
  if (!raw) return "Unassigned";
  if (Array.isArray(raw)) return raw[0]?.name ?? "Unassigned";
  return raw.name ?? "Unassigned";
}

function campaignStartIso(startedAt: string | null, createdAt: string): string {
  return startedAt ?? createdAt;
}

export async function computeCampaignAttribution(
  clientId: string,
  campaignId: string
): Promise<CampaignAttribution | null> {
  const supabase = createAdminClient();

  const { data: campaign } = await supabase
    .from("whatsapp_campaigns")
    .select("id, name, status, stats, started_at, created_at")
    .eq("id", campaignId)
    .eq("client_id", clientId)
    .maybeSingle();

  if (!campaign) return null;

  const stats = (campaign.stats as Record<string, number>) ?? {};
  const since = campaignStartIso(
    campaign.started_at as string | null,
    campaign.created_at as string
  );

  const { data: recipients } = await supabase
    .from("whatsapp_campaign_recipients")
    .select("id, lead_id, sent_at, replied_at, response_classification")
    .eq("campaign_id", campaignId);

  const rows = (recipients ?? []) as RecipientRow[];
  const leadIds = Array.from(
    new Set(rows.map((r) => r.lead_id).filter(Boolean) as string[])
  );

  let leads: LeadRow[] = [];
  if (leadIds.length > 0) {
    const { data } = await supabase
      .from("leads")
      .select("id, status, deal_value, assigned_to_id, updated_at, users!assigned_to_id ( name )")
      .in("id", leadIds);
    leads = (data ?? []) as LeadRow[];
  }

  const leadMap = new Map(leads.map((l) => [l.id, l]));

  let quotationsIssued = 0;
  if (leadIds.length > 0) {
    const { count } = await supabase
      .from("quotations")
      .select("*", { count: "exact", head: true })
      .in("lead_id", leadIds)
      .neq("status", "draft")
      .gte("created_at", since);
    quotationsIssued = count ?? 0;
  }

  const interestedRecipients = rows.filter((r) => r.response_classification === "interested");
  const repliedCount = rows.filter((r) => r.replied_at).length;
  const optOuts = rows.filter((r) => r.response_classification === "opt_out").length;

  let dealsWon = 0;
  let revenueWon = 0;
  let pipelineValue = 0;
  let activeOpportunities = 0;

  for (const recipient of rows) {
    if (!recipient.lead_id) continue;
    const lead = leadMap.get(recipient.lead_id);
    if (!lead) continue;

    const value = lead.deal_value != null ? Number(lead.deal_value) : 0;

    if (lead.status === "WON" && new Date(lead.updated_at) >= new Date(since)) {
      dealsWon++;
      revenueWon += value;
    } else if (ACTIVE_STATUSES.has(lead.status) && recipient.response_classification === "interested") {
      activeOpportunities++;
      pipelineValue += value;
    }
  }

  const settings = await getMarketingSettings(clientId);
  const messagesSent = stats.sent ?? 0;
  const estimatedCost =
    settings.estimated_cost_per_message_usd != null
      ? messagesSent * Number(settings.estimated_cost_per_message_usd)
      : null;

  const opportunities = activeOpportunities + dealsWon;
  const costPerOpportunity =
    estimatedCost != null && opportunities > 0 ? estimatedCost / opportunities : null;
  const returnOnSpend =
    estimatedCost != null && estimatedCost > 0 ? revenueWon / estimatedCost : null;

  const bySalesperson = buildSalespersonBreakdown(rows, leadMap, since);

  return {
    campaignId: campaign.id as string,
    campaignName: campaign.name as string,
    status: campaign.status as string,
    startedAt: (campaign.started_at as string | null) ?? null,
    messagesSent,
    delivered: stats.delivered ?? 0,
    read: stats.read ?? 0,
    replies: repliedCount,
    interested: interestedRecipients.length,
    optOuts,
    quotationsIssued,
    activeOpportunities,
    dealsWon,
    pipelineValue,
    revenueWon,
    estimatedCost,
    costPerOpportunity,
    returnOnSpend,
    bySalesperson,
  };
}

function buildSalespersonBreakdown(
  recipients: RecipientRow[],
  leadMap: Map<string, LeadRow>,
  since: string
): SalespersonAttribution[] {
  const map = new Map<string, SalespersonAttribution>();

  function bucket(userId: string | null, name: string): SalespersonAttribution {
    const key = userId ?? "__unassigned__";
    let row = map.get(key);
    if (!row) {
      row = {
        userId,
        name,
        replies: 0,
        interested: 0,
        quotationsIssued: 0,
        dealsWon: 0,
        pipelineValue: 0,
        revenueWon: 0,
      };
      map.set(key, row);
    }
    return row;
  }

  for (const recipient of recipients) {
    if (!recipient.lead_id) continue;
    const lead = leadMap.get(recipient.lead_id);
    const userId = (lead?.assigned_to_id as string | null) ?? null;
    const name = lead ? unwrapName(lead.users) : "Unassigned";
    const row = bucket(userId, name);

    if (recipient.replied_at) row.replies++;
    if (recipient.response_classification === "interested") row.interested++;

    if (lead) {
      const value = lead.deal_value != null ? Number(lead.deal_value) : 0;
      if (lead.status === "WON" && new Date(lead.updated_at) >= new Date(since)) {
        row.dealsWon++;
        row.revenueWon += value;
      } else if (
        ACTIVE_STATUSES.has(lead.status) &&
        recipient.response_classification === "interested"
      ) {
        row.pipelineValue += value;
      }
    }
  }

  return Array.from(map.values()).sort((a, b) => b.revenueWon - a.revenueWon);
}

export async function computeMarketingReports(clientId: string): Promise<MarketingReportsSummary> {
  const supabase = createAdminClient();

  const { data: campaigns } = await supabase
    .from("whatsapp_campaigns")
    .select("id")
    .eq("client_id", clientId)
    .in("status", ["completed", "sending", "paused"]);

  const attributions: CampaignAttribution[] = [];
  for (const camp of campaigns ?? []) {
    const attr = await computeCampaignAttribution(clientId, camp.id as string);
    if (attr) attributions.push(attr);
  }

  attributions.sort((a, b) => b.revenueWon - a.revenueWon);

  const { count: awaitingCount } = await supabase
    .from("whatsapp_campaign_recipients")
    .select("*", { count: "exact", head: true })
    .eq("client_id", clientId)
    .eq("response_classification", "interested")
    .not("replied_at", "is", null);

  const totalSent = attributions.reduce((s, a) => s + a.messagesSent, 0);
  const totalOptOuts = attributions.reduce((s, a) => s + a.optOuts, 0);

  const salespersonMap = new Map<string, SalespersonAttribution>();
  for (const attr of attributions) {
    for (const sp of attr.bySalesperson) {
      const key = sp.userId ?? "__unassigned__";
      const existing = salespersonMap.get(key);
      if (!existing) {
        salespersonMap.set(key, { ...sp });
      } else {
        existing.replies += sp.replies;
        existing.interested += sp.interested;
        existing.quotationsIssued += sp.quotationsIssued;
        existing.dealsWon += sp.dealsWon;
        existing.pipelineValue += sp.pipelineValue;
        existing.revenueWon += sp.revenueWon;
      }
    }
  }

  const settings = await getMarketingSettings(clientId);
  const estimatedTotalSpend =
    settings.estimated_cost_per_message_usd != null
      ? totalSent * Number(settings.estimated_cost_per_message_usd)
      : null;

  return {
    totalRevenueWon: attributions.reduce((s, a) => s + a.revenueWon, 0),
    totalPipeline: attributions.reduce((s, a) => s + a.pipelineValue, 0),
    totalCampaigns: attributions.length,
    totalReplies: attributions.reduce((s, a) => s + a.replies, 0),
    totalInterested: attributions.reduce((s, a) => s + a.interested, 0),
    avgOptOutRate: totalSent > 0 ? totalOptOuts / totalSent : 0,
    responsesAwaitingFollowUp: awaitingCount ?? 0,
    estimatedTotalSpend,
    bestCampaigns: attributions.slice(0, 5),
    campaignSummaries: attributions,
    bySalesperson: Array.from(salespersonMap.values()).sort(
      (a, b) => b.revenueWon - a.revenueWon
    ),
  };
}

export async function cacheCampaignAttribution(
  clientId: string,
  campaignId: string
): Promise<void> {
  const attr = await computeCampaignAttribution(clientId, campaignId);
  if (!attr) return;

  const supabase = createAdminClient();
  const { data: campaign } = await supabase
    .from("whatsapp_campaigns")
    .select("stats")
    .eq("id", campaignId)
    .maybeSingle();

  const stats = (campaign?.stats as Record<string, unknown>) ?? {};
  stats.attribution = {
    interested: attr.interested,
    quotationsIssued: attr.quotationsIssued,
    dealsWon: attr.dealsWon,
    pipelineValue: attr.pipelineValue,
    revenueWon: attr.revenueWon,
    estimatedCost: attr.estimatedCost,
    costPerOpportunity: attr.costPerOpportunity,
    returnOnSpend: attr.returnOnSpend,
  };

  await supabase
    .from("whatsapp_campaigns")
    .update({ stats, updated_at: new Date().toISOString() })
    .eq("id", campaignId);
}
