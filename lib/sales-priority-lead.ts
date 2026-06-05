import { parseBudgetValue, parseUrgencyLevel } from "@/lib/lead-lanes";
import type { CampaignQualifiers } from "@/lib/lead-lanes";

export type PriorityLead = {
  id: string;
  name: string | null;
  phone: string | null;
  email?: string | null;
  status: string;
  score?: number | null;
  is_stale?: boolean | null;
  budget?: string | null;
  project_type?: string | null;
  timeline?: string | null;
  form_data?: Record<string, unknown> | null;
  created_at: string;
  follow_up_date: string | null;
  followUpDue: boolean;
  priorityLabel: string;
  priorityColor: string;
  priorityOrder: number;
  client_id: string;
  aiScore?: number | null;
  qualifiers?: CampaignQualifiers | null;
};

export type SalespersonLeadData = {
  allActiveLeads: PriorityLead[];
};

export function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 2) return "just now";
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

export function formatFollowUpDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  if (date.toDateString() === now.toDateString()) return "Today";
  if (date.toDateString() === new Date(now.getTime() + 86400000).toDateString())
    return "Tomorrow";
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export function daysSince(dateStr: string): number {
  return Math.max(0, Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000));
}

function collectFormText(
  formData: Record<string, unknown> | null | undefined,
  keys: string[]
): string | null {
  if (!formData) return null;
  const parts: string[] = [];
  for (const key of Object.keys(formData)) {
    if (keys.some((k) => key.toLowerCase().includes(k))) {
      const v = formData[key];
      if (typeof v === "string" && v.trim()) parts.push(v.trim());
      else if (Array.isArray(v)) parts.push(v.join(" "));
    }
  }
  const joined = parts.join(" ").trim();
  return joined || null;
}

function formatBudgetDisplay(value: number): string {
  if (value >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(value % 1_000_000 ? 1 : 0)}m`;
  }
  if (value >= 1_000) return `$${Math.round(value / 1_000)}k`;
  return `$${Math.round(value)}`;
}

function budgetDisplayText(lead: PriorityLead): string | null {
  const column = lead.budget?.trim();
  if (column) return column;
  const fromForm = collectFormText(lead.form_data, ["budget", "price", "value"]);
  if (!fromForm) return null;
  const parsed = parseBudgetValue(fromForm);
  return parsed != null ? formatBudgetDisplay(parsed) : fromForm;
}

function urgencyDisplayText(lead: PriorityLead): string | null {
  const raw =
    lead.timeline?.trim() ||
    collectFormText(lead.form_data, ["timeline", "urgency", "when", "time frame", "timeframe"]);
  if (!raw) return null;
  const level = parseUrgencyLevel(raw);
  if (level === "immediate") return "urgent";
  if (level === "this_month") return "this month";
  if (level === "exploring") return "exploring";
  return null;
}

function serviceDisplayText(lead: PriorityLead): string | null {
  const column = lead.project_type?.trim();
  if (column) return column;
  return collectFormText(lead.form_data, ["service", "project", "type", "category"]);
}

/**
 * Display-only reason line: budget → urgency → service → relative age.
 * Does not surface tier windows, phone presence, or scoring internals.
 */
export function buildReasonLine(lead: PriorityLead): string {
  const parts: string[] = [];
  const budget = budgetDisplayText(lead);
  if (budget) parts.push(budget);
  const urgency = urgencyDisplayText(lead);
  if (urgency) parts.push(urgency);
  const service = serviceDisplayText(lead);
  if (service) parts.push(service);
  parts.push(timeAgo(lead.created_at));
  return parts.join(" · ");
}

/** True when the promised callback date is before today (local midnight). */
export function isFollowUpOverdue(
  followUpDate: string,
  now: Date = new Date()
): boolean {
  const due = new Date(followUpDate);
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  return due < startOfToday;
}
