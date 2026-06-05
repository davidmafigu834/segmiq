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

function leadState(formData: Record<string, unknown> | null | undefined): string | null {
  if (!formData) return null;
  for (const key of ["state", "region", "city", "location", "province"]) {
    const v = formData[key];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
}

export function reasonSegments(lead: PriorityLead): string[] {
  const segments: string[] = [];
  const state = leadState(lead.form_data);
  if (state) segments.push(state);
  if (lead.budget && lead.budget.trim()) segments.push(lead.budget.trim());
  if (lead.project_type && lead.project_type.trim())
    segments.push(lead.project_type.trim());
  segments.push(timeAgo(lead.created_at));
  return segments;
}
