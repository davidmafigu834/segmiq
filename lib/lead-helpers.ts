import { randomUUID } from "crypto";
import { addDays } from "date-fns";
import type { LeadSource } from "@/types";

/** Match form answers by label (case-insensitive) */
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

export function parseLeadFields(formData: Record<string, unknown>) {
  const name =
    extractFromFormData(formData, ["name", "full name"]) ||
    (typeof formData.name === "string" ? formData.name : null);
  const phone =
    extractFromFormData(formData, ["phone", "mobile", "tel"]) ||
    (typeof formData.phone === "string" ? formData.phone : null);
  const email =
    extractFromFormData(formData, ["email", "e-mail"]) ||
    (typeof formData.email === "string" ? formData.email : null);
  const budget = extractFromFormData(formData, ["budget", "price", "value"]);
  const projectType = extractFromFormData(formData, [
    "project",
    "service",
    "case",
    "type",
    "project type",
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
  if (s === "FACEBOOK" || s === "LANDING_PAGE" || s === "MANUAL" || s === "REFERRAL") return s;
  return "MANUAL";
}
