import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { simpleGreetingReply, tyrePriceQuery } from "../lib/agent/simple-replies";

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

describe("tyrePriceQuery", () => {
  it("normalizes explicit tyre-size price questions", () => {
    assert.equal(tyrePriceQuery("How much 195 /65R15"), "195/65R15");
    assert.equal(tyrePriceQuery("Price for 255/70 r15c please"), "255/70R15C");
  });

  it("leaves non-price and incomplete requests to the normal agent", () => {
    assert.equal(tyrePriceQuery("I need tyres for my car"), null);
    assert.equal(tyrePriceQuery("Do you have 195/65R15?"), null);
    assert.equal(tyrePriceQuery("How much are size 15 tyres?"), null);
  });
});
