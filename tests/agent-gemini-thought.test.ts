import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  GEMINI_SKIP_THOUGHT_SIGNATURE,
  withGeminiThoughtSignatures,
} from "../lib/agent/provider-gemini";
import { isAgentLlmFailoverError } from "../lib/agent/provider";

describe("Gemini thought signatures", () => {
  it("fills skip_thought_signature_validator on function calls that have no signature", () => {
    const next = withGeminiThoughtSignatures({
      role: "model",
      parts: [{ functionCall: { name: "catalog_search", args: { query: "solar" } } }],
    });
    assert.equal(next.parts[0]?.thoughtSignature, GEMINI_SKIP_THOUGHT_SIGNATURE);
  });

  it("keeps an existing camelCase or snake_case signature", () => {
    const camel = withGeminiThoughtSignatures({
      role: "model",
      parts: [{ functionCall: { name: "catalog_search" }, thoughtSignature: "abc" }],
    });
    assert.equal(camel.parts[0]?.thoughtSignature, "abc");
    const snake = withGeminiThoughtSignatures({
      role: "model",
      parts: [{ functionCall: { name: "catalog_search" }, thought_signature: "xyz" }],
    });
    assert.equal(snake.parts[0]?.thoughtSignature, "xyz");
  });
});

describe("LLM failover errors", () => {
  it("fails over on missing Gemini thought signatures", () => {
    assert.equal(
      isAgentLlmFailoverError(new Error("Gemini API 400: Function call is missing a thought_signature")),
      true
    );
    assert.equal(isAgentLlmFailoverError(new Error("Gemini API 400: bad request")), false);
  });
});
