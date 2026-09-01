import { resolveOutboundMediaContentType } from "@/lib/whatsapp/outbound-media";
import { DOCUMENT_MAX_BYTES } from "@/lib/documents/constants";

const ALLOWED_DOCUMENT_MIMES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.ms-excel",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain",
  "text/csv",
  "image/jpeg",
  "image/jpg",
  "image/png",
]);

const ALLOWED_EXTENSIONS = new Set([
  "pdf",
  "doc",
  "docx",
  "xls",
  "xlsx",
  "ppt",
  "pptx",
  "txt",
  "csv",
  "jpg",
  "jpeg",
  "png",
]);

export type DocumentFileValidation = {
  ok: true;
  mimeType: string;
  extension: string;
  safeFilename: string;
} | {
  ok: false;
  error: string;
};

export function sanitizeDocumentFilename(filename: string): string {
  const base = filename.split(/[/\\]/).pop() ?? "document";
  const cleaned = base.replace(/[^\w.\- ()[\]]+/g, "_").trim();
  return cleaned.length > 0 ? cleaned.slice(0, 255) : "document";
}

export function validateDocumentFile(
  filename: string,
  reportedMime: string | null | undefined,
  sizeBytes: number
): DocumentFileValidation {
  const safeFilename = sanitizeDocumentFilename(filename);
  const ext = safeFilename.split(".").pop()?.toLowerCase() ?? "";

  if (!ext || !ALLOWED_EXTENSIONS.has(ext)) {
    return {
      ok: false,
      error: "Unsupported file type. Allowed: PDF, DOC, DOCX, TXT, CSV, XLSX, PPTX, JPG, PNG.",
    };
  }

  if (sizeBytes <= 0) {
    return { ok: false, error: "File is empty." };
  }

  if (sizeBytes > DOCUMENT_MAX_BYTES) {
    return {
      ok: false,
      error: `File is too large (max ${Math.round(DOCUMENT_MAX_BYTES / (1024 * 1024))}MB).`,
    };
  }

  const resolved = resolveOutboundMediaContentType(safeFilename, reportedMime);
  if (!resolved || !ALLOWED_DOCUMENT_MIMES.has(resolved)) {
    return {
      ok: false,
      error: "File type could not be verified. Check the extension and MIME type.",
    };
  }

  return { ok: true, mimeType: resolved, extension: ext, safeFilename };
}
