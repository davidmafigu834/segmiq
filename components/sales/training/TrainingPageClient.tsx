"use client";

import { GraduationCap, Mail } from "lucide-react";
import { orderedSegmiq2Lessons } from "@/lib/sales/training/courses/segmiq-2";
import { completedLessonCount, totalLessonCount } from "@/lib/sales/training/engine";
import { useGuidedCourse } from "@/components/sales/training/GuidedCourseProvider";
import { Button } from "@/components/sales/ui/Button";
import { cn } from "@/lib/ui/cn";

export function TrainingPageClient() {
  const { progress, caps, start, continueCourse, replay, ready } = useGuidedCourse();
  const lessons = orderedSegmiq2Lessons();
  const done = completedLessonCount(progress);
  const total = totalLessonCount(caps);

  if (!ready) {
    return <div className="shimmer h-40 rounded-[14px]" />;
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="rounded-[16px] border border-sales-border bg-sales-surface p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-[10px] bg-[rgba(212,255,79,0.28)]">
            <GraduationCap size={20} className="text-sales-brand-text" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-[18px] font-semibold text-sales-text-primary">
              SegmiQ 2.0 Sales Course
            </h2>
            <p className="mt-1 text-[13px] text-sales-text-secondary">
              Learn the sales workflow by using SegmiQ — Leads, Deals, Pipeline, Tasks, Quotes,
              WhatsApp, and Goals.
            </p>
            <p className="mt-3 text-[13px] font-medium text-sales-text-primary">
              Completed: {done} / {total} lessons
            </p>
            <div className="mt-4">
              <Button
                type="button"
                variant="primary"
                onClick={() => {
                  if (progress.status === "COMPLETED") {
                    replay(lessons[0]!.id);
                  } else if (progress.status === "IN_PROGRESS") {
                    continueCourse();
                  } else {
                    start();
                  }
                }}
              >
                {progress.status === "COMPLETED"
                  ? "Replay course"
                  : progress.status === "IN_PROGRESS"
                    ? "Continue"
                    : "Start course"}
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        {lessons.map((lesson, i) => {
          const completed = progress.completedLessonIds.includes(lesson.id);
          const skipped = progress.skippedLessonIds.includes(lesson.id);
          const current = progress.currentLessonId === lesson.id && progress.status === "IN_PROGRESS";
          const status = completed
            ? "Completed"
            : skipped
              ? "Skipped"
              : current
                ? "In progress"
                : "Not started";
          return (
            <div
              key={lesson.id}
              className={cn(
                "flex flex-wrap items-center justify-between gap-3 rounded-[12px] border border-sales-border bg-sales-surface px-4 py-3",
                current && "border-[rgba(160,205,40,0.45)] bg-[rgba(212,255,79,0.08)]"
              )}
            >
              <div className="min-w-0">
                <p className="text-[14px] font-semibold text-sales-text-primary">
                  {i + 1}. {lesson.title}
                </p>
                <p className="mt-0.5 text-[12px] text-sales-text-secondary">{lesson.summary}</p>
                <p className="mt-1 text-[11px] text-sales-text-muted">{status}</p>
              </div>
              <div className="flex gap-2">
                {completed ? (
                  <Button type="button" variant="secondary" size="sm" onClick={() => replay(lesson.id)}>
                    Replay
                  </Button>
                ) : (
                  <Button
                    type="button"
                    variant={current ? "primary" : "secondary"}
                    size="sm"
                    onClick={() => start(lesson.id)}
                  >
                    {current ? "Continue" : "Start"}
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {progress.status === "COMPLETED" && progress.completedAt ? (
        <p className="text-[12px] text-sales-text-muted">
          SegmiQ 2.0 course completed · {new Date(progress.completedAt).toLocaleDateString()}
        </p>
      ) : null}

      <div className="rounded-[14px] border border-sales-border bg-sales-surface-subtle p-4">
        <p className="text-[13px] font-medium text-sales-text-primary">Need human help?</p>
        <a
          href="mailto:support@leadstaq.tech"
          className="mt-2 inline-flex items-center gap-2 text-[13px] text-sales-brand-fg hover:underline"
        >
          <Mail size={14} aria-hidden />
          support@leadstaq.tech
        </a>
      </div>
    </div>
  );
}
