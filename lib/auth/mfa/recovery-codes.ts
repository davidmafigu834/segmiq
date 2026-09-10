/**
 * MFA recovery codes — high-entropy, hashed at rest, single-use.
 * Never log plaintext codes.
 */

const CODE_COUNT = 10;
const CODE_BYTES = 5; // ~10 hex chars after formatting

function randomCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(CODE_BYTES));
  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
  // Human-readable groups: XXXX-XXXX-XX
  return `${hex.slice(0, 4)}-${hex.slice(4, 8)}-${hex.slice(8, 10)}`;
}

export function generateRecoveryCodes(count = CODE_COUNT): string[] {
  const codes = new Set<string>();
  while (codes.size < count) {
    codes.add(randomCode());
  }
  return [...codes];
}

export function normalizeRecoveryCode(raw: string): string {
  return raw.replace(/[\s-]/g, "").toUpperCase();
}

export async function hashRecoveryCode(code: string, userId: string): Promise<string> {
  const normalized = normalizeRecoveryCode(code);
  const data = new TextEncoder().encode(`segmiq-recovery:${userId}:${normalized}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function hashChallengeToken(token: string): Promise<string> {
  const data = new TextEncoder().encode(`segmiq-challenge:${token}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function generateChallengeToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
