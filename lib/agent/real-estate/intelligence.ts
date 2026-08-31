import { createAdminClient } from "@/lib/supabase/admin";
import { loadRealEstateAgentContext } from "./context";
import { buildAgentHandoffSummary } from "./handoff-summary";
import { resolveReNextBestAction } from "./next-best-action";
import { evaluateMatchReadiness } from "./readiness";
import { formatBudgetRange } from "@/lib/real-estate/requirements";

export type ReIntelligencePanel = {
  identity: string;
  dealSideLabel: string | null;
  sourceLabel: string | null;
  linkedProperty: {
    label: string;
    price: number | null;
    bedrooms: number | null;
    status: string;
  } | null;
  requirements: {
    budget: string | null;
    areas: string | null;
    bedrooms: string | null;
    timeline: string | null;
    matchReadiness: string;
    missing: string[];
  };
  viewingAgent: { name: string | null; routeReasonLabel: string };
  upcomingViewings: Array<{ listingLabel: string; scheduledAt: string }>;
  nextBestAction: { id: string; label: string };
  topMatches: Array<{ listingId: string; label: string; matchLabel: string }>;
};

export async function loadReIntelligencePanel(opts: {
  clientId: string;
  leadId: string;
  contactId: string | null;
  customerName?: string | null;
}): Promise<ReIntelligencePanel | null> {
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

  let topMatches: ReIntelligencePanel["topMatches"] = [];
  if (readiness.readyToMatch && opts.contactId) {
    try {
      const { findPropertyMatches, loadBuyerMatchContact } = await import("./match-service");
      const contact = await loadBuyerMatchContact({
        clientId: opts.clientId,
        contactId: opts.contactId,
      });
      if (contact) {
        const matches = await findPropertyMatches({
          clientId: opts.clientId,
          contact,
          limit: 3,
        });
        topMatches = matches.map((m) => ({
          listingId: m.listingId,
          label: m.label,
          matchLabel: m.matchLabel,
        }));
      }
    } catch {
      topMatches = [];
    }
  }

  const nextBestAction = resolveReNextBestAction({
    dealSide: ctx.dealSide,
    matchReady: readiness.readyToMatch,
    hasUpcomingViewing: ctx.upcomingViewings.length > 0,
    hasLinkedListing: Boolean(ctx.originatingListing),
    humanNeeded: false,
  });

  return {
    identity: opts.customerName?.trim() || "Customer",
    dealSideLabel: ctx.dealSideLabel,
    sourceLabel: ctx.attribution?.sourceLabel ?? null,
    linkedProperty: ctx.originatingListing
      ? {
          label: ctx.originatingListing.label,
          price: ctx.originatingListing.price,
          bedrooms: ctx.originatingListing.bedrooms,
          status: ctx.originatingListing.status,
        }
      : null,
    requirements: {
      budget: req ? formatBudgetRange(req.budgetMin, req.budgetMax) : null,
      areas: req?.areaPreference ?? null,
      bedrooms: req?.bedroomsWanted != null ? `${req.bedroomsWanted}+` : null,
      timeline: req?.timeline ?? null,
      matchReadiness: readiness.statusLabel,
      missing: readiness.missing,
    },
    viewingAgent: {
      name: ctx.viewingAgent?.agentName ?? null,
      routeReasonLabel: ctx.viewingAgent?.routeReasonLabel ?? "not assigned",
    },
    upcomingViewings: ctx.upcomingViewings.map((v) => ({
      listingLabel: v.listingLabel,
      scheduledAt: v.scheduledAt,
    })),
    nextBestAction,
    topMatches,
  };
}

export async function loadReIntelligenceForLead(opts: {
  clientId: string;
  leadId: string;
}): Promise<ReIntelligencePanel | null> {
  const supabase = createAdminClient();
  const { data: lead } = await supabase
    .from("leads")
    .select("contact_id, name")
    .eq("id", opts.leadId)
    .eq("client_id", opts.clientId)
    .maybeSingle();
  if (!lead) return null;
  return loadReIntelligencePanel({
    clientId: opts.clientId,
    leadId: opts.leadId,
    contactId: (lead.contact_id as string | null) ?? null,
    customerName: (lead.name as string | null) ?? null,
  });
}

export async function buildHandoffForLead(opts: {
  clientId: string;
  leadId: string;
  decisionSummary?: string | null;
  escalationSummary?: string | null;
  escalationBriefing?: Record<string, unknown> | null;
}) {
  const supabase = createAdminClient();
  const { data: lead } = await supabase
    .from("leads")
    .select("contact_id, name")
    .eq("id", opts.leadId)
    .eq("client_id", opts.clientId)
    .maybeSingle();
  if (!lead) return null;
  return buildAgentHandoffSummary({
    clientId: opts.clientId,
    leadId: opts.leadId,
    contactId: (lead.contact_id as string | null) ?? null,
    customerName: (lead.name as string | null) ?? null,
    decisionSummary: opts.decisionSummary,
    escalationSummary: opts.escalationSummary,
    escalationBriefing: opts.escalationBriefing,
  });
}
