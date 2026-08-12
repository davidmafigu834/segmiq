import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveNextStatus } from "../lib/call-log-save";

describe("resolveNextStatus lead lifecycle", () => {
  it("does not mark Contacted on no_answer", () => {
    assert.equal(resolveNextStatus("NEW", "no_answer", null), null);
  });

  it("does not mark Contacted on call_back alone", () => {
    assert.equal(resolveNextStatus("NEW", "call_back", null), null);
  });

  it("marks Contacted on first reached conversation", () => {
    assert.equal(resolveNextStatus("NEW", "reached", "qualifying"), "CONTACTED");
    assert.equal(resolveNextStatus("NEW", "reached", "follow_up"), "CONTACTED");
  });

  it("marks Qualified on qualified opportunity", () => {
    assert.equal(resolveNextStatus("CONTACTED", "reached", "qualified"), "QUALIFIED");
  });

  it("marks Not qualified without creating a deal status", () => {
    assert.equal(resolveNextStatus("CONTACTED", "reached", "not_qualified"), "NOT_QUALIFIED");
  });

  it("does not write WON/LOST onto the lead", () => {
    assert.equal(resolveNextStatus("CONTACTED", "reached", "won"), null);
    assert.equal(resolveNextStatus("CONTACTED", "reached", "lost"), null);
  });
});
