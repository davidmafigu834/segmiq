import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { extractCommitmentsFromText } from "../lib/sales/attention/commitment-extract";
import { resolvePipelineAttentionBadge } from "../lib/sales/attention/pipeline-badge";
import { evaluateDealNextBestAction } from "../lib/sales/attention/next-best-action";
import type { DealRow } from "../types";

describe("extractCommitmentsFromText", () => {
  it("extracts customer Friday follow-up", () => {
    const now = new Date("2026-09-01T10:00:00Z"); // Tuesday
    const out = extractCommitmentsFromText({
      body: "Let me talk to my wife and you can check with me Friday.",
      direction: "inbound",
      now,
    });
    assert.equal(out.length, 1);
    assert.equal(out[0]!.committedBy, "CUSTOMER");
    assert.ok(out[0]!.dueAt);
    assert.equal(out[0]!.dueRule, "friday");
  });

  it("extracts salesperson send commitment", () => {
    const out = extractCommitmentsFromText({
      body: "I'll send you the revised quote tomorrow.",
      direction: "outbound",
      now: new Date("2026-09-02T10:00:00Z"),
    });
    assert.equal(out.length, 1);
    assert.equal(out[0]!.committedBy, "SALESPERSON");
    assert.ok(out[0]!.dueAt);
  });

  it("ignores non-commitment chatter", () => {
    const out = extractCommitmentsFromText({
      body: "Thanks, that sounds good.",
      direction: "inbound",
    });
    assert.equal(out.length, 0);
  });
});

describe("resolvePipelineAttentionBadge", () => {
  const deal = {
    stage: "PROPOSAL_SENT",
    next_action_at: new Date(Date.now() + 86400000).toISOString(),
    next_action_label: "Follow up",
    expected_decision_at: null,
    last_meaningful_activity_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    value_status: "KNOWN",
  } as DealRow;

  it("prefers customer waiting overlay", () => {
    const badge = resolvePipelineAttentionBadge({
      deal,
      awaitingReplyMinutes: 95,
    });
    assert.equal(badge?.code, "CUSTOMER_WAITING");
    assert.match(badge!.label, /Waiting/);
  });

  it("shows wait until when intentional", () => {
    const badge = resolvePipelineAttentionBadge({
      deal: {
        ...deal,
        wait_until: new Date(Date.now() + 5 * 86400000).toISOString(),
      },
    });
    assert.equal(badge?.code, "WAIT_UNTIL");
  });
});

describe("evaluateDealNextBestAction wait_until column", () => {
  it("reads wait_until from deal", () => {
    const friday = new Date(Date.now() + 4 * 86400000).toISOString();
    const nba = evaluateDealNextBestAction({
      deal: {
        id: "d1",
        stage: "NEGOTIATING",
        next_action_at: null,
        next_action_label: null,
        expected_decision_at: null,
        last_meaningful_activity_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        value_status: "KNOWN",
        originating_lead_id: "l1",
        wait_until: friday,
        wait_reason: "Customer asked to wait",
      } as DealRow,
    });
    assert.equal(nba.actionType, "WAIT_UNTIL");
  });
});
