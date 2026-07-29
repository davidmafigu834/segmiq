import { ALL_FOLLOW_UP_HOLDUP_REASONS } from "@/lib/call-log-constants";
import {
  classifyLeadLane,
  type ClassifiableLead,
} from "@/lib/lead-lanes";
import { excludeGraduatedLeads } from "@/lib/retargeting-shared";
import {
  buildSalesMirror,
  type RulesMirrorCounts,
  type SalesMirrorResult,
} from "@/lib/mirror-nudges";

export type StallCallLogRow = {
  reason: string | null;
  result: string | null;
};

export function countLaneMetrics(
  leads: ClassifiableLead[],
  now: Date = new Date()
): Pick<RulesMirrorCounts, "callNow" | "followUps" | "slipped"> {
  const eligible = excludeGraduatedLeads(leads, now);
  let callNow = 0;
  let followUps = 0;
  let slipped = 0;

  for (const lead of eligible) {
    const { lane } = classifyLeadLane(lead, now);
    if (lane === "call_now") callNow++;
    else if (lane === "follow_ups") followUps++;
    else if (lane === "recover") slipped++;
  }

  return { callNow, followUps, slipped };
}

export function aggregateStallReasons(
  logs: StallCallLogRow[]
): { counts: Record<string, number>; total: number } {
  const counts: Record<string, number> = {};
  for (const r of ALL_FOLLOW_UP_HOLDUP_REASONS) counts[r] = 0;

  let total = 0;
  for (const log of logs) {
    if (log.result !== "follow_up") continue;
    const reason = log.reason?.trim();
    if (!reason) continue;
    if (!(ALL_FOLLOW_UP_HOLDUP_REASONS as readonly string[]).includes(reason)) continue;
    counts[reason] = (counts[reason] ?? 0) + 1;
    total++;
  }

  return { counts, total };
}

export function resolveSalesMirror(input: {
  leads: ClassifiableLead[];
  stallLogs: StallCallLogRow[];
  convertLaterCount: number;
  aiEnabled: boolean;
  now?: Date;
}): SalesMirrorResult {
  const now = input.now ?? new Date();
  const laneCounts = countLaneMetrics(input.leads, now);
  const { counts, total } = aggregateStallReasons(input.stallLogs);

  return buildSalesMirror({
    aiEnabled: input.aiEnabled,
    stallReasonTotal: total,
    reasonCounts: counts,
    rulesCounts: {
      ...laneCounts,
      convertLater: input.convertLaterCount,
    },
  });
}
