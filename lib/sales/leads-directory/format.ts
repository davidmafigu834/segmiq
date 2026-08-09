/**
 * Display helpers for the salesperson Leads directory.
 */

import { format, formatDistanceToNowStrict, isYesterday, isToday } from "date-fns";
import type { LeadStatus } from "@/types";
import { formatStageLabel, leadScoreBand, leadScoreLabel } from "@/lib/sales/format";
import { sourceBucket } from "@/lib/sales/sales-reports-data";
import { PIPELINE_STAGE_ACCENT } from "@/lib/sales/pipeline-display";

export function formatLeadName(name: string | null | undefined, phone?: string | null): string {
  const n = name?.trim();
  if (n) return n;
  const p = phone?.trim();
  if (p) return p;
  return "Unnamed lead";
}

export function formatLeadPhone(phone: string | null | undefined): string | null {
  const p = phone?.trim();
  return p || null;
}

export function formatLeadSource(raw: string | null | undefined): {
  key: ReturnType<typeof sourceBucket>["key"];
  label: string;
} {
  return sourceBucket(raw);
}

export function formatLeadStage(status: string | null | undefined): string {
  return formatStageLabel(status);
}

export function formatLeadIntent(score: number | null | undefined): string | null {
  return leadScoreLabel(score);
}

export function formatLeadScore(score: number | null | undefined): string {
  if (score == null || !Number.isFinite(score)) return "—";
  return String(Math.round(score));
}

export function formatLastContact(iso: string | null | undefined): {
  primary: string;
  secondary: string | null;
  never: boolean;
} {
  if (!iso) {
    return { primary: "Never contacted", secondary: null, never: true };
  }
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return { primary: "Never contacted", secondary: null, never: true };
  }
  const relative = formatDistanceToNowStrict(d, { addSuffix: true });
  if (isToday(d)) {
    return { primary: format(d, "h:mm a"), secondary: "Today", never: false };
  }
  if (isYesterday(d)) {
    return { primary: format(d, "h:mm a"), secondary: "Yesterday", never: false };
  }
  return {
    primary: format(d, "d MMM, yyyy"),
    secondary: relative,
    never: false,
  };
}

export function companyFromFormData(
  formData: Record<string, unknown> | null | undefined
): string | null {
  if (!formData || typeof formData !== "object") return null;
  for (const key of ["company", "company_name", "organisation", "organization", "business_name"]) {
    const v = formData[key];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
}

export function locationFromFormData(
  formData: Record<string, unknown> | null | undefined
): string | null {
  if (!formData || typeof formData !== "object") return null;
  for (const key of ["location", "city", "suburb", "area", "address"]) {
    const v = formData[key];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
}

/** Secondary context under company — project type + location without empty separators. */
export function buildLeadContext(opts: {
  projectType?: string | null;
  location?: string | null;
  company?: string | null;
  name?: string | null;
}): { company: string | null; contextLine: string | null } {
  const company = opts.company?.trim() || null;
  const name = opts.name?.trim() || null;
  const project = opts.projectType?.trim() || null;
  const location = opts.location?.trim() || null;

  const companyOut =
    company && name && company.toLowerCase() === name.toLowerCase() ? null : company;

  const parts = [project, location].filter(Boolean) as string[];
  return {
    company: companyOut,
    contextLine: parts.length ? parts.join(" · ") : null,
  };
}

export function stageAccent(status: LeadStatus | string): string {
  if (status === "NEW") return PIPELINE_STAGE_ACCENT.NEW;
  if (status === "CONTACTED") return PIPELINE_STAGE_ACCENT.CONTACTED;
  if (status === "NEGOTIATING") return PIPELINE_STAGE_ACCENT.NEGOTIATING;
  if (status === "PROPOSAL_SENT") return PIPELINE_STAGE_ACCENT.PROPOSAL_SENT;
  if (status === "WON") return "#16A34A";
  if (status === "LOST") return "#EF4444";
  return "#98A2B3";
}

export { leadScoreBand, leadScoreLabel };
