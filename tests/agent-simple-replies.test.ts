import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { simpleGreetingReply } from "../lib/agent/simple-replies";

describe("simpleGreetingReply", () => {
  it("answers common standalone greetings without an LLM", () => {
    for (const greeting of ["Hi", "Hie", "hello!", "Hey there", "Good morning 👋"]) {
      assert.equal(simpleGreetingReply(greeting), "Hi! How can we help you today?");
    }
  });

  it("does not swallow customer requests", () => {
    for (const message of ["Hi, how much is 205/55R16?", "Hello I need tyres", "Good morning, directions?"]) {
      assert.equal(simpleGreetingReply(message), null);
    }
  });
});
