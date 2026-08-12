import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  attentionBadgeTone,
  compareDealsByAttention,
  dealAgeDays,
  getDealAttentionState,
} from "../lib/sales/deals/attention";
import type { DealRow } from "../types";

function baseDeal(overrides: Partial<DealRow> = {}): DealRow {
  return {
    id: "d1",
    client_id: "c1",
    contact_id: null,
    originating_lead_id: "l1",
    owner_id: "u1",
    name: "Solar install",
    service_summary: null,
    stage: "SCOPING",
    value_status: "KNOWN",
    value_basis: "SALES_ESTIMATE",
    estimated_value: 5000,
    estimated_value_min: null,
    estimated_value_max: null,
    customer_budget: null,
    sales_estimate: 5000,
    expected_decision_at: null,
    location: null,
    buying_timeframe: null,
    decision_maker_status: null,
    decision_maker_name: null,
    next_action_at: null,
    next_action_label: null,
    won_value: null,
    won_at: null,
    lost_at: null,
    lost_reason: null,
    last_meaningful_activity_at: new Date().toISOString(),
    metadata: {},
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

describe("getDealAttentionState", () => {
  it("flags no next action as at risk", () => {
    const att = getDealAttentionState(baseDeal({ next_action_at: null }));
    assert.equal(att.code, "NO_NEXT_ACTION");
    assert.equal(att.atRisk, true);
    assert.equal(att.badge, "No next action");
    assert.equal(att.needsAttention, true);
  });

  it("flags overdue follow-up", () => {
    const past = new Date(Date.now() - 86_400_000).toISOString();
    const att = getDealAttentionState(
      baseDeal({ next_action_at: past, next_action_label: "Follow up" })
    );
    assert.equal(att.code, "FOLLOWUP_OVERDUE");
    assert.equal(att.badge, "Overdue");
  });

  it("returns no attention chrome for healthy deal with future action", () => {
    const future = new Date(Date.now() + 14 * 86_400_000).toISOString();
    const att = getDealAttentionState(
      baseDeal({
        next_action_at: future,
        next_action_label: "Site visit",
        last_meaningful_activity_at: new Date().toISOString(),
      })
    );
    assert.equal(att.needsAttention, false);
    assert.equal(att.badge, null);
  });

  it("ignores closed stages", () => {
    const att = getDealAttentionState(baseDeal({ stage: "WON", next_action_at: null }));
    assert.equal(att.needsAttention, false);
    assert.equal(att.urgency, 0);
  });
});

describe("attention helpers", () => {
  it("maps badge tones", () => {
    assert.equal(attentionBadgeTone("Overdue"), "danger");
    assert.equal(attentionBadgeTone("Due today"), "warning");
    assert.equal(attentionBadgeTone(null), "neutral");
  });

  it("sorts by urgency then next action", () => {
    const a = baseDeal({
      id: "a",
      next_action_at: new Date(Date.now() + 10_000).toISOString(),
    });
    const b = baseDeal({
      id: "b",
      next_action_at: new Date(Date.now() + 20_000).toISOString(),
    });
    assert.ok(compareDealsByAttention({ deal: a, urgency: 90 }, { deal: b, urgency: 50 }) < 0);
  });

  it("computes deal age in days", () => {
    const created = new Date(Date.now() - 3 * 86_400_000).toISOString();
    assert.equal(dealAgeDays(created), 3);
  });
});
