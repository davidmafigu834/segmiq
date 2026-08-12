/**
 * Client helpers for Create Deal form — prefill, options, payload mapping.
 * Server creation stays in createDealFromLead / RPC.
 */

import type { LeadRow } from "@/types";

export const BUYING_TIMEFRAME_OPTIONS = [
  "Immediately",
  "Within 30 days",
  "1–3 months",
  "3+ months",
  "Unknown",
] as const;

export type BuyingTimeframeOption = (typeof BUYING_TIMEFRAME_OPTIONS)[number];

export const NEXT_ACTION_OPTIONS = [
  "Follow up",
  "Site assessment",
  "Meeting",
  "Call customer",
  "Prepare Quote",
  "Send Quote",
] as const;

export type NextActionOption = (typeof NEXT_ACTION_OPTIONS)[number];

export type DealValueMode = "exact" | "range" | "later";

export function suggestDealName(lead: Pick<LeadRow, "project_type" | "customer_need" | "name">): string {
  const project = lead.project_type?.trim();
  if (project) return project;
  const need = lead.customer_need?.trim();
  if (need) {
    const short = need.length > 80 ? `${need.slice(0, 77)}…` : need;
    return short;
  }
  return "";
}

export function parseLeadBudgetHint(
  budget: string | null | undefined
): { mode: DealValueMode; exact?: number; min?: number; max?: number } {
  if (!budget?.trim()) return { mode: "later" };
  // Strip thousand separators so "$6,500" stays one number, not 6 and 500.
  const cleaned = budget.replace(/,/g, "");
  const nums = [...cleaned.matchAll(/(\d+(?:\.\d+)?)/g)]
    .map((m) => Number(m[1]))
    .filter((n) => Number.isFinite(n) && n > 0);
  if (nums.length >= 2) {
    const min = Math.min(nums[0]!, nums[1]!);
    const max = Math.max(nums[0]!, nums[1]!);
    if (max > min) return { mode: "range", min, max };
  }
  if (nums.length === 1) return { mode: "exact", exact: nums[0] };
  return { mode: "later" };
}

export function normalizeBuyingTimeframe(
  raw: string | null | undefined
): string {
  const v = raw?.trim() ?? "";
  if (!v) return "";
  const lower = v.toLowerCase();
  if (lower.includes("immediate") || lower.includes("asap")) return "Immediately";
  if (lower.includes("30") || lower.includes("1 month") || lower.includes("within 1"))
    return "Within 30 days";
  if (lower.includes("1–3") || lower.includes("1-3") || lower.includes("within 3"))
    return "1–3 months";
  if (
    lower.includes("3+") ||
    lower.includes("3–6") ||
    lower.includes("3-6") ||
    lower.includes("6 month") ||
    lower.includes("exploring") ||
    lower.includes("no rush") ||
    lower.includes("research")
  )
    return "3+ months";
  if (lower.includes("unknown") || lower.includes("not sure")) return "Unknown";
  if ((BUYING_TIMEFRAME_OPTIONS as readonly string[]).includes(v)) return v;
  return v;
}

export function parseMoneyInput(raw: string): number | null {
  const n = Number(String(raw).replace(/[^0-9.]/g, ""));
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

export function currencyPrefix(currency?: string | null): string {
  if (!currency || currency === "USD") return "$";
  if (currency === "ZAR") return "ZAR ";
  return `${currency} `;
}

export function toDatetimeLocalValue(isoOrDate: string | null | undefined): string {
  if (!isoOrDate) return "";
  const raw = isoOrDate.includes("T") ? isoOrDate : `${isoOrDate}T09:00:00`;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) {
    return raw.slice(0, 16);
  }
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export type CreateDealClientPayload = {
  name: string;
  serviceSummary: string | null;
  customerNeed: string | null;
  location: string | null;
  buyingTimeframe: string | null;
  decisionMakerStatus: "YES" | "NO" | "UNKNOWN" | null;
  decisionMakerName: string | null;
  expectedDecisionAt: string | null;
  customerBudget: number | null;
  salesEstimate: number | null;
  estimatedValue: number | null;
  estimatedValueMin: number | null;
  estimatedValueMax: number | null;
  valuePending: boolean;
  nextActionAt: string | null;
  nextActionLabel: string | null;
  notes: string | null;
};

export function buildCreateDealPayload(input: {
  name: string;
  serviceSummary: string;
  customerNeed: string;
  location: string;
  buyingTimeframe: string;
  decisionMakerStatus: "YES" | "NO" | "UNKNOWN" | "";
  decisionMakerName: string;
  expectedDecisionAt: string;
  valueMode: DealValueMode;
  exactValue: string;
  rangeMin: string;
  rangeMax: string;
  nextActionLabel: string;
  nextActionAt: string;
  notes: string;
}): { ok: true; payload: CreateDealClientPayload } | { ok: false; fieldErrors: Record<string, string> } {
  const fieldErrors: Record<string, string> = {};
  const name = input.name.trim();
  if (!name) fieldErrors.name = "Enter a Deal name.";

  let salesEstimate: number | null = null;
  let estimatedValue: number | null = null;
  let estimatedValueMin: number | null = null;
  let estimatedValueMax: number | null = null;
  let valuePending = false;

  if (input.valueMode === "exact") {
    const n = parseMoneyInput(input.exactValue);
    if (n == null || n <= 0) {
      fieldErrors.exactValue = "Enter a valid estimated value.";
    } else {
      salesEstimate = n;
      estimatedValue = n;
    }
  } else if (input.valueMode === "range") {
    const min = parseMoneyInput(input.rangeMin);
    const max = parseMoneyInput(input.rangeMax);
    if (min == null || min < 0) fieldErrors.rangeMin = "Enter a valid minimum.";
    if (max == null || max < 0) fieldErrors.rangeMax = "Enter a valid maximum.";
    if (min != null && max != null && max < min) {
      fieldErrors.rangeMax = "Maximum value must be greater than minimum value.";
    }
    if (!fieldErrors.rangeMin && !fieldErrors.rangeMax && min != null && max != null) {
      estimatedValueMin = min;
      estimatedValueMax = max;
    }
  } else {
    valuePending = true;
  }

  if (input.expectedDecisionAt) {
    const d = new Date(`${input.expectedDecisionAt}T12:00:00`);
    if (Number.isNaN(d.getTime())) {
      fieldErrors.expectedDecisionAt = "Enter a valid date.";
    }
  }

  let nextActionAt: string | null = null;
  if (input.nextActionAt) {
    const d = new Date(input.nextActionAt);
    if (Number.isNaN(d.getTime())) {
      fieldErrors.nextActionAt = "Enter a valid date and time.";
    } else {
      nextActionAt = d.toISOString();
    }
  }

  if (Object.keys(fieldErrors).length > 0) return { ok: false, fieldErrors };

  return {
    ok: true,
    payload: {
      name,
      serviceSummary: input.serviceSummary.trim() || null,
      customerNeed: input.customerNeed.trim() || null,
      location: input.location.trim() || null,
      buyingTimeframe: input.buyingTimeframe.trim() || null,
      decisionMakerStatus: input.decisionMakerStatus || null,
      decisionMakerName: input.decisionMakerName.trim() || null,
      expectedDecisionAt: input.expectedDecisionAt || null,
      customerBudget: null,
      salesEstimate,
      estimatedValue,
      estimatedValueMin,
      estimatedValueMax,
      valuePending,
      nextActionAt,
      nextActionLabel: input.nextActionLabel.trim() || null,
      notes: input.notes.trim() || null,
    },
  };
}
