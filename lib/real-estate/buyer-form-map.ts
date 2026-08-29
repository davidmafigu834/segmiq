/**
 * Safe mapping of marketing form answers onto buyer requirement fields.
 * Free-text is parsed conservatively — never treated as already-normalized CRM values.
 */

import { BUYER_TIMELINE_OPTIONS } from "./requirements";

export type MappedBuyerRequirements = {
  buyer_budget_min: number | null;
  buyer_budget_max: number | null;
  buyer_bedrooms_wanted: number | null;
  buyer_area_preference: string | null;
  buyer_timeline: string | null;
  formPrequalified: boolean;
};

const BUDGET_KEYS = [
  "budget",
  "buyer_budget",
  "price_range",
  "what_is_your_budget",
  "budget_usd",
];
const BEDROOM_KEYS = ["bedrooms", "beds", "bedroom", "how_many_bedrooms", "bedrooms_wanted"];
const AREA_KEYS = ["area", "suburb", "location", "preferred_area", "area_preference", "where"];
const TIMELINE_KEYS = ["timeline", "when", "timeframe", "buying_timeframe", "how_soon"];

function normKey(k: string): string {
  return k.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

function firstString(form: Record<string, unknown>, keys: string[]): string | null {
  const entries = Object.entries(form);
  for (const key of keys) {
    for (const [k, v] of entries) {
      if (normKey(k) === key || normKey(k).includes(key)) {
        if (typeof v === "string" && v.trim()) return v.trim();
        if (typeof v === "number" && Number.isFinite(v)) return String(v);
      }
    }
  }
  return null;
}

export function parseBudgetBand(raw: string | null): { min: number | null; max: number | null } {
  if (!raw) return { min: null, max: null };
  const t = raw.toLowerCase().replace(/,/g, "").replace(/us\$/g, "").replace(/\$/g, "").trim();
  const plus = t.match(/^(\d+(?:\.\d+)?)\s*k?\s*\+$/);
  if (plus) {
    let n = Number(plus[1]);
    if (/k/.test(t)) n *= 1000;
    return { min: n, max: null };
  }
  const range = t.match(/(\d+(?:\.\d+)?)\s*k?\s*[-–to]+\s*(\d+(?:\.\d+)?)\s*k?/);
  if (range) {
    let a = Number(range[1]);
    let b = Number(range[2]);
    if (/k/.test(t)) {
      a *= 1000;
      b *= 1000;
    }
    return { min: Math.min(a, b), max: Math.max(a, b) };
  }
  const single = t.match(/(\d+(?:\.\d+)?)\s*(k)?/);
  if (single) {
    let n = Number(single[1]);
    if (single[2] === "k" || /\dk\b/.test(t)) n *= 1000;
    if (!Number.isFinite(n) || n <= 0) return { min: null, max: null };
    return { min: n, max: n };
  }
  return { min: null, max: null };
}

export function parseBedroomsWanted(raw: string | null): number | null {
  if (!raw) return null;
  const t = raw.toLowerCase();
  const plus = t.match(/(\d+)\s*\+/);
  if (plus) return Number(plus[1]);
  const n = t.match(/(\d+)/);
  if (!n) return null;
  const v = Number(n[1]);
  if (!Number.isFinite(v) || v < 0 || v > 20) return null;
  return v;
}

export function parseTimeline(raw: string | null): string | null {
  if (!raw) return null;
  const t = raw.toLowerCase();
  for (const opt of BUYER_TIMELINE_OPTIONS) {
    if (t.includes(opt.toLowerCase())) return opt;
  }
  if (t.includes("immediate") || t.includes("now") || t.includes("asap")) return "Immediate";
  if (t.includes("3 month") || t.includes("within 3")) return "Within 3 months";
  if (t.includes("6 month") || t.includes("3–6") || t.includes("3-6")) return "3–6 months";
  if (t.includes("12") || t.includes("year")) return "6–12 months";
  if (t.includes("explor")) return "Exploring";
  return null;
}

export function mapFormToBuyerRequirements(form: Record<string, unknown>): MappedBuyerRequirements {
  const budgetRaw = firstString(form, BUDGET_KEYS);
  const bedroomsRaw = firstString(form, BEDROOM_KEYS);
  const areaRaw = firstString(form, AREA_KEYS);
  const timelineRaw = firstString(form, TIMELINE_KEYS);
  const budget = parseBudgetBand(budgetRaw);
  const bedrooms = parseBedroomsWanted(bedroomsRaw);
  const timeline = parseTimeline(timelineRaw);
  const area = areaRaw ? areaRaw.slice(0, 200) : null;
  const formPrequalified = Boolean(
    (budget.min != null || budget.max != null) && bedrooms != null && area
  );
  return {
    buyer_budget_min: budget.min,
    buyer_budget_max: budget.max,
    buyer_bedrooms_wanted: bedrooms,
    buyer_area_preference: area,
    buyer_timeline: timeline,
    formPrequalified,
  };
}

export function buyerPatchFromMapping(mapped: MappedBuyerRequirements): Record<string, unknown> {
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (mapped.buyer_budget_min != null) patch.buyer_budget_min = mapped.buyer_budget_min;
  if (mapped.buyer_budget_max != null) patch.buyer_budget_max = mapped.buyer_budget_max;
  if (mapped.buyer_bedrooms_wanted != null) patch.buyer_bedrooms_wanted = mapped.buyer_bedrooms_wanted;
  if (mapped.buyer_area_preference) patch.buyer_area_preference = mapped.buyer_area_preference;
  if (mapped.buyer_timeline) patch.buyer_timeline = mapped.buyer_timeline;
  return patch;
}
