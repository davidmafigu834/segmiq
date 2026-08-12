import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  getDealCommercialValue,
  getDealNumericValueForCoverage,
  getDealNextActionState,
} from "../lib/sales/deals";
import { reasonText } from "../lib/sales/intelligence/reasons";
import { firstQualifyingResponseMinutes } from "../lib/sales/intelligence/meaningful-activity";
import { formatTrend } from "../lib/sales/sales-dashboard-display";

describe("dashboard commercial value semantics", () => {
  it("never treats pending estimate as numeric zero for pipeline", () => {
    const pending = getDealCommercialValue({
      stage: "QUALIFIED",
      value_status: "PENDING_ESTIMATE",
      value_basis: null,
      estimated_value: null,
      estimated_value_min: null,
      estimated_value_max: null,
      customer_budget: null,
      sales_estimate: null,
      won_value: null,
    });
    assert.equal(pending.kind, "pending");
    assert.equal(pending.display.toLowerCase().includes("not estimated"), true);
    assert.equal(
      getDealNumericValueForCoverage({
        stage: "QUALIFIED",
        value_status: "PENDING_ESTIMATE",
        value_basis: null,
        estimated_value: null,
        estimated_value_min: null,
        estimated_value_max: null,
        customer_budget: null,
        sales_estimate: null,
        won_value: null,
      }),
      null
    );
  });

  it("sums only known values across mixed deals", () => {
    const known = getDealNumericValueForCoverage({
      stage: "SCOPING",
      value_status: "KNOWN",
      value_basis: "SALES_ESTIMATE",
      estimated_value: 12000,
      estimated_value_min: null,
      estimated_value_max: null,
      customer_budget: null,
      sales_estimate: 12000,
      won_value: null,
    });
    const pending = getDealNumericValueForCoverage({
      stage: "QUALIFIED",
      value_status: "PENDING_ESTIMATE",
      value_basis: null,
      estimated_value: null,
      estimated_value_min: null,
      estimated_value_max: null,
      customer_budget: null,
      sales_estimate: null,
      won_value: null,
    });
    assert.equal(known, 12000);
    assert.equal(pending, null);
    const pipeline = [known, pending]
      .filter((n): n is number => n != null)
      .reduce((a, b) => a + b, 0);
    assert.equal(pipeline, 12000);
  });
});

describe("dashboard attention reasons", () => {
  it("uses shared reason text for no next action", () => {
    const state = getDealNextActionState({
      stage: "NEGOTIATING",
      next_action_at: null,
      next_action_label: null,
    });
    assert.equal(state.hasNextAction, false);
    assert.match(reasonText("NO_NEXT_ACTION"), /nothing is scheduled/i);
  });
});

describe("dashboard trend safety", () => {
  it("does not emit Infinity when previous period is zero", () => {
    const t = formatTrend(5, 0);
    assert.equal(t.direction, "new");
    assert.equal(t.label, "New");
  });
});

describe("first qualifying response", () => {
  it("uses outbound WhatsApp / events, not only call logs", () => {
    const mins = firstQualifyingResponseMinutes(
      [{ id: "l1", created_at: "2026-08-11T10:00:00.000Z" }],
      {
        callAtsByLead: new Map(),
        outboundWaByLead: new Map([["l1", ["2026-08-11T10:05:00.000Z"]]]),
        eventsByLead: new Map(),
      }
    );
    assert.equal(mins, 5);
  });
});
