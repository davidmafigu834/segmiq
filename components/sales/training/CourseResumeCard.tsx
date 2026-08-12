"use client";

import Link from "next/link";
import { orderedSegmiq2Lessons } from "@/lib/sales/training/courses/segmiq-2";
import { completedLessonCount, totalLessonCount } from "@/lib/sales/training/engine";
import { useGuidedCourseOptional } from "./GuidedCourseProvider";
import { Button } from "@/components/sales/ui/Button";

export function CourseResumeCard() {
  const course = useGuidedCourseOptional();
  if (!course?.ready) return null;

  const { progress, continueCourse, start, hideCard, caps } = course;
  if (progress.status === "COMPLETED") return null;
  if (progress.dashboardCardHidden) return null;
  if (progress.status === "NOT_STARTED" && progress.autoShowWelcome) return null;

  const done = completedLessonCount(progress);
  const total = totalLessonCount(caps);
  const lessons = orderedSegmiq2Lessons();
  const nextLesson =
    lessons.find((l) => l.id === progress.currentLessonId) ??
    lessons.find((l) => !progress.completedLessonIds.includes(l.id));

  const title =
    progress.status === "NOT_STARTED" || progress.status === "DISMISSED"
      ? "Learn SegmiQ 2.0"
      : "Continue learning SegmiQ 2.0";

  return (
    <div
      data-course-target="dashboard-course-card"
      className="rounded-[14px] border border-sales-border bg-sales-surface p-4 shadow-sales-card"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[14px] font-semibold text-sales-text-primary">{title}</p>
          <p className="mt-1 text-[12px] text-sales-text-secondary">
            {done} of {total} lessons complete
            {nextLesson ? (
              <>
                {" · "}
                Continue: <span className="font-medium text-sales-text-primary">{nextLesson.title}</span>
              </>
            ) : null}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={() => {
              if (progress.status === "NOT_STARTED" || progress.status === "DISMISSED") start();
              else continueCourse();
            }}
          >
            {progress.status === "IN_PROGRESS" ? "Continue course" : "Start course"}
          </Button>
          <button
            type="button"
            className="text-[11px] text-sales-text-muted hover:text-sales-text-secondary"
            onClick={hideCard}
          >
            Hide
          </button>
        </div>
      </div>
      <p className="mt-2 text-[11px] text-sales-text-muted">
        Always available under{" "}
        <Link href="/sales/training" className="underline hover:text-sales-text-secondary">
          Help & Support → Training
        </Link>
        .
      </p>
    </div>
  );
}
