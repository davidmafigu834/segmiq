import { createAdminClient } from "@/lib/supabase/admin";
import {
  FOLLOW_UP_HOLDUP_REASONS,
  LOST_REASONS,
  NOT_QUALIFIED_REASONS,
} from "@/lib/call-log-constants";
import { parseBudgetValue } from "@/lib/lead-lanes";
import { LOSS_MIN_REASONED_EVENTS } from "@/lib/loss-analysis-constants";

// ============================================
// CONSTANTS
// ============================================

export const RECOVERABLE_STALL_REASONS = [
  "Can't afford now",
  "Waiting on money",
] as const;

/** Not-a-fit reasons that signal ad targeting mismatch (not sales execution). */
export const TARGETING_NOT_FIT_REASONS = [
  "Budget too small",
  "Out of area",
  "Service we don't offer",
] as const;

export { LOSS_MIN_REASONED_EVENTS } from "@/lib/loss-analysis-constants";

export const TARGETING_MIN_NOT_FIT = 5;
export const TARGETING_OVERALL_SHARE_PCT = 25;
export const TARGETING_SOURCE_SHARE_PCT = 30;
export const TARGETING_SOURCE_MIN_LEADS = 5;

const TERMINAL_STATUSES = new Set(["WON", "LOST", "NOT_QUALIFIED"]);

const SOURCE_LABELS: Record<string, string> = {
  FACEBOOK: "Facebook",
  LANDING_PAGE: "profile page",
  MANUAL: "manual entry",
  REFERRAL: "referral",
};

// ============================================
// TYPES
// ============================================

export type LossCallLogRow = {
  id: string;
  lead_id: string;
  reason: string | null;
  result: string | null;
  reach_outcome: string | null;
  /** Legacy single-step outcome (pre two-step flow). */
  outcome?: string | null;
  created_at: string;
};

export type LossLeadRow = {
  id: string;
  status: string;
  source: string | null;
  deal_value: number | null;
  budget: string | null;
  form_data: Record<string, unknown> | null;
  lost_reason: string | null;
  not_qualified_reason: string | null;
  created_at: string;
  updated_at: string;
};

export type NotFitSourceStats = {
  total: number;
  notFit: number;
  topReason: string;
  topReasonCount: number;
  sharePct: number;
};

export type LossAnalysisResult = {
  windowStart: string;
  windowEnd: string;
  /** All call_logs for this client in the window (any outcome). */
  totalCallLogsInWindow: number;
  totalReasonedEvents: number;
  stallReasons: Record<string, number>;
  lostReasons: Record<string, number>;
  notFitReasons: Record<string, number>;
  recoverablePile: {
    count: number;
    estimatedValue: number | null;
    leadIds: string[];
  };
  notFitBySource: Record<string, NotFitSourceStats>;
  contactedOutcomes: number;
  notFitOutcomes: number;
  hasEnoughData: boolean;
};

export type TargetingRecommendationInput = {
  category: string;
  priority: "critical" | "high" | "medium" | "low";
  title: string;
  body: string;
  supporting_data: Record<string, unknown>;
  dedup_key: string;
};

// ============================================
// HELPERS (pure)
// ============================================

function initReasonCounts<const T extends readonly string[]>(
  reasons: T
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const r of reasons) out[r] = 0;
  return out;
}

function bumpReasonCount(
  counts: Record<string, number>,
  reason: string | null | undefined,
  allowed: readonly string[]
): boolean {
  if (!reason?.trim()) return false;
  if (!(allowed as readonly string[]).includes(reason)) return false;
  counts[reason] = (counts[reason] ?? 0) + 1;
  return true;
}

function leadBudgetText(lead: LossLeadRow): string | null {
  if (lead.budget?.trim()) return lead.budget;
  const fd = lead.form_data;
  if (!fd) return null;
  for (const key of Object.keys(fd)) {
    if (["budget", "price", "value"].some((k) => key.toLowerCase().includes(k))) {
      const v = fd[key];
      if (typeof v === "string" && v.trim()) return v;
    }
  }
  return null;
}

export function leadEstimatedValue(lead: LossLeadRow): number | null {
  if (lead.deal_value != null && lead.deal_value > 0) return lead.deal_value;
  return parseBudgetValue(leadBudgetText(lead));
}

