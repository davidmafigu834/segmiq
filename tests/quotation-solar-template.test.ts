import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { computeQuotationTotals } from "../lib/quotations/totals";
import { amountInWords } from "../lib/quotations/layouts/amount-in-words";
import { resolveDocumentAccent } from "../lib/quotations/layouts/accent";
import { quotationPdfFilename } from "../lib/quotations/layouts/filename";
import {
  brandModelFromItem,
  paymentsFromQuote,
  signatoryParts,
  siteRows,
  solarMetrics,
  splitHeroLines,
  termsNeedOwnPage,
  warrantyFromQuote,
} from "../lib/quotations/layouts/map-fields";
import { solarTemplateFixture } from "../lib/quotations/layouts/fixtures";
import { TEMPLATE_LIME } from "../lib/quotations/layouts/types";

describe("residential premium solar template mapping", () => {
  it("omits KPI metrics when no engineering data exists", () => {
    assert.deepEqual(solarMetrics({}, true), []);
    assert.deepEqual(solarMetrics({ roof_type: "Tile" }, true), []);
  });

  it("does not invent generation, PR or CO2 from system size", () => {
    const metrics = solarMetrics({ system_size_kwp: 6 }, true);
    assert.equal(metrics.length, 1);
    assert.equal(metrics[0].id, "size");
    assert.ok(!metrics.some((m) => m.id === "gen" || m.id === "pr" || m.id === "co2"));
  });

  it("reflows only provided metrics", () => {
    const metrics = solarMetrics(
      { system_size_kwp: 6, generation_kwh_month: 900, generation_kwh_year: 10800 },
      true
    );
    assert.equal(metrics.length, 2);
    assert.match(metrics[1].value, /900/);
    assert.match(metrics[1].secondary ?? "", /10,800/);
  });

  it("hides the site card rows when values are empty", () => {
    assert.deepEqual(siteRows({ roof_type: " " }, true), []);
    assert.equal(siteRows({ roof_type: "Tile", shade_level: "Low" }, true).length, 2);
  });

  it("renders structured payment terms instead of a hard-coded 10/60/30 split", () => {
    const rows = paymentsFromQuote({
      payment_schedule: [
        { label: "Deposit", percent: 20 },
        { label: "Progress", percent: 50 },
        { label: "Completion", percent: 30, trigger: "On commissioning" },
      ],
    });
    assert.equal(rows.length, 3);
    assert.equal(rows[0].label, "Deposit");
    assert.equal(rows[0].amountLabel, "20%");
    assert.equal(rows[0].detail, null);
    assert.equal(rows[2].detail, "On commissioning");
  });

  it("omits warranty when none is configured", () => {
    assert.deepEqual(warrantyFromQuote({}, {}, true), []);
  });

  it("does not duplicate description as brand/model", () => {
    assert.equal(brandModelFromItem("550W Solar Panel", "550W Solar Panel", null), null);
    assert.equal(brandModelFromItem("550W Solar Panel", "JA Solar JAM72S30", null), "JA Solar JAM72S30");
  });

  it("excludes optional items from canonical base total", () => {
    const totals = computeQuotationTotals(
      [
        { unit_price: 1000, quantity: 2, is_optional: false },
        { unit_price: 500, quantity: 1, is_optional: true },
      ],
      { fallbackTaxRate: 0 }
    );
    assert.equal(totals.subtotal, 2000);
    assert.equal(totals.total, 2000);
  });

  it("formats USD, ZiG and ZAR without hard-coded INR", () => {
    const usd = amountInWords(440730, "USD");
    const zig = amountInWords(1250000, "ZiG");
    const zar = amountInWords(18500.5, "ZAR");
    assert.match(usd ?? "", /USD/);
    assert.match(zig ?? "", /ZIG/);
    assert.match(zar ?? "", /ZAR/);
    assert.ok(!(usd ?? "").includes("₹"));
    assert.ok(!(usd ?? "").includes("INR"));
  });

  it("builds a sanitised PDF filename from quote number and customer", () => {
    assert.equal(quotationPdfFilename("QT-2026-0048", "Jane Customer"), "QT-2026-0048-Jane-Customer.pdf");
    assert.equal(quotationPdfFilename("QT-1", "A/B*C"), "QT-1-ABC.pdf");
  });

  it("falls back to template lime when company accent fails contrast", () => {
    assert.equal(resolveDocumentAccent("#FFFF00", TEMPLATE_LIME), TEMPLATE_LIME);
    assert.equal(resolveDocumentAccent("#0F7A4F", TEMPLATE_LIME), "#0F7A4F");
  });

  it("keeps the built-in hero as three lines", () => {
    const lines = splitHeroLines("Powering\nSmarter Homes.\nSustainably.");
    assert.deepEqual(lines, ["Powering", "Smarter Homes.", "Sustainably."]);
  });

  it("does not duplicate company name on the signatory block", () => {
    const parts = signatoryParts({
      name: "Adlense Network",
      signatoryName: "Adlense Network",
      signatoryRole: "Adlense Network",
    });
    assert.equal(parts.name, "Authorised Signatory");
    assert.equal(parts.role, null);
    assert.equal(parts.company, "Adlense Network");
  });

  it("moves long terms onto their own page", () => {
    assert.equal(termsNeedOwnPage("Guarantee from it"), false);
    assert.equal(termsNeedOwnPage("a\nb\nc\nd\ne"), true);
  });

  it("populated fixture uses canonical totals and does not invent empty KPIs", () => {
    const full = solarTemplateFixture("populated");
    const expected = computeQuotationTotals(
      full.sections.flatMap((s) => s.items).map((it) => ({
        unit_price: it.unitPrice,
        quantity: it.quantity,
        is_optional: it.optional,
      })),
      { fallbackTaxRate: 15 }
    );
    assert.equal(full.commercial.total, expected.total);
    assert.equal(full.metrics.length, 4);
    assert.equal(full.sections.flatMap((s) => s.items).length, 7);
    assert.equal(full.paymentTerms.length, 3);
    assert.equal(full.warranty.length, 3);

    const minimal = solarTemplateFixture("minimal");
    assert.equal(minimal.metrics.length, 0);
    assert.equal(minimal.warranty.length, 0);
    assert.equal(minimal.site.length, 0);
    assert.equal(minimal.sections.flatMap((s) => s.items).length, 2);
  });

  it("ships a starter catalogue for the built-in solar template", async () => {
    const { SOLAR_BUILTIN_STARTER_ITEMS } = await import("../lib/quotations/layouts/builtin-starter");
    assert.equal(SOLAR_BUILTIN_STARTER_ITEMS.length, 7);
    assert.ok(SOLAR_BUILTIN_STARTER_ITEMS.every((it) => it.item_name && it.unit_price > 0));
  });
});
