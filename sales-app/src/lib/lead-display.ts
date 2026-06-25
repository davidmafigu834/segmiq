// Display helpers for lead cards, ported from the web `sales-priority-lead.ts`
// so the mobile cards surface the same context (source, chips, freshness) as
// the web salesperson dashboard. Pure / framework-free.

import {
  classifyLeadLane,
  matchesQualifiers,
  parseBudgetValue,
  parseUrgencyLevel,
  type LeadLane,
} from "./lead-lanes";
import type { LeadRow } from "./types";
import { formatFollowUpDate, timeAgo } from "./format";

export type FreshnessState = "fresh" | "slipping" | "overdue";

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

export function budgetDisplayText(lead: LeadRow): string | null {
  const column = lead.budget?.trim();
  if (column) return column;
  const fromForm = collectFormText(lead.form_data, ["budget", "price", "value"]);
  if (!fromForm) return null;
  const parsed = parseBudgetValue(fromForm);
  return parsed != null ? formatBudgetDisplay(parsed) : fromForm;
}

export function urgencyDisplayText(lead: LeadRow): string | null {
  const raw =
    lead.timeline?.trim() ||
    collectFormText(lead.form_data, [
      "timeline",
      "urgency",
      "when",
      "time frame",
      "timeframe",
    ]);
  if (!raw) return null;
  const level = parseUrgencyLevel(raw);
  if (level === "immediate") return "urgent";
  if (level === "this_month") return "this month";
  if (level === "exploring") return "exploring";
  return null;
}

export function serviceDisplayText(lead: LeadRow): string | null {
  const column = lead.project_type?.trim();
  if (column) return column;
  return collectFormText(lead.form_data, ["service", "project", "type", "category"]);
}

export function sourceLabel(source: string | null | undefined): string {
  if (source === "FACEBOOK") return "Facebook";
  if (source === "LANDING_PAGE") return "Profile";
  if (source === "REFERRAL") return "Referral";
  if (source === "MANUAL") return "Manual";
  return "Lead";
}

export function daysSince(dateStr: string): number {
  return Math.max(0, Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000));
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

/** Context line without chips or timestamp (urgency + lane hint). */
export function buildReasonContextLine(lead: LeadRow, lane?: LeadLane): string {
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

/** Single timestamp row — relative age plus optional lane timing suffix. */
export function formatCardTimestamp(
  lead: LeadRow,
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

const SLA_TARGET_MS = 5 * 60 * 1000;

export function isHotSlaBreached(createdAt: string, now: Date = new Date()): boolean {
  return now.getTime() - new Date(createdAt).getTime() > SLA_TARGET_MS;
}

/**
 * Simplified freshness for the mobile cards: overdue follow-ups and breached hot
 * SLAs are red, anything in an active lane is amber, the rest is green.
 */
export function resolveFreshnessState(input: {
  lead: LeadRow;
  lane?: LeadLane;
  now?: Date;
}): FreshnessState {
  const now = input.now ?? new Date();
  const { lead, lane } = input;

  if (lead.follow_up_date && isFollowUpOverdue(lead.follow_up_date, now)) {
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

export function leadIntentScore(lead: LeadRow): number | null {
  const score = lead.aiScore ?? lead.score ?? null;
  return typeof score === "number" ? score : null;
}

export function leadFit(lead: LeadRow): boolean {
  return matchesQualifiers(lead, lead.qualifiers ?? null).matched;
}

export { timeAgo };
