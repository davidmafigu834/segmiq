export type MarketingEventKind =
  | "page_view"
  | "engaged_view"
  | "whatsapp_click"
  | "enquiry_submit"
  | "viewing_request"
  | "share_link_created"
  | "share_link_revoked"
  | "whatsapp_conversation_confirmed";

export type CountedEvent = {
  eventType: MarketingEventKind | string;
  botClass: "human" | "preview" | "automation" | "unknown" | string;
  count: number;
  sourceHint?: string | null;
};

export type MarketingTotals = {
  visits: number;
  previewFetches: number;
  engagedViews: number;
  uniqueVisitors: number | null;
  whatsappClicks: number;
  confirmedWhatsappLeads: number;
  enquiries: number;
  viewingRequests: number;
  linkToEnquiryRate: number | null;
};

export function totalsFromCounts(events: CountedEvent[], uniqueVisitors: number | null): MarketingTotals {
  const sum = (type: string, humansOnly: boolean) =>
    events.reduce((total, event) => {
      if (event.eventType !== type) return total;
      if (humansOnly && event.botClass !== "human") return total;
      return total + event.count;
    }, 0);
  const visits = sum("page_view", true);
  const enquiries = sum("enquiry_submit", false);
  return {
    visits,
    previewFetches: events.reduce((total, event) => total + (event.eventType === "page_view" && event.botClass === "preview" ? event.count : 0), 0),
    engagedViews: sum("engaged_view", true),
    uniqueVisitors,
    whatsappClicks: sum("whatsapp_click", true),
    confirmedWhatsappLeads: sum("whatsapp_conversation_confirmed", false),
    enquiries,
    viewingRequests: sum("viewing_request", false),
    linkToEnquiryRate: visits > 0 ? Math.round((enquiries / visits) * 1000) / 10 : null,
  };
}

export function factualInsights(totals: MarketingTotals, sourceCounts: Record<string, number>): string[] {
  const insights: string[] = [];
  if (totals.visits > 0) insights.push(`Your link received ${totals.visits} ${totals.visits === 1 ? "visit" : "visits"} in this period.`);
  if (totals.enquiries > 0) {
    insights.push(`${totals.enquiries} ${totals.enquiries === 1 ? "enquiry came" : "enquiries came"} from this property page.`);
  }
  if (totals.viewingRequests > 0) {
    insights.push(`${totals.viewingRequests} ${totals.viewingRequests === 1 ? "viewing was" : "viewings were"} requested. None of these are confirmed bookings.`);
  }
  if (totals.whatsappClicks > 0) {
    insights.push(`${totals.whatsappClicks} ${totals.whatsappClicks === 1 ? "person tapped" : "people tapped"} WhatsApp. A tap is not a message sent.`);
  }
  const humanSources = Object.entries(sourceCounts).filter(([, count]) => count > 0);
  if (humanSources.length) {
    humanSources.sort((a, b) => b[1] - a[1]);
    const [source, count] = humanSources[0]!;
    const label = source === "whatsapp" ? "WhatsApp" : source === "facebook" ? "Facebook" : source === "instagram" ? "Instagram" : source === "direct" ? "a direct open" : source;
    insights.push(`Most identifiable visits came from ${label} (${count}).`);
  }
  return insights;
}

export type DailyPoint = { day: string; visits: number };

export function visitSeries(rows: Array<{ day: string; eventType: string; botClass: string; count: number }>): DailyPoint[] {
  const map = new Map<string, number>();
  for (const row of rows) {
    if (row.eventType !== "page_view" || row.botClass !== "human") continue;
    map.set(row.day, (map.get(row.day) ?? 0) + row.count);
  }
  return [...map.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([day, visits]) => ({ day, visits }));
}

export function dealOutcomeNote(input: {
  leadWon: boolean;
  transactionLinked: boolean;
  marketingAgentId: string | null;
  operationalOwnerId: string | null;
}): string | null {
  if (!input.leadWon && !input.transactionLinked) return null;
  const ownershipDiffers =
    input.marketingAgentId && input.operationalOwnerId && input.marketingAgentId !== input.operationalOwnerId;
  if (input.transactionLinked) {
    return ownershipDiffers
      ? "A transaction is linked to this lead and listing. Marketing attribution and deal ownership differ."
      : "A transaction is linked to this lead and listing.";
  }
  return ownershipDiffers
    ? "This lead is marked won. Marketing attribution and deal ownership differ."
    : "This lead is marked won.";
}
