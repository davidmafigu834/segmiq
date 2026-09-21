import { createAdminClient } from "@/lib/supabase/admin";
import { formatPeriodLabel } from "./period";
import { WEEKLY_REPORT_VERSION, WEEKLY_SALES_REPORT_TYPE } from "./types";
import { isInFlight, isStaleInFlight } from "./status";
import type {
  ResponseCoverage,
  WeeklyReportAiOutput,
  WeeklyReportDetail,
  WeeklyReportListItem,
  WeeklyReportPayload,
  WeeklyReportStatus,
  WeekPeriod,
} from "./types";

export type WeeklyReportRow = {
  id: string;
  client_id: string;
  report_type: string;
  period_start_date: string;
  period_end_date: string;
  period_start: string;
  period_end: string;
  timezone: string;
  generated_at: string | null;
  generation_status: WeeklyReportStatus;
  generated_by_kind: "system" | "user";
  generated_by_user_id: string | null;
  file_key: string | null;
  report_version: number;
  currency: string;
  summary_json: unknown;
  metrics_json: unknown;
  insights_json: unknown;
  recommendations_json: unknown;
  salesperson_analysis_json: unknown;
  pipeline_health_json: unknown;
  conversation_insights_json: unknown;
  lost_deal_analysis_json: unknown;
  attention_json: unknown;
  next_week_json: unknown;
  meeting_agenda_json: unknown;
  evidence_json: unknown;
  comparison_json: unknown;
  funnel_json: unknown;
  cover_json: unknown;
  ai_model_reference: string | null;
  ai_status: string | null;
  pdf_status: string | null;
  generation_error: string | null;
  retry_count: number;
  started_at: string | null;
  completed_at: string | null;
  notified_at: string | null;
  created_at: string;
  updated_at: string;
};

function db() {
  return createAdminClient();
}

export async function findReportByPeriod(clientId: string, periodStartDate: string): Promise<WeeklyReportRow | null> {
  const { data, error } = await db()
    .from("weekly_team_performance_reports")
    .select("*")
    .eq("client_id", clientId)
    .eq("report_type", WEEKLY_SALES_REPORT_TYPE)
    .eq("period_start_date", periodStartDate)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as WeeklyReportRow | null) ?? null;
}

export async function findReportById(clientId: string, reportId: string): Promise<WeeklyReportRow | null> {
  const { data, error } = await db()
    .from("weekly_team_performance_reports")
    .select("*")
    .eq("client_id", clientId)
    .eq("id", reportId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as WeeklyReportRow | null) ?? null;
}

export async function listReports(clientId: string, limit = 52): Promise<WeeklyReportRow[]> {
  const { data, error } = await db()
    .from("weekly_team_performance_reports")
    .select("*")
    .eq("client_id", clientId)
    .eq("report_type", WEEKLY_SALES_REPORT_TYPE)
    .order("period_start_date", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []) as WeeklyReportRow[];
}

export { isInFlight, isStaleInFlight } from "./status";

