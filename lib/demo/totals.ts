import { startOfHarareMonth } from "@/lib/demo/dates";
import type { DemoActorKey } from "@/lib/demo/actors";
import type { DemoDataset } from "@/lib/demo/types";
import type { DealStage } from "@/types";

const ACTIVE = new Set<DealStage>(["QUALIFIED", "SCOPING", "PROPOSAL_SENT", "NEGOTIATING"]);

export function dealAmount(dataset: DemoDataset, dealId: string): number {
  const quote = dataset.quotations
    .filter((row) => row.deal_id === dealId)
    .sort((a, b) => Date.parse(b.updated_at) - Date.parse(a.updated_at))[0];
  if (quote) return Number(quote.total) || 0;
  const deal = dataset.deals.find((row) => row.id === dealId);
  return Number(deal?.estimated_value ?? deal?.won_value ?? 0) || 0;
}

export function summariseDemo(dataset: DemoDataset, now = new Date()) {
  const monthStart = startOfHarareMonth(now).getTime();
  const active = dataset.deals.filter((deal) => ACTIVE.has(deal.stage));
  const pipelineValue = active.reduce((sum, deal) => sum + (Number(deal.estimated_value) || 0), 0);
  const wonThisMonth = dataset.deals.filter(
    (deal) => deal.stage === "WON" && deal.won_at && Date.parse(deal.won_at) >= monthStart
  );
  const wonValue = wonThisMonth.reduce((sum, deal) => sum + (Number(deal.won_value) || 0), 0);
  const byOwner: Record<string, { name: string; key: DemoActorKey; wonValue: number; wonCount: number; pipeline: number }> = {};
  for (const actor of Object.values(dataset.actors)) {
    if (actor.role !== "SALESPERSON") continue;
    const ownedWon = wonThisMonth.filter((deal) => deal.owner_id === actor.id);
    const ownedOpen = active.filter((deal) => deal.owner_id === actor.id);
    byOwner[actor.id] = {
      name: actor.name,
      key: actor.key,
      wonValue: ownedWon.reduce((sum, deal) => sum + (Number(deal.won_value) || 0), 0),
      wonCount: ownedWon.length,
      pipeline: ownedOpen.reduce((sum, deal) => sum + (Number(deal.estimated_value) || 0), 0),
    };
  }
  const awaiting = dataset.quotations.filter((quote) => quote.status === "sent" || quote.status === "viewed");
  const openLeads = dataset.leads.filter((lead) => !["WON", "LOST", "CONVERTED_TO_DEAL", "NOT_QUALIFIED"].includes(lead.status));
  return {
    pipelineValue,
    activeDeals: active.length,
    wonCount: wonThisMonth.length,
    wonValue,
    byOwner,
    awaitingQuotes: awaiting.length,
    awaitingValue: awaiting.reduce((sum, quote) => sum + (Number(quote.total) || 0), 0),
    openLeads: openLeads.length,
    lost: dataset.deals.filter((deal) => deal.stage === "LOST"),
  };
}
