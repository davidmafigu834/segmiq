import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import path from "node:path";

import { packageAvailability, scalePackageQuantities } from "../lib/packages/availability";
import { availableQty, canTransfer, crossedLowStock, crossedOutOfStock, stockStatus } from "../lib/inventory/math";
import { omitCostFields, parseQuantity } from "../lib/commercial/money";
import { validateImportRows } from "../lib/commercial/import";
import { discloseAvailability } from "../lib/agent/disclosure";
import { runCommercialCheck } from "../lib/quotations/commercial-check";
import { expandPackageToLineItems } from "../lib/quotations/packages";
import { priceFreshnessWarning } from "../lib/quotations/commercial-resolver";
import { computeQuotationTotals } from "../lib/quotations/totals";
import { COMPANY_CRM_RESET_PRESERVED, COMPANY_CRM_RESET_TABLES } from "../lib/clients/reset-crm";
import { isRegisteredTool, TOOL_METADATA } from "../lib/agent/tools/registry";

function solarKit(batteryAvail: number) {
  return packageAvailability([
    { id: "p", name: "Panel", requiredQty: 10, trackInventory: true, isService: false, optional: false, variantUnresolved: false, available: 80 },
    { id: "i", name: "Inverter", requiredQty: 1, trackInventory: true, isService: false, optional: false, variantUnresolved: false, available: 6 },
    { id: "b", name: "Battery", requiredQty: 1, trackInventory: true, isService: false, optional: false, variantUnresolved: false, available: batteryAvail },
    { id: "l", name: "Install", requiredQty: 1, trackInventory: false, isService: true, optional: false, variantUnresolved: false, available: null },
  ]);
}

describe("package availability", () => {
  it("80 panels / 6 inverters / 4 batteries → 4 packages", () => {
    const avail = solarKit(4);
    assert.equal(avail.availableCount, 4);
    assert.equal(avail.status, "LIMITED");
    assert.equal(avail.limitedBy, "Battery");
  });

  it("battery 0 → UNAVAILABLE", () => {
    const avail = solarKit(0);
    assert.equal(avail.status, "UNAVAILABLE");
    assert.equal(avail.availableCount, 0);
  });

  it("services do not limit stock", () => {
    const avail = packageAvailability([
      { id: "p", name: "Panel", requiredQty: 1, trackInventory: true, isService: false, optional: false, variantUnresolved: false, available: 10 },
      { id: "l", name: "Labour", requiredQty: 50, trackInventory: false, isService: true, optional: false, variantUnresolved: false, available: 0 },
    ]);
    assert.equal(avail.availableCount, 10);
    assert.equal(avail.status, "READY");
  });

  it("PPE multiplier 120 scales quantity", () => {
    assert.equal(scalePackageQuantities(1, 120, false), 120);
    const lines = expandPackageToLineItems({
      packageId: "ppe",
      packageName: "PPE",
      pricingModel: "component_total",
      flexibility: "flexible",
      fixedPrice: null,
      discountPercent: 0,
      components: [
        { catalog_item_id: null, item_name: "Hard hat", description: null, quantity: 1, unit: "Each", unit_price: 10, cost_price: 4, sku: "HH", is_optional: false },
      ],
      scale: 120,
    });
    assert.equal(lines[0]?.quantity, 120);
  });
});

describe("inventory math", () => {
  it("available is on hand minus reserved", () => {
    assert.equal(availableQty(100, 15), 85);
  });

  it("adjust 40 then +60 = 100", () => {
    assert.equal(40 + 60, 100);
    assert.equal(availableQty(100, 0), 100);
  });

  it("over-transfer is blocked when negative stock is not allowed", () => {
    assert.equal(canTransfer(10, 11, false), false);
    assert.equal(canTransfer(10, 10, false), true);
  });

  it("threshold crossing is one-shot", () => {
    assert.equal(crossedLowStock(12, 5, 8), true);
    assert.equal(crossedLowStock(5, 4, 8), false);
    assert.equal(crossedOutOfStock(3, 0), true);
    assert.equal(crossedOutOfStock(0, 0), false);
  });

  it("services are not tracked", () => {
    assert.equal(stockStatus({ trackInventory: false, available: 0 }), "NOT_TRACKED");
  });
});

