import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  COMPANY_NAVIGATION,
  companyNavHasRealEstateProperties,
  companyNavHasTradesCatalog,
  getCompanyNavigation,
  getCompanyNavSectionOrder,
} from "../lib/sales/navigation/company-nav-config";

const TRADE_CATALOG_IDS = ["products", "inventory", "packages", "quotations"];
const RE_PROPERTY_IDS = ["listings", "developments"];
const RE_PHASE1_IDS = [
  "inquiries",
  "pipeline",
  "offers",
  "viewings",
  "marketing",
  "lead-sources",
  "website-leads",
  "agents",
  "agent-performance",
  "compliance",
];

describe("company navigation — trades", () => {
  it("keeps the existing trades information architecture", () => {
    const nav = getCompanyNavigation("trades");
    assert.equal(nav, COMPANY_NAVIGATION);
    assert.equal(companyNavHasTradesCatalog(nav), true);
    for (const id of TRADE_CATALOG_IDS) {
      assert.ok(nav.some((item) => item.id === id), `trades nav missing ${id}`);
    }
    assert.equal(companyNavHasRealEstateProperties(nav), false);
    assert.deepEqual(getCompanyNavSectionOrder("trades"), ["company", "products", "tools"]);
    assert.equal(
      nav.find((item) => item.id === "leads")?.label,
      "Leads"
    );
    assert.equal(nav.find((item) => item.id === "team")?.label, "Team");
  });
});

describe("company navigation — real_estate", () => {
  it("exposes listings, developments and phase-1 modules without trade catalog items", () => {
    const nav = getCompanyNavigation("real_estate");
    assert.equal(companyNavHasTradesCatalog(nav), false);
    assert.equal(companyNavHasRealEstateProperties(nav), true);
    for (const id of TRADE_CATALOG_IDS) {
      assert.equal(
        nav.some((item) => item.id === id),
        false,
        `real-estate nav should not first-class ${id}`
      );
    }
    for (const id of RE_PROPERTY_IDS.concat(RE_PHASE1_IDS)) {
      assert.ok(nav.some((item) => item.id === id), `real-estate nav missing ${id}`);
    }
    assert.equal(nav.find((item) => item.id === "inquiries")?.href, "/client/leads");
    assert.equal(nav.find((item) => item.id === "listings")?.href, "/client/listings");
    assert.equal(nav.find((item) => item.id === "developments")?.href, "/client/developments");
    assert.equal(nav.find((item) => item.id === "viewings")?.href, "/client/viewings");
    assert.equal(nav.find((item) => item.id === "agents")?.href, "/client/team");
    assert.deepEqual(getCompanyNavSectionOrder("real_estate"), [
      "overview",
      "sales",
      "marketing",
      "properties",
      "team",
      "compliance",
      "operations",
      "system",
    ]);
  });

  it("does not change trades navigation when business_type is omitted", () => {
    assert.equal(getCompanyNavigation(), COMPANY_NAVIGATION);
    assert.equal(getCompanyNavigation(null), COMPANY_NAVIGATION);
  });
});
