/**
 * Central salesperson display formatters.
 * Never expose raw enums or invent missing money as $0 unless zero is stored.
 */

import { format, formatDistanceToNowStrict, isToday, isTomorrow, isYesterday } from "date-fns";
import type { LeadStatus } from "@/types";

export const STAGE_LABELS: Record<string, string> = {
  NEW: "New",
  CONTACTED: "Contacted",
  NEGOTIATING: "Negotiating",
  PROPOSAL_SENT: "Proposal sent",
  WON: "Won",
  LOST: "Lost",
  NOT_QUALIFIED: "Not qualified",
  QUALIFIED: "Qualified",
};

export function formatStageLabel(status: string | null | undefined): string {
  if (!status) return "—";
  return (
    STAGE_LABELS[status] ??
    status.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())
  );
}

export function formatDealCurrency(
  value: number | null | undefined,
  opts?: { currency?: string | null; compact?: boolean; zeroAsUnset?: boolean }
): string {
  if (value == null || !Number.isFinite(value)) return "Value not set";
  if (value === 0 && opts?.zeroAsUnset) return "Value not set";
  if (value === 0) return opts?.currency ? formatMoney(0, opts.currency) : "$0";

  if (opts?.compact && Math.abs(value) >= 1000) {
    const k = Math.round(value / 1000);
    const prefix = currencyPrefix(opts.currency);
    return `${prefix}${k}k`;
  }

  return formatMoney(Math.round(value), opts?.currency);
}

function currencyPrefix(currency?: string | null): string {
  if (!currency || currency === "USD") return "$";
  if (currency === "ZAR") return "ZAR ";
  return `${currency} `;
}

function formatMoney(amount: number, currency?: string | null): string {
  const code = currency || "USD";
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: code,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${currencyPrefix(currency)}${amount.toLocaleString("en-US")}`;
  }
}

export function formatPercent(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return `${Math.round(value)}%`;
}

export function formatRelativeTime(iso: string | Date | null | undefined): string {
  if (!iso) return "—";
  const d = typeof iso === "string" ? new Date(iso) : iso;
  if (Number.isNaN(d.getTime())) return "—";
  return formatDistanceToNowStrict(d, { addSuffix: true });
}

export function formatSalesDate(iso: string | Date | null | undefined): string {
  if (!iso) return "—";
  const d = typeof iso === "string" ? new Date(iso) : iso;
  if (Number.isNaN(d.getTime())) return "—";
  if (isToday(d)) return `Today, ${format(d, "HH:mm")}`;
  if (isTomorrow(d)) return `Tomorrow, ${format(d, "HH:mm")}`;
  if (isYesterday(d)) return `Yesterday, ${format(d, "HH:mm")}`;
  return format(d, "EEE, d MMM");
}

export function formatSalesDateLong(iso: string | Date | null | undefined): string {
  if (!iso) return "—";
  const d = typeof iso === "string" ? new Date(iso) : iso;
  if (Number.isNaN(d.getTime())) return "—";
  return format(d, "d MMM yyyy");
}

export type LeadScoreBand = "hot" | "warm" | "cold";

export function leadScoreBand(score: number | null | undefined): LeadScoreBand | null {
  if (score == null || !Number.isFinite(score)) return null;
  if (score >= 70) return "hot";
  if (score >= 45) return "warm";
  return "cold";
}

export function leadScoreLabel(score: number | null | undefined): string | null {
  const band = leadScoreBand(score);
  if (!band) return null;
  if (band === "hot") return "Hot";
  if (band === "warm") return "Warm";
  return "Cold";
}

export function isClosedStage(status: LeadStatus | string): boolean {
  return status === "WON" || status === "LOST" || status === "NOT_QUALIFIED";
}

/** Re-export friendly aliases used by older modules. */
export { formatDealCurrency as formatDealValue };