function isInWindow(iso: string, windowStart: Date, windowEnd: Date): boolean {
  const t = new Date(iso).getTime();
  return t >= windowStart.getTime() && t <= windowEnd.getTime();
}

function topReasonFromCounts(
  counts: Record<string, number>,
  allowed: readonly string[]
): { reason: string; count: number } | null {
  let best: { reason: string; count: number } | null = null;
  for (const r of allowed) {
    const c = counts[r] ?? 0;
    if (c > 0 && (!best || c > best.count)) {
      best = { reason: r, count: c };
    }
  }
  return best;
}

/** Map two-step fields, or infer from legacy `outcome` + lead reason columns. */
export function normalizeLossCallLog(
  log: LossCallLogRow,
  lead: LossLeadRow | undefined
): Pick<LossCallLogRow, "result" | "reason" | "reach_outcome"> {
  if (log.reach_outcome === "call_back") {
    return {
      result: "follow_up",
      reason: log.reason?.trim() || "Scheduled callback",
      reach_outcome: "call_back",
    };
  }

  if (log.result) {
    return {
      result: log.result,
      reason: log.reason?.trim() || null,
      reach_outcome: log.reach_outcome ?? "reached",
    };
  }

  const legacy = log.outcome?.toUpperCase();
  if (legacy === "LOST") {
    return {
      result: "lost",
      reason: log.reason?.trim() || lead?.lost_reason?.trim() || null,
      reach_outcome: "reached",
    };
  }
  if (legacy === "NOT_QUALIFIED") {
    return {
      result: "not_qualified",
      reason: log.reason?.trim() || lead?.not_qualified_reason?.trim() || null,
      reach_outcome: "reached",
    };
  }
  if ((legacy === "FOLLOW_UP" || legacy === "ANSWERED") && log.reason?.trim()) {
    return {
      result: "follow_up",
      reason: log.reason.trim(),
      reach_outcome: log.reach_outcome ?? "reached",
    };
  }
  if (legacy === "WON") {
    return { result: "won", reason: null, reach_outcome: "reached" };
  }

  return {
    result: log.result,
    reason: log.reason?.trim() || null,
    reach_outcome: log.reach_outcome,
  };
}

// ============================================
// PURE AGGREGATION — testable without DB
// ============================================

