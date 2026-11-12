import { fillVisitDays, type DailyPoint } from "@/lib/real-estate/agent-listing-pages/analytics";

export type DeskShare = {
  id: string;
  listingId: string;
  status: string;
  address: string | null;
  suburb: string | null;
};

export type DeskCount = {
  shareId: string;
  eventType: string;
  botClass: string;
  count: number;
  day?: string;
};

export type DeskListing = {
  id: string;
  address: string | null;
  suburb: string | null;
};

export type MarketingDeskRow = {
  id: string;
  listingId: string;
  title: string;
  meta: string | null;
  line: string;
  href: string;
  action: string;
  attention: boolean;
  visits: number | null;
  series: number[];
};

export type MarketingDesk = {
  visits: number;
  enquiries: number;
  viewingRequests: number;
  whatsappClicks: number;
  activeLinks: number;
  series: DailyPoint[];
  quiet: MarketingDeskRow[];
  unlinked: MarketingDeskRow[];
};

function propertyTitle(address: string | null, suburb: string | null): string {
  return address?.trim() || suburb?.trim() || "Listing";
}

function humanVisitDays(counts: DeskCount[]): DailyPoint[] {
  const map = new Map<string, number>();
  for (const row of counts) {
    if (!row.day || row.eventType !== "page_view" || row.botClass !== "human") continue;
    const day = row.day.slice(0, 10);
    map.set(day, (map.get(day) ?? 0) + (Number.isFinite(row.count) ? row.count : 0));
  }
  return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([day, visits]) => ({ day, visits }));
}

/** Last-30-day desk: totals, the day line, links with visits and no enquiry, and marketable listings with no active link. */
export function buildMarketingDesk(input: {
  shares: DeskShare[];
  counts: DeskCount[];
  listings: DeskListing[];
  range?: { from: string; to: string };
}): MarketingDesk {
  const activeIds = new Set(input.shares.filter((share) => share.status === "active").map((share) => share.id));
  const byShare = new Map<string, { visits: number; enquiries: number }>();
  const activeCounts = input.counts.filter((row) => activeIds.has(row.shareId));
  let visits = 0;
  let enquiries = 0;
  let viewingRequests = 0;
  let whatsappClicks = 0;
  for (const row of activeCounts) {
    const count = Number.isFinite(row.count) ? row.count : 0;
    if (row.eventType === "page_view" && row.botClass === "human") {
      visits += count;
      const current = byShare.get(row.shareId) ?? { visits: 0, enquiries: 0 };
      current.visits += count;
      byShare.set(row.shareId, current);
    } else if (row.eventType === "enquiry_submit") {
      enquiries += count;
      const current = byShare.get(row.shareId) ?? { visits: 0, enquiries: 0 };
      current.enquiries += count;
      byShare.set(row.shareId, current);
    } else if (row.eventType === "viewing_request") {
      viewingRequests += count;
    } else if (row.eventType === "whatsapp_click") {
      whatsappClicks += count;
    }
  }

  const series = fillVisitDays(input.range?.from, input.range?.to, humanVisitDays(activeCounts));
  const shareLine = (shareId: string) => {
    const own = new Map(humanVisitDays(activeCounts.filter((row) => row.shareId === shareId)).map((point) => [point.day, point.visits]));
    return series.map((point) => own.get(point.day) ?? 0);
  };

  const active = input.shares.filter((share) => share.status === "active");
  const linked = new Set(active.map((share) => share.listingId));
  const quiet = active
    .map((share) => ({ share, stats: byShare.get(share.id) ?? { visits: 0, enquiries: 0 } }))
    .filter((row) => row.stats.visits > 0 && row.stats.enquiries === 0)
    .sort((a, b) => b.stats.visits - a.stats.visits)
    .slice(0, 2)
    .map((row) => ({
      id: row.share.id,
      listingId: row.share.listingId,
      title: propertyTitle(row.share.address, row.share.suburb),
      meta: row.share.address?.trim() ? row.share.suburb?.trim() || null : null,
      line: `${row.stats.visits} ${row.stats.visits === 1 ? "visit" : "visits"}. No enquiry yet.`,
      href: `/sales/shared-listings/${row.share.id}`,
      action: "Analytics",
      attention: true,
      visits: row.stats.visits,
      series: shareLine(row.share.id),
    }));

  const unlinked = input.listings
    .filter((listing) => !linked.has(listing.id))
    .slice(0, 2)
    .map((listing) => ({
      id: listing.id,
      listingId: listing.id,
      title: propertyTitle(listing.address, listing.suburb),
      meta: listing.address?.trim() ? listing.suburb?.trim() || null : "On the market",
      line: "No personal link yet.",
      href: `/sales/listings/${listing.id}`,
      action: "Open property",
      attention: false,
      visits: null,
      series: [],
    }));

  return { visits, enquiries, viewingRequests, whatsappClicks, activeLinks: active.length, series, quiet, unlinked };
}

export function marketingDeskHasContent(desk: MarketingDesk | null): boolean {
  if (!desk) return false;
  return desk.activeLinks > 0 || desk.quiet.length > 0 || desk.unlinked.length > 0;
}
