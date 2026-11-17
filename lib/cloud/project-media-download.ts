import { keyFromPublicUrl, resolveMediaKeys } from "@/lib/watermark/storage-keys";
import { getObject, getPublicUrl } from "@/lib/storage/r2";

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
  const key = keyFromPublicUrl(storageKey) ?? storageKey;
  return resolveMediaKeys(key).publicKey;
}

export function buildProjectPhotosZipFilename(projectTitle: string): string {
  return `${sanitizeDownloadFilename(projectTitle)}-photos.zip`;
}

async function readStorageKey(key: string): Promise<Buffer> {
  try {
    return await getObject(key);
  } catch (storageError) {
    const url = getPublicUrl(key);
    const res = await fetch(url, { signal: AbortSignal.timeout(20_000) });
    if (!res.ok) throw storageError;
    return Buffer.from(await res.arrayBuffer());
  }
}

/** Watermarked/public copy, falling back to the original upload if needed. */
export async function fetchPublishablePhotoBuffer(storageKey: string): Promise<Buffer> {
  const key = keyFromPublicUrl(storageKey) ?? storageKey;
  const { publicKey, originalKey } = resolveMediaKeys(key);
  try {
    return await readStorageKey(publicKey);
  } catch (publicError) {
    if (originalKey === publicKey) throw publicError;
    return readStorageKey(originalKey);
  }
}
