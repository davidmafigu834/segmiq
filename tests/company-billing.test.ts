import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  CRM_PLAN_FEATURES,
  CRM_PLAN_MONTHLY_USD,
  CRM_PLAN_SEATS,
  getPlanAmount,
  isCrmPlan,
  planLabel,
} from "../lib/billing/plans";
import { formatBillingMoney, maskSecretTail } from "../lib/billing/format";
import {
  billedCadenceLabel,
  invoiceStatusLabel,
  invoiceStatusTone,
  subscriptionStatusLabel,
  usageBarTone,
  usagePercent,
} from "../lib/billing/status";
import { resolveBillingAccess } from "../lib/billing/client-access";

describe("company billing catalogue", () => {
  it("uses real Starter / Growth / Scale prices and seats", () => {
    assert.equal(CRM_PLAN_MONTHLY_USD.starter, 99);
    assert.equal(CRM_PLAN_MONTHLY_USD.growth, 199);
    assert.equal(CRM_PLAN_MONTHLY_USD.scale, 349);
    assert.equal(CRM_PLAN_SEATS.starter, 5);
    assert.equal(CRM_PLAN_SEATS.growth, 15);
    assert.equal(CRM_PLAN_SEATS.scale, null);
    assert.equal(planLabel("growth"), "Growth");
    assert.equal(isCrmPlan("enterprise"), false);
    assert.ok(CRM_PLAN_FEATURES.growth.length >= 3);
  });

  it("snapshots annual catalogue amount as 10 months", () => {
    assert.equal(getPlanAmount("growth", "annual"), 1990);
    assert.equal(getPlanAmount("growth", "monthly"), 199);
  });
});

describe("company billing formatters", () => {
  it("formats money with the billing currency", () => {
    assert.equal(formatBillingMoney(149, "USD"), "$149.00");
    assert.equal(formatBillingMoney(null, "USD"), "$0.00");
  });

  it("masks payment account tails without exposing the full number", () => {
    assert.equal(maskSecretTail("123456789012"), "•••• 9012");
    assert.equal(maskSecretTail(null), null);
  });

  it("maps provider statuses to human labels", () => {
    assert.equal(subscriptionStatusLabel("past_due"), "Past due");
    assert.equal(invoiceStatusLabel("sent"), "Open");
    assert.equal(invoiceStatusLabel("overdue"), "Past due");
    assert.equal(invoiceStatusTone("paid"), "success");
    assert.equal(billedCadenceLabel("monthly"), "Billed monthly");
  });
});

describe("company billing usage meters", () => {
  it("does not invent a percentage for unlimited entitlements", () => {
    assert.equal(usagePercent(12, null), null);
    assert.equal(usagePercent(12, 0), null);
    assert.equal(usagePercent(12, 20), 60);
    assert.equal(usageBarTone(79), "brand");
    assert.equal(usageBarTone(80), "warning");
    assert.equal(usageBarTone(95), "danger");
  });
});

describe("company billing access", () => {
  it("allows company managers and denies team salespeople", () => {
    assert.equal(
      resolveBillingAccess({ userId: "u", role: "CLIENT_MANAGER", clientId: "c" }),
      "allow"
    );
    assert.equal(
      resolveBillingAccess({ userId: "u", role: "SALESPERSON", clientId: "c", clientMode: "team" }),
      "deny"
    );
    assert.equal(
      resolveBillingAccess({ userId: "u", role: "SALESPERSON", clientId: "c", clientMode: "solo" }),
      "allow"
    );
    assert.equal(resolveBillingAccess({ role: "CLIENT_MANAGER" }), "deny");
  });
});
