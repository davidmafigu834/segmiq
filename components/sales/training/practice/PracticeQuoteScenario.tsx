"use client";

import { emitCourseEvent } from "@/lib/sales/training/course-events";
import { useGuidedCourse } from "../GuidedCourseProvider";
import { Button } from "@/components/sales/ui/Button";

export function PracticeQuoteScenario() {
  const { practice, setPractice } = useGuidedCourse();

  return (
    <div className="workspace-card rounded-[14px] border border-sales-border bg-sales-surface p-4">
      <p className="text-[12px] text-sales-text-muted">Practice Deal · {practice.deal.name}</p>
      <h3 className="mt-2 text-[16px] font-semibold text-sales-text-primary">Create quotation</h3>
      <p className="mt-1 text-[13px] text-sales-text-secondary">
        Practice quotes never allocate a real quotation number or PDF.
      </p>
      <div className="mt-4 rounded-[10px] border border-dashed border-sales-border p-3 text-[13px] text-sales-text-secondary">
        Solar installation package — draft total $4,800
      </div>
      <div className="mt-4" data-course-target="practice-create-quote">
        <Button
          type="button"
          variant="primary"
          disabled={practice.deal.quoteCreated}
          onClick={() => {
            setPractice((p) => ({
              ...p,
              deal: { ...p.deal, quoteCreated: true, stage: "PROPOSAL_SENT" },
            }));
            emitCourseEvent("PRACTICE_QUOTE_CREATED");
          }}
        >
          {practice.deal.quoteCreated ? "Practice quote created" : "Create practice quote"}
        </Button>
      </div>
    </div>
  );
}
