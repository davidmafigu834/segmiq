import {
  classifyLeadLane,
  parseBudgetValue,
  parseUrgencyLevel,
  type LeadLane,
} from "@/lib/lead-lanes";
import {
  isWhatsAppInboundLead,
  whatsappFirstMessage,
  whatsappLeadDisplayName,
  whatsappLeadSecondaryLine,
} from "@/lib/leads/whatsapp-lead-display";
import { isLeadSlow } from "@/lib/leadStatus";

export type FreshnessState = "fresh" | "slipping" | "overdue";

export type SalesLeadCardLead = {
  id: string;
  name: string | null;
  phone: string | null;
  status: string;
  created_at: string;
  follow_up_date: string | null;
  client_id: string;
  source?: string | null;
  budget?: string | null;
  project_type?: string | null;
  timeline?: string | null;
  form_data?: Record<string, unknown> | null;
  is_stale?: boolean | null;
  aiScore?: number | null;
  qualifiers?: CampaignQualifiers | null;
};

const SLA_TARGET_MS = 5 * 60 * 1000;

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
  source?: string | null;
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

export function budgetDisplayText(lead: SalesLeadCardLead): string | null {
  const column = lead.budget?.trim();
  if (column) return column;
  const fromForm = collectFormText(lead.form_data, ["budget", "price", "value"]);
  if (!fromForm) return null;
  const parsed = parseBudgetValue(fromForm);
  return parsed != null ? formatBudgetDisplay(parsed) : fromForm;
}

export function urgencyDisplayText(lead: SalesLeadCardLead): string | null {
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

export function serviceDisplayText(lead: SalesLeadCardLead): string | null {
  const column = lead.project_type?.trim();
  if (column) return column;
  return collectFormText(lead.form_data, ["service", "project", "type", "category"]);
}

/**
 * Context line without chips or timestamp (urgency + lane hint).
 * Used when service/budget are shown as chips and time is shown once below.
 */
export function buildReasonContextLine(
  lead: SalesLeadCardLead,
  lane?: LeadLane
): string {
  if (isWhatsAppInboundLead(lead.source)) {
    const preview = whatsappFirstMessage(lead.form_data);
    if (preview) {
      return preview.length > 72 ? `${preview.slice(0, 69)}…` : preview;
    }
    return "WhatsApp conversation";
  }

  const parts: string[] = [];
  const urgency = urgencyDisplayText(lead);
  if (urgency) parts.push(urgency);

  const uncontacted = lead.status === "NEW";

  if (lane === "call_now") {
    parts.push("Awaiting first call");
  } else if (lane === "recover") {
    parts.push(`Slipped ${daysSince(lead.created_at)} days`);
  } else if (lane === "nurture") {
    parts.push(lead.is_stale ? "Going cold" : "Low intent");
  } else if (!lane && uncontacted) {
    parts.push("Awaiting first call");
  }

  if (parts.length === 0 && uncontacted) {
    return "Awaiting first call";
  }

  return parts.join(" · ");
}

/** @deprecated Use chips + buildReasonContextLine + formatCardTimestamp */
export function buildReasonLine(lead: SalesLeadCardLead): string {
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

export function isHotSlaBreached(createdAt: string, now: Date = new Date()): boolean {
  return now.getTime() - new Date(createdAt).getTime() > SLA_TARGET_MS;
}

export function resolveFreshnessState(input: {
  lead: SalesLeadCardLead;
  lane?: LeadLane;
  now?: Date;
  clientSlaHours?: number | null;
}): FreshnessState {
  const now = input.now ?? new Date();
  const { lead, lane, clientSlaHours } = input;

  if (
    lead.follow_up_date &&
    isFollowUpOverdue(lead.follow_up_date, now)
  ) {
    return "overdue";
  }

  if (
    lead.status === "NEW" &&
    isLeadSlow(lead.status, lead.created_at, clientSlaHours)
  ) {
    return "overdue";
  }

  if (lane) {
    const { tier } = classifyLeadLane(lead, now);
    if (lane === "call_now" && tier === "hot" && isHotSlaBreached(lead.created_at, now)) {
      return "overdue";
    }
    if (lane === "recover") return "slipping";
    if (lane === "follow_ups") return "slipping";
    if (lane === "call_now" && tier === "same_day") return "slipping";
  } else if (lead.follow_up_date) {
    const due = new Date(lead.follow_up_date);
    const endOfToday = new Date(now);
    endOfToday.setHours(23, 59, 59, 999);
    if (due <= endOfToday) return "slipping";
  }

  if (lead.is_stale) return "slipping";

  return "fresh";
}

const FRESHNESS_DOT: Record<FreshnessState, string> = {
  fresh: "bg-[var(--success)]",
  slipping: "bg-[var(--warning)]",
  overdue: "bg-[var(--error)]",
};

export function freshnessDotClass(state: FreshnessState): string {
  return FRESHNESS_DOT[state];
}

/** Single timestamp row — relative age plus optional lane timing suffix. */
export function formatCardTimestamp(
  lead: SalesLeadCardLead,
  lane: LeadLane | undefined,
  now: Date = new Date()
): string {
  const parts = [timeAgo(lead.created_at)];

  if (lane === "follow_ups" && lead.follow_up_date) {
    parts.push(
      isFollowUpOverdue(lead.follow_up_date, now)
        ? `Overdue · ${formatFollowUpDate(lead.follow_up_date)}`
        : `Due ${formatFollowUpDate(lead.follow_up_date).toLowerCase()}`
    );
  } else if (!lane && lead.follow_up_date) {
    const due = new Date(lead.follow_up_date);
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);
    if (due < startOfToday) {
      parts.push(`Overdue · ${formatFollowUpDate(lead.follow_up_date)}`);
    } else if (due.toDateString() === now.toDateString()) {
      parts.push("Due today");
    }
  }

  return parts.join(" · ");
}

export function sourceLabel(source: string | null | undefined): string {
  if (source === "WHATSAPP_INBOUND") return "WhatsApp chat";
  if (source === "FACEBOOK") return "Facebook";
  if (source === "LANDING_PAGE") return "Profile";
  if (source === "REFERRAL") return "Referral";
  if (source === "MANUAL") return "Manual";
  return "Lead";
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
