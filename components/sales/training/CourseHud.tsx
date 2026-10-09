"use client";

import { useGuidedCourse } from "./GuidedCourseProvider";
import { Button } from "@/components/sales/ui/Button";
import { cn } from "@/lib/ui/cn";

export function CourseHud({ collapsed }: { collapsed?: boolean }) {
  const { lessonProgressLabel, pause, continueCourse, uiMode } = useGuidedCourse();

  if (collapsed || uiMode === "paused") {
    return (
      <div className="fixed left-3 right-3 top-[max(8px,env(safe-area-inset-top,0px))] z-[var(--sales-z-course-coach,92)] layout:bottom-6 layout:left-auto layout:right-4 layout:top-auto layout:w-max layout:max-w-[calc(100vw-2rem)]">
        <div
          className="sales-modal-premium flex items-center gap-2 rounded-[12px] border border-sales-border bg-sales-surface px-3 py-2 shadow-none"
          style={{ backgroundColor: "var(--sales-surface, #FFFFFF)" }}
        >
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
        "sales-modal-premium fixed right-4 top-3 z-[var(--sales-z-course-coach,92)] hidden layout:flex",
        "items-center gap-2 rounded-[12px] border border-sales-border bg-sales-surface px-3 py-1.5 shadow-none"
      )}
      style={{ backgroundColor: "var(--sales-surface, #FFFFFF)" }}
    >
      <span className="text-[12px] font-semibold text-sales-text-primary">SegmiQ 2.0 Course</span>
      <span className="text-[11px] text-sales-text-muted">{lessonProgressLabel}</span>
      <Button variant="ghost" size="sm" type="button" onClick={pause}>
        Pause
      </Button>
    </div>
  );
}
