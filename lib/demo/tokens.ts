import { randomBytes } from "crypto";

/**
 * 256-bit opaque token. The raw value is shown once and never stored.
 * Server-only. Middleware hashes tokens through `token-hash.ts`.
 */
export function generateOpaqueToken(): string {
  return randomBytes(32).toString("base64url");
}
