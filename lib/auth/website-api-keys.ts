import { createHash, timingSafeEqual } from "crypto";

/**
 * Website / external lead API keys — hashed at rest (Phase 6).
 * Plaintext only returned once at generation time.
 */

export function hashWebsiteApiKey(raw: string): string {
  return createHash("sha256").update(raw.trim(), "utf8").digest("hex");
}

export function websiteApiKeyPrefix(raw: string): string {
  const t = raw.trim();
  return t.slice(0, Math.min(12, t.length));
}

export function verifyWebsiteApiKey(presented: string, storedHash: string | null | undefined): boolean {
  if (!storedHash?.trim()) return false;
  const a = Buffer.from(hashWebsiteApiKey(presented));
  const b = Buffer.from(storedHash.trim());
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export function looksLikeHashedWebsiteKey(value: string | null | undefined): boolean {
  return Boolean(value && /^[a-f0-9]{64}$/i.test(value.trim()));
}
