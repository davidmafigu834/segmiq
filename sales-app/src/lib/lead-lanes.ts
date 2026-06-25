// Pure, framework-free helpers for grouping the salesperson priority list into
// lanes. No React, no Supabase, no I/O — safe to unit test in isolation.

export type LeadLane = "call_now" | "follow_ups" | "recover" | "nurture";

export type LeadTier =
  | "hot"
  | "same_day"
  | "due"
  | "slipped"
  | "cold"
  | "nurture";

export interface LaneAssignment {
  lane: LeadLane;
  tier: LeadTier;
}

// Minimal structural shape a lead needs for lane classification / sorting.
export interface ClassifiableLead {
  status: string;
  created_at: string;
  follow_up_date: string | null;
  score?: number | null;
  is_stale?: boolean | null;
}

// Campaign-fit qualifiers configured on a form/campaign. All fields optional —
// an unset qualifier is simply not evaluated.
export interface CampaignQualifiers {
  budget_min?: number | null;
  budget_max?: number | null;
  target_service_types?: string[] | null;
  target_locations?: string[] | null;
  min_urgency?: string | null;
}

// Richer lead shape used by the deterministic ranking engine. Everything beyond
// ClassifiableLead is optional, so existing callers stay compatible.
export interface RankableLead extends ClassifiableLead {
  budget?: string | null;
  timeline?: string | null;
  project_type?: string | null;
  phone?: string | null;
  email?: string | null;
  form_data?: Record<string, unknown> | null;
  // AI enrichment score (lead_intelligence.intent_score). When present it is the
  // authoritative score and always takes precedence over the rules score.
  aiScore?: number | null;
  // Qualifiers for this lead's campaign, attached upstream so sortWithinLane can
  // factor the campaign-fit bonus without extra plumbing.
  qualifiers?: CampaignQualifiers | null;
}

export interface RulesScore {
  score: number;
  factors: string[];
}

// Ordinal ranking of urgency levels so we can compare against a minimum.
export const URGENCY_RANK: Record<string, number> = {
  exploring: 1,
  this_month: 2,
  immediate: 3,
};
// Bonus added to the rules score when a lead matches its campaign qualifiers.
export const CAMPAIGN_FIT_BONUS = 10;

// Lane boundaries / thresholds (score is a 0–100 scale; 0 = not yet scored).
export const HOT_WINDOW_MS = 2 * 60 * 60 * 1000; // < 2h uncontacted = hot
export const SAME_DAY_WINDOW_MS = 24 * 60 * 60 * 1000; // 2h–24h uncontacted = same-day
export const LOW_SCORE_THRESHOLD = 40; // below this = low intent (nurture)
export const HIGH_SCORE_THRESHOLD = 60; // at/above this = high intent (lime chip)

// Display order, top to bottom, on the dashboard.
export const LANE_ORDER: LeadLane[] = [
  "call_now",
  "follow_ups",
  "recover",
  "nurture",
];

// Recover page age-tab boundaries (lower-inclusive, upper-exclusive).
export const RECOVER_TIER_WEEK_MS = 7 * 24 * 60 * 60 * 1000; // 1–7 days
export const RECOVER_TIER_TWO_WEEKS_MS = 14 * 24 * 60 * 60 * 1000; // 7–14 days
export const RECOVER_TIER_MONTH_MS = 30 * 24 * 60 * 60 * 1000; // 14–30 days

export type RecoverAgeTier = "week" | "two_weeks" | "month" | "month_plus";

export const RECOVER_AGE_TABS: Array<{
  tier: RecoverAgeTier;
  label: string;
}> = [
  { tier: "week", label: "This week" },
  { tier: "two_weeks", label: "1–2 weeks" },
  { tier: "month", label: "2–4 weeks" },
  { tier: "month_plus", label: "1 month+" },
];

function isUncontacted(lead: ClassifiableLead): boolean {
  // No dedicated contacted flag exists; status === "NEW" is the only
  // "never contacted" state. Everything else is treated as contacted.
  return lead.status === "NEW";
}

function ageMs(lead: ClassifiableLead, now: Date): number {
  return now.getTime() - new Date(lead.created_at).getTime();
}

// "Due today or overdue": a follow-up whose date is today or any earlier day.
function isFollowUpDue(lead: ClassifiableLead, now: Date): boolean {
  if (!lead.follow_up_date) return false;
  const endOfToday = new Date(now);
  endOfToday.setHours(23, 59, 59, 999);
  return new Date(lead.follow_up_date) <= endOfToday;
}

