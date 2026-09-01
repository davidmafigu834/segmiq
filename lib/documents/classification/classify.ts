import { createAdminClient } from "@/lib/supabase/admin";
import { loadDocumentCompanySettings } from "@/lib/documents/settings";
import { listDocumentTypes } from "@/lib/documents/service";
import {
  createCategory,
  findCategoryByNormalizedName,
  listActiveCategories,
} from "@/lib/documents/classification/categories";
import { classifyHeuristically } from "@/lib/documents/classification/heuristics";
import { classifyWithLlm } from "@/lib/documents/classification/llm-classify";
import {
  isReusableCategoryName,
  rankCategoryMatches,
  synonymBoost,
} from "@/lib/documents/classification/matching";
import { applyDocumentTags } from "@/lib/documents/classification/tags";
import { DOCUMENT_CLASSIFIER_VERSION } from "@/lib/documents/classification/types";
import type { CategoryMatchResult, ClassificationConfidence, ClassificationResult } from "@/lib/documents/classification/types";

function confidenceRank(level: ClassificationConfidence): number {
  return level === "HIGH" ? 3 : level === "MEDIUM" ? 2 : 1;
}

function meetsMinConfidence(
  actual: ClassificationConfidence,
  required: ClassificationConfidence
): boolean {
  return confidenceRank(actual) >= confidenceRank(required);
}

export function canAutoCreateCategory(
  settings: Pick<
    Awaited<ReturnType<typeof loadDocumentCompanySettings>>,
    "auto_create_category" | "min_auto_create_category_confidence"
  >,
  categoryConfidence: ClassificationConfidence
): boolean {
  return (
    settings.auto_create_category &&
    meetsMinConfidence(categoryConfidence, settings.min_auto_create_category_confidence)
  );
}

async function resolveTypeId(clientId: string, code: string): Promise<string | null> {
  const types = await listDocumentTypes(clientId);
  return types.find((t) => t.code === code)?.id ?? null;
}

function mergeClassification(
  heuristic: ClassificationResult,
  llm: ClassificationResult | null
): ClassificationResult {
  if (!llm) return heuristic;
  if (confidenceRank(llm.typeConfidence) >= confidenceRank(heuristic.typeConfidence)) {
    return {
      ...llm,
      tags: [...new Set([...heuristic.tags, ...llm.tags])].slice(0, 8),
    };
  }
  return {
    ...heuristic,
    suggestedCategoryName: llm.suggestedCategoryName ?? heuristic.suggestedCategoryName,
    categoryConfidence:
      confidenceRank(llm.categoryConfidence) > confidenceRank(heuristic.categoryConfidence)
        ? llm.categoryConfidence
        : heuristic.categoryConfidence,
    tags: [...new Set([...heuristic.tags, ...llm.tags])].slice(0, 8),
    lifecycleHint: llm.lifecycleHint ?? heuristic.lifecycleHint,
    titleHint: llm.titleHint ?? heuristic.titleHint,
    reasoning: llm.reasoning ?? heuristic.reasoning,
  };
}

async function resolveCategory(opts: {
  clientId: string;
  proposedName: string | null;
  categoryConfidence: ClassificationConfidence;
  settings: Awaited<ReturnType<typeof loadDocumentCompanySettings>>;
  categories: Awaited<ReturnType<typeof listActiveCategories>>;
}): Promise<CategoryMatchResult> {
  const proposedName = opts.proposedName;
  if (!proposedName || !isReusableCategoryName(proposedName)) {
    return { categoryId: "", categoryName: "", score: 0, action: "SKIPPED" };
  }

  const exact = findCategoryByNormalizedName(opts.categories, proposedName);
  if (exact) {
    return {
      categoryId: exact.id,
      categoryName: exact.name,
      score: 1,
      action: "REUSED",
    };
  }

  const ranked = rankCategoryMatches(proposedName, opts.categories).map((row) => ({
    ...row,
    score: Math.max(row.score, synonymBoost(proposedName, row.name)),
  }));

  ranked.sort((a, b) => b.score - a.score);
  const best = ranked[0];
  if (best && best.score >= 0.82) {
    return {
      categoryId: best.id,
      categoryName: best.name,
      score: best.score,
      action: "REUSED",
    };
  }

  if (
    canAutoCreateCategory(opts.settings, opts.categoryConfidence)
  ) {
    const created = await createCategory({
      clientId: opts.clientId,
      name: proposedName,
      creationSource: "AGENT",
    });
    if (created) {
      return {
        categoryId: created.id,
        categoryName: created.name,
        score: opts.categoryConfidence === "HIGH" ? 0.95 : 0.75,
        action: "AUTO_CREATED",
      };
    }
  }

  if (opts.settings.suggest_categories_when_uncertain) {
    return {
      categoryId: "",
      categoryName: proposedName,
      score: best?.score ?? 0,
      action: "SUGGESTED",
    };
  }

  return { categoryId: "", categoryName: "", score: 0, action: "NONE" };
}

