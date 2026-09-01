import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DOCUMENT_COLLECTIONS, getCollectionDefinition } from "../lib/documents/collections";
import {
  formatDocumentDate,
  processingStatusLabel,
} from "../lib/documents/format";

describe("document collections", () => {
  it("defines smart collections", () => {
    assert.ok(DOCUMENT_COLLECTIONS.length >= 8);
    assert.ok(getCollectionDefinition("contracts"));
    assert.equal(getCollectionDefinition("contracts")?.label, "Contracts");
  });
});

describe("document format", () => {
  it("formats processing labels for users", () => {
    assert.equal(processingStatusLabel("NEEDS_REVIEW"), "Needs review");
    assert.equal(processingStatusLabel("ANALYZING"), "Processing");
  });

  it("formats dates safely", () => {
    assert.equal(formatDocumentDate(null), "—");
    assert.match(formatDocumentDate("2026-09-01T12:00:00.000Z"), /2026/);
  });
});
