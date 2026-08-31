import { createAdminClient } from "@/lib/supabase/admin";
import { listingLabel } from "@/lib/real-estate/helpers";
import { LISTING_TYPE_LABEL } from "@/lib/real-estate/listings";
import type { ListingTransactionType } from "@/types";
import { getLeadAttribution } from "@/lib/real-estate/marketing-service";
import { formatBudgetRange } from "@/lib/real-estate/requirements";
import { requirementCompleteness } from "@/lib/real-estate/requirements";
import { evaluateMatchReadiness } from "./readiness";
import { resolveViewingAgent, VIEWING_ROUTE_REASON_LABELS } from "./routing";
import { dealSideBadgeLabel } from "@/lib/terminology";
import type { RealEstateAgentContext, RealEstateListingContext } from "./types";

function listingStatusLabel(status: string): string {
  const map: Record<string, string> = {
    available: "Available",
    under_offer: "Under offer",
    reserved: "Reserved",
    sold: "Sold",
    let: "Rented",
  };
  return map[status] ?? status.replace(/_/g, " ");
}

function toListingContext(
  row: Record<string, unknown>,
  agentName: string | null
): RealEstateListingContext {
  const transactionType = row.transaction_type as string;
  return {
    id: row.id as string,
    label: listingLabel({
      address: row.address as string | null,
      suburb: row.suburb as string | null,
      external_reference: row.external_reference as string | null,
    }),
    transactionType,
    status: listingStatusLabel(row.status as string),
    price: row.price == null ? null : Number(row.price),
    bedrooms: row.bedrooms == null ? null : Number(row.bedrooms),
    bathrooms: row.bathrooms == null ? null : Number(row.bathrooms),
    suburb: (row.suburb as string | null) ?? null,
    address: (row.address as string | null) ?? null,
    externalReference: (row.external_reference as string | null) ?? null,
    agentId: (row.agent_id as string | null) ?? null,
    agentName,
  };
}

async function loadListingById(opts: {
  clientId: string;
  listingId: string;
}): Promise<RealEstateListingContext | null> {
  const supabase = createAdminClient();
  const { data: listing } = await supabase
    .from("listings")
    .select(
      "id, transaction_type, status, price, bedrooms, bathrooms, suburb, address, external_reference, agent_id"
    )
    .eq("id", opts.listingId)
    .eq("client_id", opts.clientId)
    .maybeSingle();
  if (!listing) return null;
  let agentName: string | null = null;
  const agentId = listing.agent_id as string | null;
  if (agentId) {
    const { data: agent } = await supabase.from("users").select("name").eq("id", agentId).maybeSingle();
    agentName = (agent?.name as string | null) ?? null;
  }
  return toListingContext(listing as Record<string, unknown>, agentName);
}

/**
 * Tenant-scoped real-estate context for the WhatsApp agent.
 * Property facts come from listing records — never invented.
 */
