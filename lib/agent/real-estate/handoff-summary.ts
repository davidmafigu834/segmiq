import { loadRealEstateAgentContext } from "./context";
import { evaluateMatchReadiness } from "./readiness";
import { resolveReNextBestAction } from "./next-best-action";
import { formatBudgetRange } from "@/lib/real-estate/requirements";

export type AgentHandoffSummary = {
  customerName: string | null;
  dealSideLabel: string | null;
  sourceLabel: string | null;
  interestedProperty: string | null;
  budget: string | null;
  areas: string | null;
  bedrooms: string | null;
  timeline: string | null;
  matchReadiness: string;
  customerIntent: string | null;
  conversationSummary: string | null;
  recommendedAction: string;
  viewingAgentName: string | null;
  upcomingViewingsCount: number;
};

export async function buildAgentHandoffSummary(opts: {
  clientId: string;
  leadId: string;
  contactId: string | null;
  customerName?: string | null;
  decisionSummary?: string | null;
  escalationSummary?: string | null;
  escalationBriefing?: Record<string, unknown> | null;
}): Promise<AgentHandoffSummary | null> {
  const ctx = await loadRealEstateAgentContext({
    clientId: opts.clientId,
    leadId: opts.leadId,
    contactId: opts.contactId,
  });
  if (!ctx) return null;

  const req = ctx.buyerRequirements;
  const readiness = evaluateMatchReadiness(ctx.dealSide, {
    buyer_budget_min: req?.budgetMin ?? null,
    buyer_budget_max: req?.budgetMax ?? null,
    buyer_bedrooms_wanted: req?.bedroomsWanted ?? null,
    buyer_area_preference: req?.areaPreference ?? null,
    buyer_timeline: req?.timeline ?? null,
  });

  const nextAction = resolveReNextBestAction({
    dealSide: ctx.dealSide,
    matchReady: readiness.readyToMatch,
    hasUpcomingViewing: ctx.upcomingViewings.length > 0,
    hasLinkedListing: Boolean(ctx.originatingListing),
    humanNeeded: Boolean(opts.escalationSummary),
  });

  const briefingIntent =
    typeof opts.escalationBriefing?.customer_request === "string"
      ? opts.escalationBriefing.customer_request
      : null;

  return {
    customerName: opts.customerName ?? null,
    dealSideLabel: ctx.dealSideLabel,
    sourceLabel: ctx.attribution?.sourceLabel ?? null,
    interestedProperty: ctx.originatingListing?.label ?? null,
    budget: req ? formatBudgetRange(req.budgetMin, req.budgetMax) : null,
    areas: req?.areaPreference ?? null,
    bedrooms: req?.bedroomsWanted != null ? `${req.bedroomsWanted}+` : null,
    timeline: req?.timeline ?? null,
    matchReadiness: readiness.statusLabel,
    customerIntent: briefingIntent,
    conversationSummary:
      opts.decisionSummary?.trim() ||
      opts.escalationSummary?.trim() ||
      null,
    recommendedAction: nextAction.label,
    viewingAgentName: ctx.viewingAgent?.agentName ?? null,
    upcomingViewingsCount: ctx.upcomingViewings.length,
  };
}