export function aggregateLossFromData(
  windowCallLogs: LossCallLogRow[],
  leads: LossLeadRow[],
  recoverableCallLogs: LossCallLogRow[],
  windowStart: Date,
  windowEnd: Date
): LossAnalysisResult {
  const stallReasons = initReasonCounts(FOLLOW_UP_HOLDUP_REASONS);
  const lostReasons = initReasonCounts(LOST_REASONS);
  const notFitReasons = initReasonCounts(NOT_QUALIFIED_REASONS);

  const leadById = new Map(leads.map((l) => [l.id, l]));
  const terminalFromLogs = new Set<string>();

  let totalReasonedEvents = 0;
  let contactedOutcomes = 0;
  let notFitOutcomes = 0;

  for (const log of windowCallLogs) {
    if (!isInWindow(log.created_at, windowStart, windowEnd)) continue;
    const norm = normalizeLossCallLog(log, leadById.get(log.lead_id));
    const reason = norm.reason?.trim();
    if (!reason) continue;

    if (
      norm.reach_outcome === "reached" &&
      ["follow_up", "lost", "not_qualified", "won"].includes(norm.result ?? "")
    ) {
      contactedOutcomes++;
    }

    let counted = false;
    if (norm.result === "follow_up") {
      counted = bumpReasonCount(stallReasons, reason, FOLLOW_UP_HOLDUP_REASONS);
    } else if (norm.result === "lost") {
      counted = bumpReasonCount(lostReasons, reason, LOST_REASONS);
      terminalFromLogs.add(log.lead_id);
    } else if (norm.result === "not_qualified") {
      counted = bumpReasonCount(notFitReasons, reason, NOT_QUALIFIED_REASONS);
      terminalFromLogs.add(log.lead_id);
      if (counted) notFitOutcomes++;
    }

    if (counted) totalReasonedEvents++;
  }

  for (const lead of leads) {
    if (!isInWindow(lead.updated_at, windowStart, windowEnd)) continue;
    if (terminalFromLogs.has(lead.id)) continue;

    if (lead.status === "LOST" && lead.lost_reason) {
      if (bumpReasonCount(lostReasons, lead.lost_reason, LOST_REASONS)) {
        totalReasonedEvents++;
        contactedOutcomes++;
      }
    }

    if (lead.status === "NOT_QUALIFIED" && lead.not_qualified_reason) {
      if (
        bumpReasonCount(
          notFitReasons,
          lead.not_qualified_reason,
          NOT_QUALIFIED_REASONS
        )
      ) {
        totalReasonedEvents++;
        contactedOutcomes++;
        notFitOutcomes++;
      }
    }
  }

  const logsByLead = new Map<string, LossCallLogRow[]>();
  for (const log of recoverableCallLogs) {
    const arr = logsByLead.get(log.lead_id) ?? [];
    arr.push(log);
    logsByLead.set(log.lead_id, arr);
  }

  const recoverableIds: string[] = [];
  let valueSum = 0;

  for (const lead of leads) {
    if (TERMINAL_STATUSES.has(lead.status)) continue;

    const logs = (logsByLead.get(lead.id) ?? []).sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
    const latest = logs.find((l) => {
      const norm = normalizeLossCallLog(l, lead);
      return norm.result === "follow_up" && norm.reason?.trim();
    });
    const reason = latest ? normalizeLossCallLog(latest, lead).reason?.trim() : null;
    if (
      !reason ||
      !(RECOVERABLE_STALL_REASONS as readonly string[]).includes(reason)
    ) {
      continue;
    }

    recoverableIds.push(lead.id);
    const val = leadEstimatedValue(lead);
    if (val != null) valueSum += val;
  }

  const notFitLeadIdsBySource: Record<string, Set<string>> = {};
  const leadsInWindowBySource: Record<string, number> = {};

  for (const lead of leads) {
    if (!isInWindow(lead.created_at, windowStart, windowEnd)) continue;
    const src = lead.source ?? "UNKNOWN";
    leadsInWindowBySource[src] = (leadsInWindowBySource[src] ?? 0) + 1;
  }

  for (const log of windowCallLogs) {
    if (!isInWindow(log.created_at, windowStart, windowEnd)) continue;
    const norm = normalizeLossCallLog(log, leadById.get(log.lead_id));
    if (norm.result !== "not_qualified") continue;
    const lead = leadById.get(log.lead_id);
    if (!lead) continue;
    const src = lead.source ?? "UNKNOWN";
    if (!notFitLeadIdsBySource[src]) notFitLeadIdsBySource[src] = new Set();
    notFitLeadIdsBySource[src].add(log.lead_id);
  }

  for (const lead of leads) {
    if (!isInWindow(lead.created_at, windowStart, windowEnd)) continue;
    if (lead.status !== "NOT_QUALIFIED" || !lead.not_qualified_reason) continue;
    const src = lead.source ?? "UNKNOWN";
    if (!notFitLeadIdsBySource[src]) notFitLeadIdsBySource[src] = new Set();
    notFitLeadIdsBySource[src].add(lead.id);
  }

  const notFitReasonsBySource: Record<string, Record<string, number>> = {};

  for (const log of windowCallLogs) {
    if (!isInWindow(log.created_at, windowStart, windowEnd)) continue;
    const norm = normalizeLossCallLog(log, leadById.get(log.lead_id));
    if (norm.result !== "not_qualified" || !norm.reason?.trim()) continue;
    const lead = leadById.get(log.lead_id);
    if (!lead) continue;
    const src = lead.source ?? "UNKNOWN";
    if (!notFitReasonsBySource[src]) notFitReasonsBySource[src] = {};
    const r = norm.reason.trim();
    notFitReasonsBySource[src][r] = (notFitReasonsBySource[src][r] ?? 0) + 1;
  }

  const notFitBySource: Record<string, NotFitSourceStats> = {};

  for (const [src, total] of Object.entries(leadsInWindowBySource)) {
    const notFit = notFitLeadIdsBySource[src]?.size ?? 0;
    const reasonCounts = notFitReasonsBySource[src] ?? {};
    const top = topReasonFromCounts(reasonCounts, NOT_QUALIFIED_REASONS);
    notFitBySource[src] = {
      total,
      notFit,
      topReason: top?.reason ?? "",
      topReasonCount: top?.count ?? 0,
      sharePct: total > 0 ? Math.round((notFit / total) * 100) : 0,
    };
  }

  return {
    windowStart: windowStart.toISOString(),
    windowEnd: windowEnd.toISOString(),
    totalCallLogsInWindow: windowCallLogs.length,
    totalReasonedEvents,
    stallReasons,
    lostReasons,
    notFitReasons,
    recoverablePile: {
      count: recoverableIds.length,
      estimatedValue: recoverableIds.length > 0 && valueSum > 0 ? valueSum : null,
      leadIds: recoverableIds,
    },
    notFitBySource,
    contactedOutcomes,
    notFitOutcomes,
    hasEnoughData: totalReasonedEvents >= LOSS_MIN_REASONED_EVENTS,
  };
}

