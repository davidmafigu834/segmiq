import { createHash } from "crypto";

/** Stable UUID-shaped id. Same key always yields the same id. */
export function demoId(key: string): string {
  const hex = createHash("sha256").update(`segmiq.demo.v1:${key}`).digest("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}
