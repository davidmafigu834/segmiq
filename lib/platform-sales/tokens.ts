import { createHash, randomBytes } from "node:crypto";
export function createRecipientToken(): { raw: string; hash: string } {
  const raw = randomBytes(32).toString("base64url");
  return { raw, hash: hashRecipientToken(raw) };
}
export function hashRecipientToken(raw: string): string {
  return createHash("sha256").update(raw, "utf8").digest("hex");
}
export function hashDocument(body: Buffer): string {
  return createHash("sha256").update(body).digest("hex");
}
