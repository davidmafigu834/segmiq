import { extractFromFormData } from "@/lib/lead-helpers";
import { formatFormKey, formatFormValue } from "@/lib/format-form-data";

export function isFacebookInstantFormLead(source?: string | null): boolean {
  return source === "FACEBOOK";
}

const SKIP_FORM_KEY =
  /^(utm_|id$|created_time|fb_|gclid|full_name|first_name|last_name|email|e-mail|phone|mobile|tel|name)$/i;

function isContactFieldKey(key: string): boolean {
  const lower = key.toLowerCase();
  return ["email", "phone", "mobile", "tel", "name", "full name", "first_name", "last_name"].some((part) =>
    lower.includes(part)
  );
}

function fieldPriority(key: string): number {
  if (/message|notes|detail|comment|describe/i.test(key)) return 100;
  if (/project|service|installation|looking|interested|type/i.test(key)) return 90;
  if (/budget|price|value/i.test(key)) return 80;
  if (/timeline|when|urgency|timeframe/i.test(key)) return 70;
  if (/city|location|area|suburb|region|address/i.test(key)) return 60;
  return 10;
}

export function facebookLeadDisplayName(lead: {
  name?: string | null;
  phone?: string | null;
  form_data?: Record<string, unknown> | null;
}): string {
  const name = lead.name?.trim();
  if (name) return name;

  const fd = lead.form_data ?? {};
  const fromForm =
    extractFromFormData(fd, ["full name", "name"]) ||
    [fd.first_name, fd.last_name]
      .filter((v) => typeof v === "string" && v.trim())
      .join(" ")
      .trim();
  if (fromForm) return fromForm;

  const phone =
    lead.phone?.trim() || extractFromFormData(fd, ["phone", "mobile", "tel"]);
  if (phone) return phone;

  const email = extractFromFormData(fd, ["email", "e-mail"]);
  if (email) {
    const local = email.split("@")[0]?.trim();
    if (local) return local;
  }

  return "Facebook lead";
}

export function facebookLeadEmail(lead: {
  form_data?: Record<string, unknown> | null;
}): string | null {
  const fd = lead.form_data ?? {};
  const email = extractFromFormData(fd, ["email", "e-mail"]);
  return email?.trim() || null;
}

export function facebookLeadPhone(lead: {
  phone?: string | null;
  form_data?: Record<string, unknown> | null;
}): string | null {
  return (
    lead.phone?.trim() ||
    extractFromFormData(lead.form_data ?? {}, ["phone", "mobile", "tel"])?.trim() ||
    null
  );
}

export type FacebookFormHighlight = {
  label: string;
  value: string;
};

export function facebookLeadFormHighlights(lead: {
  form_data?: Record<string, unknown> | null;
}): FacebookFormHighlight[] {
  const fd = lead.form_data ?? {};
  const entries = Object.entries(fd)
    .filter(([key, val]) => {
      if (key.startsWith("_")) return false;
      if (!val || typeof val !== "string" || !val.trim()) return false;
      if (SKIP_FORM_KEY.test(key)) return false;
      if (isContactFieldKey(key)) return false;
      return true;
    })
    .sort(([a], [b]) => fieldPriority(b) - fieldPriority(a))
    .slice(0, 3)
    .map(([key, val]) => {
      const text = String(val);
      const formatted = formatFormValue(text);
      return {
        label: formatFormKey(key),
        value: formatted.length > 72 ? `${formatted.slice(0, 69)}…` : formatted,
      };
    });

  return entries;
}

export function facebookLeadPreviewLine(lead: {
  form_data?: Record<string, unknown> | null;
}): string {
  const highlights = facebookLeadFormHighlights(lead);
  if (highlights.length > 0) {
    const first = highlights[0]!;
    return `${first.label}: ${first.value}`;
  }
  return "Submitted via Facebook Instant Form";
}
