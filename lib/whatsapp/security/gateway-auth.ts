export const GATEWAY_TIMESTAMP_HEADER = "x-segmiq-timestamp";
export const GATEWAY_NONCE_HEADER = "x-segmiq-nonce";
export const GATEWAY_SIGNATURE_HEADER = "x-segmiq-signature";
export const GATEWAY_MAX_SKEW_MS = 5 * 60 * 1000;

function sharedSecret(): string {
  const secret = process.env.WHATSAPP_GATEWAY_SHARED_SECRET?.trim();
  if (!secret || secret.length < 32) {
    throw new Error("WHATSAPP_GATEWAY_SHARED_SECRET must contain at least 32 characters");
  }
  return secret;
}

function bytesToHex(value: Uint8Array): string {
  return Array.from(value, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function hexToBytes(value: string): Uint8Array<ArrayBuffer> | null {
  if (!/^[a-f0-9]{64}$/i.test(value)) return null;
  return Uint8Array.from(value.match(/.{1,2}/g)!.map((part) => Number.parseInt(part, 16)));
}

function randomNonce(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(18));
  if (typeof Buffer !== "undefined") return Buffer.from(bytes).toString("base64url");
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function bodyHash(body: string): Promise<string> {
  return bytesToHex(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(body))));
}

async function canonical(timestamp: string, nonce: string, method: string, path: string, body: string): Promise<string> {
  return [timestamp, nonce, method.toUpperCase(), path, await bodyHash(body)].join("\n");
}

async function gatewayKey(usage: KeyUsage[]): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(sharedSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    usage
  );
}

export async function signGatewayRequest(input: {
  method: string;
  path: string;
  body?: string;
  now?: number;
  nonce?: string;
}): Promise<Record<string, string>> {
  const timestamp = String(input.now ?? Date.now());
  const nonce = input.nonce ?? randomNonce();
  const signature = bytesToHex(new Uint8Array(await crypto.subtle.sign(
    "HMAC",
    await gatewayKey(["sign"]),
    new TextEncoder().encode(await canonical(timestamp, nonce, input.method, input.path, input.body ?? ""))
  )));
  return {
    [GATEWAY_TIMESTAMP_HEADER]: timestamp,
    [GATEWAY_NONCE_HEADER]: nonce,
    [GATEWAY_SIGNATURE_HEADER]: signature,
  };
}

export async function verifyGatewayRequest(input: {
  headers: Headers;
  method: string;
  path: string;
  body?: string;
  now?: number;
}): Promise<{ ok: true; nonce: string; expiresAt: string } | { ok: false; reason: string }> {
  const timestamp = input.headers.get(GATEWAY_TIMESTAMP_HEADER)?.trim();
  const nonce = input.headers.get(GATEWAY_NONCE_HEADER)?.trim();
  const signature = input.headers.get(GATEWAY_SIGNATURE_HEADER)?.trim();
  if (!timestamp || !nonce || !signature) return { ok: false, reason: "Missing gateway signature" };
  if (!/^\d{10,16}$/.test(timestamp) || !/^[A-Za-z0-9_-]{16,128}$/.test(nonce)) {
    return { ok: false, reason: "Malformed gateway signature" };
  }
  const requestTime = Number(timestamp);
  const now = input.now ?? Date.now();
  if (!Number.isFinite(requestTime) || Math.abs(now - requestTime) > GATEWAY_MAX_SKEW_MS) {
    return { ok: false, reason: "Expired gateway signature" };
  }
  const signatureBytes = hexToBytes(signature);
  if (!signatureBytes || !await crypto.subtle.verify(
    "HMAC",
    await gatewayKey(["verify"]),
    signatureBytes,
    new TextEncoder().encode(await canonical(timestamp, nonce, input.method, input.path, input.body ?? ""))
  )) {
    return { ok: false, reason: "Invalid gateway signature" };
  }
  return {
    ok: true,
    nonce,
    expiresAt: new Date(requestTime + GATEWAY_MAX_SKEW_MS).toISOString(),
  };
}
