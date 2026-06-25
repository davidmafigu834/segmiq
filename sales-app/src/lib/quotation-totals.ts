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

export function computeTotals(
  items: Array<{ unit_price: number; quantity: number }>,
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
