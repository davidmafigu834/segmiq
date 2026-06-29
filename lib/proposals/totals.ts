import type { ProposalLineItemInput } from "@/types";
import { round2, lineAmount } from "@/lib/quotations/totals";

export { round2, lineAmount, formatMoney } from "@/lib/quotations/totals";

export type ProposalTotals = {
  subtotal: number;
  taxAmount: number;
  total: number;
};

/**
 * Single source of truth for proposal maths — used by the builder UI, the save
 * API and the PDF renderer so the numbers always agree. A flat discount is
 * subtracted from the subtotal before tax is applied.
 */
export function computeProposalTotals(
  items: Pick<ProposalLineItemInput, "unit_price" | "quantity">[],
  discount: number,
  taxRate: number
): ProposalTotals {
  const subtotal = round2(
    items.reduce((sum, it) => sum + lineAmount(it.unit_price, it.quantity), 0)
  );
  const disc = Math.min(Math.max(Number(discount) || 0, 0), subtotal);
  const rate = Number(taxRate) || 0;
  const taxable = round2(subtotal - disc);
  const taxAmount = round2(taxable * (rate / 100));
  const total = round2(taxable + taxAmount);
  return { subtotal, taxAmount, total };
}
