/**
 * Central chart value formatting — use in chart tooltips, axes, and legends.
 * Do not duplicate toLocaleString() across chart components.
 */

import { formatDealCurrency, formatPercent, formatSalesDateLong } from "@/lib/sales/format";

export function formatChartNumber(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value);
}

export function formatChartCompact(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  const abs = Math.abs(value);
  if (abs >= 1_000_000) {
    const v = value / 1_000_000;
    return `${v >= 10 ? Math.round(v) : v.toFixed(1).replace(/\.0$/, "")}M`;
  }
  if (abs >= 1000) {
    const v = value / 1000;
    return `${v >= 10 ? Math.round(v) : v.toFixed(1).replace(/\.0$/, "")}K`;
  }
  return formatChartNumber(value);
}

export function formatChartCurrency(
  value: number | null | undefined,
  opts?: { currency?: string | null; compact?: boolean }
): string {
  if (value == null || !Number.isFinite(value)) return "—";
  if (opts?.compact) {
    const prefix =
      !opts.currency || opts.currency === "USD"
        ? "$"
        : opts.currency === "ZAR"
          ? "ZAR "
          : `${opts.currency} `;
    return `${prefix}${formatChartCompact(value)}`;
  }
  return formatDealCurrency(value, { currency: opts?.currency });
}

export function formatChartPercent(value: number | null | undefined, decimals = 0): string {
  if (value == null || !Number.isFinite(value)) return "—";
  if (decimals === 0) return formatPercent(value);
  return `${value.toFixed(decimals)}%`;
}

/** Compact axis label — pass ISO date or preformatted short label. */
export function formatChartAxisLabel(label: string): string {
  const d = new Date(label);
  if (!Number.isNaN(d.getTime()) && label.includes("-")) {
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }
  return label;
}

export function formatChartTooltipDate(label: string): string {
  const d = new Date(label);
  if (!Number.isNaN(d.getTime()) && label.includes("-")) {
    return formatSalesDateLong(d);
  }
  return label;
}

export function humanizeChartSeriesName(name: string): string {
  if (!name) return "";
  if (name === name.toUpperCase() && /[A-Z_]/.test(name)) {
    return name
      .replace(/_/g, " ")
      .toLowerCase()
      .replace(/\b\w/g, (c) => c.toUpperCase());
  }
  return name;
}
