import { randomUUID } from "crypto";
import { addDays } from "date-fns";
import type { LeadSource } from "@/types";

/** Match form answers by label (case-insensitive substring). Avoid for short tokens like "tel". */
export function extractFromFormData(
  formData: Record<string, unknown>,
  labels: string[]
): string | null {
  const entries = Object.entries(formData);
  const lower = labels.map((l) => l.toLowerCase());
  for (const [key, val] of entries) {
    if (lower.some((l) => key.toLowerCase().includes(l))) {
      if (val != null && String(val).trim()) return String(val);
    }
  }
  for (const [, val] of entries) {
    if (typeof val === "object" && val && "label" in (val as object) && "value" in (val as object)) {
      const o = val as { label: string; value: unknown };
      if (lower.some((l) => o.label?.toLowerCase().includes(l))) {
        if (o.value != null && String(o.value).trim()) return String(o.value);
      }
    }
  }
  return null;
}

/** True when a value looks like a callable phone (not free-text answers). */
export function looksLikePhoneNumber(raw: string | null | undefined): boolean {
  if (!raw?.trim()) return false;
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 7 || digits.length > 15) return false;
  // Reject mostly-alpha answers that happen to contain a few digits
  const letters = (raw.match(/[A-Za-z]/g) ?? []).length;
  if (letters > 3 && letters > digits.length / 2) return false;
  return true;
}

const PHONE_EXACT_KEYS = [
  "phone_number",
  "phone",
  "mobile_number",
  "mobile",
  "work_phone_number",
  "cell_phone",
  "cellphone",
  "telephone",
  "tel",
];

/**
 * Extract a phone from Facebook / form payloads.
 * Prefer Meta's `phone_number` and never treat keys like `tell_us` as phone
 * (substring "tel" previously poisoned Shield Roofing Instant Form leads).
 */
export function extractPhoneFromFormData(formData: Record<string, unknown>): string | null {
  const entries = Object.entries(formData);

  for (const exact of PHONE_EXACT_KEYS) {
    for (const [key, val] of entries) {
      if (key.toLowerCase() !== exact) continue;
      if (val == null) continue;
      const text = String(val).trim();
      if (looksLikePhoneNumber(text)) return text;
    }
  }

  for (const [key, val] of entries) {
    if (val == null) continue;
    const text = String(val).trim();
    if (!text) continue;
    const normalizedKey = key.toLowerCase().replace(/[\s-]+/g, "_");
    // Word-ish match: phone / mobile / telephone as a token — not "tell"
    if (
      !/(^|_)(phone|mobile|telephone|cellphone)(_|$)/.test(normalizedKey) &&
      normalizedKey !== "tel"
    ) {
      continue;
    }
    if (looksLikePhoneNumber(text)) return text;
  }

  // Nested { label, value } shapes
  for (const [, val] of entries) {
    if (typeof val !== "object" || !val || !("label" in val) || !("value" in val)) continue;
    const o = val as { label: string; value: unknown };
    const label = (o.label ?? "").toLowerCase().replace(/[\s-]+/g, "_");
    if (
      !PHONE_EXACT_KEYS.includes(label) &&
      !/(^|_)(phone|mobile|telephone)(_|$)/.test(label) &&
      label !== "tel"
    ) {
      continue;
    }
    const text = o.value != null ? String(o.value).trim() : "";
    if (looksLikePhoneNumber(text)) return text;
  }

  return null;
}

export function parseLeadFields(formData: Record<string, unknown>) {
  const name =
    extractFromFormData(formData, ["full_name", "full name"]) ||
    extractFromFormData(formData, ["name"]) ||
    (typeof formData.name === "string" ? formData.name : null);
  const phone =
    extractPhoneFromFormData(formData) ||
    (typeof formData.phone === "string" && looksLikePhoneNumber(formData.phone)
      ? formData.phone
      : null);
  const email =
    extractFromFormData(formData, ["email", "e-mail"]) ||
    (typeof formData.email === "string" ? formData.email : null);
  const budgetRaw =
    extractFromFormData(formData, ["budget", "price", "value"]) ||
    (typeof formData.budget === "string" ? formData.budget : null);
  const budget = budgetRaw?.trim() ? normalizeBudgetFromText(budgetRaw) : null;
  const projectType = extractFromFormData(formData, [
    "project_type",
    "project type",
    "project",
    "service",
  ]);
  const timeline = extractFromFormData(formData, ["timeline", "when", "date"]);
  return {
    name: name ?? null,
    phone: phone ?? null,
    email: email ?? null,
    budget: budget ?? null,
    project_type: projectType ?? null,
    timeline: timeline ?? null,
  };
}

export function newMagicToken(): { token: string; expires: string } {
  const token = randomUUID();
  const expires = addDays(new Date(), 30).toISOString();
  return { token, expires };
}

export function sourceFromString(s: string): LeadSource {
  if (
    s === "FACEBOOK" ||
    s === "LANDING_PAGE" ||
    s === "MANUAL" ||
    s === "REFERRAL" ||
    s === "WHATSAPP_INBOUND" ||
    s === "WEBSITE" ||
    s === "FACEBOOK_AD"
  ) {
    return s;
  }
  return "MANUAL";
}

function normalizeBudgetFromText(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return trimmed;
  if (/^\d+([.,]\d+)?$/.test(trimmed)) return trimmed.replace(",", ".");
  const match = trimmed.match(/(\d[\d,]*(?:\.\d+)?)/);
  if (match) return match[1]!.replace(/,/g, "");
  return trimmed;
}
