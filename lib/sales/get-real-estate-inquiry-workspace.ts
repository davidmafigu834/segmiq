import { createAdminClient } from "@/lib/supabase/admin";
import { appendInterestedListingIds, listingLabel, type BuyerMatchContact } from "@/lib/real-estate/helpers";
import { evaluateListingMatch } from "@/lib/real-estate/matching";
import {
  formatBudgetRange,
  formatRequirementSummary,
  isDemandSide,
  isSupplySide,
  requirementCompleteness,
  type RequirementFields,
} from "@/lib/real-estate/requirements";
import {
  markedInterestedFromFormData,
  primaryActionForStage,
  RE_STAGE_GUIDANCE,
  resolveRePipelineStage,
  rePipelineStageLabel,
  type RePipelineStage,
} from "@/lib/real-estate/pipeline";
import { dealSideBadgeLabel } from "@/lib/terminology";
import type { ListingRow } from "@/types";
import { getLeadAttribution } from "@/lib/real-estate/marketing-service";
import { reSourceLabel } from "@/lib/real-estate/marketing";

export type ReInquiryListingCard = {
  id: string;
  address: string | null;
  suburb: string | null;
  price: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  status: string;
  transactionType: string;
  label: string;
  priceLabel: string | null;
};

export type ReInquiryMatchCard = ReInquiryListingCard & {
  strength: string;
  matchLabel: string;
  reasons: Array<{ id: string; label: string; met: boolean }>;
};

export type ReInquiryViewingCard = {
  id: string;
  listingId: string;
  listingLabel: string;
  scheduledAt: string;
  status: string;
  agentId: string | null;
  agentName: string | null;
  feedbackText: string | null;
  feedbackSentiment: string | null;
};

export type ReInquiryWorkspace = {
  leadId: string;
  clientId: string;
  contactId: string | null;
  identity: string;
  dealSide: string | null;
  dealSideLabel: string | null;
  sourceLabel: string | null;
  phone: string | null;
  email: string | null;
  ownerId: string | null;
  ownerName: string | null;
  leadStatus: string;
  stage: RePipelineStage;
  stageLabel: string;
  guidance: string;
  primaryAction: { id: string; label: string };
  followUpAt: string | null;
  linkedListing: ReInquiryListingCard | null;
  requirements: RequirementFields & {
    propertyType: string | null;
    notes: string | null;
  };
  completeness: ReturnType<typeof requirementCompleteness>;
  requirementSummary: string | null;
  budgetLabel: string | null;
  demandSide: boolean;
  supplySide: boolean;
  interested: ReInquiryListingCard[];
  matches: ReInquiryMatchCard[];
  viewings: ReInquiryViewingCard[];
  suggestedStage: RePipelineStage | null;
  offerStatus: string | null;
  attribution: {
    sourceLabel: string;
    campaignName: string | null;
    adName: string | null;
    propertyLabel: string | null;
    capturedAt: string | null;
    referralSourceName: string | null;
    formPrequalified: boolean;
    latestSourceLabel: string | null;
  } | null;
};

function toListingCard(row: ListingRow): ReInquiryListingCard {
  const price = row.price != null ? Number(row.price) : null;
  return {
    id: row.id,
    address: row.address ?? null,
    suburb: row.suburb ?? null,
    price,
    bedrooms: row.bedrooms ?? null,
    bathrooms: row.bathrooms ?? null,
    status: row.status,
    transactionType: row.transaction_type,
    label: listingLabel(row),
    priceLabel: price != null ? `US$${price.toLocaleString("en-US")}` : null,
  };
}

