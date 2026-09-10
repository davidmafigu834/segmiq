/**
 * File / object storage access classes (Phase 5).
 * Application authorization is still required for private objects —
 * object-key secrecy is not access control.
 */

export type StorageAccessClass = "PUBLIC" | "PRIVATE" | "TOKEN_PUBLIC" | "INTERNAL";

export const STORAGE_CLASS_NOTES: Record<StorageAccessClass, string> = {
  PUBLIC: "Intentionally public CDN assets (logos, marketing heroes).",
  PRIVATE: "Requires auth + tenant permission; serve via short-lived signed URL.",
  TOKEN_PUBLIC: "Public quote/proposal token grants limited payload; not a permanent file ACL.",
  INTERNAL: "Service-to-service only (gateway HMAC / cron).",
};

/** Default signed download lifetime for private business files. */
export const PRIVATE_DOWNLOAD_TTL_SEC = 300;

/** Presigned upload lifetime. */
export const PRESIGNED_UPLOAD_TTL_SEC = 300;

export function classifyStorageKey(key: string): StorageAccessClass {
  const k = key.replace(/^\/+/, "");
  if (k.startsWith("marketing/") || k.startsWith("logos/") || k.startsWith("public/")) {
    return "PUBLIC";
  }
  if (k.startsWith("whatsapp/") || k.startsWith("clients/") || k.startsWith("documents/")) {
    return "PRIVATE";
  }
  if (k.startsWith("internal/") || k.includes("/outbound/")) {
    return "INTERNAL";
  }
  return "PRIVATE";
}
