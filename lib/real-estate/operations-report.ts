import { createAdminClient } from "@/lib/supabase/admin";
import { listingLabel } from "@/lib/real-estate/helpers";
import {
  isClosedListingStatus,
  isManagedListing,
  LISTING_TYPE_LABEL,
} from "@/lib/real-estate/listings";
import { QUALIFIED_LEAD_STATUSES } from "@/lib/sales/company-leads-metrics";
import { sourceTypeFromLeadSource, reSourceLabel } from "@/lib/real-estate/marketing";

export type OperationsRange = { from: string; to: string };

export type OperationsReport = {
  range: OperationsRange;
  stock: {
    sale: number;
    rental: number;
    new_development: number;
    property_management: number;
    available: number;
    reserved: number;
    underOffer: number;
    rented: number;
    sold: number;
    underManagement: number;
    pendingApproval: number;
  };
  enquiries: {
    total: number;
    qualified: number;
    bySource: Array<{ source: string; label: string; count: number }>;
  };
  viewings: {
    scheduled: number;
    completed: number;
    withFeedback: number;
  };
  conversions: {
    enquiryToQualified: number | null;
    enquiryToViewing: number | null;
    viewingToOffer: number | null;
    enquiryToWon: number | null;
  };
  popularProperties: Array<{
    listingId: string;
    label: string;
    type: string;
    status: string;
    enquiries: number;
    viewings: number;
    offers: number;
  }>;
};

function pct(part: number, whole: number): number | null {
  if (whole <= 0) return null;
  return Math.round((part / whole) * 1000) / 10;
}

export async function getRealEstateOperationsReport(
  clientId: string,
  range: OperationsRange
): Promise<OperationsReport> {
  const supabase = createAdminClient();
  const fromIso = new Date(range.from).toISOString();
  const toIso = new Date(range.to).toISOString();

  const [{ data: listings }, { data: leads }, { data: viewings }, { data: offers }] = await Promise.all([
    supabase
      .from("listings")
      .select("id, address, suburb, external_reference, transaction_type, status, approval_status")
      .eq("client_id", clientId),
    supabase
      .from("leads")
      .select("id, source, status, linked_listing_id, contact_id, created_at")
      .eq("client_id", clientId)
      .gte("created_at", fromIso)
      .lt("created_at", toIso)
      .or("is_archived.is.null,is_archived.eq.false")
      .limit(4000),
    supabase
      .from("viewings")
      .select("id, listing_id, contact_id, status, feedback_text, scheduled_at")
      .gte("scheduled_at", fromIso)
      .lt("scheduled_at", toIso)
      .limit(4000),
    supabase
      .from("real_estate_offers")
      .select("id, listing_id, lead_id, status")
      .eq("client_id", clientId)
      .limit(4000),
  ]);

  const listingIds = new Set((listings ?? []).map((l) => l.id as string));
  const scopedViewings = (viewings ?? []).filter((v) => listingIds.has(v.listing_id as string));
  const listingRows = listings ?? [];
  const leadRows = leads ?? [];

  const stock = {
    sale: listingRows.filter((l) => l.transaction_type === "sale").length,
    rental: listingRows.filter((l) => l.transaction_type === "rental").length,
    new_development: listingRows.filter((l) => l.transaction_type === "new_development").length,
    property_management: listingRows.filter((l) => isManagedListing(l)).length,
    available: listingRows.filter((l) => l.status === "available").length,
    reserved: listingRows.filter((l) => l.status === "reserved").length,
    underOffer: listingRows.filter((l) => l.status === "under_offer").length,
    rented: listingRows.filter((l) => l.status === "let" || l.status === "rented").length,
    sold: listingRows.filter((l) => l.status === "sold").length,
    underManagement: listingRows.filter((l) => l.status === "under_management").length,
    pendingApproval: listingRows.filter((l) => l.approval_status === "pending_approval").length,
  };

  const sourceCounts = new Map<string, number>();
  for (const lead of leadRows) {
    const source = sourceTypeFromLeadSource(lead.source as string | null);
    sourceCounts.set(source, (sourceCounts.get(source) ?? 0) + 1);
  }

  const qualified = leadRows.filter((l) =>
    QUALIFIED_LEAD_STATUSES.has(String(l.status))
  ).length;
  const won = leadRows.filter((l) => l.status === "WON").length;

  const viewingContacts = new Set(
    scopedViewings
      .filter((v) => v.status === "scheduled" || v.status === "completed")
      .map((v) => v.contact_id as string)
  );
  const leadsWithViewing = leadRows.filter((l) => l.contact_id && viewingContacts.has(l.contact_id as string)).length;

  const offerLeadIds = new Set(
    (offers ?? [])
      .filter((o) => o.status !== "draft" && o.status !== "withdrawn")
      .map((o) => o.lead_id as string | null)
      .filter(Boolean)
  );
  const completedViewings = scopedViewings.filter((v) => v.status === "completed").length;

  const leadsWithOffer = leadRows.filter((l) => offerLeadIds.has(l.id as string)).length;

  const byListing = new Map<
    string,
    { enquiries: number; viewings: number; offers: number }
  >();
  function bump(id: string, key: "enquiries" | "viewings" | "offers") {
    const row = byListing.get(id) ?? { enquiries: 0, viewings: 0, offers: 0 };
    row[key] += 1;
    byListing.set(id, row);
  }
  for (const lead of leadRows) {
    if (lead.linked_listing_id) bump(lead.linked_listing_id as string, "enquiries");
  }
  for (const viewing of scopedViewings) bump(viewing.listing_id as string, "viewings");
  for (const offer of offers ?? []) {
    if (offer.listing_id) bump(offer.listing_id as string, "offers");
  }

  const popularProperties = [...byListing.entries()]
    .map(([listingId, counts]) => {
      const listing = listingRows.find((l) => l.id === listingId);
      return {
        listingId,
        label: listing
          ? listingLabel({
              address: listing.address as string | null,
              suburb: listing.suburb as string | null,
              external_reference: listing.external_reference as string | null,
            })
          : listingId,
        type: listing
          ? LISTING_TYPE_LABEL[listing.transaction_type as keyof typeof LISTING_TYPE_LABEL] ??
            String(listing.transaction_type)
          : "—",
        status: String(listing?.status ?? "—"),
        ...counts,
      };
    })
    .sort((a, b) => b.enquiries + b.viewings - (a.enquiries + a.viewings))
    .slice(0, 12);

  return {
    range,
    stock,
    enquiries: {
      total: leadRows.length,
      qualified,
      bySource: [...sourceCounts.entries()]
        .map(([source, count]) => ({ source, label: reSourceLabel(source), count }))
        .sort((a, b) => b.count - a.count),
    },
    viewings: {
      scheduled: scopedViewings.filter((v) => v.status === "scheduled").length,
      completed: completedViewings,
      withFeedback: scopedViewings.filter((v) => Boolean(v.feedback_text)).length,
    },
    conversions: {
      enquiryToQualified: pct(qualified, leadRows.length),
      enquiryToViewing: pct(leadsWithViewing, leadRows.length),
      viewingToOffer: pct(leadsWithOffer, Math.max(leadsWithViewing, completedViewings)),
      enquiryToWon: pct(won, leadRows.length),
    },
    popularProperties,
  };
}
