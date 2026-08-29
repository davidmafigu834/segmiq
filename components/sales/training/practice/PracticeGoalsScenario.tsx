"use client";

import { useGuidedCourse } from "../GuidedCourseProvider";

export function PracticeGoalsScenario() {
  const { practice } = useGuidedCourse();
  const remaining = Math.max(0, practice.goalTarget - practice.goalAchieved);

  return (
    <div className="space-y-4">
      <div
        data-course-target="practice-goals-revenue"
        className="workspace-card rounded-[14px] border border-sales-border bg-sales-surface p-4"
      >
        <p className="text-[12px] text-sales-text-muted">Revenue Goal</p>
        <p className="mt-1 text-[24px] font-semibold tabular-nums text-sales-text-primary">
          ${practice.goalAchieved.toLocaleString()} / ${practice.goalTarget.toLocaleString()}
        </p>
        <p className="mt-1 text-[13px] text-sales-text-secondary">
          ${remaining.toLocaleString()} remaining this period
        </p>
      </div>

      <div
        data-course-target="practice-goals-coverage"
        className="workspace-card rounded-[14px] border border-sales-border bg-sales-surface p-4"
      >
        <p className="text-[12px] text-sales-text-muted">Pipeline Coverage</p>
        <p className="mt-1 text-[20px] font-semibold tabular-nums text-sales-text-primary">
          {practice.coverageRatio.toFixed(1)}×
        </p>
        <p className="mt-1 text-[13px] text-sales-text-secondary">
          Coverage compares Pipeline Value to remaining target — informing BUILD / MOVE / CLOSE.
        </p>
      </div>

      <div
        data-course-target="practice-goals-commitments"
        className="workspace-card rounded-[14px] border border-sales-border bg-sales-surface p-4"
      >
        <p className="text-[12px] text-sales-text-muted">Daily Commitments</p>
        <ul className="mt-2 space-y-1 text-[13px] text-sales-text-primary">
          <li>Calls · Follow-ups · Prospecting · Quotations</li>
        </ul>
        <p className="mt-2 text-[12px] text-sales-text-secondary">
          Goals show the result. Your Daily Sales Plan connects that result to work you can control.
        </p>
      </div>
    </div>
  );
}
