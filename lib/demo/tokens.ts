import { randomBytes } from "crypto";

/** 256-bit opaque token. The raw value is shown once and never stored. */
export function generateOpaqueToken(): string {
  return randomBytes(32).toString("base64url");
}

export async function hashToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  const bytes = new Uint8Array(digest);
  let hex = "";
  for (const byte of bytes) hex += byte.toString(16).padStart(2, "0");
  return hex;
}
