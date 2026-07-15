import { FOLLOW_UP_HOLDUP_REASONS } from "@/lib/call-log-constants";

/** Minimum logged stall reasons before Mode 2 (stall coaching) is shown. */
export const MIRROR_MIN_STALL_REASONS = 5;

export const MIRROR_STALL_WINDOW_DAYS = 30;

/** Static coaching nudges — same practical tone as daily WhatsApp coaching, no AI. */
export const STALL_REASON_NUDGES: Record<string, string> = {
  "Comparing quotes":
    "try sending pricing before the first callback.",
  "Still deciding":
    "a short portfolio or testimonial can help them decide.",
  "Can't afford now":
    "note the timing and plan a light check-in when circumstances change.",
  "Waiting on money":
    "confirm their date and call back that day.",
  "Project for later":
    "keep it warm with one touch — no hard push needed.",
};

export type RulesMirrorCounts = {
  callNow: number;
  followUps: number;
  slipped: number;
  convertLater: number;
};

export type SalesMirrorResult = {
  mode: "rules" | "stall" | "ai";
  line: string;
  dominantReason?: string;
};

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

/** Mode 1 — always returns a non-empty line. */
export function buildRulesMirrorLine(counts: RulesMirrorCounts): string {
  const parts: string[] = [];

  if (counts.callNow > 0) {
    parts.push(`${plural(counts.callNow, "fresh lead")} waiting`);
  }
  if (counts.followUps > 0) {
    parts.push(`${plural(counts.followUps, "follow-up")} due today`);
  }
  if (counts.slipped > 0) {
    parts.push(`${plural(counts.slipped, "slipped lead")} to recover`);
  }
  if (counts.convertLater > 0) {
    parts.push(
      `${counts.convertLater} in your convert-later pick${counts.convertLater === 1 ? "" : "s"}`
    );
  }

  if (parts.length === 0) {
    return "You're clear on fresh leads and follow-ups — log every call so your mirror learns your patterns.";
  }

  if (parts.length === 1) {
    return `${parts[0]!.charAt(0).toUpperCase()}${parts[0]!.slice(1)}.`;
  }

  const last = parts.pop()!;
  return `${parts.join(", ")}, and ${last}.`;
}

/** Mode 2 — dominant stall reason + mapped nudge. */
export function buildStallMirrorLine(dominantReason: string): string {
  const nudge =
    STALL_REASON_NUDGES[dominantReason] ??
    "a quick follow-up with the right asset can move things forward.";
  const reasonLower = dominantReason.toLowerCase();
  return `Most of your stalls are '${reasonLower}' — ${nudge}`;
}

export function pickDominantStallReason(
  reasonCounts: Record<string, number>
): { reason: string; count: number } | null {
  let best: { reason: string; count: number } | null = null;
  for (const reason of FOLLOW_UP_HOLDUP_REASONS) {
    const count = reasonCounts[reason] ?? 0;
    if (count > 0 && (!best || count > best.count)) {
      best = { reason, count };
    }
  }
  return best;
}

export function buildSalesMirror(input: {
  aiEnabled: boolean;
  stallReasonTotal: number;
  reasonCounts: Record<string, number>;
  rulesCounts: RulesMirrorCounts;
}): SalesMirrorResult {
  const dominant = pickDominantStallReason(input.reasonCounts);

  if (
    input.aiEnabled &&
    input.stallReasonTotal >= MIRROR_MIN_STALL_REASONS &&
    dominant
  ) {
    return {
      mode: "stall",
      line: buildStallMirrorLine(dominant.reason),
      dominantReason: dominant.reason,
    };
  }

  return {
    mode: "rules",
    line: buildRulesMirrorLine(input.rulesCounts),
  };
}
