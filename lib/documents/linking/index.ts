export { autoLinkDocumentRecords } from "./auto-link";
export { mergeLinkSignals, extractLinkSignalsFromText } from "./extract-signals";
export { buildEntityHref, entityTypeLabel } from "./hrefs";
export { loadDocumentEntityLinks } from "./read";
export {
  searchContactCandidates,
  searchDealCandidates,
  searchLeadCandidates,
  searchQuotationCandidates,
} from "./search";
export {
  confirmDocumentEntityLink,
  createManualDocumentLink,
  removeDocumentEntityLink,
  upsertDocumentEntityLinks,
} from "./store";
export {
  extractEmails,
  extractQuoteNumbers,
  namesLikelyMatch,
  quoteNumbersEquivalent,
} from "./signals";
export { DOCUMENT_LINKER_VERSION } from "./types";
export type {
  DocumentEntityLinkRow,
  DocumentEntityType,
  EnrichedDocumentEntityLink,
  ExtractedLinkSignals,
  LinkCandidate,
} from "./types";
