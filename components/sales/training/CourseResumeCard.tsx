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
      className="dashboard-panel dashboard-panel--onboarding overflow-hidden border-0 shadow-none"
    >
      <div className="flex flex-col gap-4 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:gap-8 sm:px-6">
        <div className="min-w-0 sm:max-w-[640px]">
          <p className="dashboard-section-title">{title}</p>
          <p className="mt-2.5 text-[13px] leading-relaxed text-sales-text-secondary">
            {done} of {total} lessons complete
            {nextLesson ? (
              <>
                {" · "}
                Continue: <span className="font-medium text-sales-text-primary">{nextLesson.title}</span>
              </>
            ) : null}
          </p>
          <p className="mt-3 text-[12px] leading-relaxed text-sales-text-muted">
            Always available under{" "}
            <Link href="/sales/training" className="underline hover:text-sales-text-secondary">
              Help & Support → Training
            </Link>
            .
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-3 sm:self-center">
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
            className="px-1 text-[12px] text-sales-text-muted hover:text-sales-text-secondary"
            onClick={hideCard}
          >
            Hide
          </button>
        </div>
      </div>
    </div>
  );
}
