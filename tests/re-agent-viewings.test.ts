import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { pickViewingAgentRoute, VIEWING_ROUTE_REASON_LABELS } from "../lib/agent/real-estate/routing";
import { evaluateRealEstateToolPolicy } from "../lib/agent/real-estate/policy";
import { mergeBusyLocalTimes } from "../lib/agent/real-estate/viewing-availability";
import { REAL_ESTATE_AGENT_SETTINGS_DEFAULTS } from "../lib/agent/real-estate/types";
import { buildRealEstatePromptExtension } from "../lib/agent/real-estate/prompt";

describe("pickViewingAgentRoute", () => {
  it("prefers lead owner over listing agent", () => {
    const route = pickViewingAgentRoute(
      [
        { agentId: "owner-1", reason: "lead_owner" },
        { agentId: "listing-1", reason: "listing_agent" },
      ],
      () => true
    );
    assert.equal(route?.agentId, "owner-1");
    assert.equal(route?.reason, "lead_owner");
  });

  it("skips ineligible candidates", () => {
    const route = pickViewingAgentRoute(
      [
        { agentId: "owner-1", reason: "lead_owner" },
        { agentId: "listing-1", reason: "listing_agent" },
      ],
      (id) => id === "listing-1"
    );
    assert.equal(route?.agentId, "listing-1");
  });
});

describe("viewing RE policy", () => {
  it("blocks slot offering when disabled", () => {
    const settings = { ...REAL_ESTATE_AGENT_SETTINGS_DEFAULTS, allowOfferViewingSlots: false };
    assert.equal(evaluateRealEstateToolPolicy("viewing.get_availability", settings).allowed, false);
  });

  it("allows viewing.request_approval by default", () => {
    assert.equal(
      evaluateRealEstateToolPolicy("viewing.request_approval", REAL_ESTATE_AGENT_SETTINGS_DEFAULTS).allowed,
      true
    );
  });

  it("blocks viewing.schedule when confirm is disabled", () => {
    const settings = { ...REAL_ESTATE_AGENT_SETTINGS_DEFAULTS, allowConfirmViewings: false };
    assert.equal(evaluateRealEstateToolPolicy("viewing.schedule", settings).allowed, false);
  });
});

describe("mergeBusyLocalTimes", () => {
  it("deduplicates and sorts busy times", () => {
    assert.deepEqual(mergeBusyLocalTimes(["11:00", "09:00"], ["11:00", "14:00"]), [
      "09:00",
      "11:00",
      "14:00",
    ]);
  });
});

describe("buildRealEstatePromptExtension", () => {
  it("includes viewing coordination rules", () => {
    const text = buildRealEstatePromptExtension();
    assert.match(text, /viewing\.get_availability/i);
    assert.match(text, /viewing\.request_approval/i);
    assert.doesNotMatch(text, /NOT available yet/i);
  });

  it("documents route reason labels", () => {
    assert.equal(VIEWING_ROUTE_REASON_LABELS.listing_agent, "listing agent");
  });
});
