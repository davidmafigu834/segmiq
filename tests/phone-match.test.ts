import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { phonesMatch } from "../lib/leads/phone-match";

describe("phonesMatch", () => {
  it("matches identical digit strings", () => {
    assert.equal(phonesMatch("263771234567", "263771234567"), true);
  });

  it("matches local and international formats", () => {
    assert.equal(phonesMatch("771234567", "263771234567"), true);
    assert.equal(phonesMatch("+263771234567", "771234567"), true);
  });

  it("does not match different numbers", () => {
    assert.equal(phonesMatch("263771234567", "263779999999"), false);
  });

  it("returns false when either side is empty", () => {
    assert.equal(phonesMatch("", "263771234567"), false);
    assert.equal(phonesMatch("263771234567", null), false);
  });
});
