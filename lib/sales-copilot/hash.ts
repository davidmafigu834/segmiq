import { createHash } from "crypto";

function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stable(record[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

export function payloadHash(value: unknown): string {
  return createHash("sha256").update(stable(value)).digest("hex").slice(0, 24);
}

export function contextRevision(parts: unknown): string {
  return createHash("sha256").update(stable(parts)).digest("hex").slice(0, 16);
}
