import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { extractCsv, extractPlainText, summarizeExtraction } from "../lib/documents/processing/extract";
import { DOCUMENT_EXTRACTOR_VERSION } from "../lib/documents/processing/constants";

describe("document extraction", () => {
  it("extracts plain text files", async () => {
    const buf = Buffer.from("Hello contract world", "utf8");
    const result = await extractPlainText(buf);
    assert.equal(result.plainText, "Hello contract world");
    assert.equal(result.pages.length, 1);
  });

  it("preserves CSV as structured table rows", async () => {
    const buf = Buffer.from("Item,Qty,Price\nPanel,10,120\nInverter,2,800", "utf8");
    const result = await extractCsv(buf);
    assert.equal(result.tables.length, 1);
    assert.equal(result.tables[0].rows.length, 3);
    assert.ok(result.plainText.includes("Panel"));
  });

  it("summarizes char and word counts", () => {
    const summary = summarizeExtraction({ plainText: "one two three", pages: [], tables: [] });
    assert.equal(summary.wordCount, 3);
    assert.equal(summary.charCount, 13);
  });

  it("pins extractor version constant", () => {
    assert.match(DOCUMENT_EXTRACTOR_VERSION, /^segmiq-doc-extract-/);
  });
});
