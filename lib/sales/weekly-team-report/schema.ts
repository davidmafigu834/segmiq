import { z } from "zod";
import type { WeeklyReportAiOutput } from "./types";

const recommendationSchema = z.object({
  title: z.string().min(3).max(120),
  evidence: z.string().min(3).max(400),
  action: z.string().min(3).max(400),
  objective: z.string().min(3).max(240),
});

const prioritySchema = z.object({
  title: z.string().min(3).max(120),
  affectedCount: z.number().int().nonnegative(),
  pipelineValue: z.number().nonnegative().nullable(),
  ownerLabel: z.string().min(1).max(80),
  targetDate: z.string().max(40).nullable(),
});

const salespersonSchema = z.object({
  salespersonId: z.string().min(1).max(80),
  narrative: z.string().min(20).max(800),
  strengths: z.array(z.string().max(240)).max(4),
  concerns: z.array(z.string().max(240)).max(4),
  coachingFocus: z.string().min(3).max(240),
});

export const weeklyReportAiSchema = z.object({
  executiveSummary: z.string().min(40).max(1600),
  whatWentWell: z.string().min(8).max(400),
  whereMomentumWasLost: z.string().min(8).max(400),
  biggestRisk: z.string().min(8).max(400),
  biggestOpportunity: z.string().min(8).max(400),
  priorityForNextWeek: z.string().min(8).max(240),
  positiveFindings: z.array(z.string().max(280)).max(6),
  concerns: z.array(z.string().max(280)).max(6),
  risks: z.array(z.string().max(280)).max(6),
  opportunities: z.array(z.string().max(280)).max(6),
  managerRecommendations: z.array(recommendationSchema).max(6),
  nextWeekPriorities: z.array(prioritySchema).max(8),
  meetingAgenda: z.array(z.string().max(180)).min(3).max(8),
  salespersonNarratives: z.array(salespersonSchema).max(40),
  pipelineNarrative: z.string().min(12).max(800),
  lossAnalysisNarrative: z.string().min(12).max(800),
  conversationPatterns: z
    .array(
      z.object({
        id: z.string().min(1).max(40),
        interpretation: z.string().min(8).max(400),
      })
    )
    .max(12),
  dataSufficiencyNote: z.string().max(400).nullable(),
});

export function parseJsonObject(text: string): unknown {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}

const BANNED_JUDGEMENT = /\b(lazy|stupid|incompetent|useless|terrible person|unprofessional character)\b/i;

export function validateWeeklyReportAi(
  raw: unknown,
  allowedSalespersonIds: Set<string>
): WeeklyReportAiOutput | null {
  const parsed = weeklyReportAiSchema.safeParse(raw);
  if (!parsed.success) return null;
  const value = parsed.data;
  value.salespersonNarratives = value.salespersonNarratives.filter((row) => {
    if (!allowedSalespersonIds.has(row.salespersonId)) return false;
    const blob = `${row.narrative} ${row.concerns.join(" ")} ${row.coachingFocus}`;
    return !BANNED_JUDGEMENT.test(blob);
  });
  value.managerRecommendations = value.managerRecommendations.filter((row) => {
    const generic = /work harder|improve communication|close more deals/i.test(
      `${row.title} ${row.action}`
    );
    return !generic;
  });
  return value;
}
