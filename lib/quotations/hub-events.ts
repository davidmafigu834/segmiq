import type { InboxChatMessage } from "@/lib/inbox/types";
import { formatMoney } from "@/lib/quotations/totals";

export const HUB_QUOTATION_EVENT_TYPES = [
  "SENT",
  "VIEWED",
  "CUSTOMER_SELECTED_OPTION",
  "CUSTOMER_REQUESTED_CHANGES",
  "CUSTOMER_ASKED_QUESTION",
  "ACCEPTED",
  "DECLINED",
] as const;

type HubQuotationEvent = {
  id: string;
  event_type: string;
  event_data: Record<string, unknown> | null;
  created_at: string;
  quotation_id: string;
};

function str(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function money(value: unknown, currency: string): string | null {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return formatMoney(n, currency);
}

export function quotationEventsToChatMessages(
  events: HubQuotationEvent[],
  opts: {
    quotes: Array<{
      id: string;
      quote_number?: string | null;
      revision_number?: number | null;
      total?: number | null;
      currency?: string | null;
      deal_id?: string | null;
    }>;
    role?: string | null;
  }
): InboxChatMessage[] {
  const byId = new Map(opts.quotes.map((quote) => [quote.id, quote]));
  const manager = opts.role === "CLIENT_MANAGER" || opts.role === "SUPER_ADMIN";

  return events.flatMap((event): InboxChatMessage[] => {
    const quote = byId.get(event.quotation_id);
    const data = event.event_data ?? {};
    const quoteNumber = str(data.quoteNumber) ?? str(data.quote_number) ?? quote?.quote_number ?? "Quotation";
    const revision = Number(data.revisionNumber ?? data.revision_number ?? quote?.revision_number) || 1;
    const currency = str(data.currency) ?? quote?.currency ?? "USD";
    const amount = money(data.total ?? data.acceptedTotal ?? data.accepted_total ?? quote?.total, currency);
    const quoteHref = manager
      ? `/client/quotations?quotation=${event.quotation_id}`
      : `/sales/quotes/${event.quotation_id}`;
    const dealId = str(data.dealId) ?? str(data.deal_id) ?? quote?.deal_id ?? null;
    const dealHref = dealId
      ? manager
        ? `/client/deals/${dealId}`
        : `/sales/deals/${dealId}`
      : null;

    if (event.event_type === "SENT") {
      return [
        {
          id: `qevt-${event.id}`,
          direction: "rep" as const,
          text: [quoteNumber, `Version ${revision}`, amount].filter(Boolean).join(" · "),
          createdAt: event.created_at,
          kind: "system" as const,
          systemTitle: "Quote sent",
          href: quoteHref,
          hrefLabel: "Open quotation",
        },
      ];
    }

    if (event.event_type === "VIEWED") {
      return [
        {
          id: `qevt-${event.id}`,
          direction: "customer" as const,
          text: "Customer viewed quotation",
          createdAt: event.created_at,
          kind: "system" as const,
          systemTitle: "Quotation viewed",
          href: quoteHref,
          hrefLabel: "Open quotation",
        },
      ];
    }

    if (event.event_type === "CUSTOMER_SELECTED_OPTION") {
      const option = str(data.itemName) ?? str(data.item_name) ?? str(data.label) ?? "Optional item";
      const optionAmount = money(data.amount ?? data.delta, currency);
      return [
        {
          id: `qevt-${event.id}`,
          direction: "customer" as const,
          text: [option, optionAmount ? `+${optionAmount}` : null].filter(Boolean).join(" · "),
          createdAt: event.created_at,
          kind: "system" as const,
          systemTitle: "Customer selected option",
          href: quoteHref,
          hrefLabel: "Open quotation",
        },
      ];
    }

    if (event.event_type === "CUSTOMER_REQUESTED_CHANGES") {
      const category = str(data.category) ?? "Change request";
      return [
        {
          id: `qevt-${event.id}`,
          direction: "customer" as const,
          text: category,
          createdAt: event.created_at,
          kind: "system" as const,
          systemTitle: "Customer requested changes",
          href: quoteHref,
          hrefLabel: "Review request",
        },
      ];
    }

    if (event.event_type === "CUSTOMER_ASKED_QUESTION") {
      const question = str(data.message) ?? str(data.question) ?? "Customer asked a question";
      return [
        {
          id: `qevt-${event.id}`,
          direction: "customer" as const,
          text: question,
          createdAt: event.created_at,
          kind: "system" as const,
          systemTitle: "Customer asked a question",
          href: quoteHref,
          hrefLabel: "Open quotation",
        },
      ];
    }

    if (event.event_type === "ACCEPTED") {
      return [
        {
          id: `qevt-${event.id}`,
          direction: "customer" as const,
          text: [quoteNumber, `Version ${revision}`, amount].filter(Boolean).join(" · "),
          createdAt: event.created_at,
          kind: "system" as const,
          systemTitle: "Quotation accepted",
          href: quoteHref,
          hrefLabel: "Open quotation",
        },
      ];
    }

    if (event.event_type === "DECLINED") {
      const reason = str(data.reason) ?? str(data.category) ?? "Customer declined";
      return [
        {
          id: `qevt-${event.id}`,
          direction: "customer" as const,
          text: reason,
          createdAt: event.created_at,
          kind: "system" as const,
          systemTitle: "Quotation declined",
          href: dealHref ?? quoteHref,
          hrefLabel: dealHref ? "Review Deal" : "Open quotation",
        },
      ];
    }

    return [];
  });
}
