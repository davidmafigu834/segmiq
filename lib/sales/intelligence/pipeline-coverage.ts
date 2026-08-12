/**
 * Safe pipeline coverage math — never NaN / Infinity / fake 0%.
 */

import type { PipelineCoverageResult } from "./types";

export function calcPipelineCoverage(opts: {
  remainingGoalValue: number | null | undefined;
  activePipelineValue: number | null | undefined;
  hasReliablePipelineValues: boolean;
}): PipelineCoverageResult {
  const remaining =
    opts.remainingGoalValue != null && Number.isFinite(opts.remainingGoalValue)
      ? opts.remainingGoalValue
      : null;
  const pipeline =
    opts.activePipelineValue != null && Number.isFinite(opts.activePipelineValue)
      ? opts.activePipelineValue
      : null;

  if (remaining == null) {
    return {
      available: false,
      remainingGoalValue: null,
      activePipelineValue: pipeline,
      coverageRatio: null,
      coverageLabel: "Coverage unavailable",
      interpretation:
        "Set a sales goal to connect pipeline coverage to your target.",
    };
  }

  if (remaining <= 0) {
    return {
      available: true,
      remainingGoalValue: 0,
      activePipelineValue: pipeline,
      coverageRatio: null,
      coverageLabel: "Goal achieved",
      interpretation:
        "Goal achieved or exceeded. Keep handling active customer commitments and deals.",
    };
  }

  if (!opts.hasReliablePipelineValues || pipeline == null) {
    return {
      available: false,
      remainingGoalValue: remaining,
      activePipelineValue: null,
      coverageRatio: null,
      coverageLabel: "Coverage unavailable",
      interpretation:
        "Coverage unavailable until deal values are recorded on active opportunities.",
    };
  }

  const ratio = pipeline / remaining;
  if (!Number.isFinite(ratio)) {
    return {
      available: false,
      remainingGoalValue: remaining,
      activePipelineValue: pipeline,
      coverageRatio: null,
      coverageLabel: "Coverage unavailable",
      interpretation:
        "Coverage unavailable until deal values are recorded on active opportunities.",
    };
  }

  const coverageLabel =
    ratio >= 2
      ? `${ratio.toFixed(1)}× coverage`
      : ratio >= 1
        ? `${ratio.toFixed(1)}× coverage`
        : "Pipeline coverage low";

  const interpretation =
    ratio >= 2
      ? "Your current recorded pipeline provides healthy opportunity coverage. Focus on progressing active deals."
      : ratio >= 1
        ? "Your recorded pipeline roughly matches your remaining target. Keep deals moving and add opportunities where gaps appear."
        : "Your recorded active pipeline is currently below your remaining goal. Build more opportunities while continuing to work existing deals.";

  return {
    available: true,
    remainingGoalValue: remaining,
    activePipelineValue: pipeline,
    coverageRatio: Math.round(ratio * 100) / 100,
    coverageLabel,
    interpretation,
  };
}

export function sumActivePipelineValue(
  values: Array<number | null | undefined>
): { total: number; counted: number } {
  let total = 0;
  let counted = 0;
  for (const v of values) {
    if (v != null && Number.isFinite(v) && v > 0) {
      total += v;
      counted += 1;
    }
  }
  return { total, counted };
}
