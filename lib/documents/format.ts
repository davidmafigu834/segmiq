import type { DocumentProcessingStatus } from "@/lib/documents/types";

export function formatDocumentDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat(undefined, {
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function formatDocumentBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function processingStatusLabel(status: string): string {
  switch (status as DocumentProcessingStatus) {
    case "READY":
      return "Ready";
    case "FAILED":
      return "Failed";
    case "NEEDS_REVIEW":
      return "Needs review";
    case "QUEUED":
    case "EXTRACTING":
    case "ANALYZING":
    case "INDEXING":
      return "Processing";
    case "UPLOADED":
      return "Uploaded";
    default:
      return status.replace(/_/g, " ");
  }
}

export function lifecycleStatusLabel(status: string): string {
  return status.replace(/_/g, " ");
}

export function activityActionLabel(action: string): string {
  switch (action) {
    case "UPLOADED":
      return "Uploaded";
    case "DOWNLOADED":
      return "Downloaded";
    case "VIEWED":
      return "Viewed";
    case "METADATA_EDITED":
      return "Metadata updated";
    case "ARCHIVED":
      return "Archived";
    case "VERSION_ADDED":
      return "New version added";
    case "PROCESSING_STARTED":
      return "Analysis started";
    case "PROCESSING_COMPLETED":
      return "Analysis completed";
    case "PROCESSING_FAILED":
      return "Analysis failed";
    default:
      return action.replace(/_/g, " ");
  }
}

export function categoryActionLabel(action: string): string {
  switch (action) {
    case "REUSED":
      return "Matched existing category";
    case "AUTO_CREATED":
      return "New category created";
    case "SUGGESTED":
      return "Category suggested for review";
    case "SKIPPED":
      return "Category skipped";
    default:
      return "No category assigned";
  }
}

export function activityMetadataSummary(metadata: Record<string, unknown> | null): string | null {
  if (!metadata || Object.keys(metadata).length === 0) return null;
  if (metadata.kind === "classification") {
    const parts = [
      metadata.documentTypeCode ? `Type: ${metadata.documentTypeCode}` : null,
      metadata.categoryName ? `Category: ${metadata.categoryName}` : null,
      metadata.categoryAction ? categoryActionLabel(String(metadata.categoryAction)) : null,
      metadata.needsReview ? "Needs review" : null,
    ].filter(Boolean);
    return parts.join(" · ");
  }
  if (metadata.kind === "intelligence") {
    const parts = [
      metadata.factCount != null ? `${metadata.factCount} facts` : null,
      metadata.obligationCount != null ? `${metadata.obligationCount} obligations` : null,
      metadata.dateCount != null ? `${metadata.dateCount} dates` : null,
      metadata.confidence ? `Confidence ${String(metadata.confidence).toLowerCase()}` : null,
    ].filter(Boolean);
    return parts.join(" · ");
  }
  if (metadata.kind === "fact_correction") {
    return `Corrected ${metadata.factType ?? "fact"}`;
  }
  if (metadata.kind === "fact_review") {
    return `${metadata.action === "confirm" ? "Confirmed" : "Rejected"} ${metadata.factType ?? "fact"}`;
  }
  if (metadata.kind === "entity_linking") {
    const parts = [
      metadata.confirmed != null ? `${metadata.confirmed} confirmed` : null,
      metadata.suggestions != null ? `${metadata.suggestions} suggestions` : null,
    ].filter(Boolean);
    return parts.join(" · ") || "CRM links updated";
  }
  return JSON.stringify(metadata);
}
