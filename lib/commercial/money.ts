import { COST_FIELD_NAMES } from "./types";

/** Strip protected cost/margin fields at the API boundary. */
export function omitCostFields<T>(value: T, canSeeCost: boolean): T {
  if (canSeeCost || value == null || typeof value !== "object") return value;
  if (Array.isArray(value)) {
    return value.map((v) => omitCostFields(v, canSeeCost)) as T;
  }
  const obj = value as Record<string, unknown>;
  const next: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (COST_FIELD_NAMES.has(k)) continue;
    next[k] = omitCostFields(v, canSeeCost);
  }
  return next as T;
}

export function parseMoney(raw: unknown): number | null {
  if (raw == null || raw === "") return null;
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : null;
  const s = String(raw).trim().replace(/[^\d.,\-]/g, "");
  if (!s) return null;
  const hasComma = s.includes(",");
  const hasDot = s.includes(".");
  let normalized = s;
  if (hasComma && hasDot) {
    const lastComma = s.lastIndexOf(",");
    const lastDot = s.lastIndexOf(".");
    normalized = lastComma > lastDot ? s.replace(/\./g, "").replace(",", ".") : s.replace(/,/g, "");
  } else if (hasComma && !hasDot) {
    const parts = s.split(",");
    normalized = parts[1] && parts[1].length === 3 && parts[0].length <= 3 ? s.replace(",", "") : s.replace(",", ".");
  }
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

export function parseQuantity(raw: unknown, allowFractional: boolean): { ok: true; value: number } | { ok: false; reason: string } {
  const n = parseMoney(raw);
  if (n == null) return { ok: false, reason: "invalid stock quantity" };
  if (n < 0) return { ok: false, reason: "quantity cannot be negative" };
  if (!allowFractional && !Number.isInteger(n)) {
    return { ok: false, reason: "fractional quantity not allowed for this unit" };
  }
  return { ok: true, value: n };
}
