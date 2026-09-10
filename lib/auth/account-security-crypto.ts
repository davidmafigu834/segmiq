/**
 * Account-security secret envelope (TOTP secrets).
 *
 * Prefer ACCOUNT_SECURITY_ENCRYPTION_KEY (32-byte hex or base64).
 * Falls back to WHATSAPP_SESSION_ENCRYPTION_KEY with distinct AAD so ciphertext
 * cannot be confused with WhatsApp session material.
 *
 * NEVER use NEXTAUTH_SECRET as the encryption key.
 * AAD binds ciphertext to purpose + userId.
 */

import {
  decryptWhatsAppSecret,
  encryptWhatsAppSecret,
  type EncryptedEnvelope,
} from "@/lib/whatsapp/security/secret-envelope";

export type { EncryptedEnvelope };

function decodeBase64(value: string): Uint8Array<ArrayBuffer> {
  if (typeof Buffer !== "undefined") return Uint8Array.from(Buffer.from(value, "base64"));
  const binary = atob(value);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function encodeBase64(value: Uint8Array): string {
  if (typeof Buffer !== "undefined") return Buffer.from(value).toString("base64");
  let binary = "";
  for (const byte of value) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function accountSecurityKey(): Uint8Array<ArrayBuffer> | null {
  const raw = process.env.ACCOUNT_SECURITY_ENCRYPTION_KEY?.trim();
  if (!raw) return null;
  const key = /^[a-f0-9]{64}$/i.test(raw)
    ? Uint8Array.from(raw.match(/.{1,2}/g)!.map((value) => Number.parseInt(value, 16)))
    : decodeBase64(raw);
  if (key.length !== 32) {
    throw new Error("ACCOUNT_SECURITY_ENCRYPTION_KEY must decode to exactly 32 bytes");
  }
  return key;
}

function mfaAad(userId: string): string {
  return `mfa:totp:${userId}`;
}

async function encryptWithDedicatedKey(
  plaintext: string,
  context: string,
  keyBytes: Uint8Array<ArrayBuffer>
): Promise<EncryptedEnvelope> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await crypto.subtle.importKey("raw", keyBytes, "AES-GCM", false, ["encrypt"]);
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, additionalData: new TextEncoder().encode(context) },
    key,
    new TextEncoder().encode(plaintext)
  );
  const encryptedBytes = new Uint8Array(encrypted);
  const authTag = encryptedBytes.slice(-16);
  const ciphertext = encryptedBytes.slice(0, -16);
  return {
    ciphertext: encodeBase64(ciphertext),
    iv: encodeBase64(iv),
    authTag: encodeBase64(authTag),
    keyVersion: 2,
  };
}

async function decryptWithDedicatedKey(
  envelope: EncryptedEnvelope,
  context: string,
  keyBytes: Uint8Array<ArrayBuffer>
): Promise<string> {
  const key = await crypto.subtle.importKey("raw", keyBytes, "AES-GCM", false, ["decrypt"]);
  const ciphertext = decodeBase64(envelope.ciphertext);
  const authTag = decodeBase64(envelope.authTag);
  const encrypted = new Uint8Array(ciphertext.length + authTag.length);
  encrypted.set(ciphertext);
  encrypted.set(authTag, ciphertext.length);
  const plaintext = await crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: decodeBase64(envelope.iv),
      additionalData: new TextEncoder().encode(context),
    },
    key,
    encrypted
  );
  return new TextDecoder().decode(plaintext);
}

/** Encrypt a TOTP secret for a user. */
export async function sealMfaTotpSecret(plaintext: string, userId: string): Promise<EncryptedEnvelope> {
  const trimmed = plaintext.trim();
  if (!trimmed) throw new Error("Cannot seal empty MFA secret");
  const context = mfaAad(userId);
  const dedicated = accountSecurityKey();
  if (dedicated) {
    return encryptWithDedicatedKey(trimmed, context, dedicated);
  }
  // Fallback: shared envelope key + purpose-bound AAD (documented operationally).
  return encryptWhatsAppSecret(trimmed, context);
}

export async function revealMfaTotpSecret(
  envelope: EncryptedEnvelope,
  userId: string
): Promise<string> {
  const context = mfaAad(userId);
  if (envelope.keyVersion === 2) {
    const dedicated = accountSecurityKey();
    if (!dedicated) {
      throw new Error("ACCOUNT_SECURITY_ENCRYPTION_KEY required to decrypt this MFA secret");
    }
    return decryptWithDedicatedKey(envelope, context, dedicated);
  }
  return decryptWhatsAppSecret(envelope, context);
}

export function encryptionKeySource(): "ACCOUNT_SECURITY_ENCRYPTION_KEY" | "WHATSAPP_SESSION_ENCRYPTION_KEY" {
  return process.env.ACCOUNT_SECURITY_ENCRYPTION_KEY?.trim()
    ? "ACCOUNT_SECURITY_ENCRYPTION_KEY"
    : "WHATSAPP_SESSION_ENCRYPTION_KEY";
}
