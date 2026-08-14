export type EncryptedEnvelope = {
  ciphertext: string;
  iv: string;
  authTag: string;
  keyVersion: number;
};

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

function sessionKey(): Uint8Array<ArrayBuffer> {
  const raw = process.env.WHATSAPP_SESSION_ENCRYPTION_KEY?.trim();
  if (!raw) throw new Error("WHATSAPP_SESSION_ENCRYPTION_KEY is required");

  const key = /^[a-f0-9]{64}$/i.test(raw)
    ? Uint8Array.from(raw.match(/.{1,2}/g)!.map((value) => Number.parseInt(value, 16)))
    : decodeBase64(raw);
  if (key.length !== 32) {
    throw new Error("WHATSAPP_SESSION_ENCRYPTION_KEY must decode to exactly 32 bytes");
  }
  return key;
}

export async function encryptWhatsAppSecret(plaintext: string, context: string): Promise<EncryptedEnvelope> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await crypto.subtle.importKey("raw", sessionKey(), "AES-GCM", false, ["encrypt"]);
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
    keyVersion: 1,
  };
}

export async function decryptWhatsAppSecret(envelope: EncryptedEnvelope, context: string): Promise<string> {
  if (envelope.keyVersion !== 1) throw new Error("Unsupported WhatsApp secret key version");
  const key = await crypto.subtle.importKey("raw", sessionKey(), "AES-GCM", false, ["decrypt"]);
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
