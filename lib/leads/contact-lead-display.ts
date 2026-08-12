import { extractFromFormData, extractPhoneFromFormData, looksLikePhoneNumber } from "@/lib/lead-helpers";
import { formatFormKey, formatFormValue } from "@/lib/format-form-data";
import { intakeOutcomeLabel, type WalkInIntakeOutcome } from "@/lib/walk-in-intake";
import type { LeadSource } from "@/types";

export type ContactLeadKind = "walk_in" | "referral" | "landing_page" | "manual" | "other";

const SKIP_FORM_KEY =
  /^(utm_|id$|created_time|fb_|gclid|channel$|first_message|hub_intake|hub_source|magic_token)$/i;

function isContactFieldKey(key: string): boolean {
  const lower = key.toLowerCase();
  return [
    "email",
    "e-mail",
    "phone",
    "mobile",
    "tel",
    "name",
    "full name",
    "first_name",
    "last_name",
  ].some((part) => lower.includes(part));
}

function fieldPriority(key: string): number {
  if (/message|notes|detail|comment|describe|referr/i.test(key)) return 100;
  if (/project|service|installation|looking|interested|type|package/i.test(key)) return 90;
  if (/budget|price|value/i.test(key)) return 80;
  if (/timeline|when|urgency|timeframe/i.test(key)) return 70;
  if (/city|location|area|suburb|region|address/i.test(key)) return 60;
  return 10;
}

export type ContactLeadSourceMeta = {
  kind: ContactLeadKind;
  label: string;
  badgeLabel: string;
  accent: string;
  badgeTextClass: string;
  badgeBgClass: string;
  badgeBorderClass: string;
};

export function isWalkInLead(lead: {
  source?: string | null;
  form_data?: Record<string, unknown> | null;
}): boolean {
  const fd = lead.form_data ?? {};
  const hubSource = String(fd.hub_source ?? fd.hubSource ?? "").toLowerCase();
  if (hubSource.includes("walk")) return true;
  if (typeof fd.hub_intake === "string" && fd.hub_intake.trim()) return true;
  return false;
}

export function resolveContactLeadKind(lead: {
  source?: string | null;
  form_data?: Record<string, unknown> | null;
}): ContactLeadKind {
  if (lead.source === "REFERRAL") return "referral";
  if (lead.source === "LANDING_PAGE") return "landing_page";
  if (lead.source === "MANUAL") {
    return isWalkInLead(lead) ? "walk_in" : "manual";
  }
  return "other";
}

export function contactLeadSourceMeta(lead: {
  source?: string | null;
  form_data?: Record<string, unknown> | null;
}): ContactLeadSourceMeta {
  const kind = resolveContactLeadKind(lead);
  switch (kind) {
    case "walk_in":
      return {
        kind,
        label: "Walk-in",
        badgeLabel: "Walk-in",
        accent: "#D4FF4F",
        badgeTextClass: "text-[#3d4f00]",
        badgeBgClass: "bg-[rgba(212,255,79,0.14)]",
        badgeBorderClass: "border-[rgba(212,255,79,0.35)]",
      };
    case "referral":
      return {
        kind,
        label: "Referral",
        badgeLabel: "Referral",
        accent: "#a78bfa",
        badgeTextClass: "text-[#6d28d9]",
        badgeBgClass: "bg-[rgba(167,139,250,0.12)]",
        badgeBorderClass: "border-[rgba(167,139,250,0.28)]",
      };
    case "landing_page":
      return {
        kind,
        label: "Profile page",
        badgeLabel: "Profile enquiry",
        accent: "var(--accent)",
        badgeTextClass: "text-[var(--accent-fg)]",
        badgeBgClass: "bg-[var(--accent-muted)]",
        badgeBorderClass: "border-[var(--accent-border)]",
      };
    case "manual":
      return {
        kind,
        label: "Manual entry",
        badgeLabel: "Manual",
        accent: "#94a3b8",
        badgeTextClass: "text-[var(--text-secondary)]",
        badgeBgClass: "bg-[var(--bg-tertiary)]",
        badgeBorderClass: "border-[var(--border)]",
      };
    default:
      return {
        kind: "other",
        label: "Contact",
        badgeLabel: "Contact",
        accent: "#94a3b8",
        badgeTextClass: "text-[var(--text-secondary)]",
        badgeBgClass: "bg-[var(--bg-tertiary)]",
        badgeBorderClass: "border-[var(--border)]",
      };
  }
}