export async function loadRealEstateAgentContext(opts: {
  clientId: string;
  leadId: string;
  contactId: string | null;
}): Promise<RealEstateAgentContext | null> {
  const supabase = createAdminClient();
  const { data: lead } = await supabase
    .from("leads")
    .select("deal_side, linked_listing_id")
    .eq("id", opts.leadId)
    .eq("client_id", opts.clientId)
    .maybeSingle();
  if (!lead) return null;

  const dealSide = (lead.deal_side as string | null) ?? null;
  const linkedListingId = (lead.linked_listing_id as string | null) ?? null;

  const [attribution, linkedListing] = await Promise.all([
    getLeadAttribution({ clientId: opts.clientId, leadId: opts.leadId }),
    linkedListingId
      ? loadListingById({ clientId: opts.clientId, listingId: linkedListingId })
      : Promise.resolve(null),
  ]);

  let originatingListing = linkedListing;
  if (!originatingListing && attribution?.listingId) {
    originatingListing = await loadListingById({
      clientId: opts.clientId,
      listingId: attribution.listingId,
    });
  }

  let buyerRequirements: RealEstateAgentContext["buyerRequirements"] = null;
  let customerPhone: string | null = null;
  if (opts.contactId) {
    const { data: contact } = await supabase
      .from("contacts")
      .select(
        "buyer_budget_min, buyer_budget_max, buyer_bedrooms_wanted, buyer_area_preference, buyer_timeline, phone"
      )
      .eq("id", opts.contactId)
      .eq("client_id", opts.clientId)
      .maybeSingle();
    if (contact) {
      customerPhone = (contact.phone as string | null) ?? null;
      const fields = {
        buyer_budget_min: contact.buyer_budget_min as number | null,
        buyer_budget_max: contact.buyer_budget_max as number | null,
        buyer_bedrooms_wanted: contact.buyer_bedrooms_wanted as number | null,
        buyer_area_preference: contact.buyer_area_preference as string | null,
        buyer_timeline: contact.buyer_timeline as string | null,
      };
      const completeness = requirementCompleteness(fields);
      buyerRequirements = {
        budgetMin: fields.buyer_budget_min,
        budgetMax: fields.buyer_budget_max,
        bedroomsWanted: fields.buyer_bedrooms_wanted,
        areaPreference: fields.buyer_area_preference,
        timeline: fields.buyer_timeline,
        completeness: {
          ready: completeness.ready,
          statusLabel: completeness.statusLabel,
          missing: completeness.missing,
          summary: completeness.summary,
        },
      };
    }
  }

  const viewingRoute = await resolveViewingAgent({
    clientId: opts.clientId,
    leadId: opts.leadId,
    contactId: opts.contactId,
    listingId: linkedListingId ?? originatingListing?.id ?? null,
    phone: customerPhone,
  });

  let upcomingViewings: RealEstateAgentContext["upcomingViewings"] = [];
  if (opts.contactId) {
    const nowIso = new Date().toISOString();
    const { data: clientListings } = await supabase
      .from("listings")
      .select("id, address, suburb, external_reference")
      .eq("client_id", opts.clientId);
    const listingIds = (clientListings ?? []).map((row) => row.id as string);
    if (listingIds.length) {
      const { data: viewings } = await supabase
        .from("viewings")
        .select("id, listing_id, scheduled_at, status")
        .eq("contact_id", opts.contactId)
        .in("listing_id", listingIds)
        .eq("status", "scheduled")
        .gte("scheduled_at", nowIso)
        .order("scheduled_at", { ascending: true })
        .limit(5);
      const listingById = new Map(
        (clientListings ?? []).map((row) => [
          row.id as string,
          listingLabel({
            address: row.address as string | null,
            suburb: row.suburb as string | null,
            external_reference: row.external_reference as string | null,
          }),
        ])
      );
      upcomingViewings = (viewings ?? []).map((row) => ({
        id: row.id as string,
        listingLabel: listingById.get(row.listing_id as string) ?? "Listing",
        scheduledAt: row.scheduled_at as string,
        status: row.status as string,
      }));
    }
  }

  return {
    dealSide,
    dealSideLabel: dealSideBadgeLabel(dealSide),
    linkedListingId,
    originatingListing,
    attribution: attribution
      ? {
          sourceType: attribution.sourceType,
          sourceLabel: attribution.sourceLabel,
          campaignName: attribution.campaignName,
          adName: attribution.adName,
          listingId: attribution.listingId,
          formPrequalified: attribution.formPrequalified,
          capturedAt: attribution.capturedAt,
        }
      : null,
    buyerRequirements,
    viewingAgent: {
      agentId: viewingRoute.agentId,
      agentName: viewingRoute.agentName,
      routeReason: viewingRoute.reason,
      routeReasonLabel: VIEWING_ROUTE_REASON_LABELS[viewingRoute.reason] ?? viewingRoute.reason,
    },
    upcomingViewings,
  };
}

