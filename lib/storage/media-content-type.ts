const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);

const ALLOWED_VIDEO_TYPES = new Set([
  "video/mp4",
  "video/quicktime",
  "video/x-msvideo",
  "video/webm",
  "video/3gpp",
  "video/3gpp2",
]);

const EXT_TO_MIME: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  heic: "image/heic",
  heif: "image/heif",
  mp4: "video/mp4",
  mov: "video/quicktime",
  avi: "video/x-msvideo",
  webm: "video/webm",
  "3gp": "video/3gpp",
  "3gpp": "video/3gpp",
};

/** Browsers (especially mobile) often send an empty file.type — infer from extension. */
export function resolveMediaContentType(filename: string, reported?: string): string | null {
  const normalized = reported?.toLowerCase().trim();
  if (normalized) {
    if (normalized === "image/jpg") return "image/jpeg";
    if (ALLOWED_IMAGE_TYPES.has(normalized) || ALLOWED_VIDEO_TYPES.has(normalized)) {
      return normalized;
    }
  }
  const ext = filename.split(".").pop()?.toLowerCase();
  if (!ext) return null;
  return EXT_TO_MIME[ext] ?? null;
}

export function isAllowedMediaContentType(contentType: string): boolean {
  const normalized = contentType.toLowerCase();
  return ALLOWED_IMAGE_TYPES.has(normalized) || ALLOWED_VIDEO_TYPES.has(normalized);
}

export const MEDIA_PHOTO_MAX_BYTES = 20 * 1024 * 1024;
export const MEDIA_VIDEO_MAX_BYTES = 200 * 1024 * 1024;

/** Safe for Vercel/serverless request bodies — larger files use presigned R2 PUT. */
export const MEDIA_SERVER_UPLOAD_MAX_BYTES = 4 * 1024 * 1024;
