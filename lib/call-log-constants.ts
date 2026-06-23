import type { CallOutcome } from "@/types";

/** Step 1 — did you reach them? */
export const REACH_OUTCOMES = ["reached", "no_answer", "call_back"] as const;
export type ReachOutcome = (typeof REACH_OUTCOMES)[number];

export const REACH_OUTCOME_LABELS: Record<ReachOutcome, string> = {
  reached: "Reached them",
  no_answer: "No answer",
  call_back: "Call me back",
};

/** Step 2 — result when reached */
export const CALL_RESULTS = ["won", "follow_up", "lost", "not_qualified"] as const;
export type CallResult = (typeof CALL_RESULTS)[number];

export const CALL_RESULT_LABELS: Record<CallResult, string> = {
  won: "Won",
  follow_up: "Follow-up",
  lost: "Lost",
  not_qualified: "Not qualified",
};

export const FOLLOW_UP_HOLDUP_REASONS = [
  "Comparing quotes",
  "Still deciding",
  "Can't afford now",
  "Waiting on money",
  "Project for later",
] as const;

/** Stall reasons that imply low budget confidence (call-log → form_data signal). */
export const LOW_BUDGET_SIGNAL_REASONS = [
  "Can't afford now",
  "Waiting on money",
] as const;

export const LOST_REASONS = [
  "Chose a competitor",
  "No longer needed",
  "Went cold",
  "Never serious",
] as const;

export const NOT_QUALIFIED_REASONS = [
  "Budget too small",
  "Out of area",
  "Service we don't offer",
  "Just price-checking",
] as const;

export const CALLBACK_SCHEDULE_OPTIONS = [
  "in_1_hour",
  "this_evening",
  "tomorrow_morning",
  "pick",
] as const;
export type CallbackScheduleOption = (typeof CALLBACK_SCHEDULE_OPTIONS)[number];

export const CALLBACK_SCHEDULE_LABELS: Record<CallbackScheduleOption, string> = {
  in_1_hour: "In 1 hour",
  this_evening: "This evening",
  tomorrow_morning: "Tomorrow morning",
  pick: "Pick a date/time",
};

/** Inline "did they ask for anything?" — stored in assets_requested */
export const ASSET_REQUEST_OPTIONS = [
  { key: "pricing", label: "Pricing", sendType: "PRICING_PACKAGE" },
  { key: "recent_work", label: "Recent work", sendType: "PROJECT" },
  { key: "portfolio", label: "Portfolio", sendType: "PORTFOLIO" },
  { key: "testimonials", label: "Testimonials", sendType: "TESTIMONIALS" },
  { key: "documents", label: "Documents", sendType: "DOCUMENT" },
] as const;

export type AssetRequestKey = (typeof ASSET_REQUEST_OPTIONS)[number]["key"];

export const DIRECT_SEND_ASSET_TYPES = new Set(["PORTFOLIO", "TESTIMONIALS"]);

/** Derive legacy call_logs.outcome for scoring + timeline back-compat. */
export function deriveLegacyOutcome(
  reachOutcome: ReachOutcome,
  result: CallResult | null | undefined
): CallOutcome {
  if (reachOutcome === "no_answer") return "NO_ANSWER";
  if (reachOutcome === "call_back") return "FOLLOW_UP";
  switch (result) {
    case "won":
      return "WON";
    case "lost":
      return "LOST";
    case "not_qualified":
      return "NOT_QUALIFIED";
    case "follow_up":
    default:
      return "ANSWERED";
  }
}

export function resolveCallbackAt(
  option: CallbackScheduleOption,
  customIso?: string | null
): Date {
  const now = new Date();
  switch (option) {
    case "in_1_hour":
      return new Date(now.getTime() + 60 * 60 * 1000);
    case "this_evening": {
      const d = new Date(now);
      d.setHours(18, 0, 0, 0);
      if (d.getTime() <= now.getTime()) {
        d.setDate(d.getDate() + 1);
      }
      return d;
    }
    case "tomorrow_morning": {
      const d = new Date(now);
      d.setDate(d.getDate() + 1);
      d.setHours(9, 0, 0, 0);
      return d;
    }
    case "pick": {
      if (!customIso?.trim()) return now;
      const parsed = new Date(customIso);
      return Number.isNaN(parsed.getTime()) ? now : parsed;
    }
    default:
      return now;
  }
}

/** Date portion (YYYY-MM-DD) for leads.follow_up_date — handles midnight rollover. */
export function followUpDateFromCallbackAt(callbackAt: Date): string {
  const y = callbackAt.getFullYear();
  const m = String(callbackAt.getMonth() + 1).padStart(2, "0");
  const d = String(callbackAt.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Prefer call_logs.callback_at; fall back to follow_up_date at noon when date-only. */
export function resolveFollowUpDateTime(
  followUpDate: string | null | undefined,
  callbackAt?: string | null
): Date | null {
  if (callbackAt) {
    const d = new Date(callbackAt);
    if (!Number.isNaN(d.getTime())) return d;
  }
  if (!followUpDate) return null;
  const d = new Date(
    followUpDate.includes("T") ? followUpDate : `${followUpDate}T12:00:00`
  );
  return Number.isNaN(d.getTime()) ? null : d;
}
