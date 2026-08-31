import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  conversationAllowsAutoReply,
  conversationAllowsCopilotAssist,
  patchForConversationMode,
  resolveConversationMode,
} from "../lib/agent/real-estate/conversation-mode";
import { serializeRealEstateAgentContext } from "../lib/agent/real-estate/context";
import type { AgentConversationState } from "../lib/agent/types";
import { conversationAllowsAgent } from "../lib/agent/conversation-state";
import { realEstateSettingsFromRow } from "../lib/agent/real-estate/settings";

function baseState(
  patch: Partial<AgentConversationState> = {}
): AgentConversationState {
  return {
    leadId: "lead-1",
    clientId: "client-1",
    agentEnabled: true,
    status: "AI_HANDLING",
    humanNeededReason: null,
    pausedUntil: null,
    pausedById: null,
    pauseReason: null,
    humanTakeover: false,
    conversationMode: "AI_HANDLING",
    lastAgentMessageAt: null,
    lastHumanMessageAt: null,
    lastCustomerMessageAt: null,
    pendingExecutionId: null,
    lockAcquiredAt: null,
    ...patch,
  };
}

describe("re agent conversation modes", () => {
  it("AI_HANDLING allows auto-reply", () => {
    assert.equal(conversationAllowsAutoReply("AI_HANDLING"), true);
    assert.equal(conversationAllowsAgent(baseState()).allowed, true);
  });

  it("AI_COPILOT blocks auto-reply but allows copilot assist", () => {
    assert.equal(conversationAllowsAutoReply("AI_COPILOT"), false);
    assert.equal(conversationAllowsCopilotAssist("AI_COPILOT"), true);
    const gate = conversationAllowsAgent(baseState({ conversationMode: "AI_COPILOT", humanTakeover: true }));
    assert.equal(gate.allowed, false);
    if (!gate.allowed) assert.equal(gate.reason, "HUMAN_TAKEOVER");
  });

  it("HUMAN_ONLY blocks auto-reply", () => {
    assert.equal(conversationAllowsAutoReply("HUMAN_ONLY"), false);
    const gate = conversationAllowsAgent(
      baseState({ conversationMode: "HUMAN_ONLY", status: "PAUSED" })
    );
    assert.equal(gate.allowed, false);
    if (!gate.allowed) assert.equal(gate.reason, "HUMAN_ONLY_MODE");
  });

  it("takeover patch sets AI_COPILOT", () => {
    const patch = patchForConversationMode("AI_COPILOT");
    assert.equal(patch.conversationMode, "AI_COPILOT");
    assert.equal(patch.humanTakeover, true);
    assert.equal(patch.status, "HUMAN_HANDLING");
  });

  it("resolves legacy human_takeover to AI_COPILOT", () => {
    assert.equal(
      resolveConversationMode(baseState({ conversationMode: undefined as never, humanTakeover: true })),
      "AI_COPILOT"
    );
  });
});

describe("re agent settings row mapping", () => {
  it("defaults when columns missing", () => {
    const settings = realEstateSettingsFromRow(null);
    assert.equal(settings.autoRespondAdInquiries, true);
    assert.equal(settings.requireViewingApproval, true);
    assert.equal(settings.defaultConversationMode, "AI_HANDLING");
  });
});

describe("serializeRealEstateAgentContext", () => {
  it("includes listing facts and never invents attribution", () => {
    const text = serializeRealEstateAgentContext({
      dealSide: "buy_side",
      dealSideLabel: "BUYER",
      linkedListingId: "listing-1",
      originatingListing: {
        id: "listing-1",
        label: "12 Burnside Road",
        transactionType: "sale",
        status: "Available",
        price: 155000,
        bedrooms: 4,
        bathrooms: 2,
        suburb: "Burnside",
        address: "12 Burnside Road",
        externalReference: "BR-12",
        agentId: "agent-1",
        agentName: "Rumbidzai Ncube",
      },
      attribution: {
        sourceType: "facebook",
        sourceLabel: "Facebook Ads",
        campaignName: "Burnside House Campaign",
        adName: null,
        listingId: "listing-1",
        formPrequalified: false,
        capturedAt: "2026-08-31T10:00:00.000Z",
      },
      buyerRequirements: null,
      viewingAgent: {
        agentId: "agent-1",
        agentName: "Rumbidzai Ncube",
        routeReason: "listing_agent",
        routeReasonLabel: "listing agent",
      },
      upcomingViewings: [],
    });
    assert.match(text, /12 Burnside Road/);
    assert.match(text, /155000/);
    assert.match(text, /Burnside House Campaign/);
    assert.match(text, /do not guess/i);
  });

  it("states when no property is linked", () => {
    const text = serializeRealEstateAgentContext({
      dealSide: null,
      dealSideLabel: null,
      linkedListingId: null,
      originatingListing: null,
      attribution: null,
      buyerRequirements: null,
      viewingAgent: null,
      upcomingViewings: [],
    });
    assert.match(text, /No property linked/);
    assert.match(text, /No campaign or ad attribution/);
  });
});
