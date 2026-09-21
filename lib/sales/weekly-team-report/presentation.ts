import type { ComparedMetric, ConversationReliability } from "./types";

export function countLabel(n: number, singular: string, pluralForm?: string): string {
  const plural = pluralForm ?? `${singular}s`;
  return `${n} ${n === 1 ? singular : plural}`;
}

export function formatPct(value: number): string {
  if (!Number.isFinite(value)) return "0%";
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? `${rounded}%` : `${rounded.toFixed(1)}%`;
}

export function formatReportMoney(amount: number, currency: string): string {
  const code = currency && /^[A-Z]{3}$/.test(currency) ? currency : "USD";
  if (!Number.isFinite(amount)) return `${code} 0`;
  const abs = Math.abs(amount);
  const rounded = Math.round(amount);
  const centsMatter = abs > 0 && abs < 1000 && Math.abs(amount - rounded) >= 0.005;
  const n = centsMatter ? amount.toFixed(2) : String(rounded);
  const withSep = n.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${code} ${withSep}`;
}

export function formatMinutes(minutes: number | null): string {
  if (minutes == null || !Number.isFinite(minutes)) return "n/a";
  if (minutes < 60) return `${Math.round(minutes)} min`;
  const hours = minutes / 60;
  if (hours < 10) {
    const rounded = Math.round(hours * 10) / 10;
    return `${Number.isInteger(rounded) ? rounded : rounded.toFixed(1)} h`;
  }
  return `${Math.round(hours)} h`;
}

export function formatDays(days: number | null): string | null {
  if (days == null || !Number.isFinite(days)) return null;
  const n = Math.round(days);
  return `${n} ${n === 1 ? "day" : "days"} inactive`;
}

export function formatMetricValue(metric: ComparedMetric, currency: string): string {
  if (metric.current == null || !Number.isFinite(metric.current)) return "n/a";
  if (metric.format === "money") return formatReportMoney(metric.current, currency);
  if (metric.format === "minutes") return formatMinutes(metric.current);
  if (metric.format === "percent") return formatPct(metric.current);
  return String(Math.round(metric.current));
}

export type ComparisonTone = "positive" | "negative" | "neutral";

export type MetricComparison = {
  arrow: string;
  text: string;
  qualifier: string;
  tone: ComparisonTone;
};

export function metricComparison(metric: ComparedMetric): MetricComparison {
  const invert = Boolean(metric.invertGood);
  const dir = metric.trend.direction;

  if (dir === "none") {
    return { arrow: "", text: metric.trend.label || "No prior comparison", qualifier: "", tone: "neutral" };
  }
  if (dir === "flat") {
    return { arrow: "", text: "No change vs last week", qualifier: "Unchanged", tone: "neutral" };
  }
  if (dir === "new") {
    return { arrow: "", text: "New this week", qualifier: "", tone: "neutral" };
  }

  const improved = invert ? dir === "down" : dir === "up";
  const arrow = dir === "up" ? "↑" : "↓";
  const absPct = metric.trend.pct == null ? null : Math.abs(metric.trend.pct);
  const qualifier = improved ? "Improved" : "Weakened";
  const tone: ComparisonTone = improved ? "positive" : "negative";

  if (metric.format === "minutes" && metric.delta != null && metric.delta !== 0) {
    const mins = Math.abs(Math.round(metric.delta));
    return {
      arrow,
      text: improved ? `Improved by ${mins} min` : `Slowed by ${mins} min`,
      qualifier,
      tone,
    };
  }

  if (absPct != null) {
    return {
      arrow,
      text: `${formatPct(absPct)} ${dir === "up" ? "higher" : "lower"} vs last week`,
      qualifier,
      tone,
    };
  }

  return { arrow, text: metric.trend.label, qualifier, tone };
}

export function conversationReliability(count: number): ConversationReliability {
  if (count <= 1) return "Low sample";
  if (count <= 3) return "Emerging";
  if (count <= 7) return "Recurring";
  return "Reliable pattern";
}

export function conversationInterpretation(label: string, count: number): string {
  if (count <= 1) return "Not enough volume yet to establish a reliable pattern.";
  if (count <= 3) return `Review ${label.toLowerCase()} in the weekly meeting.`;
  return "Review in the weekly meeting.";
}

const CONTROL =
  /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F\uFFFD\uFFFE\uFFFF]/g;
const INVISIBLE = /[\u200B-\u200F\u202A-\u202E\u2060-\u2064\uFEFF]/g;
const EMOJI = /\p{Extended_Pictographic}/gu;

export function sanitizePdfText(value: string | null | undefined, fallback = ""): string {
  if (value == null) return fallback;
  const cleaned = value
    .normalize("NFC")
    .replace(CONTROL, "")
    .replace(INVISIBLE, "")
    .replace(EMOJI, "")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned || fallback;
}

export function finiteNumber(value: unknown, fallback = 0): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export function finitePct(value: unknown): number {
  const n = finiteNumber(value, 0);
  if (n < 0) return 0;
  return n;
}

export function personMetric(personMetrics: ComparedMetric[], id: string): ComparedMetric | null {
  return personMetrics.find((metric) => metric.id === id) ?? null;
}

export function splitCoverTitle(title: string): string[] {
  if (/^weekly sales performance report$/i.test(title.trim())) {
    return ["Weekly Sales", "Performance Report"];
  }
  return [title];
}
