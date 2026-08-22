import type { QuotationLineItemInput, QuotationStatus } from "@/types";
import { computeQuotationTotals } from "@/lib/quotations/totals";
import { runCommercialCheck } from "@/lib/quotations/commercial-check";
import type { CommercialGovernance } from "@/lib/quotations/governance";
import type { ApprovalEvaluation } from "@/lib/quotations/approval-engine";

/** Server-side send gate — mirrors UI Commercial Check blockers including approval. */
export function validateQuotationForSend(quote: {
  status: QuotationStatus | string;
  approval_status?: string | null;
  customer_name?: string | null;
  deal_id?: string | null;
  currency?: string | null;
  valid_until?: string | null;
  payment_terms_label?: string | null;
  tax_rate?: number | null;
  other_amount?: number | null;
  discount_percent?: number | null;
  items: QuotationLineItemInput[];
  governance?: CommercialGovernance | null;
  approval?: ApprovalEvaluation | null;
}): { ok: true } | { ok: false; error: string; blockers: string[] } {
  const items = quote.items ?? [];
  const totals = computeQuotationTotals(items, {
    fallbackTaxRate: Number(quote.tax_rate) || 0,
    otherAmount: Number(quote.other_amount) || 0,
    discountPercent: Number(quote.discount_percent) || 0,
  });

  const check = runCommercialCheck({
    status: quote.status,
    approvalStatus: quote.approval_status,
    customerName: quote.customer_name,
    dealId: quote.deal_id,
    currency: quote.currency,
    validUntil: quote.valid_until,
    paymentTermsLabel: quote.payment_terms_label,
    items,
    totals,
    governance: quote.governance,
    approval: quote.approval,
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
