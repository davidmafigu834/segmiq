import type { QuotationLineItemInput } from "@/types";

export function round2(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** Minor-unit safe multiply for money (avoids float drift on qty × price). */
export function moneyMul(unitPrice: number, quantity: number): number {
  const cents = Math.round((Number(unitPrice) || 0) * 100);
  const qty = Number(quantity) || 0;
  return round2((cents * qty) / 100);
}

export function lineAmount(unitPrice: number, quantity: number): number {
  return moneyMul(unitPrice, quantity);
}

export type LineCommercialInput = Pick<
  QuotationLineItemInput,
  | "unit_price"
  | "quantity"
  | "discount_percent"
  | "discount_amount"
  | "tax_rate"
  | "tax_inclusive"
  | "is_optional"
  | "cost_price"
>;

export type LineComputed = {
  gross: number;
  discount: number;
  netBeforeTax: number;
  tax: number;
  total: number;
  cost: number | null;
};

/**
 * Per-line commercial maths. Optional lines are excluded from base totals
 * by callers; this still computes their standalone values.
 */
export function computeLine(item: LineCommercialInput, fallbackTaxRate = 0): LineComputed {
  const gross = moneyMul(item.unit_price, item.quantity);
  const pct = Number(item.discount_percent) || 0;
  const fixed = Number(item.discount_amount) || 0;
  const discount = round2(Math.min(gross, round2(gross * (pct / 100)) + fixed));
  const afterDiscount = round2(gross - discount);
  const rate = item.tax_rate != null && item.tax_rate !== undefined
    ? Number(item.tax_rate) || 0
    : Number(fallbackTaxRate) || 0;
  const inclusive = Boolean(item.tax_inclusive);

  let netBeforeTax: number;
  let tax: number;
  let total: number;

  if (inclusive && rate > 0) {
    total = afterDiscount;
    netBeforeTax = round2(afterDiscount / (1 + rate / 100));
    tax = round2(total - netBeforeTax);
  } else {
    netBeforeTax = afterDiscount;
    tax = round2(netBeforeTax * (rate / 100));
    total = round2(netBeforeTax + tax);
  }

  const unitCost = item.cost_price != null ? Number(item.cost_price) : null;
  const cost =
    unitCost != null && Number.isFinite(unitCost)
      ? moneyMul(unitCost, item.quantity)
      : null;

  return { gross, discount, netBeforeTax, tax, total, cost };
}

export type QuoteTotals = {
  subtotal: number;
  lineDiscountTotal: number;
  documentDiscount: number;
  discountTotal: number;
  taxAmount: number;
  total: number;
  costTotal: number | null;
  marginPercent: number | null;
  /** Effective discount vs gross of included lines */
  effectiveDiscountPercent: number;
};

export type ComputeTotalsOpts = {
  /** Document-level fixed discount/fee (legacy other_amount; negative = discount). */
  otherAmount?: number;
  /** Document-level percent discount applied to net-before-tax of included lines. */
  discountPercent?: number;
  fallbackTaxRate?: number;
  /** When true, optional lines are excluded from base totals (default). */
  excludeOptional?: boolean;
};

/**
 * Single source of truth for quotation maths — editor, rail, PDF, send modal.
 * Backward compatible: plain unit_price×qty + flat tax_rate + other_amount
 * still matches historical computeTotals behaviour when no line discounts/tax.
 */
export function computeQuotationTotals(
  items: LineCommercialInput[],
  opts: ComputeTotalsOpts = {}
): QuoteTotals {
  const excludeOptional = opts.excludeOptional !== false;
  const fallbackTax = Number(opts.fallbackTaxRate) || 0;
  const included = items.filter((it) => !(excludeOptional && it.is_optional));

  let grossSum = 0;
  let lineDiscountSum = 0;
  let netSum = 0;
  let taxSum = 0;
  let costSum = 0;
  let hasCost = false;

  for (const it of included) {
    const line = computeLine(it, fallbackTax);
    grossSum = round2(grossSum + line.gross);
    lineDiscountSum = round2(lineDiscountSum + line.discount);
    netSum = round2(netSum + line.netBeforeTax);
    taxSum = round2(taxSum + line.tax);
    if (line.cost != null) {
      hasCost = true;
      costSum = round2(costSum + line.cost);
    }
  }

  const docPct = Number(opts.discountPercent) || 0;
  const docPctAmount = round2(netSum * (docPct / 100));
  const other = Number(opts.otherAmount) || 0;
  // other_amount: positive = fee/surcharge, negative = additional discount
  const documentDiscount = round2(docPctAmount + Math.max(0, -other));
  const surcharge = Math.max(0, other);

  const taxableBase = round2(Math.max(0, netSum - docPctAmount));
  // When lines already carry tax, keep line tax; apply document discount proportionally
  // by reducing tax if we had a simple flat model with no line tax.
  const hasLineTax = included.some(
    (it) => it.tax_rate != null && Number(it.tax_rate) !== fallbackTax
  );
  let taxAmount = taxSum;
  if (!hasLineTax && fallbackTax > 0 && docPctAmount > 0 && netSum > 0) {
    taxAmount = round2(taxableBase * (fallbackTax / 100));
  } else if (!hasLineTax && included.every((it) => it.tax_rate == null || it.tax_rate === undefined)) {
    // Classic path: tax on (subtotal after line discounts, before other)
    taxAmount = round2(taxableBase * (fallbackTax / 100));
  }

  const subtotal = netSum;
  const discountTotal = round2(lineDiscountSum + documentDiscount);
  const total = round2(taxableBase + taxAmount + surcharge);
  const effectiveDiscountPercent =
    grossSum > 0 ? round2((discountTotal / grossSum) * 100) : 0;

  const marginPercent =
    hasCost && total > 0 ? round2(((total - costSum) / total) * 100) : null;

  return {
    subtotal,
    lineDiscountTotal: lineDiscountSum,
    documentDiscount,
    discountTotal,
    taxAmount,
    total,
    costTotal: hasCost ? costSum : null,
    marginPercent,
    effectiveDiscountPercent,
  };
}

/**
 * Legacy wrapper — used by older call sites and tests.
 * Treats otherAmount as additive (fee or negative discount).
 */
export function computeTotals(
  items: Pick<QuotationLineItemInput, "unit_price" | "quantity">[],
  taxRate: number,
  otherAmount: number
): { subtotal: number; taxAmount: number; total: number } {
  const t = computeQuotationTotals(items, {
    fallbackTaxRate: taxRate,
    otherAmount,
    discountPercent: 0,
    excludeOptional: false,
  });
  return { subtotal: t.subtotal, taxAmount: t.taxAmount, total: t.total };
}

export function formatMoney(amount: number, currency = "USD"): string {
  const n = (Number(amount) || 0).toFixed(2);
  const withSep = n.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${currency} ${withSep}`;
}

export function formatMoneyCompact(amount: number, currency = "USD"): string {
  const n = (Number(amount) || 0).toFixed(2);
  const withSep = n.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const symbol =
    currency === "USD" ? "$" : currency === "ZAR" ? "R" : currency === "BWP" ? "P" : `${currency} `;
  if (currency === "USD" || currency === "ZAR" || currency === "BWP") {
    return `${symbol}${withSep}`;
  }
  return `${currency} ${withSep}`;
}

export function sectionSubtotal(
  items: LineCommercialInput[],
  fallbackTaxRate = 0
): number {
  return round2(
    items
      .filter((it) => !it.is_optional)
      .reduce((sum, it) => sum + computeLine(it, fallbackTaxRate).total, 0)
  );
}
