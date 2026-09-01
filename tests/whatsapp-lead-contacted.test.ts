import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  deriveFirstRespondedAt,
  deriveLastMeaningfulActivityAt,
} from "@/lib/sales/intelligence/meaningful-activity";

describe("WhatsApp outbound counts as first contact", () => {
  it("deriveFirstRespondedAt uses outbound WhatsApp when no calls exist", () => {
    const at = "2026-08-15T14:00:00.000Z";
    const first = deriveFirstRespondedAt([], [], [at]);
    assert.equal(first, at);
  });

  it("deriveLastMeaningfulActivityAt uses outbound WhatsApp", () => {
    const older = "2026-08-15T14:00:00.000Z";
    const newer = "2026-08-16T09:00:00.000Z";
    const last = deriveLastMeaningfulActivityAt([], [], [older, newer]);
    assert.equal(last, newer);
  });

  it("picks earliest across calls, events, and WhatsApp", () => {
    const wa = "2026-08-15T10:00:00.000Z";
    const call = "2026-08-14T12:00:00.000Z";
    const first = deriveFirstRespondedAt(
      [{ event_type: "MESSAGE_SENT", created_at: "2026-08-16T08:00:00.000Z" }],
      [call],
      [wa]
    );
    assert.equal(first, call);
  });
});
