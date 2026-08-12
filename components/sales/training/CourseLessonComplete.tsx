"use client";

import { orderedSegmiq2Lessons } from "@/lib/sales/training/courses/segmiq-2";
import { useGuidedCourse } from "./GuidedCourseProvider";
import { Button } from "@/components/sales/ui/Button";

export function CourseLessonComplete() {
  const { progress, continueCourse, pause } = useGuidedCourse();
  const lessons = orderedSegmiq2Lessons();
  const completedId = [...progress.completedLessonIds].pop();
  const completed = lessons.find((l) => l.id === completedId);
  const nextLesson = lessons.find((l) => l.id === progress.currentLessonId);

  return (
    <div className="fixed inset-0 z-[var(--sales-z-course-modal,95)] flex items-center justify-center bg-[rgba(15,23,42,0.45)] p-4 dark:bg-[rgba(0,0,0,0.55)]">
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-md rounded-[16px] border border-sales-border bg-sales-surface p-6 shadow-sales-popover"
      >
        <p className="text-[13px] font-semibold text-sales-success-fg">✓ {completed?.title ?? "Lesson"} complete</p>
        <p className="mt-2 text-[14px] leading-relaxed text-sales-text-secondary">
          {completed?.summary ?? "Nice work. Keep going when you're ready."}
        </p>
        {nextLesson ? (
          <p className="mt-4 text-[13px] text-sales-text-primary">
            Next: <span className="font-semibold">{nextLesson.title}</span>
          </p>
        ) : null}
        <div className="mt-6 flex gap-2">
          <Button variant="primary" type="button" onClick={continueCourse}>
            Continue
          </Button>
          <Button variant="secondary" type="button" onClick={pause}>
            Pause
          </Button>
        </div>
      </div>
    </div>
  );
}
