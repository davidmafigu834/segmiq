"use client";

import { Info, RefreshCw } from "lucide-react";

export function ReportFooterStrip({
  lastUpdated,
  onRefresh,
  refreshing,
  scopeNote,
}: {
  lastUpdated: Date | null;
  onRefresh: () => void;
  refreshing?: boolean;
  scopeNote?: string | null;
}) {
  const stamp = formatUpdated(lastUpdated);
  return (
    <div className="flex flex-col gap-2 rounded-[12px] border border-sales-border bg-sales-surface px-4 py-2.5 text-[12px] text-sales-text-muted sm:flex-row sm:items-center sm:justify-between">
      <p className="inline-flex min-w-0 items-start gap-2 sm:items-center">
        <Info size={14} strokeWidth={1.8} className="mt-0.5 shrink-0 sm:mt-0" aria-hidden />
        <span>
          All data is filtered by the selected date range and your company scope.
          {scopeNote ? ` ${scopeNote}` : ""}
        </span>
      </p>
      <div className="flex shrink-0 items-center gap-2">
        <span>Last updated: {stamp}</span>
        <button
          type="button"
          onClick={onRefresh}
          aria-label="Refresh report"
          className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-sales-border text-sales-text-secondary hover:bg-sales-surface-hover hover:text-sales-text-primary"
        >
          <RefreshCw size={13} strokeWidth={1.8} className={refreshing ? "animate-spin" : undefined} />
        </button>
      </div>
    </div>
  );
}

function formatUpdated(d: Date | null): string {
  if (!d) return "—";
  const now = new Date();
  if (now.getTime() - d.getTime() < 45_000) return "Updated just now";
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  const time = d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  return sameDay ? `Today, ${time}` : `${d.toLocaleDateString(undefined, { month: "short", day: "numeric" })}, ${time}`;
}
