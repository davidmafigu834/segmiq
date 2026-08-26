import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  conversationNeedsStaleResume,
  MAX_STALE_FAILURES,
  STALE_RESUME_AFTER_MS,
  type StaleResumeCandidate,
} from "../lib/agent/stale-resume-policy";

const NOW = new Date("2026-08-26T18:06:00.000Z");

function row(overrides: Partial<StaleResumeCandidate> = {}): StaleResumeCandidate {
  return {
    status: "AI_HANDLING",
    agentEnabled: true,
    humanTakeover: false,
    lastCustomerMessageAt: "2026-08-26T18:01:00.000Z",
    lastAgentMessageAt: "2026-08-26T17:59:00.000Z",
    lockAcquiredAt: "2026-08-26T18:02:51.000Z",
    updatedAt: "2026-08-26T18:02:51.000Z",
    ...overrides,
  };
}

describe("conversationNeedsStaleResume", () => {
  it("resumes AI_HANDLING after the lock TTL when the customer is still waiting", () => {
    assert.equal(conversationNeedsStaleResume(row(), NOW), true);
  });

  it("does not resume a live run under the lock TTL", () => {
    assert.equal(
      conversationNeedsStaleResume(row({ lockAcquiredAt: "2026-08-26T18:05:00.000Z" }), NOW),
      false
    );
  });

  it("does not resume after the agent already replied to that inbound", () => {
    assert.equal(
      conversationNeedsStaleResume(row({ lastAgentMessageAt: "2026-08-26T18:04:00.000Z" }), NOW),
      false
    );
  });

  it("does not resume paused, takeover, or disabled conversations", () => {
    assert.equal(conversationNeedsStaleResume(row({ status: "WAITING_ON_CUSTOMER" }), NOW), false);
    assert.equal(conversationNeedsStaleResume(row({ humanTakeover: true }), NOW), false);
    assert.equal(conversationNeedsStaleResume(row({ agentEnabled: false }), NOW), false);
  });

  it("uses updated_at when the lock timestamp is missing", () => {
    assert.equal(
      conversationNeedsStaleResume(row({ lockAcquiredAt: null, updatedAt: "2026-08-26T18:02:51.000Z" }), NOW),
      true
    );
  });

  it("resumes a rate-limit HUMAN_NEEDED hold after the cool-down", () => {
    assert.equal(
      conversationNeedsStaleResume(
        row({
          status: "HUMAN_NEEDED",
          humanNeededReason: "Agent rate limit reached",
          lockAcquiredAt: null,
        }),
        NOW
      ),
      true
    );
  });

  it("does not resume a genuine human-needed handoff", () => {
    assert.equal(
      conversationNeedsStaleResume(
        row({
          status: "HUMAN_NEEDED",
          humanNeededReason: "Customer asked for a person",
        }),
        NOW
      ),
      false
    );
  });

  it("aligns the cool-down window with the conversation lock TTL", () => {
    assert.equal(STALE_RESUME_AFTER_MS, 3 * 60 * 1000);
    assert.ok(MAX_STALE_FAILURES >= 2);
  });
});
