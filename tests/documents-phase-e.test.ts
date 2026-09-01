import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { canAutoCreateCategory } from "../lib/documents/classification";
import { findCategoryByNormalizedName } from "../lib/documents/classification/categories";
import { classifyHeuristically } from "../lib/documents/classification/heuristics";
import {
  isPersonSpecificCategoryName,
  isReusableCategoryName,
  rankCategoryMatches,
  synonymBoost,
} from "../lib/documents/classification/matching";

describe("document classification matching", () => {
  it("blocks person-specific category names", () => {
    assert.equal(isPersonSpecificCategoryName("Mr Mutasa Contract Documents"), true);
    assert.equal(isPersonSpecificCategoryName("Client Contracts"), false);
    assert.equal(isReusableCategoryName("Mr Mutasa Contract Documents"), false);
    assert.equal(isReusableCategoryName("Client Contracts"), true);
  });

  it("boosts synonym category matches for deduplication", () => {
    assert.ok(synonymBoost("Client Contract", "Client Contracts") >= 0.9);
    assert.ok(synonymBoost("Supplier Agreements", "Supplier Contracts") >= 0.9);
  });

  it("ranks overlapping category names", () => {
    const ranked = rankCategoryMatches("Compliance Policies", [{ id: "1", name: "Compliance" }]);
    assert.equal(ranked[0]?.id, "1");
    assert.ok(ranked[0]!.score > 0.35);
  });

  it("finds categories by normalized name for deduplication", () => {
    const categories = [
      {
        id: "a",
        client_id: "c",
        name: "Client Contracts",
        description: null,
        parent_id: null,
        created_by: null,
        creation_source: "HUMAN" as const,
        status: "ACTIVE",
      },
    ];
    assert.equal(findCategoryByNormalizedName(categories, "client contracts")?.id, "a");
    assert.equal(findCategoryByNormalizedName(categories, "Invoices"), null);
  });

  it("does not auto-create categories when the setting is disabled", () => {
    assert.equal(
      canAutoCreateCategory(
        { auto_create_category: false, min_auto_create_category_confidence: "HIGH" },
        "HIGH"
      ),
      false
    );
    assert.equal(
      canAutoCreateCategory(
        { auto_create_category: true, min_auto_create_category_confidence: "HIGH" },
        "MEDIUM"
      ),
      false
    );
    assert.equal(
      canAutoCreateCategory(
        { auto_create_category: true, min_auto_create_category_confidence: "HIGH" },
        "HIGH"
      ),
      true
    );
  });
});

describe("document classification heuristics", () => {
  it("classifies contract filenames and content", () => {
    const result = classifyHeuristically({
      filename: "Acme_MSA_2026.pdf",
      textSample: "This agreement is entered into by the parties whereas...",
    });
    assert.equal(result.documentTypeCode, "CONTRACT");
    assert.equal(result.suggestedCategoryName, "Client Contracts");
    assert.ok(result.tags.length >= 0);
  });
});
