"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/ui/cn";

export type StepperStepStatus = "completed" | "current" | "upcoming" | "error";

export type StepperStep = {
  id: string;
  label: string;
  status: StepperStepStatus;
};

export function Stepper({
  steps,
  className,
  "aria-label": ariaLabel = "Progress",
}: {
  steps: StepperStep[];
  className?: string;
  "aria-label"?: string;
}) {
  return (
    <ol className={cn("flex w-full items-start", className)} aria-label={ariaLabel}>
      {steps.map((step, index) => {
        const isLast = index === steps.length - 1;
        const isCurrent = step.status === "current";
        const isCompleted = step.status === "completed";
        const isError = step.status === "error";

        return (
          <li
            key={step.id}
            className={cn("flex min-w-0 flex-1 flex-col items-center", isLast ? "flex-none" : "")}
            aria-current={isCurrent ? "step" : undefined}
          >
            <div className="flex w-full items-center">
              <span
                className={cn(
                  "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold transition-colors",
                  isCompleted && "border-sales-success bg-sales-success-soft text-sales-success",
                  isCurrent && "border-sales-brand bg-sales-brand text-sales-text-on-brand",
                  isError && "border-sales-danger bg-sales-danger-soft text-sales-danger",
                  step.status === "upcoming" &&
                    "border-sales-border bg-sales-surface-subtle text-sales-text-muted"
                )}
              >
                {isCompleted ? <Check size={14} strokeWidth={2.2} aria-hidden /> : index + 1}
              </span>
              {!isLast ? (
                <span
                  className={cn(
                    "mx-2 h-px min-w-[12px] flex-1",
                    isCompleted ? "bg-sales-success/60" : "bg-sales-border"
                  )}
                  aria-hidden
                />
              ) : null}
            </div>
            <span
              className={cn(
                "mt-2 max-w-[88px] text-center text-[11px] leading-tight sm:max-w-none sm:text-[12px]",
                isCurrent && "font-semibold text-sales-text-primary",
                isCompleted && "text-sales-text-secondary",
                isError && "font-medium text-sales-danger",
                step.status === "upcoming" && "text-sales-text-muted"
              )}
            >
              {step.label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