function hasUsableScore(lead: ClassifiableLead): boolean {
  // score defaults to 0 (unscored) in the DB, so treat only > 0 as real intent.
  return typeof lead.score === "number" && lead.score > 0;
}

function isLowIntent(lead: ClassifiableLead): boolean {
  if (lead.is_stale === true) return true;
  if (hasUsableScore(lead) && (lead.score as number) < LOW_SCORE_THRESHOLD)
    return true;
  return false;
}

/**
 * Assign a lead to exactly one lane. Rules are evaluated in order; first match
 * wins. `now` is injectable so the function stays pure and testable.
 */
export function classifyLeadLane(
  lead: ClassifiableLead,
  now: Date = new Date()
): LaneAssignment {
  const uncontacted = isUncontacted(lead);
  const age = ageMs(lead, now);

  if (uncontacted && age < HOT_WINDOW_MS) {
    return { lane: "call_now", tier: "hot" };
  }
  if (uncontacted && age < SAME_DAY_WINDOW_MS) {
    return { lane: "call_now", tier: "same_day" };
  }
  if (!uncontacted && isFollowUpDue(lead, now)) {
    return { lane: "follow_ups", tier: "due" };
  }
  if (uncontacted && age >= SAME_DAY_WINDOW_MS) {
    return { lane: "recover", tier: "slipped" };
  }
  if (isLowIntent(lead)) {
    return { lane: "nurture", tier: "cold" };
  }
  return { lane: "nurture", tier: "nurture" };
}

// ============================================
// DETERMINISTIC RANKING ENGINE (no AI)
// ============================================

// Gather candidate free-text values for a signal from typed columns + form_data.
function collectText(
  lead: RankableLead,
  keys: string[]
): string {
  const parts: string[] = [];
  const fd = lead.form_data ?? {};
  for (const key of Object.keys(fd)) {
    if (keys.some((k) => key.toLowerCase().includes(k))) {
      const v = fd[key];
      if (typeof v === "string") parts.push(v);
      else if (Array.isArray(v)) parts.push(v.join(" "));
    }
  }
  return parts.join(" ");
}

/**
 * Best-effort numeric budget from free text. Handles "$", thousands commas, and
 * k/m suffixes; for ranges it returns the largest figure (top of stated range).
 * Returns null when no number is present. Pure / deterministic.
 */
export function parseBudgetValue(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const matches = raw.match(/\$?\s?(\d[\d,]*(?:\.\d+)?)\s*([kmKM])?/g);
  if (!matches) return null;
  let best: number | null = null;
  for (const m of matches) {
    const parsed = /(\d[\d,]*(?:\.\d+)?)\s*([kmKM])?/.exec(m);
    if (!parsed) continue;
    let value = parseFloat(parsed[1].replace(/,/g, ""));
    if (Number.isNaN(value)) continue;
    const suffix = parsed[2]?.toLowerCase();
    if (suffix === "k") value *= 1_000;
    else if (suffix === "m") value *= 1_000_000;
    if (best === null || value > best) best = value;
  }
  return best;
}

/**
 * Map free-text timeline/urgency answers to a normalised urgency level via a
 * deterministic keyword map. Returns "unknown" when nothing matches.
 */
export function parseUrgencyLevel(
  raw: string | null | undefined
): "immediate" | "this_month" | "exploring" | "unknown" {
  if (!raw) return "unknown";
  const t = raw.toLowerCase();
  if (
    /\b(asap|immediate(ly)?|urgent|emergency|right away|today|this week|within (a )?week|as soon as possible)\b/.test(
      t
    )
  ) {
    return "immediate";
  }
  if (/\b(this month|within (a )?month|30 days|1 month|next month)\b/.test(t)) {
    return "this_month";
  }
  if (
    /\b(explor|research|just looking|browsing|flexible|no rush|someday|future|months|year)\b/.test(
      t
    )
  ) {
    return "exploring";
  }
  return "unknown";
}

