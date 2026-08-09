/**
 * Shared closed-deal analytics helpers.
 * Win rate = won / (won + lost) — same formula as salesperson Reports conversionRate.
 */

import {
  eachMonthOfInterval,
  eachWeekOfInterval,
  format,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import type {
  ClosedDealRow,
  OutcomeReasonRow,
  WinLossTrendPoint,
  WonLostGranularity,
} from "./types";

/** Canonical win rate: won / (won + lost) × 100. Null when no closed deals. */
export function calculateWinRate(won: number, lost: number): number | null {
  const closed = won + lost;
  if (closed <= 0) return null;
  return Math.round((won / closed) * 100);
}

/** Sum deal values that are actually recorded (nulls excluded, not treated as 0). */
export function calculateRevenueWon(deals: Array<{ status: string; dealValue: number | null }>): {
  total: number | null;
  recordedCount: number;
} {
  const won = deals.filter((d) => d.status === "WON" && d.dealValue != null && Number.isFinite(d.dealValue));
  if (won.length === 0) return { total: null, recordedCount: 0 };
  return {
    total: won.reduce((s, d) => s + Number(d.dealValue), 0),
    recordedCount: won.length,
  };
}

export function calculateLostValue(deals: Array<{ status: string; dealValue: number | null }>): {
  total: number | null;
  recordedCount: number;
  lostCount: number;
} {
  const lost = deals.filter((d) => d.status === "LOST");
  const withValue = lost.filter((d) => d.dealValue != null && Number.isFinite(d.dealValue));
  if (withValue.length === 0) {
    return { total: null, recordedCount: 0, lostCount: lost.length };
  }
  return {
    total: withValue.reduce((s, d) => s + Number(d.dealValue), 0),
    recordedCount: withValue.length,
    lostCount: lost.length,
  };
}

/**
 * Group outcome reasons. Percentage = count / deals with a recorded reason.
 * Optionally include "No reason recorded" when missing data is material.
 */
export function groupOutcomeReasons(
  deals: Array<{ reason: string | null }>,
  opts?: { includeMissing?: boolean; maxRows?: number }
): { rows: OutcomeReasonRow[]; withReason: number; total: number } {
  const total = deals.length;
  const counts = new Map<string, number>();
  let withReason = 0;
  let missing = 0;

  for (const d of deals) {
    const r = (d.reason ?? "").trim();
    if (!r) {
      missing += 1;
      continue;
    }
    withReason += 1;
    counts.set(r, (counts.get(r) ?? 0) + 1);
  }

  const denom = withReason > 0 ? withReason : 0;
  const rows: OutcomeReasonRow[] = Array.from(counts.entries())
    .map(([reason, count]) => ({
      reason,
      count,
      pct: denom === 0 ? 0 : Math.round((count / denom) * 100),
    }))
    .sort((a, b) => b.count - a.count || a.reason.localeCompare(b.reason));

  if (opts?.includeMissing && missing > 0 && total > 0) {
    rows.push({
      reason: "No reason recorded",
      count: missing,
      pct: Math.round((missing / total) * 100),
    });
  }

  const max = opts?.maxRows ?? 8;
  return { rows: rows.slice(0, max), withReason, total };
}

export function groupOutcomesByPeriod(
  deals: Array<{ status: string; closeDate: string }>,
  range: { from: Date; to: Date },
  granularity: WonLostGranularity
): WinLossTrendPoint[] {
  const buckets =
    granularity === "monthly"
      ? eachMonthOfInterval({
          start: startOfMonth(range.from),
          end: new Date(Math.max(range.from.getTime(), range.to.getTime() - 1)),
        })
      : eachWeekOfInterval(
          {
            start: startOfWeek(range.from, { weekStartsOn: 1 }),
            end: new Date(Math.max(range.from.getTime(), range.to.getTime() - 1)),
          },
          { weekStartsOn: 1 }
        );

  const map = new Map<string, { won: number; lost: number; start: Date }>();
  for (const b of buckets) {
    const key = b.toISOString();
    map.set(key, { won: 0, lost: 0, start: b });
  }

  for (const d of deals) {
    const close = new Date(d.closeDate);
    if (Number.isNaN(close.getTime())) continue;
    const bucketStart =
      granularity === "monthly"
        ? startOfMonth(close)
        : startOfWeek(close, { weekStartsOn: 1 });
    const key = bucketStart.toISOString();
    const entry = map.get(key);
    if (!entry) continue;
    if (d.status === "WON") entry.won += 1;
    else if (d.status === "LOST") entry.lost += 1;
  }

  return Array.from(map.values()).map((b) => ({
    label:
      granularity === "monthly"
        ? format(b.start, "MMM yyyy")
        : format(b.start, "MMM d"),
    periodStart: b.start.toISOString(),
    won: b.won,
    lost: b.lost,
  }));
}

export function dealMatchesSearch(deal: ClosedDealRow, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const hay = [
    deal.name,
    deal.phone,
    deal.email,
    deal.projectType,
    deal.reason,
    deal.sourceLabel,
    deal.note,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return hay.includes(q);
}

export function formatOutcomeReason(raw: string | null | undefined): string {
  const t = (raw ?? "").trim();
  if (!t) return "—";
  // Already human labels from call-log constants; avoid SCREAMING_SNAKE display
  if (/^[A-Z0-9_]+$/.test(t)) {
    return t
      .replace(/_/g, " ")
      .toLowerCase()
      .replace(/\b\w/g, (c) => c.toUpperCase());
  }
  return t;
}

export function formatCloseDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return format(d, "MMM d, yyyy");
}

export function initialsFromName(name: string | null | undefined): string {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
}
