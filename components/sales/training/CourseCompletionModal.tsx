"use client";

import { useRouter } from "next/navigation";
import { useGuidedCourse } from "./GuidedCourseProvider";
import { Button } from "@/components/sales/ui/Button";

export function CourseCompletionModal() {
  const router = useRouter();
  const { exit } = useGuidedCourse();

  return (
    <div className="sales-modal-premium fixed inset-0 z-[var(--sales-z-course-modal,95)] flex items-center justify-center bg-[rgba(15,23,42,0.5)] p-4 dark:bg-[rgba(0,0,0,0.6)]">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="course-complete-title"
        className="w-full max-w-[560px] rounded-[16px] border border-sales-border bg-sales-surface p-7 shadow-sales-modal sm:p-8"
        style={{ backgroundColor: "var(--sales-surface, #FFFFFF)" }}
      >
        <div
          className="mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-[rgba(212,255,79,0.35)] text-[18px] font-bold text-sales-brand-text"
          aria-hidden
        >
          ✓
        </div>
        <h2
          id="course-complete-title"
          className="text-[26px] font-semibold tracking-[-0.03em] text-sales-text-primary"
        >
          You&apos;re ready to work in SegmiQ 2.0
        </h2>
        <p className="mt-3 text-[14px] leading-relaxed text-sales-text-secondary">
          You&apos;ve learned how to turn enquiries into Deals, manage your Pipeline, follow up
          consistently and use your Daily Sales Plan.
        </p>
        <div className="mt-7 flex flex-col gap-2 sm:flex-row">
          <Button
            variant="primary"
            size="lg"
            type="button"
            onClick={() => {
              exit();
              router.push("/sales/dashboard");
            }}
          >
            Go to Dashboard
          </Button>
          <Button
            variant="secondary"
            size="lg"
            type="button"
            onClick={() => {
              exit();
              router.push("/sales/training");
            }}
          >
            Review lessons
          </Button>
        </div>
      </div>
    </div>
  );
}
