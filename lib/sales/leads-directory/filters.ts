import type {
  AttentionFilter,
  LeadsIntentFilter,
  LeadsPeriodId,
  LeadsSourceFilter,
  LeadsStageFilter,
} from "./types";

export const LEADS_PERIODS: { id: LeadsPeriodId; label: string }[] = [
  { id: "all", label: "All dates" },
  { id: "this_month", label: "This month" },
  { id: "last_month", label: "Last month" },
  { id: "last_30", label: "Last 30 days" },
  { id: "last_90", label: "Last 90 days" },
  { id: "this_quarter", label: "This quarter" },
  { id: "this_year", label: "This year" },
];

export const LEADS_SOURCES: { id: LeadsSourceFilter; label: string }[] = [
  { id: "all", label: "All sources" },
  { id: "whatsapp", label: "WhatsApp" },
  { id: "facebook", label: "Facebook Ads" },
  { id: "referral", label: "Referrals" },
  { id: "website", label: "Website" },
  { id: "manual", label: "Manual" },
  { id: "other", label: "Other" },
];

export const LEADS_STAGE_FILTERS: { id: LeadsStageFilter; label: string }[] = [
  { id: "all", label: "All stages" },
  { id: "NEW", label: "New" },
  { id: "CONTACTED", label: "Contacted" },
  { id: "NEGOTIATING", label: "Negotiating" },
  { id: "PROPOSAL_SENT", label: "Proposal sent" },
  { id: "WON", label: "Won" },
  { id: "LOST", label: "Lost" },
  { id: "NOT_QUALIFIED", label: "Not qualified" },
];

export const LEADS_INTENT_FILTERS: { id: LeadsIntentFilter; label: string }[] = [
  { id: "all", label: "All intent" },
  { id: "hot", label: "Hot" },
  { id: "warm", label: "Warm" },
  { id: "cold", label: "Cold" },
];

export const CONVERSION_FORMULA = "Won ÷ closed (Won + Lost)";

export function isLeadsPeriod(v: string): v is LeadsPeriodId {
  return LEADS_PERIODS.some((p) => p.id === v);
}

export function isLeadsSource(v: string): v is LeadsSourceFilter {
  return LEADS_SOURCES.some((s) => s.id === v);
}

export function isLeadsStage(v: string): v is LeadsStageFilter {
  return LEADS_STAGE_FILTERS.some((s) => s.id === v);
}

export function isLeadsIntent(v: string): v is LeadsIntentFilter {
  return LEADS_INTENT_FILTERS.some((s) => s.id === v);
}

export function isAttentionFilter(v: string): v is AttentionFilter {
  return (
    v === "none" ||
    v === "never_contacted" ||
    v === "stale" ||
    v === "follow_up_overdue" ||
    v === "hot" ||
    v === "uncontacted"
  );
}
