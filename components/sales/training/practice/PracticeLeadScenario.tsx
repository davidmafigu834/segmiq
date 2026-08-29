"use client";

import { useEffect, useMemo, useState } from "react";
import { emitCourseEvent } from "@/lib/sales/training/course-events";
import { useGuidedCourse } from "../GuidedCourseProvider";
import { Button } from "@/components/sales/ui/Button";
import { CreateDealSheet } from "@/components/sales/deals/CreateDealSheet";
import { DealReadinessCard } from "@/components/sales/deals/DealReadinessCard";
import { getDealReadiness } from "@/lib/sales/deals/readiness";
import type { LeadRow } from "@/types";

function practiceLeadAsRow(lead: {
  name: string;
  source: string;
  intent: string;
  interest: string;
  discoveryNotes: string;
  discoverySaved: boolean;
}): LeadRow {
  const need =
    lead.discoveryNotes.trim() ||
    "Customer confirmed interest in a rooftop solar system for backup power.";
  return {
    id: "practice-lead",
    client_id: "practice",
    assigned_to_id: null,
    contact_id: null,
    source: "FACEBOOK",
    status: lead.discoverySaved ? "QUALIFIED" : "CONTACTED",
    form_data: {
      company: "Moyo Residence",
      location: "Borrowdale",
    },
    name: lead.name,
    phone: "+263771234567",
    email: null,
    budget: "$4,500 – $6,500",
    project_type: lead.interest || "5kW Solar Installation",
    timeline: "Within 30 days",
    magic_token: null,
    magic_token_expires_at: null,
    not_qualified_reason: null,
    lost_reason: null,
    deal_value: null,
    follow_up_date: lead.discoverySaved
      ? new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString()
      : null,
    facebook_lead_id: null,
    created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date().toISOString(),
    score: lead.intent === "Hot" ? 82 : lead.intent === "Warm" ? 55 : 30,
    score_updated_at: null,
    score_breakdown: null,
    is_stale: false,
    stale_since: null,
    is_convert_later_pick: false,
    convert_later_note: null,
    manual_priority: null,
    customer_need: need,
    buying_timeframe: "Within 30 days",
    decision_maker_status: "YES",
  } as LeadRow;
}

export function PracticeLeadScenario() {
  const { practice, setPractice, activeStep } = useGuidedCourse();
  const { lead } = practice;
  const [createOpen, setCreateOpen] = useState(false);

  const leadRow = useMemo(() => practiceLeadAsRow(lead), [lead]);
  const readiness = useMemo(
    () =>
      getDealReadiness({
        lead: leadRow,
        discovery: {
          interestConfirmed: lead.discoverySaved,
          nextStepAgreed: lead.discoverySaved,
          valuePending: true,
          customerNeed: leadRow.customer_need,
          projectType: leadRow.project_type,
          buyingTimeframe: leadRow.buying_timeframe,
        },
      }),
    [lead.discoverySaved, leadRow]
  );

  // Course Create Deal step: open the real product modal so the salesperson
  // practices the same UI they'll use on live Leads.
  useEffect(() => {
    const stepId = activeStep?.id;
    const target = activeStep?.target;
    const wantsModal =
      stepId === "ltd-create-deal" ||
      target === "create-deal-modal" ||
      target === "create-deal-submit" ||
      target === "create-deal-name" ||
      target === "create-deal-value" ||
      target === "create-deal-next-action";
    if (wantsModal && lead.discoverySaved && !lead.dealCreated) {
      setCreateOpen(true);
    }
  }, [activeStep?.id, activeStep?.target, lead.discoverySaved, lead.dealCreated]);

  return (
    <div className="space-y-4">
      <div className="workspace-card rounded-[14px] border border-sales-border bg-sales-surface p-4 shadow-sales-card">
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
        className="workspace-card rounded-[14px] border border-sales-border bg-sales-surface p-4"
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

      <div data-course-target="practice-deal-readiness">
        <DealReadinessCard
          readiness={readiness}
          onCreateDeal={
            lead.discoverySaved && !lead.dealCreated
              ? () => setCreateOpen(true)
              : undefined
          }
        />
      </div>

      {!createOpen && lead.discoverySaved && !lead.dealCreated ? (
        <div className="flex justify-end" data-course-target="practice-create-deal">
          <Button type="button" variant="primary" onClick={() => setCreateOpen(true)}>
            Create Deal
          </Button>
        </div>
      ) : null}

      {lead.dealCreated ? (
        <div className="rounded-[14px] border border-sales-brand-border bg-sales-brand-soft p-4">
          <p className="text-[13px] font-semibold text-sales-text-primary">Deal created</p>
          <p className="mt-1 text-[12px] text-sales-text-secondary">
            Practice only — this used the same Create Deal modal you&apos;ll see on real Leads.
          </p>
        </div>
      ) : null}

      <CreateDealSheet
        lead={leadRow}
        open={createOpen}
        practiceMode
        onClose={() => {
          // Keep modal available during the Create Deal course step
          if (activeStep?.id === "ltd-create-deal" && !lead.dealCreated) return;
          setCreateOpen(false);
        }}
        onCreated={() => {
          /* production callback unused in practice */
        }}
        onPracticeCreated={() => {
          setCreateOpen(false);
          setPractice((p) => ({
            ...p,
            lead: {
              ...p.lead,
              dealCreated: true,
              dealId: p.deal.id,
            },
            deal: {
              ...p.deal,
              name: lead.interest || p.deal.name,
            },
          }));
          emitCourseEvent("PRACTICE_DEAL_CREATED");
        }}
      />
    </div>
  );
}
