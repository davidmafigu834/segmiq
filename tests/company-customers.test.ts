import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildCompanyCustomersKpis,
  countCompanyCustomersTabs,
  customerValueLabel,
  formatCustomerType,
  matchesCompanyCustomersFilters,
  matchesCompanyCustomersSearch,
  matchesCompanyCustomersTab,
  sortCompanyCustomersRows,
} from "../lib/sales/company-customers-metrics";
import { DEFAULT_COMPANY_CUSTOMERS_FILTERS } from "../components/dashboard/company/customers/types";
import type { CompanyCustomerRow } from "../components/dashboard/company/customers/types";

function row(partial: Partial<CompanyCustomerRow> = {}): CompanyCustomerRow {
  return {
    id: "customer-1",
    name: "Moyo Residence",
    customerType: "company",
    customerTypeLabel: "Company",
    industry: "Residential Solar",
    primaryContactName: "Tendai Moyo",
    phone: "+263 77 123 4567",
    email: "moyo@example.com",
    location: "Harare, Zimbabwe",
    source: "Referral",
    ownerId: "owner-1",
    ownerName: "Tendai Moyo",
    ownerAvatarUrl: null,
    customerSince: "2026-02-14T08:00:00.000Z",
    customerSinceLabel: "Feb 14, 2026",
    lastInteractionAt: "2026-08-13T08:24:00.000Z",
    lastInteractionLabel: "Yesterday, 10:24 AM",
    lastInteractionChannel: "WhatsApp",
    totalDeals: 3,
    activeDeals: 2,
    activePipelineKnown: 30000,
    activePipelineUnknownCount: 1,
    wonDeals: 1,
    wonValueKnown: 18500,
    wonValueUnknownCount: 0,
    customerValueLabel: "$18,500",
    ...partial,
  };
}

describe("Company Customers truth model", () => {
  it("treats legacy untyped person contacts as Individuals", () => {
    assert.equal(formatCustomerType(null), "individual");
    assert.equal(formatCustomerType(undefined), "individual");
    assert.equal(formatCustomerType("company"), "company");
  });

  it("keeps company and individual Customer types explicit", () => {
    const rows = [
      row(),
      row({ id: "person", customerType: "individual", customerTypeLabel: "Individual" }),
      row({ id: "legacy", customerType: "individual", customerTypeLabel: "Individual" }),
    ];
    assert.deepEqual(countCompanyCustomersTabs(rows, new Date("2026-08-14T12:00:00Z")), {
      all: 3,
      companies: 1,
      individuals: 2,
      recent: 3,
    });
    assert.equal(matchesCompanyCustomersTab(rows[2]!, "companies"), false);
    assert.equal(matchesCompanyCustomersTab(rows[2]!, "individuals"), true);
  });

  it("uses meaningful interaction timestamps for Recent and never created_at", () => {
    const noInteraction = row({ lastInteractionAt: null, lastInteractionLabel: "No activity yet" });
    assert.equal(matchesCompanyCustomersTab(noInteraction, "recent", new Date("2026-08-14T12:00:00Z")), false);
  });

  it("preserves unknown won values instead of displaying them as zero", () => {
    assert.equal(customerValueLabel({ wonDeals: 1, knownValue: 0, unknownCount: 1 }), "Not recorded");
    assert.equal(customerValueLabel({ wonDeals: 2, knownValue: 18500, unknownCount: 1 }), "$18,500 + unrecorded");
    assert.equal(customerValueLabel({ wonDeals: 0, knownValue: 0, unknownCount: 0 }), "$0");
  });
});

describe("Company Customers KPI definitions", () => {
  it("builds exactly the five approved cards and reports pending estimates", () => {
    const kpis = buildCompanyCustomersKpis({
      totalCustomers: 128,
      companies: 86,
      individuals: 42,
      activeDeals: 76,
      customersWithActiveDeals: 60,
      activePipelineKnown: 1248700,
      activePipelineUnknownCount: 4,
    });
    assert.deepEqual(kpis.map((kpi) => kpi.label), [
      "Total Customers",
      "Companies",
      "Individuals",
      "Active Deals",
      "Total Pipeline Value",
    ]);
    assert.equal(kpis[4]?.value, "$1,248,700");
    assert.match(kpis[4]?.supporting ?? "", /4 Deals awaiting estimate/);
    assert.equal(kpis.some((kpi) => kpi.trend), false);
  });

  it("shows unavailable when every active Deal is awaiting an estimate", () => {
    const pipeline = buildCompanyCustomersKpis({
      totalCustomers: 1,
      companies: 0,
      individuals: 1,
      activeDeals: 2,
      customersWithActiveDeals: 1,
      activePipelineKnown: 0,
      activePipelineUnknownCount: 2,
    }).find((kpi) => kpi.id === "customer-pipeline-value");
    assert.equal(pipeline?.value, "—");
  });
});

describe("Company Customers table behavior", () => {
  it("searches identity, contact, location, industry, and relationship owner", () => {
    const customer = row();
    for (const query of ["moyo", "263 77", "example.com", "harare", "residential", "tendai"]) {
      assert.equal(matchesCompanyCustomersSearch(customer, query), true, query);
    }
    assert.equal(matchesCompanyCustomersSearch(customer, "bulawayo"), false);
  });

  it("filters by canonical Customer owner/type, active Deals, and recorded value", () => {
    const customer = row();
    assert.equal(matchesCompanyCustomersFilters(customer, {
      ...DEFAULT_COMPANY_CUSTOMERS_FILTERS,
      customerType: "company",
      ownerId: "owner-1",
      activeDeals: "yes",
      customerValue: "known",
    }), true);
    assert.equal(matchesCompanyCustomersFilters(customer, {
      ...DEFAULT_COMPANY_CUSTOMERS_FILTERS,
      ownerId: "unassigned",
    }), false);
  });

  it("sorts Customers with multiple Deals by active Deal count", () => {
    const sorted = sortCompanyCustomersRows([
      row({ id: "one", activeDeals: 1, totalDeals: 4 }),
      row({ id: "three", activeDeals: 3, totalDeals: 3 }),
      row({ id: "none", activeDeals: 0, totalDeals: 8 }),
    ], "deals_desc");
    assert.deepEqual(sorted.map((customer) => customer.id), ["three", "one", "none"]);
  });
});
