import {
  decryptWhatsAppSecret,
  encryptWhatsAppSecret,
  type EncryptedEnvelope,
} from "@/lib/whatsapp/security/secret-envelope";

/**
 * Integration credential vault (Meta / Facebook / WhatsApp Cloud tokens).
 *
 * Reuses the audited AES-256-GCM envelope from WhatsApp session crypto.
 * Ciphertext is stored in the existing clients text columns as JSON with
 * `__segmiq_enc: 1` so plaintext legacy values remain readable during migration.
 *
 * SECURITY:
 * - Decrypt only on the server when calling Meta/Facebook APIs.
 * - Never return sealed or plaintext tokens to browsers.
 * - AAD binds ciphertext to clientId + token kind.
 */

export type IntegrationTokenKind = "fb_page" | "fb_user" | "meta_wa";

type SealedPayload = EncryptedEnvelope & { __segmiq_enc: 1 };

function aad(kind: IntegrationTokenKind, clientId: string): string {
  return `integration:${kind}:${clientId}`;
}

export function isSealedIntegrationToken(value: string | null | undefined): boolean {
  if (!value?.trim()) return false;
  try {
    const parsed = JSON.parse(value) as Partial<SealedPayload>;
    return (
      parsed?.__segmiq_enc === 1 &&
      typeof parsed.ciphertext === "string" &&
      typeof parsed.iv === "string" &&
      typeof parsed.authTag === "string" &&
      typeof parsed.keyVersion === "number"
    );
  } catch {
    return false;
  }
}

export async function sealIntegrationToken(
  plaintext: string,
  kind: IntegrationTokenKind,
  clientId: string
): Promise<string> {
  const trimmed = plaintext.trim();
  if (!trimmed) {
    throw new Error("Cannot seal empty integration token");
  }
  const envelope = await encryptWhatsAppSecret(trimmed, aad(kind, clientId));
  const sealed: SealedPayload = { __segmiq_enc: 1, ...envelope };
  return JSON.stringify(sealed);
}

/**
 * Reveal a stored token. Supports:
 * - sealed JSON envelopes
 * - legacy plaintext (returned as-is; callers may re-seal)
 */
export async function revealIntegrationToken(
  stored: string | null | undefined,
  kind: IntegrationTokenKind,
  clientId: string
): Promise<string | null> {
  const raw = stored?.trim() || "";
  if (!raw) return null;
  if (!isSealedIntegrationToken(raw)) {
    return raw;
  }
  const envelope = JSON.parse(raw) as SealedPayload;
  return decryptWhatsAppSecret(
    {
      ciphertext: envelope.ciphertext,
      iv: envelope.iv,
      authTag: envelope.authTag,
      keyVersion: envelope.keyVersion,
    },
    aad(kind, clientId)
  );
}

/** Seal when non-empty; null/blank clears storage. */
export async function sealIntegrationTokenOrNull(
  plaintext: string | null | undefined,
  kind: IntegrationTokenKind,
  clientId: string
): Promise<string | null> {
  const trimmed = plaintext?.trim() || "";
  if (!trimmed) return null;
  return sealIntegrationToken(trimmed, kind, clientId);
}

/**
 * Strip secret columns from a clients row before any browser/API response.
 * Status booleans replace raw tokens.
 */
export function sanitizeClientSecrets<T extends Record<string, unknown>>(row: T): T & {
  fb_connected?: boolean;
  meta_whatsapp_token_configured?: boolean;
} {
  const copy = { ...row } as T & {
    fb_connected?: boolean;
    meta_whatsapp_token_configured?: boolean;
  };
  const fbToken = copy.fb_access_token;
  const fbUser = copy.fb_user_access_token;
  const metaWa = copy.meta_whatsapp_access_token;

  copy.fb_connected = Boolean(
    (typeof fbToken === "string" && fbToken.trim()) ||
      (typeof fbUser === "string" && fbUser.trim())
  );
  copy.meta_whatsapp_token_configured = Boolean(typeof metaWa === "string" && metaWa.trim());

  delete (copy as { fb_access_token?: unknown }).fb_access_token;
  delete (copy as { fb_user_access_token?: unknown }).fb_user_access_token;
  delete (copy as { meta_whatsapp_access_token?: unknown }).meta_whatsapp_access_token;
  return copy;
}

/** Lazy-migrate plaintext → sealed when encryption key is available. */
export async function maybeMigrateIntegrationToken(
  stored: string | null | undefined,
  kind: IntegrationTokenKind,
  clientId: string
): Promise<{ plaintext: string | null; sealed: string | null; migrated: boolean }> {
  const plaintext = await revealIntegrationToken(stored, kind, clientId);
  if (!plaintext) return { plaintext: null, sealed: null, migrated: false };
  if (isSealedIntegrationToken(stored)) {
    return { plaintext, sealed: stored!.trim(), migrated: false };
  }
  try {
    const sealed = await sealIntegrationToken(plaintext, kind, clientId);
    return { plaintext, sealed, migrated: true };
  } catch (err) {
    console.warn("[token-vault] seal skipped (key missing or crypto error)", {
      kind,
      clientId,
      reason: err instanceof Error ? err.message : "unknown",
    });
    return { plaintext, sealed: null, migrated: false };
  }
}
