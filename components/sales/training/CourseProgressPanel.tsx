"use client";

import { orderedSegmiq2Lessons } from "@/lib/sales/training/courses/segmiq-2";
import { useGuidedCourse } from "./GuidedCourseProvider";
import { cn } from "@/lib/ui/cn";

export function CourseProgressPanel() {
  const { progress, pause } = useGuidedCourse();
  const lessons = orderedSegmiq2Lessons();

  return (
    <aside
      className="sales-modal-premium fixed bottom-6 right-4 z-[var(--sales-z-course-coach,92)] hidden w-[240px] workspace-card rounded-[14px] border border-sales-border bg-sales-surface p-3 shadow-sales-modal xl:block"
      style={{ backgroundColor: "var(--sales-surface, #FFFFFF)" }}
      aria-label="Course progress"
    >
      <div className="mb-2 flex items-center justify-between">
        <p className="text-[12px] font-semibold text-sales-text-primary">Course progress</p>
        <button
          type="button"
          className="text-[11px] text-sales-text-muted hover:text-sales-text-secondary"
          onClick={pause}
        >
          Collapse
        </button>
      </div>
      <ol className="space-y-1">
        {lessons.map((lesson, i) => {
          const done = progress.completedLessonIds.includes(lesson.id);
          const current = progress.currentLessonId === lesson.id;
          return (
            <li
              key={lesson.id}
              className={cn(
                "rounded-[8px] px-2 py-1.5 text-[12px]",
                current && "bg-[rgba(212,255,79,0.18)] text-sales-text-primary",
                !current && done && "text-sales-text-secondary",
                !current && !done && "text-sales-text-muted"
              )}
            >
              <span className="tabular-nums">{i + 1}. </span>
              {lesson.title}
              {done ? " ✓" : ""}
            </li>
          );
        })}
      </ol>
    </aside>
  );
}
