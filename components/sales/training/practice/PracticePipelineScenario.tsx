"use client";

import { emitCourseEvent } from "@/lib/sales/training/course-events";
import { useGuidedCourse } from "../GuidedCourseProvider";
import { Button } from "@/components/sales/ui/Button";
import type { PracticeDealStage } from "@/lib/sales/training/practice/practice-state";

const STAGES: PracticeDealStage[] = ["QUALIFIED", "SCOPING", "PROPOSAL_SENT", "NEGOTIATING"];
const LABELS: Record<PracticeDealStage, string> = {
  QUALIFIED: "Qualified",
  SCOPING: "Scoping",
  PROPOSAL_SENT: "Proposal sent",
  NEGOTIATING: "Negotiating",
};

export function PracticePipelineScenario() {
  const { practice, setPractice } = useGuidedCourse();
  const { deal } = practice;

  return (
    <div className="space-y-4">
      <div>
        <p className="text-[12px] text-sales-text-muted">Practice Pipeline</p>
        <button
          type="button"
          data-course-target="practice-deal-card"
          className="mt-3 w-full rounded-[12px] border border-sales-border bg-sales-surface-subtle p-4 text-left hover:border-sales-border-strong"
          onClick={() => emitCourseEvent("PRACTICE_DEAL_OPENED")}
        >
          <p className="text-[15px] font-semibold text-sales-text-primary">{deal.name}</p>
          <p className="mt-1 text-[13px] text-sales-text-secondary">
            Est. ${deal.estimatedValue?.toLocaleString() ?? "—"} · Next: {deal.nextActionLabel}
          </p>
          <p className="mt-2 text-[12px] font-medium text-sales-text-muted">
            Stage: {LABELS[deal.stage]}
          </p>
        </button>

        <div className="mt-4" data-course-target="practice-deal-stage-scoping">
          <p className="mb-2 text-[12px] font-medium text-sales-text-secondary">Move stage</p>
          <div className="flex flex-wrap gap-2">
            {STAGES.map((stage) => (
              <Button
                key={stage}
                type="button"
                size="sm"
                variant={deal.stage === stage ? "primary" : "secondary"}
                onClick={() => {
                  setPractice((p) => ({
                    ...p,
                    deal: { ...p.deal, stage },
                  }));
                  if (stage === "SCOPING") {
                    emitCourseEvent("PRACTICE_DEAL_STAGE_CHANGED", { stage });
                  }
                }}
              >
                {LABELS[stage]}
              </Button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
