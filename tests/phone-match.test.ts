import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  phoneLookupSuffixes,
  phoneOrFilter,
  phonesMatch,
} from "../lib/leads/phone-match";

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

describe("phoneLookupSuffixes / phoneOrFilter", () => {
  it("includes full digits and local suffix for sticky WhatsApp matching", () => {
    const suffixes = phoneLookupSuffixes("263771234567");
    assert.ok(suffixes.includes("263771234567"));
    assert.ok(suffixes.includes("771234567"));
  });

  it("builds a PostgREST or-filter that ends-with the phone digits", () => {
    const filter = phoneOrFilter("263771234567", ["phone"]);
    assert.ok(filter.includes("phone.eq.263771234567"));
    assert.ok(filter.includes("phone.eq.+263771234567"));
    assert.ok(filter.includes("phone.like.*771234567"));
  });

  it("includes whatsapp_wa_id when requested", () => {
    const filter = phoneOrFilter("263771234567", ["phone", "whatsapp_wa_id"]);
    assert.ok(filter.includes("whatsapp_wa_id.eq.263771234567"));
    assert.ok(filter.includes("whatsapp_wa_id.like.*771234567"));
  });
});
