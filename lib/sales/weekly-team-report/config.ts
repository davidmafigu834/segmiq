import {
  DEFAULT_QUOTE_FOLLOWUP_HOURS,
  DEFAULT_SALES_EXECUTION,
  DEFAULT_STAGE_INACTIVITY_HOURS,
} from "@/lib/sales/intelligence/defaults";
import type { PipelineHealthConfig } from "./types";

export const DEFAULT_PIPELINE_HEALTH: PipelineHealthConfig = {
  needsAttentionDays: 5,
  atRiskDays: 8,
  quoteFollowupHours: DEFAULT_QUOTE_FOLLOWUP_HOURS,
  stalledHoursByStage: { ...DEFAULT_STAGE_INACTIVITY_HOURS },
  slaResponseHours: 4,
};

export function resolvePipelineHealthConfig(input?: {
  weeklyReportHealthConfig?: unknown;
  stageInactivityHours?: unknown;
  quoteFollowupHours?: number | null;
  slaResponseHours?: number | null;
}): PipelineHealthConfig {
  const base: PipelineHealthConfig = {
    ...DEFAULT_PIPELINE_HEALTH,
    stalledHoursByStage: { ...DEFAULT_SALES_EXECUTION.stageInactivityHours },
  };

  if (input?.stageInactivityHours && typeof input.stageInactivityHours === "object") {
    base.stalledHoursByStage = {
      ...base.stalledHoursByStage,
      ...(input.stageInactivityHours as Record<string, number>),
    };
  }
  if (typeof input?.quoteFollowupHours === "number" && input.quoteFollowupHours > 0) {
    base.quoteFollowupHours = input.quoteFollowupHours;
  }
  if (typeof input?.slaResponseHours === "number" && input.slaResponseHours > 0) {
    base.slaResponseHours = input.slaResponseHours;
  }

  const raw = input?.weeklyReportHealthConfig;
  if (raw && typeof raw === "object") {
    const cfg = raw as Record<string, unknown>;
    if (typeof cfg.needsAttentionDays === "number" && cfg.needsAttentionDays > 0) {
      base.needsAttentionDays = cfg.needsAttentionDays;
    }
    if (typeof cfg.atRiskDays === "number" && cfg.atRiskDays > 0) {
      base.atRiskDays = cfg.atRiskDays;
    }
    if (typeof cfg.quoteFollowupHours === "number" && cfg.quoteFollowupHours > 0) {
      base.quoteFollowupHours = cfg.quoteFollowupHours;
    }
    if (cfg.stalledHoursByStage && typeof cfg.stalledHoursByStage === "object") {
      base.stalledHoursByStage = {
        ...base.stalledHoursByStage,
        ...(cfg.stalledHoursByStage as Record<string, number>),
      };
    }
  }

  if (base.atRiskDays <= base.needsAttentionDays) {
    base.atRiskDays = base.needsAttentionDays + 3;
  }
  return base;
}

export const STALE_GENERATION_MS = 20 * 60 * 1000;
export const MAX_GENERATIONS_PER_CRON = 3;
export const MAX_ATTENTION_ITEMS = 25;
export const MAX_CONVERSATION_SCAN = 1500;
export const LOW_ACTIVITY_THRESHOLD = 8;
