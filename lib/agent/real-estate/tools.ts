import { createAdminClient } from "@/lib/supabase/admin";
import { logReActivity } from "@/lib/lead-events";
import { appendInterestedListingIds } from "@/lib/real-estate/helpers";
import { notifyPropertyMatch } from "@/lib/real-estate/notifications";
import { AGENT_ACTOR, toolFailure, toolSuccess, type ToolExecutionContext, type ToolResult } from "@/lib/agent/tools/context";
import { evaluateMatchReadiness } from "./readiness";
import {
  findPropertyMatches,
  getListingForClient,
  loadBuyerMatchContact,
  searchListings,
  summarizeListingForAgent,
} from "./match-service";

async function loadLeadDealSide(ctx: ToolExecutionContext): Promise<string | null> {
  const supabase = createAdminClient();
  const { data: lead } = await supabase
    .from("leads")
    .select("deal_side")
    .eq("id", ctx.leadId)
    .eq("client_id", ctx.clientId)
    .maybeSingle();
  return (lead?.deal_side as string | null) ?? null;
}

export async function executeListingSearch(
  ctx: ToolExecutionContext,
  input: {
    query?: string;
    suburb?: string;
    transaction_type?: "sale" | "rental";
    limit?: number;
  }
): Promise<ToolResult> {
  const listings = await searchListings({
    clientId: ctx.clientId,
    filters: {
      q: input.query,
      suburb: input.suburb,
      transactionType: input.transaction_type,
      status: "available",
    },
    limit: input.limit,
  });
  return toolSuccess({
    count: listings.length,
    listings,
    note: "Use listing.get for full facts on one property. Use property.match when buyer requirements are READY TO MATCH.",
  });
}

export async function executeListingGet(
  ctx: ToolExecutionContext,
  input: { listing_id: string }
): Promise<ToolResult> {
  const listing = await getListingForClient({ clientId: ctx.clientId, listingId: input.listing_id });
  if (!listing) return toolFailure("Listing not found for this company.");
  return toolSuccess({
    listing: summarizeListingForAgent(listing),
    description: (listing.description as string | null)?.slice(0, 600) ?? null,
    external_reference: listing.external_reference ?? null,
    address: listing.address ?? null,
  });
}

export async function executePropertyMatch(
  ctx: ToolExecutionContext,
  input: { limit?: number; exclude_listing_ids?: string[] }
): Promise<ToolResult> {
  if (!ctx.contactId) {
    return toolFailure("No contact record exists yet, so property matching cannot run.");
  }

  const contact = await loadBuyerMatchContact({ clientId: ctx.clientId, contactId: ctx.contactId });
  if (!contact) return toolFailure("Contact not found.");

  const dealSide = await loadLeadDealSide(ctx);
  const readiness = evaluateMatchReadiness(dealSide, {
    buyer_budget_min: contact.buyer_budget_min,
    buyer_budget_max: contact.buyer_budget_max,
    buyer_bedrooms_wanted: contact.buyer_bedrooms_wanted,
    buyer_area_preference: contact.buyer_area_preference,
  });
  if (!readiness.readyToMatch) {
    return toolFailure(readiness.guidance, {
      readiness: readiness.statusLabel,
      missing: readiness.missing,
    });
  }

  const matches = await findPropertyMatches({
    clientId: ctx.clientId,
    contact,
    limit: input.limit,
    excludeListingIds: input.exclude_listing_ids,
  });

  if (!matches.length) {
    return toolSuccess({
      count: 0,
      matches: [],
      note: "No available listings matched these requirements. Consider widening budget or area after confirming with the customer.",
    });
  }

  return toolSuccess({
    count: matches.length,
    matches,
    note: "Recommend at most 3 properties in WhatsApp. Describe only facts returned here — never invent photos, prices or availability.",
  });
}

