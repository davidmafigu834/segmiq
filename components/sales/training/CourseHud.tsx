"use client";

import { useGuidedCourse } from "./GuidedCourseProvider";
import { Button } from "@/components/sales/ui/Button";
import { cn } from "@/lib/ui/cn";

export function CourseHud({ collapsed }: { collapsed?: boolean }) {
  const { lessonProgressLabel, pause, continueCourse, uiMode } = useGuidedCourse();

  if (collapsed || uiMode === "paused") {
    return (
      <div className="fixed bottom-20 right-4 z-[var(--sales-z-course-coach,92)] layout:bottom-6">
        <div className="flex items-center gap-2 rounded-[12px] border border-sales-border bg-sales-surface px-3 py-2 shadow-sales-card">
          <span className="text-[12px] font-medium text-sales-text-primary">SegmiQ 2.0 Course</span>
          <span className="text-[11px] text-sales-text-muted">{lessonProgressLabel}</span>
          <Button variant="primary" size="sm" type="button" onClick={continueCourse}>
            Continue
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "fixed right-4 top-3 z-[var(--sales-z-course-coach,92)] hidden layout:flex",
        "items-center gap-2 rounded-[12px] border border-sales-border bg-sales-surface px-3 py-1.5 shadow-sales-card"
      )}
    >
      <span className="text-[12px] font-semibold text-sales-text-primary">SegmiQ 2.0 Course</span>
      <span className="text-[11px] text-sales-text-muted">{lessonProgressLabel}</span>
      <Button variant="ghost" size="sm" type="button" onClick={pause}>
        Pause
      </Button>
    </div>
  );
}