// ============================================
// TARGETING RECOMMENDATIONS (Rule 8)
// ============================================

export function buildTargetingRecommendations(
  loss: LossAnalysisResult,
  clientId: string,
  industry: string,
  makeDedupKey: (clientId: string, category: string, signal: string) => string
): TargetingRecommendationInput[] {
  if (!loss.hasEnoughData || loss.notFitOutcomes < TARGETING_MIN_NOT_FIT) {
    return [];
  }

  const out: TargetingRecommendationInput[] = [];

  const sourceCandidates = Object.entries(loss.notFitBySource)
    .filter(([src, s]) => {
      if (src === "UNKNOWN") return false;
      if (s.total < TARGETING_SOURCE_MIN_LEADS) return false;
      if (s.sharePct < TARGETING_SOURCE_SHARE_PCT) return false;
      return (TARGETING_NOT_FIT_REASONS as readonly string[]).includes(
        s.topReason
      );
    })
    .sort((a, b) => b[1].sharePct - a[1].sharePct);

  if (sourceCandidates.length > 0) {
    const [source, stats] = sourceCandidates[0]!;
    const label = SOURCE_LABELS[source] ?? source;
    const priority: "high" | "medium" =
      stats.sharePct >= 35 ? "high" : "medium";

    out.push({
      category: "targeting",
      priority,
      title: `${stats.sharePct}% of ${label} leads are not a fit — ${stats.topReason}`,
      body: `${stats.sharePct}% of leads from ${label} are marked not a fit (${stats.topReason}) — tighten targeting. Review geo, service, and budget filters in Meta rather than asking sales to push harder.`,
      supporting_data: {
        source,
        reason: stats.topReason,
        share_pct: stats.sharePct,
        not_fit_count: stats.notFit,
        total_count: stats.total,
        industry,
      },
      dedup_key: makeDedupKey(clientId, "targeting", `${source}_${stats.topReason}`),
    });

    return out;
  }

  const overallShare =
    loss.contactedOutcomes > 0
      ? Math.round((loss.notFitOutcomes / loss.contactedOutcomes) * 100)
      : 0;

  if (
    overallShare >= TARGETING_OVERALL_SHARE_PCT &&
    loss.notFitOutcomes >= TARGETING_MIN_NOT_FIT
  ) {
    const top = topReasonFromCounts(loss.notFitReasons, TARGETING_NOT_FIT_REASONS);
    if (!top) return out;

    const priority: "high" | "medium" =
      overallShare >= 35 ? "high" : "medium";

    out.push({
      category: "targeting",
      priority,
      title: `${overallShare}% of contacted leads are not a fit — ${top.reason}`,
      body: `${overallShare}% of contacted outcomes this period are marked not a fit (${top.reason}) — tighten ad targeting. Review who the campaigns are reaching before changing the sales approach.`,
      supporting_data: {
        reason: top.reason,
        share_pct: overallShare,
        not_fit_count: loss.notFitOutcomes,
        contacted_outcomes: loss.contactedOutcomes,
        industry,
      },
      dedup_key: makeDedupKey(
        clientId,
        "targeting",
        `overall_${top.reason}`
      ),
    });
  }

  return out;
}

// ============================================
// DB FETCH
// ============================================

