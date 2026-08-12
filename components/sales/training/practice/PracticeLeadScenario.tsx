"use client";

import { emitCourseEvent } from "@/lib/sales/training/course-events";
import { useGuidedCourse } from "../GuidedCourseProvider";
import { Button } from "@/components/sales/ui/Button";

export function PracticeLeadScenario() {
  const { practice, setPractice } = useGuidedCourse();
  const { lead } = practice;

  return (
    <div className="space-y-4">
      <div className="rounded-[14px] border border-sales-border bg-sales-surface p-4 shadow-sales-card">
        <p className="text-[12px] font-medium text-sales-text-muted">Practice Lead</p>
        <button
          type="button"
          data-course-target="practice-lead-row"
          className="mt-2 flex w-full items-center justify-between rounded-[10px] border border-sales-border bg-sales-surface-subtle px-3 py-3 text-left hover:border-sales-border-strong focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--sales-focus-outline)]"
          onClick={() => emitCourseEvent("OPENED_PRACTICE_LEAD")}
        >
          <span>
            <span className="block text-[15px] font-semibold text-sales-text-primary">{lead.name}</span>
            <span className="mt-0.5 block text-[12px] text-sales-text-secondary">
              {lead.source} · Intent {lead.intent} · {lead.interest}
            </span>
          </span>
          <span className="text-[12px] font-medium text-sales-brand-fg">Open</span>
        </button>
      </div>

      <div
        data-course-target="practice-lead-discovery"
        className="rounded-[14px] border border-sales-border bg-sales-surface p-4"
      >
        <h3 className="text-[15px] font-semibold text-sales-text-primary">Discovery</h3>
        <p className="mt-1 text-[13px] text-sales-text-secondary">
          Confirm what the customer is trying to buy before creating a Deal.
        </p>
        <label className="mt-3 block text-[12px] font-medium text-sales-text-secondary">
          Notes
          <textarea
            className="mt-1 w-full rounded-[10px] border border-sales-border-strong bg-sales-surface px-3 py-2 text-[13px] text-sales-text-primary"
            rows={3}
            value={lead.discoveryNotes}
            onChange={(e) =>
              setPractice((p) => ({
                ...p,
                lead: { ...p.lead, discoveryNotes: e.target.value },
              }))
            }
            placeholder="e.g. 5kW rooftop, wants install this month"
          />
        </label>
        <div className="mt-3">
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={() => {
              setPractice((p) => ({
                ...p,
                lead: {
                  ...p.lead,
                  discoverySaved: true,
                  readinessScore: 82,
                },
              }));
              emitCourseEvent("PRACTICE_QUALIFICATION_UPDATED");
            }}
          >
            Save discovery
          </Button>
        </div>
      </div>

      <div
        data-course-target="practice-deal-readiness"
        className="rounded-[14px] border border-sales-border bg-sales-surface p-4"
      >
        <h3 className="text-[15px] font-semibold text-sales-text-primary">Deal Readiness</h3>
        <p className="mt-1 text-[13px] text-sales-text-secondary">
          SegmiQ helps you confirm a genuine commercial opportunity before adding it to your
          Pipeline.
        </p>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-sales-neutral-100">
          <div
            className="h-full rounded-full bg-sales-brand"
            style={{ width: `${lead.readinessScore}%` }}
          />
        </div>
        <p className="mt-2 text-[12px] text-sales-text-muted">{lead.readinessScore}% ready</p>
        <div className="mt-4" data-course-target="practice-create-deal">
          <Button
            type="button"
            variant="primary"
            disabled={!lead.discoverySaved || lead.dealCreated}
            onClick={() => {
              setPractice((p) => ({
                ...p,
                lead: {
                  ...p.lead,
                  dealCreated: true,
                  dealId: p.deal.id,
                },
              }));
              emitCourseEvent("PRACTICE_DEAL_CREATED");
            }}
          >
            {lead.dealCreated ? "Deal created" : "Create Deal"}
          </Button>
        </div>
      </div>
    </div>
  );
}