describe("import validation", () => {
  it("duplicate SKU is an error in CREATE mode", () => {
    const rows = validateImportRows(
      [
        { name: "A", sku: "SKU-1", selling_price: "10" },
        { name: "B", sku: "SKU-1", selling_price: "12" },
      ],
      { existingSkus: new Map(), duplicateMode: "CREATE" }
    );
    assert.ok(rows[1]?.errors.some((e) => /duplicate SKU/i.test(e)));
  });

  it("existing SKU is skipped", () => {
    const rows = validateImportRows([{ name: "A", sku: "SKU-1", selling_price: "10" }], {
      existingSkus: new Map([["sku-1", { id: "p1" }]]),
      duplicateMode: "SKIP",
    });
    assert.equal(rows[0]?.decision, "SKIP");
  });

  it("invalid quantity is rejected", () => {
    const q = parseQuantity("abc", false);
    assert.equal(q.ok, false);
    const rows = validateImportRows([{ name: "A", sku: "S2", on_hand: "-3" }], {
      existingSkus: new Map(),
      duplicateMode: "SKIP",
    });
    assert.ok(rows[0]?.errors.length);
  });
});

describe("cost stripping and quotes", () => {
  it("omits cost fields without permission", () => {
    const stripped = omitCostFields({ name: "Panel", selling_price: 100, cost_price: 60, marginPercent: 40 }, false);
    assert.equal((stripped as { selling_price: number }).selling_price, 100);
    assert.equal("cost_price" in (stripped as object), false);
    assert.equal("marginPercent" in (stripped as object), false);
  });

  it("quote resolver never calls reserveStock", () => {
    const src = readFileSync(path.join(process.cwd(), "lib/quotations/commercial-resolver.ts"), "utf8");
    assert.equal(src.includes("reserveStock"), false);
  });

  it("draft snapshots catalog price and warns when source changes", () => {
    const line = { item_name: "Panel", unit_price: 100, catalog_unit_price: 100, quantity: 1 };
    assert.equal(priceFreshnessWarning(line, 100), null);
    assert.match(priceFreshnessWarning(line, 120) ?? "", /Price changed/);
  });

  it("commercial check inventory defaults to warn, not block", () => {
    const items = [{ item_name: "Battery", unit_price: 100, quantity: 2 }];
    const totals = computeQuotationTotals(items, { fallbackTaxRate: 0 });
    const check = runCommercialCheck({
      status: "draft",
      customerName: "Jane",
      dealId: "d1",
      currency: "USD",
      validUntil: "2099-01-01",
      paymentTermsLabel: "50%",
      items,
      totals,
      inventoryShortages: [{ name: "Battery", requested: 2, available: 0 }],
    });
    const inv = check.items.find((c) => c.id === "inventory");
    assert.equal(inv?.status, "warn");
    assert.equal(check.canSend, true);
  });
});

describe("agent disclosure", () => {
  const avail = {
    productId: "p",
    variantId: null,
    onHand: 12,
    reserved: 2,
    available: 10,
    status: "IN_STOCK" as const,
    trackInventory: true,
    lastSyncedAt: null,
    stale: false,
    locations: [],
  };

  it("HIDDEN omits quantity", () => {
    const d = discloseAvailability(avail, "HIDDEN");
    assert.equal("available" in d, false);
    assert.equal("availability" in d, false);
  });

  it("EXACT returns the count", () => {
    const d = discloseAvailability(avail, "EXACT");
    assert.equal(d.available, 10);
  });

  it("stale external inventory does not return an exact count", () => {
    const d = discloseAvailability({ ...avail, stale: true }, "EXACT");
    assert.equal(d.availability, "unknown");
    assert.equal("available" in d, false);
  });
});

describe("agent tools and CRM reset", () => {
  it("registers commercial tools and keeps catalog_search", () => {
    assert.equal(isRegisteredTool("catalog_search"), true);
    assert.equal(isRegisteredTool("product.search"), true);
    assert.equal(isRegisteredTool("inventory.getAvailability"), true);
    assert.equal(isRegisteredTool("package.checkAvailability"), true);
    assert.equal(TOOL_METADATA["product.search"].readOnly, true);
  });

  it("preserves products, packages and inventory setup on CRM reset", () => {
    for (const table of ["products", "commercial_packages", "inventory_locations", "inventory_settings", "product_catalog"]) {
      assert.ok(COMPANY_CRM_RESET_PRESERVED.includes(table as (typeof COMPANY_CRM_RESET_PRESERVED)[number]), table);
      assert.equal((COMPANY_CRM_RESET_TABLES as readonly string[]).includes(table), false);
    }
  });
});
