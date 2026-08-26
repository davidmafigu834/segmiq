import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseAgentFinalOutput } from "../lib/agent/prompt";

const valid = {
  intents: ["QUOTATION_REQUEST"],
  confidence: 0.8,
  decision_summary: "Customer asked us to go ahead with a quotation.",
  evidence: "Please go ahead",
  reply: "I'll prepare that now.",
};

describe("parseAgentFinalOutput", () => {
  it("parses a clean JSON object", () => {
    const parsed = parseAgentFinalOutput(JSON.stringify(valid));
    assert.equal(parsed?.reply, "I'll prepare that now.");
    assert.equal(parsed?.intents[0], "QUOTATION_REQUEST");
  });

  it("strips gpt-oss think tags and ignores braces inside reasoning", () => {
    const text = `<think>
Looking at catalog { "packages": [{ "name": "solar" }] } and deciding.
</think>
${JSON.stringify(valid)}`;
    const parsed = parseAgentFinalOutput(text);
    assert.equal(parsed?.reply, "I'll prepare that now.");
    assert.equal(parsed?.decisionSummary, valid.decision_summary);
  });

  it("accepts camelCase keys, percent confidence, and unknown intents", () => {
    const parsed = parseAgentFinalOutput(
      JSON.stringify({
        intents: ["quotation-request", "UNKNOWN_THING"],
        confidence: 80,
        decisionSummary: "Going ahead with the quote.",
        reply: "On it.",
      })
    );
    assert.deepEqual(parsed?.intents, ["QUOTATION_REQUEST"]);
    assert.equal(parsed?.confidence, 0.8);
    assert.equal(parsed?.reply, "On it.");
  });

  it("recovers a reply from truncated JSON", () => {
    const parsed = parseAgentFinalOutput(
      '{"intents":["QUOTATION_REQUEST"],"confidence":0.7,"decision_summary":"Go ahead","reply":"I will send the quotation shortly."'
    );
    assert.equal(parsed?.reply, "I will send the quotation shortly.");
    assert.equal(parsed?.intents[0], "GENERAL_MESSAGE");
  });
});
