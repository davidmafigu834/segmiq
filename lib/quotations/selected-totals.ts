import type { QuotationLineItemInput } from "@/types";
import { computeQuotationTotals, type ComputeTotalsOpts, type QuoteTotals } from "@/lib/quotations/totals";

function lineKey(item: QuotationLineItemInput, index: number): string {
  return (item as { id?: string }).id || `${item.item_name}-${index}`;
}

/**
 * Customer-selected total: optional lines count only when selected.
 * Uses the same canonical engine as the editor / PDF.
 */
export function computeCustomerSelectedTotals(
  items: QuotationLineItemInput[],
  selectedOptionalKeys: string[],
  opts: ComputeTotalsOpts = {}
): QuoteTotals {
  const selected = new Set(selectedOptionalKeys);
  const mapped = items.map((it, idx) => {
    if (!it.is_optional) return it;
    const key = lineKey(it, idx);
    return { ...it, is_optional: !selected.has(key) && !selected.has(it.item_name) };
  });
  return computeQuotationTotals(mapped, { ...opts, excludeOptional: true });
}
