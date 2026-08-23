export type WhatsAppOutboundMediaType = "image" | "video" | "document";

export const WHATSAPP_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
export const WHATSAPP_VIDEO_MAX_BYTES = 16 * 1024 * 1024;
export const WHATSAPP_DOCUMENT_MAX_BYTES = 20 * 1024 * 1024;
export const WHATSAPP_DIRECT_UPLOAD_MAX_BYTES = 4 * 1024 * 1024;

const IMAGE_TYPES = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"]);
const VIDEO_TYPES = new Set(["video/mp4", "video/3gpp", "video/3gpp2"]);
const DOCUMENT_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.ms-excel",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain",
  "text/csv",
  "application/zip",
  "application/x-zip-compressed",
]);

const EXT_TO_MIME: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  heic: "image/heic",
  heif: "image/heif",
  mp4: "video/mp4",
  mov: "video/quicktime",
  webm: "video/webm",
  "3gp": "video/3gpp",
  "3gpp": "video/3gpp",
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  txt: "text/plain",
  csv: "text/csv",
  zip: "application/zip",
};

const META_IMAGE_TYPES = new Set(["image/jpeg", "image/png"]);
const META_VIDEO_TYPES = new Set(["video/mp4", "video/3gpp"]);

export function resolveOutboundMediaContentType(
  filename: string,
  reported?: string | null
): string | null {
  const normalized = reported?.toLowerCase().trim();
  if (normalized) {
    if (normalized === "image/jpg") return "image/jpeg";
    if (
      IMAGE_TYPES.has(normalized) ||
      VIDEO_TYPES.has(normalized) ||
      DOCUMENT_TYPES.has(normalized) ||
      normalized === "image/heic" ||
      normalized === "image/heif" ||
      normalized === "video/quicktime" ||
      normalized === "video/webm"
    ) {
      return normalized;
    }
  }
  const ext = filename.split(".").pop()?.toLowerCase();
  if (!ext) return null;
  return EXT_TO_MIME[ext] ?? null;
}

export function classifyWhatsAppOutboundMedia(mimeType: string): WhatsAppOutboundMediaType {
  const mime = mimeType.toLowerCase();
  if (IMAGE_TYPES.has(mime) || mime === "image/heic" || mime === "image/heif") return "image";
  if (VIDEO_TYPES.has(mime) || mime === "video/quicktime" || mime === "video/webm") return "video";
  return "document";
}

export function metaCloudMediaType(
  mimeType: string,
  classified: WhatsAppOutboundMediaType
): WhatsAppOutboundMediaType {
  const mime = mimeType.toLowerCase();
  if (classified === "image" && !META_IMAGE_TYPES.has(mime)) return "document";
  if (classified === "video" && !META_VIDEO_TYPES.has(mime)) return "document";
  return classified;
}

export function maxBytesForWhatsAppMedia(type: WhatsAppOutboundMediaType): number {
  if (type === "image") return WHATSAPP_IMAGE_MAX_BYTES;
  if (type === "video") return WHATSAPP_VIDEO_MAX_BYTES;
  return WHATSAPP_DOCUMENT_MAX_BYTES;
}

export function sanitizeOutboundFilename(filename: string): string {
  const base = filename.split(/[/\\]/).pop()?.trim() || "attachment";
  const cleaned = base.replace(/[^\w.\- ()[\]]+/g, "_").replace(/^\.+/, "");
  const trimmed = cleaned.slice(0, 80) || "attachment";
  return trimmed;
}

export function placeholderBodyForMedia(
  type: WhatsAppOutboundMediaType,
  filename: string,
  caption?: string | null
): string {
  const text = caption?.trim();
  if (text) return text;
  if (type === "image") return "Photo";
  if (type === "video") return "Video";
  return sanitizeOutboundFilename(filename);
}

export function isWhatsAppOutboundKeyForLead(
  key: string,
  clientId: string,
  leadId: string
): boolean {
  if (!key || key.includes("..") || key.includes("\\")) return false;
  return key.startsWith(`whatsapp/${clientId}/outbound/${leadId}/`);
}

export function validateWhatsAppOutboundMedia(input: {
  filename: string;
  mimeType?: string | null;
  size: number;
}):
  | { ok: true; mimeType: string; messageType: WhatsAppOutboundMediaType; filename: string }
  | { ok: false; error: string } {
  const filename = sanitizeOutboundFilename(input.filename);
  const mimeType = resolveOutboundMediaContentType(filename, input.mimeType);
  if (!mimeType) {
    return {
      ok: false,
      error:
        "That file type cannot be sent on WhatsApp. Use a photo (JPEG, PNG), a video (MP4), or a document such as PDF or Office.",
    };
  }

  const messageType = classifyWhatsAppOutboundMedia(mimeType);
  const maxBytes = maxBytesForWhatsAppMedia(messageType);
  if (input.size <= 0) {
    return { ok: false, error: "The selected file is empty." };
  }
  if (input.size > maxBytes) {
    const mb = Math.floor(maxBytes / (1024 * 1024));
    if (messageType === "image") {
      return { ok: false, error: `Photos must be ${mb} MB or smaller.` };
    }
    if (messageType === "video") {
      return { ok: false, error: `Videos must be ${mb} MB or smaller.` };
    }
    return { ok: false, error: `Files must be ${mb} MB or smaller.` };
  }

  return { ok: true, mimeType, messageType, filename };
}
