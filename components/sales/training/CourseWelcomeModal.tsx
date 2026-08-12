"use client";

import { useGuidedCourse } from "./GuidedCourseProvider";
import { Button } from "@/components/sales/ui/Button";
import { cn } from "@/lib/ui/cn";

export function CourseWelcomeModal({ isExistingUser }: { isExistingUser?: boolean }) {
  const { start, dismissWelcomeLater, neverAutoShow } = useGuidedCourse();

  const title = isExistingUser ? "Meet SegmiQ 2.0" : "Welcome to SegmiQ 2.0";
  const supporting = isExistingUser
    ? "Learn the new Lead → Deal workflow and Daily Sales Plan by using SegmiQ."
    : "Learn the sales workflow through a short interactive course inside SegmiQ.";

  return (
    <div
      className="sales-modal-premium fixed inset-0 z-[var(--sales-z-course-modal,95)] flex items-center justify-center bg-[rgba(15,23,42,0.5)] p-4 dark:bg-[rgba(0,0,0,0.6)]"
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="guided-welcome-title"
        className="w-full max-w-[640px] rounded-[16px] border border-sales-border bg-sales-surface p-6 shadow-sales-modal sm:p-8"
        style={{
          // Course overlays render outside .sales-dashboard-premium — force opaque panel.
          backgroundColor: "var(--sales-surface, #FFFFFF)",
          color: "var(--sales-text-primary, #101828)",
        }}
      >
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-sales-text-muted">
          SegmiQ Guided Learning
        </p>
        <h1
          id="guided-welcome-title"
          className="mt-2 text-[28px] font-semibold leading-tight tracking-[-0.03em] text-sales-text-primary sm:text-[32px]"
        >
          {title}
        </h1>
        <p className="mt-3 text-[14px] leading-relaxed text-sales-text-secondary">{supporting}</p>

        <ul className="mt-5 space-y-2.5 text-[13px] text-sales-text-primary">
          {[
            "Understand Leads and Deals",
            "Learn what to work on each day",
            "Practice the actions that move opportunities forward",
          ].map((item) => (
            <li key={item} className="flex items-start gap-2.5">
              <span
                className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[rgba(212,255,79,0.35)] text-[11px] font-bold text-[#101828]"
                aria-hidden
              >
                ✓
              </span>
              <span>{item}</span>
            </li>
          ))}
        </ul>

        <div className="mt-7 flex flex-col gap-2 sm:flex-row sm:items-center">
          <Button variant="primary" size="lg" type="button" onClick={() => start()}>
            Start course
          </Button>
          <Button variant="secondary" size="lg" type="button" onClick={dismissWelcomeLater}>
            I&apos;ll do this later
          </Button>
        </div>

        <button
          type="button"
          onClick={neverAutoShow}
          className={cn(
            "mt-4 text-[12px] text-sales-text-muted hover:text-sales-text-secondary hover:underline"
          )}
        >
          Don&apos;t show this automatically again
        </button>
      </div>
    </div>
  );
}
