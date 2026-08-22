import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  computeTotals,
  computeQuotationTotals,
  formatMoney,
  lineAmount,
  round2,
} from "../lib/quotations/totals";

describe("quotation totals", () => {
  it("rounds monetary values to two decimal places", () => {
    assert.equal(round2(10.005), 10.01);
    assert.equal(lineAmount(19.995, 2), 40);
  });

  it("computes subtotal, tax, and additional charges consistently", () => {
    assert.deepEqual(
      computeTotals(
        [
          { unit_price: 25.5, quantity: 2 },
          { unit_price: 10, quantity: 3 },
        ],
        15,
        5
      ),
      { subtotal: 81, taxAmount: 12.15, total: 98.15 }
    );
  });

  it("normalizes non-finite input values to zero", () => {
    assert.deepEqual(
      computeTotals([{ unit_price: Number.NaN, quantity: 4 }], Number.NaN, Number.NaN),
      { subtotal: 0, taxAmount: 0, total: 0 }
    );
  });

  it("formats currency with grouping and two decimals", () => {
    assert.equal(formatMoney(12345.6), "USD 12,345.60");
  });

  it("excludes optional lines from base totals", () => {
    const t = computeQuotationTotals(
      [
        { unit_price: 100, quantity: 2, is_optional: false },
        { unit_price: 500, quantity: 1, is_optional: true },
      ],
      { fallbackTaxRate: 0, otherAmount: 0 }
    );
    assert.equal(t.subtotal, 200);
    assert.equal(t.total, 200);
  });

  it("applies line discount before tax", () => {
    const t = computeQuotationTotals(
      [{ unit_price: 100, quantity: 1, discount_percent: 10 }],
      { fallbackTaxRate: 10, otherAmount: 0 }
    );
    assert.equal(t.subtotal, 90);
    assert.equal(t.taxAmount, 9);
    assert.equal(t.total, 99);
  });
});
