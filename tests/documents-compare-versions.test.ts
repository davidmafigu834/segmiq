import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { compareDocumentVersionText } from "../lib/documents/compare-versions";

describe("compareDocumentVersionText", () => {
  it("detects added and changed lines", () => {
    const diffs = compareDocumentVersionText(
      "Payment due in 30 days.\nNet terms apply.",
      "Payment due in 45 days.\nNet terms apply.\nLate fee applies."
    );
    assert.ok(diffs.some((d) => d.field.includes("Line 1")));
    assert.ok(diffs.some((d) => d.field.includes("added")));
  });

  it("returns empty when text is identical", () => {
    const diffs = compareDocumentVersionText("Same text", "Same text");
    assert.equal(diffs.length, 0);
  });
});
