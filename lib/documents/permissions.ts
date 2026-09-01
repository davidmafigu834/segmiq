import type { DocumentActor } from "@/lib/documents/types";
import type { DocumentAccessPolicyRow } from "@/lib/documents/types";

export const DOCUMENT_PERMISSIONS = [
  "documents.view",
  "documents.upload",
  "documents.download",
  "documents.edit",
  "documents.archive",
  "documents.ask",
  "documents.categories.view",
  "documents.categories.manage",
  "documents.versions.view",
  "documents.versions.manage",
  "documents.intelligence.view",
  "documents.intelligence.correct",
  "documents.obligations.view",
  "documents.obligations.manage",
  "documents.permissions.manage",
] as const;

export type DocumentPermission = (typeof DOCUMENT_PERMISSIONS)[number];

function isManager(role: string): boolean {
  return role === "CLIENT_MANAGER" || role === "SUPER_ADMIN";
}

export function hasDocumentPermission(
  actor: DocumentActor,
  permission: DocumentPermission
): boolean {
  if (actor.role === "SUPER_ADMIN") return true;
  if (actor.role === "CLIENT_MANAGER") {
    if (permission === "documents.permissions.manage") return true;
    return true;
  }
  if (actor.role !== "SALESPERSON") return false;

  switch (permission) {
    case "documents.view":
    case "documents.download":
    case "documents.ask":
    case "documents.categories.view":
    case "documents.versions.view":
    case "documents.intelligence.view":
    case "documents.obligations.view":
      return true;
    case "documents.upload":
    case "documents.edit":
      return true;
    default:
      return false;
  }
}

/**
 * Phase B access check — managers see all company docs; salespeople see
 * COMPANY-scoped and their own PRIVATE/USER-scoped documents.
 */
export function canViewDocument(
  actor: DocumentActor,
  document: { client_id: string; owner_user_id: string | null; uploaded_by: string | null },
  policy: DocumentAccessPolicyRow | null
): boolean {
  if (!hasDocumentPermission(actor, "documents.view")) return false;
  if (actor.clientId !== document.client_id && actor.role !== "SUPER_ADMIN") return false;
  if (isManager(actor.role)) return true;
  if (!policy) return true;

  switch (policy.scope_type) {
    case "COMPANY":
    case "LINKED_RECORD":
      return true;
    case "PRIVATE":
    case "USER":
      return (
        policy.scope_id === actor.userId ||
        document.owner_user_id === actor.userId ||
        document.uploaded_by === actor.userId
      );
    case "TEAM":
    case "ROLE":
      return false;
    default:
      return false;
  }
}

export function canUploadDocuments(actor: DocumentActor): boolean {
  return hasDocumentPermission(actor, "documents.upload");
}

export function canDownloadDocument(
  actor: DocumentActor,
  document: { client_id: string; owner_user_id: string | null; uploaded_by: string | null },
  policy: DocumentAccessPolicyRow | null
): boolean {
  if (!hasDocumentPermission(actor, "documents.download")) return false;
  return canViewDocument(actor, document, policy);
}

export function canEditDocument(actor: DocumentActor): boolean {
  return hasDocumentPermission(actor, "documents.edit");
}

export function canCorrectDocumentIntelligence(actor: DocumentActor): boolean {
  return hasDocumentPermission(actor, "documents.intelligence.correct");
}

export function canArchiveDocument(actor: DocumentActor): boolean {
  return hasDocumentPermission(actor, "documents.archive");
}
