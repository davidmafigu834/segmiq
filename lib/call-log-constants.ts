import type { CallOutcome } from "@/types";
import type { BusinessType } from "@/lib/terminology";
import { normalizeBusinessType } from "@/lib/terminology";

/** Step 1 — did you reach them? */
export const REACH_OUTCOMES = ["reached", "no_answer", "call_back"] as const;
export type ReachOutcome = (typeof REACH_OUTCOMES)[number];

export const REACH_OUTCOME_LABELS: Record<ReachOutcome, string> = {
  reached: "Reached them",
  no_answer: "No answer",
  call_back: "Call me back",
};

/**
 * Step 2 — result when reached.
 * Lead lifecycle outcomes (pre-deal): qualifying | qualified | follow_up | not_qualified
 * Deal outcomes (when active deal exists): won | lost | follow_up
 */
export const CALL_RESULTS = [
  "qualifying",
  "qualified",
  "follow_up",
  "not_qualified",
  "won",
  "lost",
] as const;
export type CallResult = (typeof CALL_RESULTS)[number];

export const CALL_RESULT_LABELS: Record<CallResult, string> = {
  qualifying: "Interested — still qualifying",
  qualified: "Qualified opportunity",
  follow_up: "Follow up later",
  not_qualified: "Not a fit",
  won: "Won",
  lost: "Lost",
};

/** Results shown when logging a call on a Lead without an active Deal. */
export const LEAD_CALL_RESULTS = [
  "qualifying",
  "qualified",
  "follow_up",
  "not_qualified",
] as const satisfies readonly CallResult[];

/** Results shown when logging a call on an active Deal. */
export const DEAL_CALL_RESULTS = [
  "follow_up",
  "won",
  "lost",
] as const satisfies readonly CallResult[];

/** Trades stall reasons — default / historical values (must stay identical). */
export const FOLLOW_UP_HOLDUP_REASONS = [
  "Comparing quotes",
  "Still deciding",
  "Can't afford now",
  "Waiting on money",
  "Project for later",
  /** Inferred when a rep logs "Call me back" without picking a stall reason. */
  "Scheduled callback",
] as const;

export const REAL_ESTATE_FOLLOW_UP_HOLDUP_REASONS = [
  "Bond/financing pending",
  "Comparing other properties",
  "Waiting to sell current home",
  "Still deciding on area",
  "Seller/landlord hasn't responded",
  "Scheduled callback",
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

export const REAL_ESTATE_LOST_REASONS = [
  "Bought/rented elsewhere",
  "Seller rejected offer",
  "Deal fell through (bond declined / chain collapsed)",
  "Went cold",
  "Never serious",
] as const;

export const NOT_QUALIFIED_REASONS = [
  "Budget too small",
  "Out of area",
  "Service we don't offer",
  "Just price-checking",
] as const;

export const REAL_ESTATE_NOT_QUALIFIED_REASONS = [
  "Budget doesn't match available stock",
  "Out of area",
  "Looking to rent, we only sell (or vice versa)",
  "Just browsing / no timeline",
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

/** Trades send-panel asset types (SendAssetPanel). */
export type SendAssetType =
  | "PORTFOLIO"
  | "PROJECT"
  | "PRICING_PACKAGE"
  | "TESTIMONIALS"
  | "DOCUMENT";

/** Inline "did they ask for anything?" — stored in assets_requested */
export const ASSET_REQUEST_OPTIONS = [
  { key: "pricing", label: "Pricing", sendType: "PRICING_PACKAGE" as const },
  { key: "recent_work", label: "Recent work", sendType: "PROJECT" as const },
  { key: "portfolio", label: "Portfolio", sendType: "PORTFOLIO" as const },
  { key: "testimonials", label: "Testimonials", sendType: "TESTIMONIALS" as const },
  { key: "documents", label: "Documents", sendType: "DOCUMENT" as const },
] as const;

export const REAL_ESTATE_ASSET_REQUEST_OPTIONS = [
  { key: "pricing", label: "Pricing", sendType: "PRICING_PACKAGE" as const },
  /** Routes to listing send-match, not SendAssetPanel. */
  { key: "similar_listings", label: "Similar listings", sendType: "SIMILAR_LISTINGS" as const },
  { key: "floor_plan", label: "Floor plan", sendType: "DOCUMENT" as const },
  { key: "virtual_tour", label: "Virtual tour", sendType: "DOCUMENT" as const },
  { key: "documents", label: "Documents", sendType: "DOCUMENT" as const },
] as const;

export type AssetRequestKey =
  | (typeof ASSET_REQUEST_OPTIONS)[number]["key"]
  | (typeof REAL_ESTATE_ASSET_REQUEST_OPTIONS)[number]["key"];

export type AssetRequestOption = {
  key: AssetRequestKey;
  label: string;
  sendType: SendAssetType | "SIMILAR_LISTINGS";
};

export const DIRECT_SEND_ASSET_TYPES = new Set<string>(["PORTFOLIO", "TESTIMONIALS"]);

export function getFollowUpHoldupReasons(
  businessType: BusinessType | string | null | undefined
): readonly string[] {
  return normalizeBusinessType(businessType) === "real_estate"
    ? REAL_ESTATE_FOLLOW_UP_HOLDUP_REASONS
    : FOLLOW_UP_HOLDUP_REASONS;
}

export function getLostReasons(
  businessType: BusinessType | string | null | undefined
): readonly string[] {
  return normalizeBusinessType(businessType) === "real_estate"
    ? REAL_ESTATE_LOST_REASONS
    : LOST_REASONS;
}

export function getNotQualifiedReasons(
  businessType: BusinessType | string | null | undefined
): readonly string[] {
  return normalizeBusinessType(businessType) === "real_estate"
    ? REAL_ESTATE_NOT_QUALIFIED_REASONS
    : NOT_QUALIFIED_REASONS;
}

export function getAssetRequestOptions(
  businessType: BusinessType | string | null | undefined
): readonly AssetRequestOption[] {
  return normalizeBusinessType(businessType) === "real_estate"
    ? REAL_ESTATE_ASSET_REQUEST_OPTIONS
    : ASSET_REQUEST_OPTIONS;
}

/** Union allowlists so loss aggregation counts either vertical's reasons. */
export const ALL_FOLLOW_UP_HOLDUP_REASONS: readonly string[] = Array.from(
  new Set([...FOLLOW_UP_HOLDUP_REASONS, ...REAL_ESTATE_FOLLOW_UP_HOLDUP_REASONS])
);

export const ALL_LOST_REASONS: readonly string[] = Array.from(
  new Set([...LOST_REASONS, ...REAL_ESTATE_LOST_REASONS])
);

export const ALL_NOT_QUALIFIED_REASONS: readonly string[] = Array.from(
  new Set([...NOT_QUALIFIED_REASONS, ...REAL_ESTATE_NOT_QUALIFIED_REASONS])
);

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
    case "qualifying":
    case "qualified":
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
