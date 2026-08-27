import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { replyHandsOffToTeam } from "../lib/agent/team-handoff";

describe("replyHandsOffToTeam", () => {
  it("flags promises to ask or confirm with the team", () => {
    assert.equal(
      replyHandsOffToTeam("I don't have the exact figure — I'll ask the team and get back to you."),
      true
    );
    assert.equal(replyHandsOffToTeam("Let me confirm with the team on payment terms."), true);
    assert.equal(replyHandsOffToTeam("The team will get back to you on that."), true);
    assert.equal(replyHandsOffToTeam("I can check with the technical team."), true);
  });

  it("does not flag ordinary team mentions", () => {
    assert.equal(replyHandsOffToTeam("Our team installs residential solar across Harare."), false);
    assert.equal(replyHandsOffToTeam("Welcome to Ecolus Energy. How can we help today?"), false);
    assert.equal(replyHandsOffToTeam(""), false);
  });
});
