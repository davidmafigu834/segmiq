/**
 * SHA-256 hex digest of an invitation token or session secret.
 * Uses Web Crypto so Edge Middleware and Node return the same hash.
 * Do not import Node's `crypto` module here.
 */
export async function hashToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  const bytes = new Uint8Array(digest);
  let hex = "";
  for (const byte of bytes) hex += byte.toString(16).padStart(2, "0");
  return hex;
}
