import type { QuotationRow } from "@/types";

export type DealQuotationOffer = Pick<
  QuotationRow,
  | "id"
  | "quote_number"
  | "revision_number"
  | "status"
  | "total"
  | "currency"
  | "valid_until"
  | "sent_at"
  | "viewed_at"
  | "created_at"
  | "updated_at"
  | "parent_quotation_id"
> & {
  approval_status?: string | null;
  customer_response_type?: string | null;
};

function stamp(quote: DealQuotationOffer): number {
  return Date.parse(quote.updated_at || quote.created_at || "") || 0;
}

/** Latest live commercial offer for a Deal. Superseded versions stay historical. */
export function classifyDealQuotations(quotes: DealQuotationOffer[]): {
  current: DealQuotationOffer | null;
  previous: DealQuotationOffer[];
} {
  if (quotes.length === 0) return { current: null, previous: [] };
  const live = quotes.filter((quote) => quote.status !== "superseded");
  const pool = live.length > 0 ? live : quotes;
  const current = [...pool].sort((a, b) => stamp(b) - stamp(a))[0] ?? null;
  const previous = quotes
    .filter((quote) => quote.id !== current?.id)
    .sort((a, b) => stamp(b) - stamp(a));
  return { current, previous };
}

export function dealQuoteIsCurrent(quote: DealQuotationOffer, currentId: string | null): boolean {
  return Boolean(currentId) && quote.id === currentId;
}

export function canCreateDealRevision(quote: DealQuotationOffer | null): boolean {
  if (!quote) return false;
  return ["sent", "viewed", "accepted", "rejected", "expired", "approved"].includes(quote.status);
}
