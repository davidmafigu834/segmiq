import { createAdminClient } from "@/lib/supabase/admin";
import { listingLabel } from "@/lib/real-estate/helpers";
import {
  isManagedListing,
  LISTING_TYPE_LABEL,
} from "@/lib/real-estate/listings";
import { QUALIFIED_LEAD_STATUSES } from "@/lib/sales/company-leads-metrics";
import { sourceTypeFromLeadSource, reSourceLabel } from "@/lib/real-estate/marketing";
import { RE_TRANSACTION_ACTIVE_STATUSES } from "@/lib/real-estate/transactions";
import { decimalToCents, reportSaleOnce } from "@/lib/real-estate/agency-operations";
import { chunk } from "@/lib/real-estate/paging";

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
  transactions: {
    inProgress: number;
    completed: number;
    fallenThrough: number;
    commissionTotal: number;
  };
  sales: {
    completedCount: number;
    totalAgreedValue: number;
    totalAgreedCents: number;
    duplicatesIgnored: number;
    commissionTotal: number;
  };
  commission: CommissionLedgerSummary;
  definitions: {
    stock: string;
    enquiries: string;
    viewings: string;
    offers: string;
    completedSales: string;
    commission: string;
  };
  truncated: boolean;
};

function pct(part: number, whole: number): number | null {
  if (whole <= 0) return null;
  return Math.round((part / whole) * 1000) / 10;
}

function legacyCommissionCents(row: {
  listing_agent_commission_amount?: number | string | null;
  selling_agent_commission_amount?: number | string | null;
}): number {
  return (decimalToCents(row.listing_agent_commission_amount) ?? 0) + (decimalToCents(row.selling_agent_commission_amount) ?? 0);
}

export type ReportCommissionRow = {
  transaction_id: string;
  gross_cents: number | string;
  status: string;
  provenance?: string | null;
  verified_received_cents?: number | string | null;
};

export type CommissionLedgerSummary = {
  /** Gross commission from the ledger for transactions completed in the period. */
  grossCents: number;
  verifiedReceivedCents: number;
  /** Part of grossCents that comes from unverified legacy transaction fields. */
  legacyUnverifiedCents: number;
  /** Completed transactions with no commission at all, ledger or legacy. */
  transactionsWithoutCommission: number;
  ledgerAvailable: boolean;
};

/**
 * One commission figure per transaction. A live ledger row wins over a legacy backfill row,
 * cancelled rows never count, and legacy transaction fields are used only when a transaction
 * has no ledger row.
 */
export function ledgerCommissionSummary(
  transactions: ReadonlyArray<ReportTransactionRow>,
  commissions: ReadonlyArray<ReportCommissionRow> | null
): CommissionLedgerSummary {
  const byTxn = new Map<string, ReportCommissionRow[]>();
  for (const row of commissions ?? []) {
    if (row.status === "cancelled") continue;
    const list = byTxn.get(row.transaction_id) ?? [];
    list.push(row);
    byTxn.set(row.transaction_id, list);
  }
  const summary: CommissionLedgerSummary = {
    grossCents: 0,
    verifiedReceivedCents: 0,
    legacyUnverifiedCents: 0,
    transactionsWithoutCommission: 0,
    ledgerAvailable: commissions != null,
  };
  const seen = new Set<string>();
  for (const txn of transactions) {
    if (seen.has(txn.id)) continue;
    seen.add(txn.id);
    const rows = byTxn.get(txn.id) ?? [];
    const live = rows.filter((row) => row.provenance !== "legacy_transaction_fields");
    const chosen = live.length ? live : rows;
    if (chosen.length) {
      for (const row of chosen) {
        const gross = Number(row.gross_cents) || 0;
        summary.grossCents += gross;
        summary.verifiedReceivedCents += Number(row.verified_received_cents ?? 0) || 0;
        if (!live.length) summary.legacyUnverifiedCents += gross;
      }
      continue;
    }
    const legacy = legacyCommissionCents(txn);
    if (legacy > 0) {
      summary.grossCents += legacy;
      summary.legacyUnverifiedCents += legacy;
    } else {
      summary.transactionsWithoutCommission += 1;
    }
  }
  return summary;
}

