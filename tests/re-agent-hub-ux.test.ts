import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  actionCardFromBlockedAction,
  actionCardFromEscalation,
  buildAgentActionCards,
} from "../lib/agent/hub-action-cards";
import { resolveReNextBestAction } from "../lib/agent/real-estate/next-best-action";
import { matchesInboxFilter } from "../lib/inbox/queue-filters";
import type { InboxConversation } from "../lib/inbox/types";

describe("buildAgentActionCards", () => {
  it("prefers escalation viewing card over duplicate blocked action", () => {
    const cards = buildAgentActionCards({
      openEscalation: {
        id: "esc-1",
        reason: "COMMERCIAL_APPROVAL",
        summary: "Viewing approval needed",
        briefing: {
          cardType: "VIEWING_APPROVAL",
          property_label: "2-bed in Borrowdale",
          date: "2026-09-02",
          time: "10:00",
          requested_for: "2026-09-02 at 10:00",
        },
      },
      blockedActions: [
        {
          id: "act-1",
          toolName: "viewing.schedule",
          label: "Schedule viewing",
          inputSummary: { date: "2026-09-02", time: "10:00", listing_id: "listing-1" },
        },
      ],
    });
    assert.equal(cards.length, 1);
    assert.equal(cards[0]?.type, "VIEWING_APPROVAL");
    assert.equal(cards[0]?.primaryLabel, "Approve viewing");
  });
});

describe("actionCardFromEscalation", () => {
  it("maps COMMERCIAL_APPROVAL briefing to viewing approval card", () => {
    const card = actionCardFromEscalation({
      id: "esc-1",
      reason: "COMMERCIAL_APPROVAL",
      summary: "Viewing approval",
      briefing: {
        cardType: "VIEWING_APPROVAL",
        property_label: "Garden flat",
        date: "2026-09-03",
        time: "14:30",
      },
    });
    assert.ok(card);
    assert.equal(card?.type, "VIEWING_APPROVAL");
    assert.deepEqual(card?.inputSummary, {
      listing_id: undefined,
      date: "2026-09-03",
      time: "14:30",
      customer_request: undefined,
    });
  });
});

describe("actionCardFromBlockedAction", () => {
  it("maps blocked viewing.schedule to approval card", () => {
    const card = actionCardFromBlockedAction({
      id: "act-1",
      toolName: "viewing.schedule",
      label: "Schedule viewing",
      inputSummary: { property: "Townhouse", date: "2026-09-04", time: "09:00" },
    });
    assert.ok(card);
    assert.equal(card?.type, "VIEWING_SCHEDULE_BLOCKED");
  });
});

describe("resolveReNextBestAction", () => {
  it("prioritises handoff when human needed", () => {
    const action = resolveReNextBestAction({
      dealSide: "buy_side",
      matchReady: true,
      hasUpcomingViewing: false,
      hasLinkedListing: true,
      humanNeeded: true,
    });
    assert.equal(action.id, "review_handoff");
  });
});

describe("RE inbox queue filters", () => {
  const base = {
    id: "lead-1",
    agentStatus: "HUMAN_NEEDED" as const,
    agentHumanNeededReason: "VIEWING_APPROVAL",
  } as InboxConversation;

  it("matches viewing_requests only for viewing approval reason", () => {
    assert.equal(matchesInboxFilter(base, "viewing_requests", "user-1"), true);
    assert.equal(
      matchesInboxFilter(
        { ...base, agentHumanNeededReason: "LOW_CONFIDENCE" } as InboxConversation,
        "viewing_requests",
        "user-1"
      ),
      false
    );
  });

  it("matches ai_handling for AI statuses", () => {
    assert.equal(
      matchesInboxFilter(
        { ...base, agentStatus: "AI_HANDLING", agentHumanNeededReason: null } as InboxConversation,
        "ai_handling",
        "user-1"
      ),
      true
    );
  });
});
