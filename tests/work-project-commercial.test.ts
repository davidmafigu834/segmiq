import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
  equipmentLineStatus,
  moneyRound,
  outstandingBalance,
  paymentGate,
  procurementGroups,
  projectPaymentStatus,
  quantityMissing,
  quoteScheduleTerm,
  readinessSummary,
  termAmount,
} from "../lib/work-projects/commercial-rules";

const sql = readFileSync("supabase/migrations/20261004013000_work_project_commercial.sql", "utf8");
const service = readFileSync("lib/work-projects/commercial-service.ts", "utf8");
const dashboard = readFileSync("lib/sales/get-company-sales-dashboard-data.ts", "utf8");
const closeDeal = readFileSync("lib/sales/deals/close-deal.ts", "utf8");

describe("project payments", () => {
  it("calculates percentage and fixed milestones from the project value", () => {
    assert.equal(termAmount({ termType: "PERCENTAGE", percent: 60, amount: null }, 5800), 3480);
    assert.equal(termAmount({ termType: "FIXED_AMOUNT", percent: null, amount: 1800 }, 5800), 1800);
  });

  it("ignores pending money and keeps reversal out of the received balance", () => {
    assert.equal(projectPaymentStatus({ projectValue: 5800, paymentRequired: true, confirmed: 0, refunded: 0, hasTerms: true }), "AWAITING_PAYMENT");
    assert.equal(projectPaymentStatus({ projectValue: 5800, paymentRequired: true, confirmed: 3480, refunded: 0, hasTerms: true }), "PARTIALLY_PAID");
    assert.equal(projectPaymentStatus({ projectValue: 5800, paymentRequired: true, confirmed: 5800, refunded: 0, hasTerms: true }), "PAID");
    assert.equal(projectPaymentStatus({ projectValue: 5800, paymentRequired: true, confirmed: 6000, refunded: 0, hasTerms: true }), "OVERPAID");
    assert.equal(projectPaymentStatus({ projectValue: 5800, paymentRequired: true, confirmed: 0, refunded: 3480, hasTerms: true }), "REFUNDED");
    assert.equal(outstandingBalance(5800, 3480), 2320);
    assert.equal(projectPaymentStatus({ projectValue: 0, paymentRequired: false, confirmed: 0, refunded: 0, hasTerms: false }), "NOT_REQUIRED");
  });

  it("treats the deposit milestone as the payment gate", () => {
    const gate = paymentGate({
      projectValue: 5800,
      terms: [
        { id: "deposit", trigger: "ON_ACCEPTANCE", termType: "PERCENTAGE", percent: 60, amount: null },
        { id: "final", trigger: "ON_COMPLETION", termType: "PERCENTAGE", percent: 40, amount: null },
      ],
      confirmedByTerm: new Map([["deposit", 3480]]),
      unallocatedConfirmed: 0,
    });
    assert.equal(gate.required, 3480);
    assert.equal(gate.satisfied, true);
  });

  it("imports structured quotation terms and leaves prose out of the ledger", () => {
    const term = quoteScheduleTerm({ label: "Deposit", percent: 60, trigger: "on acceptance" });
    assert.equal(term?.termType, "PERCENTAGE");
    assert.equal(term?.trigger, "ON_ACCEPTANCE");
    assert.equal(quoteScheduleTerm({ label: "Pay on completion" }), null);
  });
});

describe("project equipment", () => {
  it("computes partial reservation and ignores labour", () => {
    assert.equal(equipmentLineStatus({ cancelled: false, trackInventory: true, required: 2, reserved: 1, issued: 0 }), "PARTIALLY_RESERVED");
    assert.equal(equipmentLineStatus({ cancelled: false, trackInventory: true, required: 8, reserved: 8, issued: 0 }), "RESERVED");
    assert.equal(equipmentLineStatus({ cancelled: false, trackInventory: false, required: 1, reserved: 0, issued: 0 }), "NOT_STOCKED");
    assert.equal(quantityMissing(2, 1, true), 1);
    assert.equal(quantityMissing(1, 0, false), 0);
  });

  it("groups shortages without treating project value as new revenue", () => {
    const groups = procurementGroups([
      { description: "5.12kWh Battery", missing: 1, projectId: "a", projectValue: 5800 },
      { description: "5.12kWh Battery", missing: 2, projectId: "b", projectValue: 4000 },
    ]);
    assert.equal(groups[0]?.missing, 3);
    assert.equal(groups[0]?.projects, 2);
    assert.equal(groups[0]?.blockedValue, 9800);
    assert.equal(moneyRound(1.005), 1.01);
  });

  it("keeps scheduling readiness separate from project status", () => {
    const ready = readinessSummary({
      paymentStatus: "PARTIALLY_PAID",
      gate: { configured: true, satisfied: true },
      assessmentCompleted: true,
      projectStatus: "SITE_ASSESSMENT",
      trackedRequired: 11,
      trackedReserved: 11,
      missing: [],
    });
    assert.equal(ready.scheduling, "Ready");
    const blocked = readinessSummary({
      paymentStatus: "PARTIALLY_PAID",
      gate: { configured: true, satisfied: true },
      assessmentCompleted: true,
      projectStatus: "SITE_ASSESSMENT",
      trackedRequired: 11,
      trackedReserved: 10,
      missing: [{ description: "5.12kWh Battery", missing: 1 }],
    });
    assert.match(blocked.nextStep, /5.12kWh Battery/);
    assert.equal(blocked.scheduling, "Not ready");
  });
});

describe("commercial safety", () => {
  it("reserves through inventory balances without reducing on hand or touching revenue", () => {
    assert.match(sql, /reserve_work_project_stock/);
    assert.match(sql, /source_type, source_id/);
    assert.match(sql, /'WORK_PROJECT'/);
    assert.match(sql, /SET reserved = COALESCE\(reserved, 0\) \+ v_qty/);
    assert.equal(sql.includes("on_hand ="), false);
    assert.match(sql, /confirm_work_project_payment/);
    assert.match(sql, /PROJECT_FULLY_PAID/);
    assert.match(sql, /ENABLE ROW LEVEL SECURITY/);
    assert.match(sql, /WORK_PROJECT_PAYMENT/);
    assert.equal(sql.includes("subscription_id"), false);
    assert.equal(dashboard.includes("work_project_payments"), false);
    assert.match(dashboard, /won_value/);
    assert.equal(closeDeal.includes("work_project_payments"), false);
    assert.match(service, /Only a manager can confirm a payment/);
    assert.match(service, /Only a manager can reserve stock/);
    assert.match(service, /track_inventory/);
    assert.equal(service.includes("payment_schedule"), true);
    assert.equal(service.includes('.update({ payment_schedule'), false);
  });
});