export function serializeRealEstateAgentContext(ctx: RealEstateAgentContext): string {
  const lines: string[] = ["=== REAL ESTATE CONTEXT (canonical CRM; property facts must match exactly) ==="];

  if (ctx.dealSideLabel) {
    lines.push(`Customer side: ${ctx.dealSideLabel}`);
  } else if (ctx.dealSide) {
    lines.push(`Customer side: ${ctx.dealSide}`);
  } else {
    lines.push("Customer side: not set yet");
  }

  if (ctx.attribution) {
    lines.push(
      [
        "-- Marketing attribution --",
        `Source: ${ctx.attribution.sourceLabel}`,
        ctx.attribution.campaignName ? `Campaign: ${ctx.attribution.campaignName}` : null,
        ctx.attribution.adName ? `Ad / form: ${ctx.attribution.adName}` : null,
        ctx.attribution.formPrequalified ? "Form pre-qualified: yes" : null,
      ]
        .filter(Boolean)
        .join("\n")
    );
  } else {
    lines.push("-- Marketing attribution --\nNo campaign or ad attribution recorded for this inquiry.");
  }

  const listing = ctx.originatingListing;
  if (listing) {
    const tx = listing.transactionType as ListingTransactionType;
    const typeLabel = LISTING_TYPE_LABEL[tx] ?? listing.transactionType;
    lines.push(
      [
        "-- Originating / linked property (use ONLY these facts; never invent) --",
        `Property: ${listing.label}`,
        listing.externalReference ? `Reference: ${listing.externalReference}` : null,
        `Type: ${typeLabel}`,
        `Status: ${listing.status}`,
        listing.price != null ? `Listed price: ${listing.price}` : "Listed price: not set",
        listing.bedrooms != null ? `Bedrooms: ${listing.bedrooms}` : null,
        listing.bathrooms != null ? `Bathrooms: ${listing.bathrooms}` : null,
        listing.agentName ? `Listing agent: ${listing.agentName}` : null,
      ]
        .filter(Boolean)
        .join("\n")
    );
  } else {
    lines.push(
      "-- Originating / linked property --\nNo property linked to this inquiry yet. Do not assume which listing they mean."
    );
  }

  if (ctx.buyerRequirements) {
    const r = ctx.buyerRequirements;
    lines.push(
      [
        "-- Buyer / tenant requirements (CRM) --",
        formatBudgetRange(r.budgetMin, r.budgetMax)
          ? `Budget: ${formatBudgetRange(r.budgetMin, r.budgetMax)}`
          : "Budget: not captured",
        r.bedroomsWanted != null ? `Bedrooms wanted: ${r.bedroomsWanted}+` : "Bedrooms wanted: not captured",
        r.areaPreference ? `Preferred areas: ${r.areaPreference}` : "Preferred areas: not captured",
        r.timeline ? `Timeline: ${r.timeline}` : "Timeline: not captured",
        `Matching readiness: ${r.completeness.statusLabel} (${r.completeness.summary})`,
        `Agent guidance: ${evaluateMatchReadiness(ctx.dealSide, {
          buyer_budget_min: r.budgetMin,
          buyer_budget_max: r.budgetMax,
          buyer_bedrooms_wanted: r.bedroomsWanted,
          buyer_area_preference: r.areaPreference,
          buyer_timeline: r.timeline,
        }).guidance}`,
      ]
        .filter(Boolean)
        .join("\n")
    );
  }

  if (ctx.viewingAgent) {
    lines.push(
      [
        "-- Routed viewing agent (deterministic; use for viewing coordination) --",
        ctx.viewingAgent.agentName
          ? `Agent: ${ctx.viewingAgent.agentName}`
          : "Agent: not assigned yet",
        `Route reason: ${ctx.viewingAgent.routeReasonLabel}`,
      ].join("\n")
    );
  }

  if (ctx.upcomingViewings.length) {
    lines.push(
      [
        "-- Upcoming viewings for this customer --",
        ...ctx.upcomingViewings.map(
          (v) => `${v.listingLabel}: ${v.scheduledAt} (${v.status})`
        ),
      ].join("\n")
    );
  } else {
    lines.push("-- Upcoming viewings --\nNo upcoming viewings scheduled for this customer.");
  }

  lines.push(
    "If the customer asks for a property fact not listed above, do not guess. Say you will confirm with the property agent."
  );

  return lines.join("\n\n");
}