export type ReportListingRow = {
  id: string;
  address?: string | null;
  suburb?: string | null;
  external_reference?: string | null;
  transaction_type?: string | null;
  status?: string | null;
  approval_status?: string | null;
};

export type ReportLeadRow = {
  id: string;
  source?: string | null;
  status?: string | null;
  linked_listing_id?: string | null;
  contact_id?: string | null;
};

export type ReportViewingRow = {
  id: string;
  listing_id: string;
  contact_id?: string | null;
  status?: string | null;
  feedback_text?: string | null;
};

export type ReportOfferRow = {
  id: string;
  listing_id?: string | null;
  submitted_at?: string | null;
};

export type ReportTransactionRow = {
  id: string;
  status?: string | null;
  agreed_price?: number | string | null;
  completed_at?: string | null;
  fallen_through_at?: string | null;
  lead_id?: string | null;
  listing_agent_commission_amount?: number | string | null;
  selling_agent_commission_amount?: number | string | null;
};

const REPORT_DEFINITIONS = {
  stock: "Current listing snapshot. Not limited to the selected period.",
  enquiries: "Leads created in the selected period.",
  viewings: "Viewings whose scheduled date falls in the selected period.",
  offers: "Offers submitted in the selected period.",
  completedSales: "Transactions whose completion date falls in the selected period. Each transaction is counted once.",
  commission:
    "Gross commission from the commission ledger for transactions completed in the period, one figure per transaction. This is not cash received: verified receipts are shown separately and legacy amounts are unverified.",
} as const;

/** Period maths for rows already scoped to one organisation. Stock is the current snapshot. */
export function aggregateOperationsReport(input: {
  range: OperationsRange;
  listings: ReportListingRow[];
  leads: ReportLeadRow[];
  viewings: ReportViewingRow[];
  offers: ReportOfferRow[];
  transactions: ReportTransactionRow[];
  /** null when the commission ledger is not deployed. */
  commissions?: ReportCommissionRow[] | null;
  fromMs: number;
  toMs: number;
  truncated: boolean;
}): OperationsReport {
  const inWindow = (iso: string | null | undefined) => {
    if (!iso) return false;
    const ms = new Date(iso).getTime();
    return ms >= input.fromMs && ms < input.toMs;
  };
  const listingRows = input.listings;
  const leadRows = input.leads;
  const scopedViewings = input.viewings;
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

  const qualified = leadRows.filter((l) => QUALIFIED_LEAD_STATUSES.has(String(l.status))).length;

  const usedViewingIds = new Set<string>();
  let leadsWithViewing = 0;
  for (const lead of leadRows) {
    const match = scopedViewings.find((v) => {
      if (usedViewingIds.has(v.id)) return false;
      if (!lead.contact_id || v.contact_id !== lead.contact_id) return false;
      if (lead.linked_listing_id && v.listing_id !== lead.linked_listing_id) return false;
      return v.status === "scheduled" || v.status === "completed";
    });
    if (match) {
      usedViewingIds.add(match.id);
      leadsWithViewing += 1;
    }
  }

  const submittedOffers = input.offers.filter((o) => inWindow(o.submitted_at));
  const completedViewings = scopedViewings.filter((v) => v.status === "completed").length;

  const byListing = new Map<string, { enquiries: number; viewings: number; offers: number }>();
  function bump(id: string, key: "enquiries" | "viewings" | "offers") {
    const row = byListing.get(id) ?? { enquiries: 0, viewings: 0, offers: 0 };
    row[key] += 1;
    byListing.set(id, row);
  }
  for (const lead of leadRows) {
    if (lead.linked_listing_id) bump(lead.linked_listing_id, "enquiries");
  }
  for (const viewing of scopedViewings) {
    if (viewing.status !== "cancelled") bump(viewing.listing_id, "viewings");
  }
  for (const offer of submittedOffers) {
    if (offer.listing_id) bump(offer.listing_id, "offers");
  }

  const popularProperties = [...byListing.entries()]
    .map(([listingId, counts]) => {
      const listing = listingRows.find((l) => l.id === listingId);
      return {
        listingId,
        label: listing
          ? listingLabel({
              address: listing.address ?? null,
              suburb: listing.suburb ?? null,
              external_reference: listing.external_reference ?? null,
            })
          : listingId,
        type: listing
          ? LISTING_TYPE_LABEL[listing.transaction_type as keyof typeof LISTING_TYPE_LABEL] ??
            String(listing.transaction_type ?? "—")
          : "—",
        status: String(listing?.status ?? "—"),
        ...counts,
      };
    })
    .sort((a, b) => b.enquiries + b.viewings - (a.enquiries + a.viewings))
    .slice(0, 12);

  const activeStatusSet = new Set<string>(RE_TRANSACTION_ACTIVE_STATUSES);
  const txnRows = input.transactions;
  const inProgressTxns = txnRows.filter((t) => activeStatusSet.has(String(t.status)));
  const completedInRange = txnRows.filter((t) => t.status === "completed" && inWindow(t.completed_at));
  const fallenThroughTxns = txnRows.filter(
    (t) => t.status === "fallen_through" && inWindow(t.fallen_through_at)
  );
  const completedLeadIds = new Set(
    completedInRange.map((t) => t.lead_id).filter((id): id is string => Boolean(id))
  );
  const commission = ledgerCommissionSummary(completedInRange, input.commissions ?? null);
  const salesCommission = commission.grossCents / 100;
  const sale = reportSaleOnce(
    completedInRange.map((t) => ({ transactionId: t.id, agreedCents: decimalToCents(t.agreed_price) ?? 0 }))
  );

  return {
    range: input.range,
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
      viewingToOffer: pct(submittedOffers.length, completedViewings),
      enquiryToWon: pct(completedLeadIds.size, leadRows.length),
    },
    popularProperties,
    transactions: {
      inProgress: inProgressTxns.length,
      completed: completedInRange.length,
      fallenThrough: fallenThroughTxns.length,
      commissionTotal: salesCommission,
    },
    sales: {
      completedCount: sale.transactions,
      totalAgreedValue: sale.volumeCents / 100,
      totalAgreedCents: sale.volumeCents,
      duplicatesIgnored: sale.duplicatesIgnored,
      commissionTotal: salesCommission,
    },
    commission,
    definitions: { ...REPORT_DEFINITIONS },
    truncated: input.truncated,
  };
}