export async function classifyDocumentRecord(opts: {
  clientId: string;
  documentId: string;
  versionId: string;
  filename: string;
  plainText: string;
  title: string;
}): Promise<{
  applied: boolean;
  needsReview: boolean;
  classification: ClassificationResult;
  category: CategoryMatchResult;
}> {
  const settings = await loadDocumentCompanySettings(opts.clientId);
  if (!settings.auto_classify) {
    return {
      applied: false,
      needsReview: false,
      classification: classifyHeuristically({ filename: opts.filename, textSample: opts.plainText }),
      category: { categoryId: "", categoryName: "", score: 0, action: "NONE" },
    };
  }

  const categories = await listActiveCategories(opts.clientId);
  const heuristic = classifyHeuristically({
    filename: opts.filename,
    textSample: opts.plainText,
  });

  const llm =
    opts.plainText.length >= 80
      ? await classifyWithLlm({
          filename: opts.filename,
          textSample: opts.plainText,
          existingCategories: categories.map((c) => c.name),
        })
      : null;

  const classification = mergeClassification(heuristic, llm);
  const category = await resolveCategory({
    clientId: opts.clientId,
    proposedName: classification.suggestedCategoryName,
    categoryConfidence: classification.categoryConfidence,
    settings,
    categories,
  });

  const typeId = await resolveTypeId(opts.clientId, classification.documentTypeCode);
  const needsReview =
    classification.typeConfidence === "LOW" ||
    category.action === "SUGGESTED" ||
    (category.action === "NONE" && Boolean(classification.suggestedCategoryName));

  const supabase = createAdminClient();
  const documentPatch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (typeId) documentPatch.document_type_id = typeId;
  if (category.categoryId) documentPatch.category_id = category.categoryId;

  if (classification.lifecycleHint === "SIGNED") {
    documentPatch.lifecycle_status = "SIGNED";
  } else if (classification.lifecycleHint === "DRAFT") {
    documentPatch.lifecycle_status = "DRAFT";
  }

  if (needsReview && documentPatch.lifecycle_status !== "SIGNED") {
    documentPatch.processing_status = "NEEDS_REVIEW";
  }

  await supabase
    .from("documents")
    .update(documentPatch)
    .eq("id", opts.documentId)
    .eq("client_id", opts.clientId);

  if (classification.tags.length) {
    await applyDocumentTags({
      clientId: opts.clientId,
      documentId: opts.documentId,
      tags: classification.tags,
      source: "AGENT",
    });
  }

  await supabase.from("document_classification_audit").insert({
    client_id: opts.clientId,
    document_id: opts.documentId,
    version_id: opts.versionId,
    document_type_code: classification.documentTypeCode,
    document_type_id: typeId,
    category_id: category.categoryId || null,
    suggested_category_name: classification.suggestedCategoryName,
    category_action: category.action,
    type_confidence: classification.typeConfidence,
    category_confidence: classification.categoryConfidence,
    tags: classification.tags,
    classifier_version: DOCUMENT_CLASSIFIER_VERSION,
    model: llm ? "agent-llm" : "heuristic",
    needs_review: needsReview,
    details: {
      reasoning: classification.reasoning,
      categoryScore: category.score,
      categoryName: category.categoryName,
    },
  });

  await supabase.from("document_activity").insert({
    client_id: opts.clientId,
    document_id: opts.documentId,
    version_id: opts.versionId,
    action: "METADATA_EDITED",
    metadata: {
      kind: "classification",
      documentTypeCode: classification.documentTypeCode,
      categoryAction: category.action,
      categoryName: category.categoryName || classification.suggestedCategoryName,
      needsReview,
    },
  });

  return { applied: true, needsReview, classification, category };
}
