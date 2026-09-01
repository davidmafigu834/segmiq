export { classifyDocumentRecord, canAutoCreateCategory } from "./classify";
export { classifyHeuristically } from "./heuristics";
export { classifyWithLlm } from "./llm-classify";
export {
  createCategory,
  getCategoryDocumentCounts,
  listActiveCategories,
  mergeCategories,
} from "./categories";
export { applyDocumentTags, listDocumentTags } from "./tags";
export {
  isPersonSpecificCategoryName,
  isReusableCategoryName,
  normalizeLabel,
  overlapScore,
  rankCategoryMatches,
  synonymBoost,
} from "./matching";
export { DOCUMENT_CLASSIFIER_VERSION } from "./types";
export type { ClassificationResult, CategoryMatchResult } from "./types";