export async function claimOrCreateReport(opts: {
  clientId: string;
  period: WeekPeriod;
  generatedByKind: "system" | "user";
  generatedByUserId?: string | null;
  force?: boolean;
}): Promise<{ row: WeeklyReportRow; duplicate: boolean }> {
  const existing = await findReportByPeriod(opts.clientId, opts.period.startDate);
  if (existing) {
    if (existing.generation_status === "ready" && !opts.force) {
      return { row: existing, duplicate: true };
    }
    if (isInFlight(existing.generation_status) && !isStaleInFlight(existing) && !opts.force) {
      return { row: existing, duplicate: true };
    }
    const { data, error } = await db()
      .from("weekly_team_performance_reports")
      .update({
        generation_status: "scheduled",
        generation_error: null,
        retry_count: (existing.retry_count ?? 0) + (existing.generation_status === "failed" || isStaleInFlight(existing) ? 1 : 0),
        generated_by_kind: opts.generatedByKind,
        generated_by_user_id: opts.generatedByUserId ?? existing.generated_by_user_id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id)
      .eq("client_id", opts.clientId)
      .select("*")
      .maybeSingle();
    if (error) throw new Error(error.message);
    return { row: (data as WeeklyReportRow) ?? existing, duplicate: false };
  }

  const insert = {
    client_id: opts.clientId,
    report_type: WEEKLY_SALES_REPORT_TYPE,
    period_start_date: opts.period.startDate,
    period_end_date: opts.period.endDate,
    period_start: opts.period.startIso,
    period_end: opts.period.endIsoExclusive,
    timezone: opts.period.timezone,
    generation_status: "scheduled",
    generated_by_kind: opts.generatedByKind,
    generated_by_user_id: opts.generatedByUserId ?? null,
    report_version: WEEKLY_REPORT_VERSION,
  };
  const { data, error } = await db()
    .from("weekly_team_performance_reports")
    .insert(insert)
    .select("*")
    .maybeSingle();
  if (error) {
    if (error.code === "23505") {
      const raced = await findReportByPeriod(opts.clientId, opts.period.startDate);
      if (raced) return { row: raced, duplicate: raced.generation_status === "ready" || isInFlight(raced.generation_status) };
    }
    throw new Error(error.message);
  }
  return { row: data as WeeklyReportRow, duplicate: false };
}

export async function tryStartGeneration(
  clientId: string,
  reportId: string
): Promise<boolean> {
  const { data, error } = await db()
    .from("weekly_team_performance_reports")
    .update({
      generation_status: "collecting_data",
      started_at: new Date().toISOString(),
      generation_error: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", reportId)
    .eq("client_id", clientId)
    .in("generation_status", ["scheduled", "failed"])
    .select("id")
    .maybeSingle();
  if (error) throw new Error(error.message);
  return Boolean(data?.id);
}

export async function updateReport(
  clientId: string,
  reportId: string,
  patch: Record<string, unknown>
): Promise<void> {
  const { error } = await db()
    .from("weekly_team_performance_reports")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", reportId)
    .eq("client_id", clientId);
  if (error) throw new Error(error.message);
}

export function persistPayloadPatch(payload: WeeklyReportPayload): Record<string, unknown> {
  return {
    currency: payload.cover.currency,
    cover_json: payload.cover,
    summary_json: {
      executiveSummary: payload.ai.executiveSummary,
      whatWentWell: payload.ai.whatWentWell,
      whereMomentumWasLost: payload.ai.whereMomentumWasLost,
      biggestRisk: payload.ai.biggestRisk,
      biggestOpportunity: payload.ai.biggestOpportunity,
      priorityForNextWeek: payload.ai.priorityForNextWeek,
      headline: payload.ai.executiveSummary.slice(0, 280),
      findingCount:
        payload.insights.length + payload.attention.length + payload.ai.managerRecommendations.length,
      lowData: payload.lowData,
      activityVolume: payload.activityVolume,
      ai: payload.ai,
      responseCoverage: payload.responseCoverage,
    },
    metrics_json: payload.metrics,
    insights_json: payload.insights,
    recommendations_json: payload.ai.managerRecommendations,
    salesperson_analysis_json: payload.salespeople,
    pipeline_health_json: {
      buckets: payload.pipelineHealth,
      narrative: payload.pipelineHealthNarrative,
    },
    conversation_insights_json: payload.conversation,
    lost_deal_analysis_json: payload.lostDeals,
    attention_json: payload.attention,
    next_week_json: payload.ai.nextWeekPriorities,
    meeting_agenda_json: payload.ai.meetingAgenda,
    evidence_json: payload.evidence,
    comparison_json: payload.comparison,
    funnel_json: { stages: payload.funnel, explanation: payload.funnelExplanation },
  };
}

function metricCurrent(metrics: unknown, id: string): number | null {
  if (!Array.isArray(metrics)) return null;
  const match = metrics.find((row) => row && typeof row === "object" && (row as { id?: string }).id === id) as
    | { current?: number | null }
    | undefined;
  return typeof match?.current === "number" ? match.current : null;
}

export function toListItem(row: WeeklyReportRow): WeeklyReportListItem {
  const summary = (row.summary_json ?? {}) as {
    headline?: string;
    findingCount?: number;
    lowData?: boolean;
    whereMomentumWasLost?: string;
    biggestRisk?: string;
  };
  const keyIssue = String(summary.whereMomentumWasLost || summary.biggestRisk || "").trim();
  return {
    id: row.id,
    periodStartDate: row.period_start_date,
    periodEndDate: row.period_end_date,
    periodLabel: formatPeriodLabel({ startDate: row.period_start_date, endDate: row.period_end_date }),
    generatedAt: row.generated_at,
    status: row.generation_status,
    headline: summary.headline ?? null,
    findingCount: Number(summary.findingCount ?? 0),
    hasPdf: Boolean(row.file_key) && row.pdf_status === "ok",
    currency: row.currency,
    lowData: Boolean(summary.lowData),
    newLeads: metricCurrent(row.metrics_json, "new_leads"),
    dealsWon: metricCurrent(row.metrics_json, "deals_won"),
    revenueWon: metricCurrent(row.metrics_json, "revenue_won"),
    keyIssue: keyIssue ? keyIssue.slice(0, 80) : null,
  };
}

export function toDetail(row: WeeklyReportRow): WeeklyReportDetail {
  const payload = hydratePayload(row);
  return {
    ...toListItem(row),
    timezone: row.timezone,
    currency: row.currency,
    reportVersion: row.report_version,
    aiStatus: row.ai_status,
    pdfStatus: row.pdf_status,
    generationError: row.generation_error,
    payload,
  };
}

function hydratePayload(row: WeeklyReportRow): WeeklyReportPayload | null {
  if (!row.metrics_json || !row.cover_json || !row.summary_json) return null;
  const summary = row.summary_json as Record<string, unknown>;
  const storedAi = (summary.ai as WeeklyReportAiOutput | undefined) ?? null;
  const recommendations = (row.recommendations_json as WeeklyReportPayload["ai"]["managerRecommendations"]) ?? [];
  const nextWeek = (row.next_week_json as WeeklyReportPayload["ai"]["nextWeekPriorities"]) ?? [];
  const agenda = (row.meeting_agenda_json as string[]) ?? [];
  const salespeople = (row.salesperson_analysis_json as WeeklyReportPayload["salespeople"]) ?? [];
  const conversation = (row.conversation_insights_json as WeeklyReportPayload["conversation"]) ?? [];
  const lost = row.lost_deal_analysis_json as WeeklyReportPayload["lostDeals"] | null;
  const funnel = (row.funnel_json ?? {}) as { stages?: WeeklyReportPayload["funnel"]; explanation?: WeeklyReportPayload["funnelExplanation"] };
  const health = (row.pipeline_health_json ?? {}) as { buckets?: WeeklyReportPayload["pipelineHealth"]; narrative?: string };
  const reconstructedAi: WeeklyReportAiOutput = {
    executiveSummary: String(summary.executiveSummary ?? ""),
    whatWentWell: String(summary.whatWentWell ?? ""),
    whereMomentumWasLost: String(summary.whereMomentumWasLost ?? ""),
    biggestRisk: String(summary.biggestRisk ?? ""),
    biggestOpportunity: String(summary.biggestOpportunity ?? ""),
    priorityForNextWeek: String(summary.priorityForNextWeek ?? ""),
    positiveFindings: [],
    concerns: [],
    risks: [],
    opportunities: [],
    managerRecommendations: recommendations,
    nextWeekPriorities: nextWeek,
    meetingAgenda: agenda,
    salespersonNarratives: salespeople.map((p) => ({
      salespersonId: p.salespersonId,
      narrative: p.narrative,
      strengths: p.strengths,
      concerns: p.concerns,
      coachingFocus: p.coachingFocus,
    })),
    pipelineNarrative: health.narrative ?? "",
    lossAnalysisNarrative: lost?.narrative ?? "",
    conversationPatterns: conversation.map((c) => ({ id: c.id, interpretation: c.interpretation })),
    dataSufficiencyNote: null,
  };
  return {
    cover: row.cover_json as WeeklyReportPayload["cover"],
    metrics: row.metrics_json as WeeklyReportPayload["metrics"],
    funnel: funnel.stages ?? [],
    funnelExplanation: funnel.explanation ?? [],
    pipelineHealth: health.buckets ?? [],
    pipelineHealthNarrative: health.narrative ?? "",
    attention: (row.attention_json as WeeklyReportPayload["attention"]) ?? [],
    salespeople,
    lostDeals: lost ?? {
      count: 0,
      previousCount: 0,
      value: 0,
      previousValue: 0,
      rows: [],
      reasonCounts: [],
      narrative: "",
    },
    conversation,
    insights: (row.insights_json as WeeklyReportPayload["insights"]) ?? [],
    ai: storedAi ?? reconstructedAi,
    evidence: (row.evidence_json as WeeklyReportPayload["evidence"]) ?? [],
    lowData: Boolean(summary.lowData),
    activityVolume: Number(summary.activityVolume ?? 0),
    responseCoverage: hydrateResponseCoverage(summary, row.metrics_json),
    comparison: (row.comparison_json as WeeklyReportPayload["comparison"]) ?? {
      previousWeek: {
        startDate: "",
        endDate: "",
        startIso: "",
        endIsoExclusive: "",
        timezone: row.timezone,
      },
      fourWeekAverageSupported: true,
    },
  };
}

function hydrateResponseCoverage(summary: Record<string, unknown>, metrics: unknown): ResponseCoverage {
  const stored = summary.responseCoverage;
  if (stored && typeof stored === "object") {
    const row = stored as Partial<ResponseCoverage>;
    const sla = Number(row.slaHours);
    return {
      contactedAverageMinutes:
        typeof row.contactedAverageMinutes === "number" && Number.isFinite(row.contactedAverageMinutes)
          ? row.contactedAverageMinutes
          : null,
      newLeads: Math.max(0, Math.round(Number(row.newLeads) || 0)),
      contactedLeads: Math.max(0, Math.round(Number(row.contactedLeads) || 0)),
      onTime: Math.max(0, Math.round(Number(row.onTime) || 0)),
      missedSla: Math.max(0, Math.round(Number(row.missedSla) || 0)),
      slaHours: Number.isFinite(sla) && sla > 0 ? sla : 2,
    };
  }
  return {
    contactedAverageMinutes: metricCurrent(metrics, "avg_first_response"),
    newLeads: metricCurrent(metrics, "new_leads") ?? 0,
    contactedLeads: metricCurrent(metrics, "contacted_leads") ?? 0,
    onTime: 0,
    missedSla: 0,
    slaHours: 2,
  };
}

export async function listDueClientIds(): Promise<string[]> {
  const { data, error } = await db()
    .from("clients")
    .select("id")
    .eq("is_active", true)
    .eq("is_archived", false);
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => row.id as string);
}

export async function resolveClientTimezone(clientId: string): Promise<string> {
  const { data } = await db()
    .from("client_marketing_settings")
    .select("timezone")
    .eq("client_id", clientId)
    .maybeSingle();
  return (data?.timezone as string | null) || "Africa/Harare";
}