export async function getRealEstateInquiryWorkspace(opts: {
  clientId: string;
  leadId: string;
}): Promise<ReInquiryWorkspace | null> {
  const supabase = createAdminClient();
  const { data: lead } = await supabase
    .from("leads")
    .select(
      "id, client_id, contact_id, name, phone, email, source, status, assigned_to_id, follow_up_date, form_data, deal_side, linked_listing_id, offer_status, project_type"
    )
    .eq("id", opts.leadId)
    .eq("client_id", opts.clientId)
    .maybeSingle();
  if (!lead) return null;

  const formData = (lead.form_data as Record<string, unknown> | null) ?? {};
  const reReq = (formData.re_requirements as Record<string, unknown> | undefined) ?? {};

  const [ownerRes, contactRes, linkedRes] = await Promise.all([
    lead.assigned_to_id
      ? supabase.from("users").select("id, name").eq("id", lead.assigned_to_id as string).maybeSingle()
      : Promise.resolve({ data: null }),
    lead.contact_id
      ? supabase
          .from("contacts")
          .select(
            "id, name, phone, email, buyer_budget_min, buyer_budget_max, buyer_bedrooms_wanted, buyer_area_preference, buyer_timeline, interested_listing_ids, notes"
          )
          .eq("id", lead.contact_id as string)
          .eq("client_id", opts.clientId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    lead.linked_listing_id
      ? supabase
          .from("listings")
          .select("*")
          .eq("id", lead.linked_listing_id as string)
          .eq("client_id", opts.clientId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const contact = contactRes.data as
    | (BuyerMatchContact & {
        buyer_timeline?: string | null;
        interested_listing_ids?: unknown;
        notes?: string | null;
        email?: string | null;
      })
    | null;

  const interestedIds = Array.isArray(contact?.interested_listing_ids)
    ? (contact!.interested_listing_ids as unknown[]).filter((id): id is string => typeof id === "string")
    : [];

  const { data: listingRows } = await supabase
    .from("listings")
    .select("*")
    .eq("client_id", opts.clientId)
    .order("updated_at", { ascending: false })
    .limit(200);
  const listings = (listingRows ?? []) as ListingRow[];
  const listingById = new Map(listings.map((l) => [l.id, l]));

  const interested = interestedIds
    .map((id) => listingById.get(id))
    .filter(Boolean)
    .map((l) => toListingCard(l as ListingRow));

  const buyer: BuyerMatchContact = {
    id: contact?.id ?? "",
    name: contact?.name ?? null,
    phone: contact?.phone ?? null,
    email: contact?.email ?? null,
    buyer_budget_min: contact?.buyer_budget_min ?? null,
    buyer_budget_max: contact?.buyer_budget_max ?? null,
    buyer_bedrooms_wanted: contact?.buyer_bedrooms_wanted ?? null,
    buyer_area_preference: contact?.buyer_area_preference ?? null,
  };

  const matches: ReInquiryMatchCard[] = [];
  if (isDemandSide(lead.deal_side as string | null) && contact) {
    for (const listing of listings) {
      if (listing.status !== "available") continue;
      const evald = evaluateListingMatch(buyer, listing);
      if (!evald) continue;
      matches.push({
        ...toListingCard(listing),
        strength: evald.strength,
        matchLabel: evald.label,
        reasons: evald.reasons,
      });
      if (matches.length >= 25) break;
    }
  }

  const listingIds = listings.map((l) => l.id);
  let viewingRows: Array<Record<string, unknown>> = [];
  if (lead.contact_id && listingIds.length > 0) {
    const { data } = await supabase
      .from("viewings")
      .select("id, listing_id, agent_id, scheduled_at, status, feedback_text, feedback_sentiment")
      .eq("contact_id", lead.contact_id as string)
      .in("listing_id", listingIds)
      .order("scheduled_at", { ascending: false })
      .limit(40);
    viewingRows = (data ?? []) as Array<Record<string, unknown>>;
  }

  const agentIds = [...new Set(viewingRows.map((v) => v.agent_id as string | null).filter(Boolean))] as string[];
  const { data: agents } = agentIds.length
    ? await supabase.from("users").select("id, name").in("id", agentIds)
    : { data: [] as { id: string; name: string | null }[] };
  const agentById = new Map((agents ?? []).map((a) => [a.id, a.name]));

  const now = Date.now();
  const viewings: ReInquiryViewingCard[] = viewingRows.map((v) => {
    const listing = listingById.get(v.listing_id as string);
    return {
      id: v.id as string,
      listingId: v.listing_id as string,
      listingLabel: listing ? listingLabel(listing) : "Listing",
      scheduledAt: v.scheduled_at as string,
      status: (v.status as string) ?? "scheduled",
      agentId: (v.agent_id as string | null) ?? null,
      agentName: v.agent_id ? agentById.get(v.agent_id as string) ?? null : null,
      feedbackText: (v.feedback_text as string | null) ?? null,
      feedbackSentiment: (v.feedback_sentiment as string | null) ?? null,
    };
  });

  const hasUpcoming = viewings.some(
    (v) => v.status === "scheduled" && new Date(v.scheduledAt).getTime() >= now
  );
  const hasCompleted = viewings.some((v) => v.status === "completed");
  const latestCompleted = viewings.find((v) => v.status === "completed");

  const reqFields: RequirementFields = {
    buyer_budget_min: contact?.buyer_budget_min ?? null,
    buyer_budget_max: contact?.buyer_budget_max ?? null,
    buyer_bedrooms_wanted: contact?.buyer_bedrooms_wanted ?? null,
    buyer_area_preference: contact?.buyer_area_preference ?? null,
    buyer_timeline: contact?.buyer_timeline ?? null,
  };

  const stage = resolveRePipelineStage({
    leadStatus: lead.status as string,
    offerStatus: lead.offer_status as string | null,
    hasInterestedListing: interestedIds.length > 0,
    hasLinkedListing: Boolean(lead.linked_listing_id),
    hasUpcomingViewing: hasUpcoming,
    hasCompletedViewing: hasCompleted,
    markedInterested: markedInterestedFromFormData(formData),
  });

  const suggestedStage =
    stage === "viewing_completed" && latestCompleted?.feedbackSentiment === "positive"
      ? ("interested" as RePipelineStage)
      : null;

  const source = String(lead.source ?? "").replace(/_/g, " ");
  const attr = await getLeadAttribution({ clientId: opts.clientId, leadId: opts.leadId });
  let attrPropertyLabel: string | null = null;
  if (attr?.listingId) {
    if (linkedRes.data && (linkedRes.data as ListingRow).id === attr.listingId) {
      attrPropertyLabel = listingLabel(linkedRes.data as ListingRow);
    } else {
      const { data: attrListing } = await supabase
        .from("listings")
        .select("address, suburb, external_reference")
        .eq("id", attr.listingId)
        .eq("client_id", opts.clientId)
        .maybeSingle();
      if (attrListing) attrPropertyLabel = listingLabel(attrListing);
    }
  }

  return {
    leadId: lead.id as string,
    clientId: opts.clientId,
    contactId: (lead.contact_id as string | null) ?? null,
    identity: (lead.name as string | null) || (contact?.name as string | null) || "Inquiry",
    dealSide: (lead.deal_side as string | null) ?? null,
    dealSideLabel: dealSideBadgeLabel(lead.deal_side as string | null),
    sourceLabel: attr?.sourceLabel ?? source || null,
    phone: (lead.phone as string | null) || contact?.phone || null,
    email: (lead.email as string | null) || contact?.email || null,
    ownerId: (lead.assigned_to_id as string | null) ?? null,
    ownerName: (ownerRes.data as { name?: string | null } | null)?.name ?? null,
    leadStatus: lead.status as string,
    stage,
    stageLabel: rePipelineStageLabel(stage),
    guidance: RE_STAGE_GUIDANCE[stage],
    primaryAction: primaryActionForStage(stage),
    followUpAt: (lead.follow_up_date as string | null) ?? null,
    linkedListing: linkedRes.data ? toListingCard(linkedRes.data as ListingRow) : null,
    requirements: {
      ...reqFields,
      propertyType: (typeof reReq.propertyType === "string" ? reReq.propertyType : null) ||
        (lead.project_type as string | null) ||
        null,
      notes: typeof reReq.notes === "string" ? reReq.notes : null,
    },
    completeness: requirementCompleteness(reqFields),
    requirementSummary: formatRequirementSummary(reqFields),
    budgetLabel: formatBudgetRange(reqFields.buyer_budget_min, reqFields.buyer_budget_max),
    demandSide: isDemandSide(lead.deal_side as string | null),
    supplySide: isSupplySide(lead.deal_side as string | null),
    interested,
    matches,
    viewings,
    suggestedStage,
    offerStatus: (lead.offer_status as string | null) ?? null,
    attribution: attr
      ? {
          sourceLabel: attr.sourceLabel,
          campaignName: attr.campaignName,
          adName: attr.adName,
          propertyLabel: attrPropertyLabel,
          capturedAt: attr.capturedAt,
          referralSourceName: attr.referralSourceName,
          formPrequalified: attr.formPrequalified,
          latestSourceLabel: attr.latestSourceType ? reSourceLabel(attr.latestSourceType) : null,
        }
      : null,
  };
}

export { appendInterestedListingIds };
