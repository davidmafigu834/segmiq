import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { extractLinkSignalsFromText } from "../lib/documents/linking/extract-signals";
import {
  extractQuoteNumbers,
  namesLikelyMatch,
  quoteNumbersEquivalent,
} from "../lib/documents/linking/signals";
import { buildEntityHref } from "../lib/documents/linking/hrefs";

describe("document CRM linking signals", () => {
  it("extracts quote numbers from document text", () => {
    const quotes = extractQuoteNumbers("Please refer to quotation Q-1082 and Q 2045.");
    assert.ok(quotes.includes("Q-1082"));
    assert.ok(quotes.some((q) => q.includes("2045")));
  });

  it("treats equivalent quote numbers as matching", () => {
    assert.equal(quoteNumbersEquivalent("Q-1082", "Q1082"), true);
    assert.equal(quoteNumbersEquivalent("Q-1082", "Q-2045"), false);
  });

  it("scores similar customer names", () => {
    assert.ok(namesLikelyMatch("Mutasa Holdings", "Mutasa Holdings (Pvt) Ltd") >= 0.45);
  });

  it("extracts party hints from filenames and text", () => {
    const signals = extractLinkSignalsFromText(
      "Between Mutasa Holdings and SegmiQ Technologies",
      "Mutasa Signed Agreement",
      "Mutasa_Signed_Agreement.pdf"
    );
    assert.ok(signals.partyNames.length > 0);
    assert.ok(signals.partyNames.some((n) => /mutasa/i.test(n)));
  });

  it("builds CRM navigation hrefs", () => {
    assert.match(buildEntityHref("DEAL", "abc", "client-1"), /\/client\/deals\/abc/);
    assert.match(
      buildEntityHref("CUSTOMER", "abc", "client-1"),
      /customerId=abc/
    );
  });
});
