import { createHmac, timingSafeEqual } from "node:crypto";
import { getPublicBaseUrl } from "@/lib/constants";

const MEDIA_URL_TTL_MS = 10 * 60 * 1000;

function sharedSecret(): string {
  const secret = process.env.WHATSAPP_GATEWAY_SHARED_SECRET?.trim();
  if (!secret || secret.length < 32) {
    throw new Error("WHATSAPP_GATEWAY_SHARED_SECRET must contain at least 32 characters");
  }
  return secret;
}

export function isWhatsAppGatewayOutboundKey(key: string): boolean {
  if (!key || key.includes("..") || key.includes("\\")) return false;
  return key.startsWith("whatsapp/") && key.includes("/outbound/");
}

function signOutboundMediaKey(storageKey: string, expMs: number): string {
  return createHmac("sha256", sharedSecret()).update(`${storageKey}\n${expMs}`).digest("hex");
}

/** Signed HTTPS URL the WhatsApp gateway can fetch without R2 public-host allowlisting. */
export function buildGatewayOutboundMediaUrl(storageKey: string): string {
  if (!isWhatsAppGatewayOutboundKey(storageKey)) {
    throw new Error("Invalid outbound media key");
  }
  const base = (
    process.env.WHATSAPP_GATEWAY_MEDIA_BASE_URL?.trim() ||
    process.env.SEGMIQ_INTERNAL_BASE_URL?.trim() ||
    getPublicBaseUrl()
  ).replace(/\/$/, "");
  const exp = Date.now() + MEDIA_URL_TTL_MS;
  const sig = signOutboundMediaKey(storageKey, exp);
  const query = new URLSearchParams({
    key: storageKey,
    exp: String(exp),
    sig,
  });
  return `${base}/api/internal/whatsapp/outbound-media?${query.toString()}`;
}

export function verifyGatewayOutboundMediaToken(
  storageKey: string,
  expRaw: string,
  sig: string
): boolean {
  if (!isWhatsAppGatewayOutboundKey(storageKey)) return false;
  const exp = Number(expRaw);
  if (!Number.isFinite(exp) || exp < Date.now()) return false;
  if (!/^[a-f0-9]{64}$/i.test(sig)) return false;
  const expected = signOutboundMediaKey(storageKey, exp);
  try {
    return timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(sig, "hex"));
  } catch {
    return false;
  }
}
