"use client";

import { emitCourseEvent } from "@/lib/sales/training/course-events";
import { useGuidedCourse } from "../GuidedCourseProvider";
import { Button } from "@/components/sales/ui/Button";

export function PracticeTasksScenario() {
  const { practice, setPractice } = useGuidedCourse();

  return (
    <div className="space-y-4 workspace-card rounded-[14px] border border-sales-border bg-sales-surface p-4">
      <h3 className="text-[15px] font-semibold text-sales-text-primary">Today&apos;s Focus — MOVE DEALS</h3>
      <p className="text-[13px] text-sales-text-secondary">
        Priority follow-ups rise here. Completing them updates your Daily Sales Plan.
      </p>

      <div className="rounded-[10px] border border-sales-border bg-sales-surface-subtle p-3">
        <p className="text-[13px] font-medium text-sales-text-primary">{practice.deal.name}</p>
        <p className="text-[12px] text-sales-text-secondary">{practice.deal.nextActionLabel}</p>
        <div className="mt-3" data-course-target="practice-complete-followup">
          <Button
            type="button"
            variant="primary"
            size="sm"
            disabled={practice.deal.followUpCompleted}
            onClick={() => {
              setPractice((p) => ({
                ...p,
                deal: { ...p.deal, followUpCompleted: true },
                planCompleted: Math.min(p.planTarget, p.planCompleted + 1),
              }));
              emitCourseEvent("PRACTICE_FOLLOWUP_COMPLETED");
            }}
          >
            {practice.deal.followUpCompleted ? "Follow-up complete" : "Complete follow-up"}
          </Button>
        </div>
      </div>

      <div data-course-target="practice-next-action">
        <p className="text-[12px] font-medium text-sales-text-muted">Daily Sales Plan</p>
        <p className="mt-1 text-[20px] font-semibold tabular-nums text-sales-text-primary">
          {practice.planCompleted} / {practice.planTarget}
        </p>
        <p className="mt-1 text-[12px] text-sales-text-secondary">
          Actions you complete in SegmiQ automatically update your Daily Sales Plan.
        </p>
      </div>
    </div>
  );
}
