"use client";

/**
 * Pipeline display helpers — keep formatting out of card/board components.
 */

import { scoreLabel } from "@/lib/inbox/scoring";
import type { LeadStatus } from "@/types";

export const PIPELINE_ACTIVE_STAGES = [
  "NEW",
  "CONTACTED",
  "NEGOTIATING",
  "PROPOSAL_SENT",
] as const satisfies readonly LeadStatus[];

export type PipelineActiveStage = (typeof PIPELINE_ACTIVE_STAGES)[number];

export const PIPELINE_STAGE_LABEL: Record<PipelineActiveStage, string> = {
  NEW: "New",
  CONTACTED: "Contacted",
  NEGOTIATING: "Negotiating",
  PROPOSAL_SENT: "Proposal sent",
};

export const PIPELINE_STAGE_ACCENT: Record<PipelineActiveStage, string> = {
  NEW: "#2684FF",
  CONTACTED: "#22C55E",
  NEGOTIATING: "#F59E0B",
  PROPOSAL_SENT: "#8B5CF6",
};

export function formatPipelineStage(status: string): string {
  if (status === "NEW") return "New";
  if (status === "CONTACTED") return "Contacted";
  if (status === "NEGOTIATING") return "Negotiating";
  if (status === "PROPOSAL_SENT") return "Proposal sent";
  if (status === "WON") return "Won";
  if (status === "LOST") return "Lost";
  if (status === "NOT_QUALIFIED") return "Not qualified";
  return status.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

export function getNextPipelineStage(
  status: string
): PipelineActiveStage | null {
  const idx = (PIPELINE_ACTIVE_STAGES as readonly string[]).indexOf(status);
  if (idx < 0 || idx >= PIPELINE_ACTIVE_STAGES.length - 1) return null;
  return PIPELINE_ACTIVE_STAGES[idx + 1]!;
}

export function formatLeadIntent(score: number | null | undefined): {
  label: string;
  tone: "high" | "medium" | "low";
  dot: string;
} | null {
  if (score == null || !Number.isFinite(score)) return null;
  const raw = scoreLabel(score);
  if (raw === "Hot") return { label: "High intent", tone: "high", dot: "#EF4444" };
  if (raw === "Warm") return { label: "Medium intent", tone: "medium", dot: "#F59E0B" };
  return { label: "Low intent", tone: "low", dot: "#98A2B3" };
}

export function intentLikelihoodCopy(score: number): string {
  if (score >= 70) return "Very likely to convert";
  if (score >= 40) return "Moderately likely to convert";
  return "Needs nurturing";
}

export function closedStatusPillClass(status: string): string {
  if (status === "WON") return "bg-[#ECFDF3] text-[#027A48]";
  if (status === "LOST") return "bg-[#FEF3F2] text-[#B42318]";
  return "bg-[#F2F4F7] text-[#667085]";
}
