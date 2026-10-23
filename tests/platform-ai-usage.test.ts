import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  calculateQuota,
  isBillableInternalAction,
  isWithinRollingWindow,
  usageThreshold,
} from "../lib/platform-ai-usage/quota";

describe("Release 4 rolling conversation windows", () => {
  const opened = "2026-10-23T10:00:00.000Z";

  it("keeps successful handling inside the half-open 24-hour window", () => {
    assert.equal(
      isWithinRollingWindow(opened, "2026-10-24T09:59:59.999Z"),
      true,
    );
  });

  it("opens a new conversation at exactly 24 hours", () => {
    assert.equal(
      isWithinRollingWindow(opened, "2026-10-24T10:00:00.000Z"),
      false,
    );
  });
});

describe("Release 4 quota reporting", () => {
  it("adds active top-ups without changing the included allowance", () => {
    assert.deepEqual(calculateQuota(500, 410, 250), {
      included: 500,
      topups: 250,
      consumed: 410,
      available: 340,
      percent: 54,
      threshold: 0,
    });
  });

  it("uses the 80, 95 and 100 percent warning boundaries", () => {
    assert.equal(usageThreshold(79), 0);
    assert.equal(usageThreshold(80), 80);
    assert.equal(usageThreshold(95), 95);
    assert.equal(usageThreshold(100), 100);
  });
});

describe("Release 4 internal action allowlist", () => {
  it("counts one completed autonomous allowlisted business action", () => {
    assert.equal(
      isBillableInternalAction({
        toolName: "deal_create",
        status: "EXECUTED",
        testMode: false,
      }),
      true,
    );
  });

  it("fails closed for reads, failures, tests and human-approved actions", () => {
    assert.equal(
      isBillableInternalAction({
        toolName: "catalog_search",
        status: "EXECUTED",
        testMode: false,
      }),
      false,
    );
    assert.equal(
      isBillableInternalAction({
        toolName: "deal_create",
        status: "FAILED",
        testMode: false,
      }),
      false,
    );
    assert.equal(
      isBillableInternalAction({
        toolName: "deal_create",
        status: "EXECUTED",
        testMode: true,
      }),
      false,
    );
    assert.equal(
      isBillableInternalAction({
        toolName: "deal_create",
        status: "EXECUTED",
        testMode: false,
        humanApproved: true,
      }),
      false,
    );
  });
});
