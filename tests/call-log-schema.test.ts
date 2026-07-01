import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { logCallBodySchema } from "../lib/call-log-schema";

const futureCallback = () => new Date(Date.now() + 60 * 60 * 1000).toISOString();

describe("call log validation", () => {
  it("accepts a completed reached call", () => {
    const result = logCallBodySchema.safeParse({
      reachOutcome: "reached",
      result: "won",
      dealValue: 1200,
    });

    assert.equal(result.success, true);
  });

  it("requires a reason when a reached lead is lost", () => {
    const result = logCallBodySchema.safeParse({
      reachOutcome: "reached",
      result: "lost",
    });

    assert.equal(result.success, false);
    assert.equal(result.error?.issues.some((issue) => issue.path[0] === "reason"), true);
  });

  it("requires a scheduled time for callbacks", () => {
    const result = logCallBodySchema.safeParse({ reachOutcome: "call_back" });

    assert.equal(result.success, false);
    assert.equal(result.error?.issues.some((issue) => issue.path[0] === "callbackAt"), true);
  });

  it("accepts a callback scheduled in the future", () => {
    const result = logCallBodySchema.safeParse({
      reachOutcome: "call_back",
      callbackAt: futureCallback(),
    });

    assert.equal(result.success, true);
  });

  it("rejects malformed callback timestamps", () => {
    const result = logCallBodySchema.safeParse({
      reachOutcome: "call_back",
      callbackAt: "not-a-date",
    });

    assert.equal(result.success, false);
    assert.equal(result.error?.issues.some((issue) => issue.message === "Invalid callback time"), true);
  });
});
