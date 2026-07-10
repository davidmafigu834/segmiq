const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);

const EXT_TO_MIME: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  heic: "image/heic",
  heif: "image/heif",
};

export function generateLogoKey(clientId: string, filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "png";
  return `clients/${clientId}/logo/${Date.now()}.${ext}`;
}

/** Browsers on Windows often send an empty file.type — infer from extension. */
export function resolveImageContentType(filename: string, reported?: string): string | null {
  const normalized = reported?.toLowerCase().trim();
  if (normalized && ALLOWED_IMAGE_TYPES.has(normalized)) {
    return normalized === "image/jpg" ? "image/jpeg" : normalized;
  }
  const ext = filename.split(".").pop()?.toLowerCase();
  if (!ext) return null;
  return EXT_TO_MIME[ext] ?? null;
}

export function isAllowedImageContentType(contentType: string): boolean {
  return ALLOWED_IMAGE_TYPES.has(contentType.toLowerCase());
}

/** Browser-side: upload via server route (avoids presigned PUT Content-Type / CORS issues). */
export async function uploadClientLogoFile(
  clientId: string,
  file: File
): Promise<{ publicUrl: string; key: string }> {
  const body = new FormData();
  body.append("file", file);
  const res = await fetch(`/api/clients/${clientId}/logo/upload`, { method: "POST", body });
  const payload = (await res.json().catch(() => ({}))) as {
    publicUrl?: string;
    key?: string;
    error?: string;
  };
  if (!res.ok || !payload.publicUrl || !payload.key) {
    throw new Error(payload.error ?? "Upload failed");
  }
  return { publicUrl: payload.publicUrl, key: payload.key };
}
