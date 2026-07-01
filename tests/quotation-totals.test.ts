import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { computeTotals, formatMoney, lineAmount, round2 } from "../lib/quotations/totals";

describe("quotation totals", () => {
  it("rounds monetary values to two decimal places", () => {
    assert.equal(round2(10.005), 10.01);
    assert.equal(lineAmount(19.995, 2), 39.99);
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
});