export async function executeBuyerRequirementsUpdate(
  ctx: ToolExecutionContext,
  input: {
    budget_min?: number;
    budget_max?: number;
    bedrooms_wanted?: number;
    area_preference?: string;
    timeline?: string;
    confidence: number;
    evidence?: string;
  }
): Promise<ToolResult> {
  if (!ctx.contactId) {
    return toolFailure("No contact record exists yet; buyer requirements cannot be saved.");
  }
  if (input.confidence < 0.6) {
    return toolFailure(
      "Confidence is below 0.6. Ask the customer to clarify instead of writing uncertain CRM data."
    );
  }

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  const applied: string[] = [];
  if (input.budget_min != null) {
    patch.buyer_budget_min = input.budget_min;
    applied.push("budget_min");
  }
  if (input.budget_max != null) {
    patch.buyer_budget_max = input.budget_max;
    applied.push("budget_max");
  }
  if (input.bedrooms_wanted != null) {
    patch.buyer_bedrooms_wanted = input.bedrooms_wanted;
    applied.push("bedrooms");
  }
  if (input.area_preference?.trim()) {
    patch.buyer_area_preference = input.area_preference.trim();
    applied.push("area");
  }
  if (input.timeline?.trim()) {
    patch.buyer_timeline = input.timeline.trim();
    applied.push("timeline");
  }
  if (!applied.length) {
    return toolFailure("Provide at least one requirement field to update.");
  }

  if (ctx.testMode) {
    return toolSuccess({ simulated: true, applied, evidence: input.evidence ?? null });
  }

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("contacts")
    .update(patch)
    .eq("id", ctx.contactId)
    .eq("client_id", ctx.clientId);
  if (error) return toolFailure(`Failed to update buyer requirements: ${error.message}`);

  const dealSide = await loadLeadDealSide(ctx);
  const refreshed = await loadBuyerMatchContact({ clientId: ctx.clientId, contactId: ctx.contactId });
  const readiness = evaluateMatchReadiness(dealSide, {
    buyer_budget_min: refreshed?.buyer_budget_min ?? null,
    buyer_budget_max: refreshed?.buyer_budget_max ?? null,
    buyer_bedrooms_wanted: refreshed?.buyer_bedrooms_wanted ?? null,
    buyer_area_preference: refreshed?.buyer_area_preference ?? null,
    buyer_timeline: input.timeline?.trim() ?? null,
  });

  await logReActivity({
    leadId: ctx.leadId,
    clientId: ctx.clientId,
    actor: AGENT_ACTOR,
    summary: `Buyer requirements updated: ${applied.join(", ")}`,
    kind: "requirements_updated",
  }).catch(() => null);

  return toolSuccess({
    applied,
    readiness: readiness.statusLabel,
    ready_to_match: readiness.readyToMatch,
    missing: readiness.missing,
    evidence: input.evidence ?? null,
  });
}

export async function executeListingSendMatch(
  ctx: ToolExecutionContext,
  input: { listing_id: string; note?: string }
): Promise<ToolResult> {
  if (!ctx.contactId) {
    return toolFailure("No contact record exists, so a property alert cannot be sent.");
  }

  const listing = await getListingForClient({ clientId: ctx.clientId, listingId: input.listing_id });
  if (!listing) return toolFailure("Listing not found for this company.");
  if (listing.status !== "available") {
    return toolFailure("This listing is not available to send to the customer.");
  }

  const supabase = createAdminClient();
  const { data: contact } = await supabase
    .from("contacts")
    .select("id, name, phone, interested_listing_ids")
    .eq("id", ctx.contactId)
    .eq("client_id", ctx.clientId)
    .maybeSingle();
  if (!contact?.phone) {
    return toolFailure("Contact has no phone number for WhatsApp delivery.");
  }

  if (ctx.testMode) {
    return toolSuccess({
      simulated: true,
      listing_id: input.listing_id,
      note: input.note ?? null,
    });
  }

  await notifyPropertyMatch({
    clientId: ctx.clientId,
    to: contact.phone as string,
    contactName: (contact.name as string | null) ?? null,
    listing,
    leadId: ctx.leadId,
  });

  const nextIds = appendInterestedListingIds(contact.interested_listing_ids, input.listing_id);
  await supabase
    .from("contacts")
    .update({ interested_listing_ids: nextIds, updated_at: new Date().toISOString() })
    .eq("id", contact.id);

  await logReActivity({
    leadId: ctx.leadId,
    clientId: ctx.clientId,
    actor: AGENT_ACTOR,
    summary: "Property sent to client",
    kind: "property_sent",
  }).catch(() => null);

  return toolSuccess(
    {
      sent: true,
      listing_id: input.listing_id,
      listing_label: summarizeListingForAgent(listing).label,
      note: input.note ?? null,
    },
    { type: "listing_match_send", id: input.listing_id }
  );
}
