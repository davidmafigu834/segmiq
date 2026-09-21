"use client";

import { cn } from "@/lib/ui/cn";
import type { WeeklyReportStatus } from "@/lib/sales/weekly-team-report/types";
import { generationStepIndex, generationStepLabel, GENERATION_STEPS, isGenerating } from "./format";

export function ReadyIndicator({ label = "Weekly report ready" }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-2 text-[12px] font-medium text-sales-text-secondary">
      <span className="weekly-report-ready-dot h-1.5 w-1.5 rounded-full" aria-hidden />
      <span className="flex h-4 w-4 items-center justify-center rounded-[4px] bg-sales-brand text-[9px] font-bold text-[var(--sales-ink)]">
        Q
      </span>
      {label}
    </span>
  );
}

export function GenerationProgress({ status }: { status: WeeklyReportStatus }) {
  const active = generationStepIndex(status);
  return (
    <div>
      <p className="text-[13px] font-medium text-sales-text-primary">
        SegmiQ is analysing last week’s team activity.
      </p>
      <p className="mt-1 text-[12px] text-sales-text-muted">{generationStepLabel(status)}</p>
      <ol className="mt-3 space-y-1.5">
        {GENERATION_STEPS.map((step, index) => {
          const done = index < active;
          const current = index === active;
          return (
            <li key={step.id} className="flex items-center gap-2 text-[12px] text-sales-text-muted">
              <span
                className={cn(
                  "h-1.5 w-1.5 rounded-full",
                  current && "weekly-report-pulse bg-sales-brand",
                  done && "bg-sales-text-primary",
                  !current && !done && "bg-sales-border"
                )}
                aria-hidden
              />
              <span className={cn(current && "font-medium text-sales-text-primary")}>{step.label}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

export function StatusLabel({ status }: { status: WeeklyReportStatus }) {
  if (status === "ready") return <span className="text-[12px] text-sales-text-muted">Ready</span>;
  if (status === "failed") return <span className="text-[12px] text-sales-danger-fg">Could not finish</span>;
  if (isGenerating(status)) return <span className="text-[12px] text-sales-text-secondary">Generating</span>;
  return <span className="text-[12px] text-sales-text-muted">{status.replace(/_/g, " ")}</span>;
}