function lossWindowBounds(windowDays: number): { windowStart: Date; windowEnd: Date } {
  const now = new Date();
  const windowEnd = new Date(now);
  windowEnd.setHours(23, 59, 59, 999);

  const windowStart = new Date(now);
  windowStart.setDate(now.getDate() - windowDays);
  windowStart.setHours(0, 0, 0, 0);

  return { windowStart, windowEnd };
}

function emptyLossResult(windowStart: Date, windowEnd: Date): LossAnalysisResult {
  return {
    windowStart: windowStart.toISOString(),
    windowEnd: windowEnd.toISOString(),
    totalCallLogsInWindow: 0,
    totalReasonedEvents: 0,
    stallReasons: initReasonCounts(FOLLOW_UP_HOLDUP_REASONS),
    lostReasons: initReasonCounts(LOST_REASONS),
    notFitReasons: initReasonCounts(NOT_QUALIFIED_REASONS),
    recoverablePile: { count: 0, estimatedValue: null, leadIds: [] },
    notFitBySource: {},
    contactedOutcomes: 0,
    notFitOutcomes: 0,
    hasEnoughData: false,
  };
}

const LOSS_LEAD_SELECT =
  "id, status, source, deal_value, budget, form_data, lost_reason, not_qualified_reason, created_at, updated_at";

function isMissingLeadsArchivedColumn(error: unknown): boolean {
  const msg =
    error instanceof Error
      ? error.message
      : typeof error === "object" && error !== null && "message" in error
        ? String((error as { message: unknown }).message)
        : "";
  return msg.includes("column leads.is_archived does not exist");
}

async function fetchLossLeadRows(
  supabase: ReturnType<typeof createAdminClient>,
  clientId: string
): Promise<LossLeadRow[]> {
  let result = await supabase
    .from("leads")
    .select(LOSS_LEAD_SELECT)
    .eq("client_id", clientId)
    .eq("is_archived", false);

  if (result.error && isMissingLeadsArchivedColumn(result.error)) {
    result = await supabase
      .from("leads")
      .select(LOSS_LEAD_SELECT)
      .eq("client_id", clientId);
  }

  if (result.error) {
    console.error("aggregateLossAnalysis: leads fetch failed", result.error);
    return [];
  }

  return (result.data ?? []) as LossLeadRow[];
}

const LOSS_CALL_LOG_SELECT =
  "id, lead_id, reason, result, reach_outcome, outcome, created_at";

export async function aggregateLossAnalysis(
  clientId: string,
  windowDays = 30
): Promise<LossAnalysisResult> {
  const { windowStart, windowEnd } = lossWindowBounds(windowDays);
  const supabase = createAdminClient();

  const leadRows = await fetchLossLeadRows(supabase, clientId);

  if (leadRows.length === 0) {
    return emptyLossResult(windowStart, windowEnd);
  }

  const leadIds = leadRows.map((l) => l.id);

  const { data: windowLogs, error: logsError } = await supabase
    .from("call_logs")
    .select(LOSS_CALL_LOG_SELECT)
    .in("lead_id", leadIds)
    .gte("created_at", windowStart.toISOString())
    .lte("created_at", windowEnd.toISOString());

  if (logsError) {
    console.error("aggregateLossAnalysis: call_logs fetch failed", logsError);
    return emptyLossResult(windowStart, windowEnd);
  }

  const activeIds = new Set(
    leadRows.filter((l) => !TERMINAL_STATUSES.has(l.status)).map((l) => l.id)
  );

  let recoverableLogs: LossCallLogRow[] = [];

  if (activeIds.size > 0) {
    const { data: followUpLogs } = await supabase
      .from("call_logs")
      .select(LOSS_CALL_LOG_SELECT)
      .in("lead_id", Array.from(activeIds))
      .or(
        "result.eq.follow_up,reach_outcome.eq.call_back,outcome.in.(FOLLOW_UP,ANSWERED)"
      );

    recoverableLogs = ((followUpLogs ?? []) as LossCallLogRow[]).filter((l) => {
      const norm = normalizeLossCallLog(l, leadRows.find((r) => r.id === l.lead_id));
      return norm.result === "follow_up" && Boolean(norm.reason?.trim());
    });
  }

  const windowLogRows = (windowLogs ?? []) as LossCallLogRow[];

  return aggregateLossFromData(
    windowLogRows,
    leadRows,
    recoverableLogs,
    windowStart,
    windowEnd
  );
}
