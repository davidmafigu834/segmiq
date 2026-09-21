import { formatMoney, formatMoneyCompact } from "@/lib/quotations/totals";
import type {
  ComparedMetric,
  WeeklyReportListItem,
  WeeklyReportStatus,
} from "@/lib/sales/weekly-team-report/types";

export function formatMetricValue(metric: ComparedMetric, currency: string): string {
  if (metric.current == null) return "n/a";
  if (metric.format === "money") return formatMoney(metric.current, currency);
  if (metric.format === "minutes") {
    if (metric.current < 60) return `${Math.round(metric.current)}m`;
    return `${(metric.current / 60).toFixed(1)}h`;
  }
  if (metric.format === "percent") return `${metric.current}%`;
  return String(Math.round(metric.current));
}

export function formatCompactMoney(value: number | null, currency: string): string {
  if (value == null) return "—";
  if (Math.abs(value) >= 1000) {
    const compact = value / 1000;
    const label = compact >= 10 ? compact.toFixed(0) : compact.toFixed(1);
    const prefix =
      currency === "USD" ? "$" : currency === "ZAR" ? "R" : currency === "BWP" ? "P" : `${currency} `;
    return `${prefix}${label}k`;
  }
  return formatMoneyCompact(value, currency);
}

export function trendTone(metric: ComparedMetric): "positive" | "negative" | "neutral" {
  const direction = metric.trend.direction;
  if (direction !== "up" && direction !== "down") return "neutral";
  const improved = metric.invertGood ? direction === "down" : direction === "up";
  return improved ? "positive" : "negative";
}

export function findMetric(metrics: ComparedMetric[], id: string): ComparedMetric | undefined {
  return metrics.find((metric) => metric.id === id);
}

export function generatedLabel(iso: string | null): string {
  if (!iso) return "Not generated yet";
  return new Date(iso).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function generatedLongLabel(iso: string | null): string {
  if (!iso) return "Not generated yet";
  return new Date(iso).toLocaleString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function isGenerating(status: WeeklyReportStatus): boolean {
  return status === "scheduled" || status === "collecting_data" || status === "analysing" || status === "generating";
}

export function generationStepLabel(status: WeeklyReportStatus): string {
  if (status === "collecting_data" || status === "scheduled") return "Collecting team activity";
  if (status === "analysing") return "Analysing sales performance";
  if (status === "generating") return "Preparing recommendations";
  return "Building report";
}

export const GENERATION_STEPS = [
  { id: "collecting_data", label: "Collecting team activity" },
  { id: "analysing", label: "Analysing sales performance" },
  { id: "generating", label: "Preparing recommendations" },
] as const;

export function generationStepIndex(status: WeeklyReportStatus): number {
  if (status === "analysing") return 1;
  if (status === "generating") return 2;
  return 0;
}

export function friendlyGenerationError(raw: string | null | undefined): string {
  if (!raw) return "SegmiQ could not finish compiling this week's report.";
  if (/storage|R2|file/i.test(raw)) return "The PDF could not be stored. You can try again.";
  if (/pdf/i.test(raw)) return "The document could not be built. You can try again.";
  return "SegmiQ could not finish compiling this week's report.";
}

export function teamResultLabel(report: WeeklyReportListItem): string {
  if (report.status !== "ready") return report.status === "failed" ? "Not finished" : "In progress";
  const won = report.dealsWon == null ? null : `${report.dealsWon} won`;
  const revenue = report.revenueWon == null ? null : formatCompactMoney(report.revenueWon, report.currency);
  return [won, revenue].filter(Boolean).join(" · ") || "Activity recorded";
}

export function pdfUrl(reportId: string, inline = false): string {
  return `/api/reports/weekly/${reportId}/pdf${inline ? "?inline=1" : ""}`;
}

export function dealHref(dealId: string): string {
  return `/client/deals/${dealId}`;
}

export const METRIC_HELP: Record<string, string> = {
  new_leads: "New customer enquiries created during the reporting week.",
  contacted_leads: "New enquiries that received a first salesperson contact.",
  qualified_leads: "New enquiries that reached a qualified stage.",
  deals_created: "Opportunities created during the week.",
  quotations_sent: "Quotations delivered to customers during the week.",
  quotations_accepted: "Quotations marked accepted during the week.",
  deals_won: "Opportunities marked won during the week.",
  deals_lost: "Opportunities marked lost during the week.",
  revenue_won: "Recorded won value for deals closed during the week.",
  pipeline_value: "Current value of active opportunities. This is a snapshot, not a week-over-week change.",
  avg_first_response: "Time between a new enquiry and the first salesperson response.",
  follow_ups_completed: "Follow-up tasks completed during the week.",
  follow_ups_missed: "Scheduled follow-ups that became overdue during the week.",
  overdue_tasks: "Open tasks that were overdue at week close.",
  appointments: "Recorded appointments and viewings in the week.",
  conversion_rate: "Won deals as a share of new leads in the week.",
  quote_to_win: "Won deals as a share of quotations sent in the week.",
};
