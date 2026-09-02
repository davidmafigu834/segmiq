import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  detectCustomerWaiting,
  formatWaitingDuration,
} from "../lib/sales/attention/customer-waiting";
import {
  attentionTypeFromReason,
  compareAttentionItems,
  priorityClassForReason,
  suggestedActionFromAttention,
} from "../lib/sales/attention/priority";
import { evaluateDealNextBestAction } from "../lib/sales/attention/next-best-action";
import { draftFollowupMessage } from "../lib/sales/attention/draft-followup";
import { mapRecommendationToAttentionItem } from "../lib/sales/attention/map-from-plan";
import type { SalesActionRecommendation } from "../lib/sales/intelligence/types";
import type { DealRow } from "../types";

describe("detectCustomerWaiting", () => {
  it("flags unanswered meaningful inbound as waiting", () => {
    const now = new Date("2026-09-02T12:00:00Z");
    const result = detectCustomerWaiting({
      now,
      messages: [
        {
          direction: "inbound",
          created_at: "2026-09-02T10:00:00Z",
          body: "Can you send me the quotation today?",
        },
      ],
    });
    assert.equal(result.isWaiting, true);
    assert.equal(result.waitingReason, "CUSTOMER_UNANSWERED");
    assert.equal(result.waitingDurationMinutes, 120);
  });

  it("clears waiting after outbound reply", () => {
    const result = detectCustomerWaiting({
      messages: [
        { direction: "inbound", created_at: "2026-09-02T10:00:00Z", body: "Hello" },
        { direction: "outbound", created_at: "2026-09-02T10:05:00Z", body: "Hi, on it" },
      ],
    });
    assert.equal(result.isWaiting, false);
    assert.equal(result.suppressedReason, "ANSWERED");
  });

  it("suppresses support queue and resolved conversations", () => {
    const support = detectCustomerWaiting({
      messages: [{ direction: "inbound", created_at: "2026-09-02T10:00:00Z", body: "Help" }],
      meta: { queue: "SUPPORT" },
    });
    assert.equal(support.isWaiting, false);
    assert.equal(support.suppressedReason, "SUPPORT_QUEUE");

    const resolved = detectCustomerWaiting({
      messages: [{ direction: "inbound", created_at: "2026-09-02T10:00:00Z", body: "Help" }],
      meta: { conversationStatus: "RESOLVED" },
    });
    assert.equal(resolved.isWaiting, false);
  });

  it("suppresses when another human is handling", () => {
    const result = detectCustomerWaiting({
      messages: [{ direction: "inbound", created_at: "2026-09-02T10:00:00Z", body: "Hi" }],
      meta: {
        handledByOtherUserId: "u2",
        currentUserId: "u1",
      },
    });
    assert.equal(result.isWaiting, false);
    assert.equal(result.suppressedReason, "HANDLED_BY_OTHER");
  });

  it("formats waiting duration", () => {
    assert.equal(formatWaitingDuration(14), "14m");
    assert.equal(formatWaitingDuration(134), "2h 14m");
  });
});

describe("attention priority classes", () => {
  it("maps customer waiting to IMMEDIATE", () => {
    assert.equal(priorityClassForReason("CUSTOMER_WAITING"), "IMMEDIATE");
    assert.equal(attentionTypeFromReason("CUSTOMER_WAITING"), "CUSTOMER_WAITING");
  });

  it("maps quote viewed to WATCH (not creepy immediate contact)", () => {
    assert.equal(priorityClassForReason("QUOTE_VIEWED"), "WATCH");
  });

  it("maps no next action to NEEDS_PROGRESS", () => {
    assert.equal(priorityClassForReason("NO_NEXT_ACTION"), "NEEDS_PROGRESS");
    assert.equal(suggestedActionFromAttention("DEAL_NO_NEXT_ACTION"), "CREATE_TASK");
  });

  it("sorts IMMEDIATE before TODAY", () => {
    const a = {
      priorityClass: "TODAY" as const,
      internalScore: 99,
      dueAt: null,
      fingerprint: "a",
    };
    const b = {
      priorityClass: "IMMEDIATE" as const,
      internalScore: 10,
      dueAt: null,
      fingerprint: "b",
    };
    assert.ok(compareAttentionItems(a, b) > 0);
  });
});

describe("evaluateDealNextBestAction", () => {
  function deal(overrides: Partial<DealRow> = {}): DealRow {
    return {
      id: "d1",
      client_id: "c1",
      contact_id: null,
      originating_lead_id: "l1",
      owner_id: "u1",
      name: "Solar",
      service_summary: null,
      stage: "PROPOSAL_SENT",
      value_status: "KNOWN",
      value_basis: "SALES_ESTIMATE",
      estimated_value: 1000,
      estimated_value_min: null,
      estimated_value_max: null,
      customer_budget: null,
      sales_estimate: 1000,
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

  it("returns WAIT_UNTIL when intentional wait is set", () => {
    const friday = new Date(Date.now() + 5 * 86_400_000).toISOString();
    const nba = evaluateDealNextBestAction({
      deal: deal(),
      waitUntil: friday,
      waitReason: "Customer asked to wait until Friday",
    });
    assert.equal(nba.actionType, "WAIT_UNTIL");
    assert.equal(nba.priorityClass, "WATCH");
  });

  it("returns CREATE_TASK when active deal has no next action", () => {
    const nba = evaluateDealNextBestAction({ deal: deal({ next_action_at: null }) });
    assert.equal(nba.actionType, "CREATE_TASK");
    assert.equal(nba.reasonCode, "NO_NEXT_ACTION");
  });

  it("does not auto-won closed deals", () => {
    const nba = evaluateDealNextBestAction({ deal: deal({ stage: "WON" }) });
    assert.equal(nba.actionType, "NO_ACTION_REQUIRED");
  });
});

describe("draftFollowupMessage", () => {
  it("does not invent delivery promises when delivery is asked", () => {
    const item = mapRecommendationToAttentionItem({
      companyId: "c1",
      salespersonId: "u1",
      rec: {
        id: "1",
        idempotencyKey: "k1",
        actionType: "RESPOND_TO_CUSTOMER",
        origin: "SYSTEM_RECOMMENDED",
        sourceEntityType: "lead",
        sourceEntityId: "l1",
        attentionScore: 90,
        title: "Tendai",
        subtitle: null,
        recommendedActionLabel: "Reply",
        reasonCode: "CUSTOMER_WAITING",
        reason: "Customer asked about delivery",
        urgencyLabel: "2h",
        dueAt: null,
        customer: {
          leadId: "l1",
          name: "Tendai Moyo",
          phone: "+263",
          score: null,
          scoreBand: null,
          source: "WHATSAPP_INBOUND",
          status: "QUALIFIED",
          projectType: null,
          dealValue: null,
        },
        availableActions: ["whatsapp", "open_lead"],
        metadata: {},
      } satisfies SalesActionRecommendation,
    });
    const draft = draftFollowupMessage({
      item,
      summary: { customerNeed: null, importantRequirements: [], whatHappened: null, customerPosition: "Is delivery included?", openQuestions: [], commitment: null, recommendedContext: null },
    });
    assert.match(draft.body, /confirm/i);
    assert.ok(draft.warnings.length > 0);
    assert.doesNotMatch(draft.body, /free delivery|included for sure/i);
  });
});
