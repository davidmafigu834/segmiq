import type { CheckStatus, DueDiligenceCheck, ReportStatus } from "@/lib/real-estate/due-diligence/types";

/** 80 and above is a pass. 50 to 79 is conditional. Below 50 fails. */
export const PASS_SCORE = 80;
export const CONDITIONAL_SCORE = 50;

/** A check removes its weight from a starting score of 100. Passes remove nothing. */
export function pointsFor(status: CheckStatus, weight: number): number {
  if (weight <= 0 || status === "pass" || status === "not_applicable") return 0;
  return weight;
}

export function scoreRisk(checks: DueDiligenceCheck[]): { score: number; reasons: string[] } {
  let deducted = 0;
  const reasons: string[] = [];
  for (const item of checks) {
    const points = pointsFor(item.status, item.weight);
    if (points <= 0) continue;
    deducted += points;
    reasons.push(item.detail);
  }
  return { score: Math.max(0, Math.min(100, 100 - deducted)), reasons };
}

/** Status follows the score bands. Critical checks are weighted so one of them falls below 50. */
export function decideStatus(_checks: DueDiligenceCheck[], score: number): ReportStatus {
  if (score >= PASS_SCORE) return "pass";
  if (score >= CONDITIONAL_SCORE) return "conditional_pass";
  return "fail";
}
