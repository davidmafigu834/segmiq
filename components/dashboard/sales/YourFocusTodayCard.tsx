"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, RefreshCw } from "lucide-react";
import type { SalesAttentionItem, TodaysFocusPayload } from "@/lib/sales/attention/types";
import { attentionTypeLabel, priorityClassLabel } from "@/lib/sales/attention/priority";
import { cn } from "@/lib/ui/cn";

function PriorityDot({ cls }: { cls: SalesAttentionItem["priorityClass"] }) {
  const tone =
    cls === "IMMEDIATE"
      ? "bg-sales-danger"
      : cls === "TODAY"
        ? "bg-sales-warning"
        : cls === "NEEDS_PROGRESS"
          ? "bg-sales-text-muted"
          : "bg-sales-border-strong";
  return <span className={cn("mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full", tone)} aria-hidden />;
}

function FocusRow({ item, index }: { item: SalesAttentionItem; index: number }) {
  const primary = item.actions.find((a) => a.primary) ?? item.actions[0];
  return (
    <div className="flex gap-3 border-t border-sales-border/70 py-3 first:border-t-0 first:pt-0 last:pb-0">
      <PriorityDot cls={item.priorityClass} />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="text-[11px] font-semibold tabular-nums text-sales-text-muted">
            {String(index + 1).padStart(2, "0")}
          </span>
          <span className="text-[10px] font-semibold uppercase tracking-[0.06em] text-sales-text-muted">
            {attentionTypeLabel(item.type)}
          </span>
        </div>
        <p className="mt-0.5 truncate text-[13px] font-semibold text-sales-text-primary">
          {item.customerName || item.title}
        </p>
        <p className="mt-0.5 truncate text-[12px] text-sales-text-secondary">{item.whyNow}</p>
      </div>
      {primary?.href || primary?.prompt ? (
        primary.href ? (
          <Link
            href={primary.href}
            className="shrink-0 self-center text-[12px] font-semibold text-sales-brand-fg hover:underline"
          >
            {primary.label} →
          </Link>
        ) : (
          <Link
            href={`/sales/command?view=focus&prompt=${encodeURIComponent(primary.prompt || "")}`}
            className="shrink-0 self-center text-[12px] font-semibold text-sales-brand-fg hover:underline"
          >
            {primary.label} →
          </Link>
        )
      ) : null}
    </div>
  );
}

export function YourFocusTodayCard() {
  const [data, setData] = useState<TodaysFocusPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await fetch("/api/sales/attention/focus?limit=3");
      if (!res.ok) throw new Error("failed");
      const json = (await res.json()) as TodaysFocusPayload;
      setData(json);
    } catch {
      setError(true);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading && !data) {
    return (
      <div className="dashboard-panel dashboard-panel--attention overflow-hidden border-0 p-5 shadow-none">
        <p className="dashboard-focus-kicker">Your focus today</p>
        <div className="mt-3 space-y-2">
          <div className="shimmer h-4 w-2/3 rounded" />
          <div className="shimmer h-10 rounded" />
          <div className="shimmer h-10 rounded" />
        </div>
      </div>
    );
  }

  if (error || data?.planError) {
    return (
      <div className="dashboard-panel dashboard-panel--attention overflow-hidden border-0 p-5 shadow-none">
        <p className="dashboard-focus-kicker">Your focus today</p>
        <p className="mt-2 text-[13px] text-sales-text-secondary">
          Today&apos;s Focus couldn&apos;t be refreshed. Your CRM records are unchanged.
        </p>
        <button
          type="button"
          onClick={() => void load()}
          className="mt-3 inline-flex min-h-11 items-center gap-1.5 text-[13px] font-semibold text-sales-brand-fg hover:underline"
        >
          <RefreshCw size={14} aria-hidden /> Try again
        </button>
      </div>
    );
  }

  if (!data || data.empty) {
    return (
      <div className="dashboard-panel dashboard-panel--attention overflow-hidden border-0 p-5 shadow-none">
        <p className="dashboard-focus-kicker">Your focus today</p>
        <p className="mt-2 text-[15px] font-semibold text-sales-text-primary">You&apos;re clear for now</p>
        <p className="mt-1.5 text-[13px] leading-relaxed text-sales-text-secondary">
          {data?.emptyMessage ||
            "No follow-ups, commitments, or mid-thread replies due. Unread WhatsApp stays in WhatsApp."}
        </p>
        <Link
          href="/sales/pipeline"
          className="mt-3 inline-flex min-h-11 items-center gap-1 text-[13px] font-semibold text-sales-brand-fg hover:underline"
        >
          Open my Deals <ArrowRight size={14} aria-hidden />
        </Link>
      </div>
    );
  }

  const { summary, items, newEnquiries } = data;
  const enquiryCount = newEnquiries?.length ?? 0;
  const chips = [
    summary.immediate > 0 ? `${summary.immediate} waiting / immediate` : null,
    summary.today > 0 ? `${summary.today} today` : null,
    summary.needsProgress > 0 ? `${summary.needsProgress} need progress` : null,
    enquiryCount > 0 ? `${enquiryCount} new to draft` : null,
  ].filter(Boolean);

  return (
    <div
      data-course-target="dashboard-your-focus-today"
      className="dashboard-panel dashboard-panel--attention overflow-hidden border-0 shadow-none"
    >
      <div className="flex flex-col gap-1 p-5 sm:flex-row sm:items-start sm:justify-between sm:px-6">
        <div className="min-w-0">
          <p className="dashboard-focus-kicker">Your focus today</p>
          <p className="mt-2 text-[18px] font-semibold tracking-tight text-sales-text-primary">
            {summary.total === 0
              ? enquiryCount > 0
                ? "New enquiries ready to draft"
                : "You're clear for now"
              : `${summary.total} priorit${summary.total === 1 ? "y" : "ies"} need attention`}
          </p>
          {chips.length ? (
            <p className="mt-1.5 text-[12px] text-sales-text-muted">{chips.join(" · ")}</p>
          ) : null}
        </div>
        <Link
          href="/sales/command?view=focus"
          className="mt-2 inline-flex min-h-10 shrink-0 items-center gap-1 rounded-[8px] bg-sales-brand px-3 text-[12px] font-semibold text-sales-brand-fg sm:mt-0"
        >
          {summary.total > 0 ? "Start my day" : "Draft replies"} <ArrowRight size={14} aria-hidden />
        </Link>
      </div>
      <div className="border-t border-sales-border px-5 pb-4 sm:px-6">
        {items.map((item, i) => (
          <FocusRow key={item.id} item={item} index={i} />
        ))}
        {summary.total === 0 && enquiryCount > 0 ? (
          <p className="py-2 text-[13px] text-sales-text-secondary">
            {enquiryCount} uncontacted enquir{enquiryCount === 1 ? "y" : "ies"} — summarize & draft in
            Command, then click Send.
          </p>
        ) : null}
        <div className="mt-1 flex flex-wrap gap-2 pt-2">
          {(["IMMEDIATE", "TODAY", "NEEDS_PROGRESS", "WATCH"] as const).map((cls) => {
            const count =
              cls === "IMMEDIATE"
                ? summary.immediate
                : cls === "TODAY"
                  ? summary.today
                  : cls === "NEEDS_PROGRESS"
                    ? summary.needsProgress
                    : summary.watch;
            if (!count) return null;
            return (
              <span
                key={cls}
                className="rounded-[6px] border border-sales-border bg-sales-surface px-2 py-0.5 text-[11px] text-sales-text-secondary"
              >
                {priorityClassLabel(cls)} {count}
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
}
