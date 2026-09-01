"use client";

import { Check, Circle, Loader2 } from "lucide-react";
import { cn } from "@/lib/ui/cn";
import type { DocumentProcessingStatus } from "@/lib/documents/types";

const STEPS: Array<{
  id: string;
  label: string;
  statuses: DocumentProcessingStatus[];
}> = [
  { id: "upload", label: "Uploaded", statuses: ["UPLOADED", "QUEUED", "EXTRACTING", "ANALYZING", "INDEXING", "READY", "NEEDS_REVIEW", "FAILED"] },
  { id: "queue", label: "Queued for analysis", statuses: ["QUEUED", "EXTRACTING", "ANALYZING", "INDEXING", "READY", "NEEDS_REVIEW", "FAILED"] },
  { id: "extract", label: "Text extraction", statuses: ["EXTRACTING", "ANALYZING", "INDEXING", "READY", "NEEDS_REVIEW", "FAILED"] },
  { id: "analyze", label: "Classification & intelligence", statuses: ["ANALYZING", "INDEXING", "READY", "NEEDS_REVIEW", "FAILED"] },
  { id: "index", label: "Indexing & CRM linking", statuses: ["INDEXING", "READY", "NEEDS_REVIEW", "FAILED"] },
  { id: "complete", label: "Complete", statuses: ["READY", "NEEDS_REVIEW", "FAILED"] },
];

function stepState(
  stepIndex: number,
  currentIndex: number,
  status: DocumentProcessingStatus
): "done" | "active" | "pending" | "failed" {
  if (status === "FAILED" && stepIndex === currentIndex) return "failed";
  if (stepIndex < currentIndex) return "done";
  if (stepIndex === currentIndex) return status === "FAILED" ? "failed" : "active";
  return "pending";
}

function currentStepIndex(status: DocumentProcessingStatus): number {
  if (status === "UPLOADED") return 0;
  if (status === "QUEUED") return 1;
  if (status === "EXTRACTING") return 2;
  if (status === "ANALYZING") return 3;
  if (status === "INDEXING") return 4;
  if (status === "READY" || status === "NEEDS_REVIEW" || status === "FAILED") return 5;
  return 0;
}

export function DocumentProcessingTimeline({
  status,
  className,
}: {
  status: DocumentProcessingStatus | string;
  className?: string;
}) {
  const processingStatus = status as DocumentProcessingStatus;
  const activeIndex = currentStepIndex(processingStatus);
  const isProcessing = ["UPLOADED", "QUEUED", "EXTRACTING", "ANALYZING", "INDEXING"].includes(
    processingStatus
  );

  return (
    <ol className={cn("space-y-0", className)}>
      {STEPS.map((step, index) => {
        const state = stepState(index, activeIndex, processingStatus);
        const reached = step.statuses.includes(processingStatus);

        return (
          <li key={step.id} className="relative flex gap-3 pb-4 last:pb-0">
            {index < STEPS.length - 1 ? (
              <span
                className={cn(
                  "absolute left-[11px] top-6 h-[calc(100%-12px)] w-px",
                  state === "done" || (state === "active" && index < activeIndex)
                    ? "bg-sales-brand"
                    : "bg-sales-border-subtle"
                )}
              />
            ) : null}
            <span
              className={cn(
                "relative z-[1] flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2",
                state === "done" && "border-sales-brand bg-sales-brand text-white",
                state === "active" && "border-sales-brand bg-sales-brand-soft text-sales-brand-fg",
                state === "pending" && "border-sales-border bg-sales-surface text-sales-text-muted",
                state === "failed" && "border-sales-danger bg-sales-danger-soft text-sales-danger-fg"
              )}
            >
              {state === "done" ? (
                <Check size={12} strokeWidth={2.5} />
              ) : state === "active" && isProcessing ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                <Circle size={8} fill="currentColor" strokeWidth={0} />
              )}
            </span>
            <div className="min-w-0 pt-0.5">
              <p
                className={cn(
                  "text-[13px] font-medium",
                  reached ? "text-sales-text-primary" : "text-sales-text-muted"
                )}
              >
                {step.label}
              </p>
              {state === "active" && processingStatus === "NEEDS_REVIEW" && index === 5 ? (
                <p className="mt-0.5 text-[12px] text-sales-warning-fg">Needs review</p>
              ) : state === "active" && processingStatus === "READY" && index === 5 ? (
                <p className="mt-0.5 text-[12px] text-sales-text-secondary">Ready for use</p>
              ) : state === "failed" ? (
                <p className="mt-0.5 text-[12px] text-sales-danger-fg">Failed</p>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