function formatBudget(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(value % 1_000_000 ? 1 : 0)}m`;
  if (value >= 1_000) return `$${Math.round(value / 1_000)}k`;
  return `$${Math.round(value)}`;
}

function leadBudgetText(lead: RankableLead): string | null {
  return (lead.budget ?? collectText(lead, ["budget", "price", "value"])) || null;
}

function leadTimelineText(lead: RankableLead): string | null {
  return (
    (lead.timeline ??
      collectText(lead, ["timeline", "urgency", "when", "time frame", "timeframe"])) ||
    null
  );
}

function leadServiceText(lead: RankableLead): string | null {
  return (
    (lead.project_type ??
      collectText(lead, ["service", "project", "type", "category"])) ||
    null
  );
}

function leadLocationText(lead: RankableLead): string | null {
  return collectText(lead, ["state", "region", "city", "location", "province", "area"]) || null;
}

function hasMessage(lead: RankableLead): boolean {
  const text = collectText(lead, ["message", "notes", "detail", "comment", "describe", "tell us"]);
  return text.trim().length >= 10;
}

function isValidPhone(lead: RankableLead): boolean {
  if (!lead.phone) return false;
  return (lead.phone.match(/\d/g) ?? []).length >= 7;
}

/**
 * Deterministic 0–100 rank for a lead using only structured/parsed data — no AI
 * calls. Returns the score plus the strongest contributing factors as short
 * labels for the reason line. Optional campaign qualifiers add a +10 fit bonus.
 */
export function computeRulesScore(
  lead: RankableLead,
  qualifiers?: CampaignQualifiers | null,
  now: Date = new Date()
): RulesScore {
  const q = qualifiers ?? lead.qualifiers ?? null;
  const weighted: Array<{ label: string; weight: number }> = [];

  // Recency (0–40)
  const age = ageMs(lead, now);
  let recency: number;
  let recencyLabel: string;
  if (age < 2 * 60 * 60 * 1000) {
    recency = 40;
    recencyLabel = "within 2h";
  } else if (age < 6 * 60 * 60 * 1000) {
    recency = 30;
    recencyLabel = "within 6h";
  } else if (age < 24 * 60 * 60 * 1000) {
    recency = 20;
    recencyLabel = "today";
  } else if (age < 3 * 24 * 60 * 60 * 1000) {
    recency = 10;
    recencyLabel = "1–3d old";
  } else {
    recency = 5;
    recencyLabel = "older";
  }
  weighted.push({ label: recencyLabel, weight: recency });

  // Budget (0–25)
  const budgetValue = parseBudgetValue(leadBudgetText(lead));
  let budget: number;
  let budgetLabel: string | null = null;
  const hasRange = !!q && (q.budget_min != null || q.budget_max != null);
  if (hasRange) {
    if (budgetValue == null) {
      budget = 5;
    } else if (q!.budget_min == null || budgetValue >= q!.budget_min) {
      budget = 25;
      budgetLabel = formatBudget(budgetValue);
    } else if (budgetValue >= q!.budget_min * 0.8) {
      budget = 15;
      budgetLabel = formatBudget(budgetValue);
    } else {
      budget = 5;
      budgetLabel = formatBudget(budgetValue);
    }
  } else if (budgetValue != null) {
    budget = 15;
    budgetLabel = formatBudget(budgetValue);
  } else {
    budget = 5;
  }
  if (budgetLabel) weighted.push({ label: budgetLabel, weight: budget });

  // Urgency (0–20)
  const urgency = parseUrgencyLevel(leadTimelineText(lead));
  const urgencyPoints =
    urgency === "immediate"
      ? 20
      : urgency === "this_month"
      ? 12
      : urgency === "exploring"
      ? 5
      : 8;
  const urgencyLabel =
    urgency === "immediate"
      ? "urgent"
      : urgency === "this_month"
      ? "this month"
      : urgency === "exploring"
      ? "exploring"
      : null;
  if (urgencyLabel) weighted.push({ label: urgencyLabel, weight: urgencyPoints });

  // Completeness (0–15)
  let completeness = 0;
  if (hasMessage(lead)) {
    completeness += 7;
    weighted.push({ label: "detailed", weight: 7 });
  }
  const optionalFilled = [
    leadBudgetText(lead),
    leadServiceText(lead),
    leadTimelineText(lead),
  ].filter((v) => v && String(v).trim()).length;
  if (optionalFilled >= 2) completeness += 5;
  if (isValidPhone(lead)) {
    completeness += 3;
    weighted.push({ label: "phone ✓", weight: 3 });
  }

  // Campaign fit (+10, capped at 100)
  let campaignBonus = 0;
  if (q) {
    const fit = matchesQualifiers(lead, q);
    if (fit.matched) {
      campaignBonus = CAMPAIGN_FIT_BONUS;
      weighted.push({ label: "campaign fit", weight: 999 });
    }
  }

  const score = Math.min(
    100,
    recency + budget + urgencyPoints + completeness + campaignBonus
  );

  const factors = weighted
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 4)
    .map((f) => f.label);

  return { score, factors };
}

/**
 * Whether a lead satisfies the qualifiers configured on its campaign. Only
 * qualifiers that are set are evaluated; matched is true when at least one
 * qualifier is set and every set qualifier is satisfied. Pure / deterministic.
 */
export function matchesQualifiers(
  lead: RankableLead,
  qualifiers: CampaignQualifiers | null | undefined
): { matched: boolean; criteria: string[] } {
  if (!qualifiers) return { matched: false, criteria: [] };

  const checks: boolean[] = [];
  const criteria: string[] = [];

  // Budget range
  if (qualifiers.budget_min != null || qualifiers.budget_max != null) {
    const value = parseBudgetValue(leadBudgetText(lead));
    const ok =
      value != null &&
      (qualifiers.budget_min == null || value >= qualifiers.budget_min) &&
      (qualifiers.budget_max == null || value <= qualifiers.budget_max);
    checks.push(ok);
    if (ok) criteria.push("budget");
  }

  // Service types
  if (qualifiers.target_service_types && qualifiers.target_service_types.length) {
    const service = (leadServiceText(lead) ?? "").toLowerCase();
    const ok =
      !!service &&
      qualifiers.target_service_types.some((t) =>
        service.includes(t.toLowerCase())
      );
    checks.push(ok);
    if (ok) criteria.push("service");
  }

  // Locations
  if (qualifiers.target_locations && qualifiers.target_locations.length) {
    const location = (leadLocationText(lead) ?? "").toLowerCase();
    const ok =
      !!location &&
      qualifiers.target_locations.some((l) => location.includes(l.toLowerCase()));
    checks.push(ok);
    if (ok) criteria.push("location");
  }

  // Minimum urgency
  if (qualifiers.min_urgency && URGENCY_RANK[qualifiers.min_urgency] != null) {
    const urgency = parseUrgencyLevel(leadTimelineText(lead));
    const ok =
      URGENCY_RANK[urgency] != null &&
      URGENCY_RANK[urgency] >= URGENCY_RANK[qualifiers.min_urgency];
    checks.push(ok);
    if (ok) criteria.push("urgency");
  }

  const matched = checks.length > 0 && checks.every(Boolean);
  return { matched, criteria };
}

/**
 * Effective rank for sorting: the AI enrichment score when present, otherwise
 * the deterministic rules score. Qualifiers attached to the lead feed the
 * campaign-fit bonus.
 */
function effectiveScore(lead: RankableLead): number {
  if (typeof lead.aiScore === "number") return lead.aiScore;
  return computeRulesScore(lead).score;
}

/**
 * Sort leads within a lane by effective score (desc), with creation timestamp
 * (desc, freshest first) as the tie-breaker. Returns a new array.
 */
export function sortWithinLane<T extends RankableLead>(leads: T[]): T[] {
  return [...leads].sort((a, b) => {
    const diff = effectiveScore(b) - effectiveScore(a);
    if (diff !== 0) return diff;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });
}

/**
 * Age bucket for recover-lane leads. Boundaries: week = [1d, 7d),
 * two_weeks = [7d, 14d), month = [14d, 30d), month_plus = 30d+.
 */
export function recoverAgeTier(
  lead: ClassifiableLead,
  now: Date = new Date()
): RecoverAgeTier {
  const age = ageMs(lead, now);
  if (age < RECOVER_TIER_WEEK_MS) return "week";
  if (age < RECOVER_TIER_TWO_WEEKS_MS) return "two_weeks";
  if (age < RECOVER_TIER_MONTH_MS) return "month";
  return "month_plus";
}

/** Leads belonging to a single lane. */
export function filterByLane<T extends ClassifiableLead>(
  leads: T[],
  lane: LeadLane,
  now: Date = new Date()
): T[] {
  return leads.filter((l) => classifyLeadLane(l, now).lane === lane);
}

/**
 * Callable manual queues exclude retargeting graduates (30d+ uncontacted).
 * Lane classification itself is unchanged — this is a display/filter layer.
 */
export function filterCallableLane<T extends ClassifiableLead>(
  leads: T[],
  lane: LeadLane,
  now: Date = new Date(),
  isGraduated: (lead: T, at: Date) => boolean
): T[] {
  return filterByLane(leads, lane, now).filter((l) => !isGraduated(l, now));
}

/**
 * Call-now lane ordering: hot tier first, then same-day — each sub-group
 * sorted by sortWithinLane. Matches the dashboard top section.
 */
export function sortCallNowLane<T extends RankableLead>(
  leads: T[],
  now: Date = new Date()
): T[] {
  const hot = sortWithinLane(
    leads.filter((l) => classifyLeadLane(l, now).tier === "hot")
  );
  const sameDay = sortWithinLane(
    leads.filter((l) => classifyLeadLane(l, now).tier === "same_day")
  );
  return [...hot, ...sameDay];
}
