import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { computeQuotationTotals } from "../lib/quotations/totals";
import { evaluateGovernance, marginHealth, resolveMaxDiscountPercent } from "../lib/quotations/governance";
import { evaluateApprovalRequirement } from "../lib/quotations/approval-engine";
import { runCommercialCheck } from "../lib/quotations/commercial-check";
import { expandPackageToLineItems } from "../lib/quotations/packages";
import { computeCustomerSelectedTotals } from "../lib/quotations/selected-totals";
import { compareQuotationVersions } from "../lib/quotations/compare-versions";

const settings = {
  max_discount_percent: 5,
  min_margin_percent: 25,
  margin_warning_percent: 28,
  discount_authority: [{ role: "SALESPERSON", max_percent: 5 }],
  default_payment_terms: "50% deposit",
};

describe("quotation commercial governance", () => {
  it("computes margin from selling price 1000 and cost 700", () => {
    const totals = computeQuotationTotals(
      [{ unit_price: 1000, quantity: 1, cost_price: 700 }],
      { fallbackTaxRate: 0 }
    );
    assert.equal(totals.total, 1000);
    assert.equal(totals.costTotal, 700);
    assert.equal(totals.marginPercent, 30);
    assert.equal(marginHealth(30, settings), "healthy");
  });

  it("3% discount is within 5% salesperson authority", () => {
    const totals = computeQuotationTotals(
      [{ unit_price: 1000, quantity: 1, cost_price: 700, discount_percent: 3 }],
      { fallbackTaxRate: 0 }
    );
    const gov = evaluateGovernance({
      items: [{ item_name: "Item", unit_price: 1000, quantity: 1, cost_price: 700, discount_percent: 3 }],
      totals,
      settings,
      role: "SALESPERSON",
    });
    assert.equal(gov.discountWithinAuthority, true);
    assert.equal(gov.pricingAuthority, "within_authority");
    assert.ok(totals.effectiveDiscountPercent <= 5);
  });

  it("8% discount exceeds 5% authority and requires approval", () => {
    const items = [{ item_name: "Item", unit_price: 1000, quantity: 1, cost_price: 700, discount_percent: 8 }];
    const totals = computeQuotationTotals(items, { fallbackTaxRate: 0 });
    const gov = evaluateGovernance({ items, totals, settings, role: "SALESPERSON" });
    assert.equal(gov.discountWithinAuthority, false);
    const approval = evaluateApprovalRequirement({
      items,
      totals,
      settings,
      policies: [],
      role: "SALESPERSON",
    });
    assert.equal(approval.required, true);
    const check = runCommercialCheck({
      status: "draft",
      approvalStatus: approval.required ? "required" : "not_required",
      customerName: "Jane",
      dealId: "deal-1",
      currency: "USD",
      validUntil: "2099-01-01",
      paymentTermsLabel: "50% deposit",
      items,
      totals,
      governance: gov,
      approval,
    });
    assert.equal(check.canSend, false);
    assert.ok(check.items.some((c) => c.id === "approval" && c.status === "block"));
  });

  it("approved exception can send even when discount still exceeds authority", () => {
    const items = [{ item_name: "Item", unit_price: 1000, quantity: 1, cost_price: 700, discount_percent: 8 }];
    const totals = computeQuotationTotals(items, { fallbackTaxRate: 0 });
    const gov = evaluateGovernance({ items, totals, settings, role: "SALESPERSON" });
    const check = runCommercialCheck({
      status: "draft",
      approvalStatus: "approved",
      customerName: "Jane",
      dealId: "deal-1",
      currency: "USD",
      validUntil: "2099-01-01",
      paymentTermsLabel: "50% deposit",
      items,
      totals,
      governance: gov,
      approval: { required: false, rules: [], reasons: [] },
    });
    assert.equal(check.canSend, true);
  });

  it("resolves discount authority from company configuration, not hard-coded roles", () => {
    assert.equal(resolveMaxDiscountPercent(settings, "SALESPERSON"), 5);
    assert.equal(
      resolveMaxDiscountPercent(
        { discount_authority: [{ role: "SALESPERSON", max_percent: 8 }] },
        "SALESPERSON"
      ),
      8
    );
  });
});

describe("quotation packages and optional items", () => {
  it("expands a package into priced line items", () => {
    const lines = expandPackageToLineItems({
      packageId: "pkg-1",
      packageName: "Bundle",
      pricingModel: "component_total",
      flexibility: "locked",
      fixedPrice: null,
      discountPercent: 0,
      components: [
        { catalog_item_id: "a", item_name: "A", description: null, quantity: 1, unit: "Each", unit_price: 100, cost_price: 60, sku: "A", is_optional: false },
        { catalog_item_id: "b", item_name: "B", description: null, quantity: 2, unit: "Each", unit_price: 50, cost_price: 20, sku: "B", is_optional: false },
      ],
    });
    assert.equal(lines.length, 2);
    assert.equal(lines[0].package_locked, true);
    const totals = computeQuotationTotals(lines, { fallbackTaxRate: 0 });
    assert.equal(totals.total, 200);
  });

  it("excludes optional items from base total until selected", () => {
    const items = [
      { item_name: "Base", unit_price: 6800, quantity: 1, is_optional: false },
      { item_name: "Battery", unit_price: 1350, quantity: 1, is_optional: true },
      { item_name: "Maintenance", unit_price: 420, quantity: 1, is_optional: true },
    ];
    const base = computeQuotationTotals(items, { fallbackTaxRate: 0 });
    assert.equal(base.total, 6800);
    const selected = computeCustomerSelectedTotals(items, ["Battery"], { fallbackTaxRate: 0 });
    assert.equal(selected.total, 8150);
  });
});

describe("version comparison", () => {
  it("highlights commercial differences only", () => {
    const diff = compareQuotationVersions(
      {
        revision: 1,
        items: [{ item_name: "Battery", unit_price: 100, quantity: 5 }],
        total: 6800,
        discountPercent: 0,
        paymentTerms: "50/50",
        validUntil: "2026-01-01",
        taxRate: 0,
      },
      {
        revision: 2,
        items: [{ item_name: "Battery", unit_price: 100, quantity: 10 }],
        total: 7950,
        discountPercent: 0,
        paymentTerms: "60/40",
        validUntil: "2026-01-01",
        taxRate: 0,
      }
    );
    assert.ok(diff.some((r) => r.field.includes("quantity")));
    assert.ok(diff.some((r) => r.field === "Total"));
    assert.ok(diff.some((r) => r.field === "Payment terms"));
    assert.equal(diff.some((r) => r.field === "Tax"), false);
  });
});

describe("commercial fingerprint", () => {
  it("changes when selling price changes so prior approval cannot reuse the snapshot", async () => {
    const { commercialFingerprint } = await import("../lib/quotations/fingerprint");
    const base = {
      items: [{ item_name: "Item", unit_price: 10000, quantity: 1, discount_percent: 0 }],
      discountPercent: 0,
      otherAmount: 0,
      taxRate: 0,
      paymentTermsLabel: "50/50",
      validUntil: "2026-12-01",
      currency: "USD",
      total: 10000,
    };
    const approved = commercialFingerprint(base);
    const changed = commercialFingerprint({
      ...base,
      items: [{ item_name: "Item", unit_price: 8000, quantity: 1, discount_percent: 0 }],
      total: 8000,
    });
    assert.notEqual(approved, changed);
  });
});