export async function getRealEstateOperationsReport(
  clientId: string,
  range: OperationsRange
): Promise<OperationsReport> {
  const supabase = createAdminClient();
  const fromIso = new Date(range.from).toISOString();
  const toIso = new Date(range.to).toISOString();

  const ROW_CAP = 5000;
  const offerSelect = "id, listing_id, submitted_at";
  const txnSelect =
    "id, status, agreed_price, completed_at, fallen_through_at, lead_id, listing_agent_commission_amount, selling_agent_commission_amount";
  const [listingsRes, leadsRes, viewingsRes, submittedOffersRes, activeTxnsRes, completedTxnsRes, fallenTxnsRes] =
    await Promise.all([
      supabase
        .from("listings")
        .select("id, address, suburb, external_reference, transaction_type, status, approval_status", {
          count: "exact",
        })
        .eq("client_id", clientId)
        .limit(ROW_CAP),
      supabase
        .from("leads")
        .select("id, source, status, linked_listing_id, contact_id, created_at", { count: "exact" })
        .eq("client_id", clientId)
        .gte("created_at", fromIso)
        .lt("created_at", toIso)
        .or("is_archived.is.null,is_archived.eq.false")
        .limit(ROW_CAP),
      supabase
        .from("viewings")
        .select("id, listing_id, contact_id, status, feedback_text, scheduled_at, client_id", { count: "exact" })
        .eq("client_id", clientId)
        .gte("scheduled_at", fromIso)
        .lt("scheduled_at", toIso)
        .limit(ROW_CAP),
      supabase
        .from("real_estate_offers")
        .select(offerSelect, { count: "exact" })
        .eq("client_id", clientId)
        .gte("submitted_at", fromIso)
        .lt("submitted_at", toIso)
        .limit(ROW_CAP),
      supabase
        .from("real_estate_transactions")
        .select(txnSelect, { count: "exact" })
        .eq("client_id", clientId)
        .in("status", ["draft", "pending_compliance", "in_progress"])
        .limit(ROW_CAP),
      supabase
        .from("real_estate_transactions")
        .select(txnSelect, { count: "exact" })
        .eq("client_id", clientId)
        .gte("completed_at", fromIso)
        .lt("completed_at", toIso)
        .limit(ROW_CAP),
      supabase
        .from("real_estate_transactions")
        .select(txnSelect, { count: "exact" })
        .eq("client_id", clientId)
        .gte("fallen_through_at", fromIso)
        .lt("fallen_through_at", toIso)
        .limit(ROW_CAP),
    ]);

  for (const [label, result] of [
    ["listings", listingsRes],
    ["enquiries", leadsRes],
    ["submitted offers", submittedOffersRes],
    ["active transactions", activeTxnsRes],
    ["completed transactions", completedTxnsRes],
    ["fallen-through transactions", fallenTxnsRes],
  ] as const) {
    if (result.error) throw new Error(`Operations report ${label} failed: ${result.error.message}`);
  }

  let viewings = viewingsRes.data;
  let viewingsTruncated = (viewingsRes.count ?? 0) > (viewingsRes.data?.length ?? 0);
  if (viewingsRes.error && /client_id|schema cache/i.test(viewingsRes.error.message)) {
    const { data: listingIds, error: listingError } = await supabase
      .from("listings")
      .select("id")
      .eq("client_id", clientId);
    if (listingError) throw new Error(`Operations report viewings failed: ${listingError.message}`);
    const ids = (listingIds ?? []).map((l) => l.id as string);
    const fallback = ids.length
      ? await supabase
          .from("viewings")
          .select("id, listing_id, contact_id, status, feedback_text, scheduled_at", { count: "exact" })
          .in("listing_id", ids)
          .gte("scheduled_at", fromIso)
          .lt("scheduled_at", toIso)
          .limit(ROW_CAP)
      : { data: [], count: 0, error: null };
    if (fallback.error) throw new Error(`Operations report viewings failed: ${fallback.error.message}`);
    viewings = fallback.data;
    viewingsTruncated = (fallback.count ?? 0) > (fallback.data?.length ?? 0);
  } else if (viewingsRes.error) {
    throw new Error(`Operations report viewings failed: ${viewingsRes.error.message}`);
  }

  const listings = listingsRes.data ?? [];
  const leads = leadsRes.data ?? [];
  const offers = submittedOffersRes.data ?? [];
  const txnById = new Map<string, ReportTransactionRow>();
  for (const row of [...(activeTxnsRes.data ?? []), ...(completedTxnsRes.data ?? []), ...(fallenTxnsRes.data ?? [])]) {
    txnById.set(row.id as string, row as ReportTransactionRow);
  }
  const txns = [...txnById.values()];
  const completedIds = (completedTxnsRes.data ?? []).map((row) => row.id as string);
  let commissions: ReportCommissionRow[] | null = [];
  for (const part of chunk(completedIds, 200)) {
    const { data, error } = await supabase
      .from("real_estate_commissions")
      .select("*")
      .eq("client_id", clientId)
      .in("transaction_id", part);
    if (error) {
      if (error.code === "42P01" || /does not exist|schema cache/i.test(error.message)) {
        commissions = null;
        break;
      }
      throw new Error(`Operations report commissions failed: ${error.message}`);
    }
    commissions.push(...((data ?? []) as ReportCommissionRow[]));
  }
  const truncated =
    viewingsTruncated ||
    (listingsRes.count ?? 0) > listings.length ||
    (leadsRes.count ?? 0) > leads.length ||
    (submittedOffersRes.count ?? 0) > offers.length ||
    (activeTxnsRes.count ?? 0) > (activeTxnsRes.data?.length ?? 0) ||
    (completedTxnsRes.count ?? 0) > (completedTxnsRes.data?.length ?? 0) ||
    (fallenTxnsRes.count ?? 0) > (fallenTxnsRes.data?.length ?? 0);

  return aggregateOperationsReport({
    range,
    listings: listings as ReportListingRow[],
    leads: leads as ReportLeadRow[],
    viewings: (viewings ?? []) as ReportViewingRow[],
    offers: offers as ReportOfferRow[],
    transactions: txns,
    commissions,
    fromMs: new Date(fromIso).getTime(),
    toMs: new Date(toIso).getTime(),
    truncated,
  });
}
