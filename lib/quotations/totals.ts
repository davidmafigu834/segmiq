import type { QuotationLineItemInput } from "@/types";

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function lineAmount(unitPrice: number, quantity: number): number {
  return round2((Number(unitPrice) || 0) * (Number(quantity) || 0));
}

export type QuoteTotals = {
  subtotal: number;
  taxAmount: number;
  total: number;
};

/**
 * Single source of truth for quote maths — used by the builder UI, the save
 * API and the PDF renderer so the numbers always agree.
 */
export function computeTotals(
  items: Pick<QuotationLineItemInput, "unit_price" | "quantity">[],
  taxRate: number,
  otherAmount: number
): QuoteTotals {
  const subtotal = round2(
    items.reduce((sum, it) => sum + lineAmount(it.unit_price, it.quantity), 0)
  );
  const rate = Number(taxRate) || 0;
  const other = Number(otherAmount) || 0;
  const taxAmount = round2(subtotal * (rate / 100));
  const total = round2(subtotal + taxAmount + other);
  return { subtotal, taxAmount, total };
}

export function formatMoney(amount: number, currency = "USD"): string {
  const n = (Number(amount) || 0).toFixed(2);
  const withSep = n.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${currency} ${withSep}`;
}