export function contactLeadDisplayName(lead: {
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

  const phone = contactLeadPhone(lead);
  if (phone) return phone;

  const email = contactLeadEmail(lead);
  if (email) {
    const local = email.split("@")[0]?.trim();
    if (local) return local;
  }

  return "Contact";
}

export function contactLeadEmail(lead: {
  form_data?: Record<string, unknown> | null;
}): string | null {
  const fd = lead.form_data ?? {};
  const email = extractFromFormData(fd, ["email", "e-mail"]);
  return email?.trim() || null;
}

export function contactLeadPhone(lead: {
  phone?: string | null;
  form_data?: Record<string, unknown> | null;
}): string | null {
  if (lead.phone?.trim() && looksLikePhoneNumber(lead.phone)) {
    return lead.phone.trim();
  }
  return extractPhoneFromFormData(lead.form_data ?? {})?.trim() || null;
}

export function walkInIntakeLabel(lead: {
  form_data?: Record<string, unknown> | null;
}): string | null {
  const fd = lead.form_data ?? {};
  const intake = fd.hub_intake;
  if (typeof intake !== "string" || !intake.trim()) return null;
  return intakeOutcomeLabel(intake as WalkInIntakeOutcome);
}

export type ContactFormHighlight = {
  label: string;
  value: string;
};

export function contactLeadFormHighlights(lead: {
  form_data?: Record<string, unknown> | null;
}): ContactFormHighlight[] {
  const fd = lead.form_data ?? {};
  return Object.entries(fd)
    .filter(([key, val]) => {
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
}

function contactLeadNotes(lead: { form_data?: Record<string, unknown> | null }): string | null {
  const fd = lead.form_data ?? {};
  const notes =
    extractFromFormData(fd, ["notes", "message", "detail", "comment", "describe"]) ||
    (typeof fd.Notes === "string" ? fd.Notes : null);
  if (!notes?.trim()) return null;
  const trimmed = notes.trim();
  return trimmed.length > 120 ? `${trimmed.slice(0, 117)}…` : trimmed;
}

export function contactLeadPreviewLine(lead: {
  source?: LeadSource | string | null;
  status?: string;
  form_data?: Record<string, unknown> | null;
}): string {
  const meta = contactLeadSourceMeta(lead);
  const notes = contactLeadNotes(lead);
  const highlights = contactLeadFormHighlights(lead);

  if (meta.kind === "walk_in") {
    const intake = walkInIntakeLabel(lead);
    if (intake && notes) return `${intake} · ${notes}`;
    if (intake) return `Walk-in · ${intake}`;
    if (notes) return notes;
    return "Walk-in visit logged";
  }

  if (meta.kind === "referral") {
    const referrer = extractFromFormData(lead.form_data ?? {}, ["referr", "referred by", "source name"]);
    if (referrer && notes) return `Referred by ${referrer} · ${notes}`;
    if (referrer) return `Referred by ${referrer}`;
    if (notes) return notes;
    return "Referred contact";
  }

  if (highlights.length > 0) {
    const first = highlights[0]!;
    return `${first.label}: ${first.value}`;
  }

  if (notes) return notes;

  if (meta.kind === "landing_page") {
    return "Enquiry from your profile page";
  }

  if (meta.kind === "manual") {
    return lead.status === "NEW" ? "Added manually · Awaiting first call" : "Added manually";
  }

  return meta.label;
}

export function isContactLeadCardSource(source?: string | null): boolean {
  return source === "MANUAL" || source === "REFERRAL" || source === "LANDING_PAGE";
}
