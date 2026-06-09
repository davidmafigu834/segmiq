import { extractFromFormData } from "@/lib/lead-helpers";
import type { LeadRow } from "@/types";

const DIAL_CODE_REGION: Record<string, string> = {
  "263": "Zimbabwe",
  "260": "Zambia",
  "27": "South Africa",
  "254": "Kenya",
};

export function firstName(fullName: string | null | undefined, fallback = "there"): string {
  return (fullName?.trim().split(/\s+/)[0] || fallback).trim();
}

export function formatResponseWindow(hours: number): string {
  const h = Math.max(1, Math.round(hours));
  return h === 1 ? "the next hour" : `the next ${h} hours`;
}

export function extractLeadLocation(lead: Pick<LeadRow, "form_data">): string {
  const fromForm = extractFromFormData(lead.form_data ?? {}, [
    "location",
    "city",
    "suburb",
    "area",
    "region",
    "province",
    "address",
  ]);
  return fromForm?.trim() || "—";
}

export function regionFromDialCode(dialCode: string | null | undefined): string {
  const code = (dialCode ?? "").replace(/\D/g, "");
  return DIAL_CODE_REGION[code] ?? "your region";
}

export function formatWaitingDuration(createdAt: string, nowMs = Date.now()): string {
  const diffMs = Math.max(0, nowMs - new Date(createdAt).getTime());
  const minutes = Math.floor(diffMs / (1000 * 60));
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"}`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours} hour${hours === 1 ? "" : "s"}`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"}`;
}
