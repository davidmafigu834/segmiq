import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  formatFactValue,
  formatSourceEvidence,
  getExtractionProfile,
} from "../lib/documents/intelligence";

describe("document intelligence profiles", () => {
  it("returns contract profile for contract documents", () => {
    const profile = getExtractionProfile("CONTRACT");
    assert.equal(profile.documentTypeCode, "CONTRACT");
    assert.ok(profile.focusFields.includes("PAYMENT_TERM"));
    assert.ok(profile.obligationHints.length > 0);
  });

  it("falls back to general profile for unknown types", () => {
    const profile = getExtractionProfile("UNKNOWN_TYPE");
    assert.equal(profile.documentTypeCode, "OTHER");
  });

  it("formats fact values for display", () => {
    assert.equal(formatFactValue("Net 30 days"), "Net 30 days");
    assert.equal(formatFactValue({ amount: 50000, currency: "USD" }), "50000 USD");
    assert.equal(formatFactValue({ text: "Clause summary" }), "Clause summary");
  });

  it("formats source evidence labels", () => {
    assert.equal(
      formatSourceEvidence({ page: 6, clause: "4.2" }),
      "Clause 4.2 · Page 6"
    );
    assert.equal(formatSourceEvidence({}), "Source in document");
  });
});
