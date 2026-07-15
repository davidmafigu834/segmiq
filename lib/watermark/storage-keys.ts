import { getPublicUrl } from "@/lib/storage/r2";

export function keyFromPublicUrl(publicUrl: string | null | undefined): string | null {
  if (!publicUrl) return null;

  const base = process.env.CLOUDFLARE_R2_PUBLIC_URL?.replace(/\/$/, "");
  if (base && publicUrl.startsWith(`${base}/`)) {
    return publicUrl.slice(base.length + 1);
  }

  try {
    const path = new URL(publicUrl).pathname.replace(/^\//, "");
    if (path.startsWith("clients/")) return path;
  } catch {
    /* invalid url */
  }

  return null;
}

export function resolveClientLogoKey(
  client: { logo_key?: string | null; logo_url?: string | null } | null | undefined
): string | null {
  if (!client) return null;
  if (client.logo_key) return client.logo_key;
  return keyFromPublicUrl(client.logo_url);
}

export function resolveMediaKeys(storageKey: string): { originalKey: string; publicKey: string } {
  if (/\/photos\//i.test(storageKey)) {
    return {
      originalKey: storageKey.replace(/\/photos\//i, "/originals/"),
      publicKey: storageKey,
    };
  }
  if (/\/originals\//i.test(storageKey)) {
    return {
      originalKey: storageKey,
      publicKey: storageKey.replace(/\/originals\//i, "/photos/"),
    };
  }
  return { originalKey: storageKey, publicKey: storageKey };
}

/** Photo keys we can watermark (includes legacy flat project paths). */
export function isPhotoStorageKey(key: string): boolean {
  if (!key || /\/videos\//i.test(key)) return false;
  return (
    /\/photos\//i.test(key) ||
    /\/originals\//i.test(key) ||
    /^clients\/[^/]+\/projects\/[^/]+\/[^/]+\.[a-z0-9]+$/i.test(key)
  );
}

export function publicUrlForStorageKey(storageKey: string): string {
  const { publicKey } = resolveMediaKeys(storageKey);
  return getPublicUrl(publicKey);
}
