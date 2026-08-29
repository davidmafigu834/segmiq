import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  dealSideBadgeLabel,
  displayCompositionLabel,
  displayRoleColumn,
  getTerminology,
  isRealEstate,
  normalizeBusinessType,
} from "../lib/terminology";

describe("getTerminology", () => {
  it("keeps trades copy unchanged", () => {
    const t = getTerminology("trades");
    assert.equal(t.lead.singular, "Lead");
    assert.equal(t.lead.plural, "Leads");
    assert.equal(t.salesperson.singular, "Salesperson");
    assert.equal(t.salesperson.plural, "Salespeople");
    assert.equal(t.project.singular, "Project");
    assert.equal(t.project.plural, "Projects");
    assert.equal(t.siteVisit.singular, "Site Visit");
    assert.equal(t.siteVisit.plural, "Site Visits");
    assert.equal(t.actions.addLead, "Add Lead");
    assert.equal(t.actions.assign, "Assign salesperson");
  });

  it("maps real_estate presentation terms without renaming database concepts", () => {
    const t = getTerminology("real_estate");
    assert.equal(t.lead.singular, "Inquiry");
    assert.equal(t.lead.plural, "Inquiries");
    assert.equal(t.salesperson.singular, "Agent");
    assert.equal(t.salesperson.plural, "Agents");
    assert.equal(t.project.singular, "Property");
    assert.equal(t.project.plural, "Properties");
    assert.equal(t.siteVisit.singular, "Viewing");
    assert.equal(t.siteVisit.plural, "Viewings");
    assert.equal(t.actions.addLead, "Add Inquiry");
    assert.equal(t.actions.assign, "Assign agent");
  });

  it("treats missing or unknown business_type as trades", () => {
    assert.equal(getTerminology(null).lead.singular, "Lead");
    assert.equal(getTerminology(undefined).salesperson.singular, "Salesperson");
    assert.equal(getTerminology("something_else").siteVisit.singular, "Site Visit");
    assert.equal(normalizeBusinessType("real_estate"), "real_estate");
    assert.equal(normalizeBusinessType("trades"), "trades");
    assert.equal(normalizeBusinessType(null), "trades");
    assert.equal(isRealEstate("real_estate"), true);
    assert.equal(isRealEstate("trades"), false);
    assert.equal(isRealEstate(null), false);
  });
});

describe("deal-side badges", () => {
  it("maps stored enum values to presentation labels and hides unset sides", () => {
    assert.equal(dealSideBadgeLabel("buy_side"), "BUYER");
    assert.equal(dealSideBadgeLabel("sell_side"), "SELLER");
    assert.equal(dealSideBadgeLabel("landlord_side"), "LANDLORD");
    assert.equal(dealSideBadgeLabel("tenant_side"), "TENANT");
    assert.equal(dealSideBadgeLabel(null), null);
    assert.equal(dealSideBadgeLabel(undefined), null);
    assert.equal(dealSideBadgeLabel(""), null);
    assert.equal(dealSideBadgeLabel("unknown"), null);
  });
});

describe("display-time remaps", () => {
  it("does not change trades role or composition labels", () => {
    assert.equal(displayRoleColumn("Salesperson", "trades"), "Salesperson");
    assert.equal(displayCompositionLabel("Salespeople", "trades"), "Salespeople");
  });

  it("remaps salesperson labels for real estate without changing metric ids", () => {
    assert.equal(displayRoleColumn("Salesperson", "real_estate"), "Agent");
    assert.equal(displayCompositionLabel("Salespeople", "real_estate"), "Agents");
    assert.equal(displayCompositionLabel("Managers", "real_estate"), "Managers");
  });
});
