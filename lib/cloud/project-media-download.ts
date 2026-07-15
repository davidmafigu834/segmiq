import { resolveMediaKeys } from "@/lib/watermark/storage-keys";

export function sanitizeDownloadFilename(name: string): string {
  return name
    .trim()
    .replace(/[^\w\s.-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80) || "photo";
}

export function buildPhotoDownloadFilename(
  projectTitle: string,
  index: number,
  caption?: string | null
): string {
  const base = sanitizeDownloadFilename(caption?.trim() || projectTitle);
  const padded = String(index + 1).padStart(2, "0");
  return `${base}-${padded}.jpg`;
}

/** Public / watermarked copy used for sharing and downloads. */
export function getPublishablePhotoKey(storageKey: string): string {
  return resolveMediaKeys(storageKey).publicKey;
}

export function buildProjectPhotosZipFilename(projectTitle: string): string {
  return `${sanitizeDownloadFilename(projectTitle)}-photos.zip`;
}
