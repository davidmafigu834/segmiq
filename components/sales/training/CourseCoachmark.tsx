"use client";

import { useMemo } from "react";
import type { CourseStep } from "@/lib/sales/training/types";
import { canManualAdvance } from "@/lib/sales/training/engine";
import { useGuidedCourse } from "./GuidedCourseProvider";
import { Button } from "@/components/sales/ui/Button";
import { cn } from "@/lib/ui/cn";

function placeCoachmark(
  rect: DOMRect | null,
  placement: CourseStep["placement"],
  isMobile: boolean
): React.CSSProperties {
  if (isMobile) {
    return {};
  }
  const width = 340;
  const gap = 14;
  if (!rect || placement === "center") {
    return {
      position: "fixed",
      left: "50%",
      top: "50%",
      transform: "translate(-50%, -50%)",
      width,
    };
  }

  const prefer = placement === "auto" ? "bottom" : placement ?? "bottom";
  let top = rect.bottom + gap;
  let left = rect.left + rect.width / 2 - width / 2;

  if (prefer === "top") top = rect.top - gap - 200;
  if (prefer === "left") {
    top = rect.top;
    left = rect.left - width - gap;
  }
  if (prefer === "right") {
    top = rect.top;
    left = rect.right + gap;
  }

  // Clamp to viewport
  left = Math.min(Math.max(12, left), window.innerWidth - width - 12);
  top = Math.min(Math.max(12, top), window.innerHeight - 220);

  return { position: "fixed", top, left, width };
}

export function CourseCoachmark({
  step,
  rect,
  targetMissing,
  overlayNudge,
}: {
  step: CourseStep;
  rect: DOMRect | null;
  targetMissing?: boolean;
  overlayNudge?: boolean;
}) {
  const {
    isMobile,
    stepProgress,
    next,
    back,
    pause,
    exit,
    skipCurrentLesson,
  } = useGuidedCourse();

  const style = useMemo(
    () => placeCoachmark(rect, step.placement, isMobile),
    [rect, step.placement, isMobile]
  );

  const showNext = canManualAdvance(step);
  const cue = step.requiredAction?.cue;

  const body = (
    <>
      {step.label ? (
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-sales-text-muted">
          {step.label}
        </p>
      ) : null}
      <h2 className="mt-1 text-[17px] font-semibold leading-snug tracking-[-0.02em] text-sales-text-primary">
        {step.title}
      </h2>
      <p className="mt-2 text-[13px] leading-relaxed text-sales-text-secondary">
        {step.description}
      </p>

      {targetMissing ? (
        <p className="mt-3 rounded-[10px] border border-sales-border bg-sales-surface-subtle px-3 py-2 text-[12px] text-sales-text-secondary">
          We couldn&apos;t find this UI element. You can retry after the page loads, or pause the
          course and keep working.
        </p>
      ) : null}

      {cue && !showNext ? (
        <p className="mt-3 text-[13px] font-semibold text-sales-text-primary">{cue}</p>
      ) : null}

      {overlayNudge ? (
        <p className="mt-2 text-[12px] text-sales-warning-fg" role="status">
          Complete the highlighted action to continue.
        </p>
      ) : null}

      <div className="mt-4 flex items-center justify-between gap-2">
        <p className="text-[11px] tabular-nums text-sales-text-muted">
          {stepProgress.index} of {stepProgress.total}
        </p>
        <div className="flex flex-wrap items-center justify-end gap-1.5">
          <Button variant="ghost" size="sm" onClick={back} type="button">
            Back
          </Button>
          <Button variant="ghost" size="sm" onClick={pause} type="button">
            Pause
          </Button>
          {showNext ? (
            <Button variant="primary" size="sm" onClick={next} type="button">
              {step.type === "COMPLETE" ? "Continue" : step.type === "PRACTICE" ? "Start practice" : "Continue"}
            </Button>
          ) : null}
        </div>
      </div>

      <div className="mt-2 flex justify-end gap-2">
        <button
          type="button"
          className="text-[11px] text-sales-text-muted hover:text-sales-text-secondary"
          onClick={skipCurrentLesson}
        >
          Skip lesson
        </button>
        <button
          type="button"
          className="text-[11px] text-sales-text-muted hover:text-sales-text-secondary"
          onClick={exit}
        >
          Exit (progress saved)
        </button>
      </div>
    </>
  );

  if (isMobile) {
    return (
      <div
        role="dialog"
        aria-modal="false"
        aria-label={step.title}
        className={cn(
          "sales-modal-premium fixed inset-x-0 bottom-0 z-[var(--sales-z-course-coach,92)]",
          "rounded-t-[16px] border border-sales-border bg-sales-surface px-4 pb-[calc(12px+env(safe-area-inset-bottom,0px))] pt-3 shadow-sales-modal"
        )}
        style={{ backgroundColor: "var(--sales-surface, #FFFFFF)" }}
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-sales-border" aria-hidden />
        {body}
      </div>
    );
  }

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-label={step.title}
      className="sales-modal-premium z-[var(--sales-z-course-coach,92)] workspace-card rounded-[14px] border border-sales-border bg-sales-surface p-4 shadow-sales-modal"
      style={{ ...style, backgroundColor: "var(--sales-surface, #FFFFFF)" }}
    >
      {body}
    </div>
  );
}
