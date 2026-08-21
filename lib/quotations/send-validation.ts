import type { QuotationLineItemInput, QuotationStatus } from "@/types";
import { computeQuotationTotals } from "@/lib/quotations/totals";
import { runCommercialCheck } from "@/lib/quotations/commercial-check";

/** Server-side Phase 1 send gate — mirrors UI Commercial Check blockers. */
export function validateQuotationForSend(quote: {
  status: QuotationStatus | string;
  customer_name?: string | null;
  deal_id?: string | null;
  currency?: string | null;
  valid_until?: string | null;
  payment_terms_label?: string | null;
  tax_rate?: number | null;
  other_amount?: number | null;
  discount_percent?: number | null;
  items: QuotationLineItemInput[];
}): { ok: true } | { ok: false; error: string; blockers: string[] } {
  const items = quote.items ?? [];
  const totals = computeQuotationTotals(items, {
    fallbackTaxRate: Number(quote.tax_rate) || 0,
    otherAmount: Number(quote.other_amount) || 0,
    discountPercent: Number(quote.discount_percent) || 0,
  });

  const check = runCommercialCheck({
    status: quote.status,
    customerName: quote.customer_name,
    dealId: quote.deal_id,
    currency: quote.currency,
    validUntil: quote.valid_until,
    paymentTermsLabel: quote.payment_terms_label,
    items,
    totals,
  });

  if (check.canSend) return { ok: true };

  const blockers = check.items
    .filter((c) => c.status === "block")
    .map((c) => c.action || c.label);

  return {
    ok: false,
    error:
      blockers.length === 1
        ? blockers[0]
        : `Complete ${blockers.length} required items before sending`,
    blockers,
  };
}
