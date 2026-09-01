import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildSnippet,
  fuseSearchScore,
  lifecycleRankBoost,
  metadataMatchScore,
  toFtsQuery,
  tokenizeQuery,
} from "../lib/documents/retrieval";

describe("document retrieval ranking", () => {
  it("tokenizes queries for lexical search", () => {
    assert.deepEqual(tokenizeQuery("Mutasa contract 2026!"), ["mutasa", "contract", "2026"]);
    assert.equal(toFtsQuery("Mutasa contract"), "mutasa & contract");
  });

  it("prefers signed active documents in ranking", () => {
    assert.ok(lifecycleRankBoost("SIGNED") > lifecycleRankBoost("DRAFT"));
    assert.ok(lifecycleRankBoost("ACTIVE") > lifecycleRankBoost("EXPIRED"));
  });

  it("combines metadata and content scores with current-version boost", () => {
    const signedCurrent = fuseSearchScore({
      metadataScore: 0.4,
      lexicalScore: 0.5,
      overlapScore: 0.45,
      lifecycleStatus: "SIGNED",
      processingStatus: "READY",
      isCurrentVersion: true,
    });
    const draftOld = fuseSearchScore({
      metadataScore: 0.4,
      lexicalScore: 0.5,
      overlapScore: 0.45,
      lifecycleStatus: "DRAFT",
      processingStatus: "READY",
      isCurrentVersion: false,
    });
    assert.ok(signedCurrent > draftOld);
  });

  it("matches metadata from titles and filenames", () => {
    const titleScore = metadataMatchScore("Mutasa service agreement", {
      title: "Mutasa Holdings Service Agreement",
      originalFileName: "invoice.pdf",
    });
    assert.ok(titleScore >= 0.35);
    const fileScore = metadataMatchScore("Mutasa contract", {
      title: "Other document",
      originalFileName: "Mutasa_contract_signed.pdf",
    });
    assert.ok(fileScore >= 0.2);
  });

  it("builds readable snippets", () => {
    const snippet = buildSnippet("Payment terms require a forty percent deposit before procurement begins.");
    assert.ok(snippet.length > 10);
    assert.ok(snippet.length <= 220);
  });
});
