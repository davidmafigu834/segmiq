"use client";

import { useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import {
  buildQualificationAssist,
  qualificationProgress,
  type QualificationAssistField,
} from "@/lib/inbox/qualification-assist";
import type { InboxConversation } from "@/lib/inbox/types";
import { getDealReadiness } from "@/lib/sales/deals/readiness";
import type { LeadRow } from "@/types";

export function QualificationStrip({
  conversation,
  lead,
  onInsertQuestion,
  onCreateDeal,
  canCreateDeal,
}: {
  conversation: InboxConversation;
  lead: LeadRow | null;
  onInsertQuestion: (text: string) => void;
  onCreateDeal?: () => void;
  canCreateDeal?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const fields = useMemo(
    () =>
      buildQualificationAssist({
        formData: lead?.form_data ?? null,
        projectType: conversation.projectType,
        location: conversation.location,
        budget: conversation.leadBudget,
        timeline: conversation.leadTimeline,
      }),
    [conversation, lead]
  );
  const progress = qualificationProgress(fields);
  const missing = fields.filter((field) => !field.filled);
  const readiness = lead
    ? getDealReadiness({
        lead: {
          project_type: lead.project_type,
          budget: lead.budget,
          timeline: lead.timeline,
          customer_need: lead.customer_need,
          buying_timeframe: lead.buying_timeframe,
          follow_up_date: lead.follow_up_date,
          form_data: lead.form_data,
          status: lead.status,
        },
      })
    : null;

  return (
    <div className="shrink-0 border-b border-sales-border bg-sales-surface">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center gap-3 px-3 py-2 text-left sm:px-4"
        aria-expanded={open}
      >
        <span className="text-[12px] font-medium text-sales-text-primary">
          Qualification {progress.complete}/{progress.total} complete
        </span>
        <span className="flex flex-1 items-center gap-0.5" aria-hidden>
          {Array.from({ length: progress.total }).map((_, index) => (
            <span
              key={index}
              className={`h-1.5 flex-1 max-w-6 rounded-[2px] ${
                index < progress.complete ? "bg-sales-brand" : "bg-sales-neutral-100"
              }`}
            />
          ))}
        </span>
        <ChevronDown
          size={14}
          className={`text-sales-text-muted transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open ? (
        <div className="space-y-2 px-3 pb-3 sm:px-4">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5">
            {fields.slice(0, 8).map((field) => (
              <div key={field.key} className="min-w-0">
                <dt className="text-[10px] text-sales-text-muted">{field.label}</dt>
                <dd className="truncate text-[12px] font-medium text-sales-text-primary">
                  {field.value || "—"}
                </dd>
              </div>
            ))}
          </dl>
          {missing[0]?.suggestedQuestion ? (
            <MissingPrompt field={missing[0]} onInsert={onInsertQuestion} />
          ) : null}
          {readiness?.ready && canCreateDeal && onCreateDeal ? (
            <div className="flex items-center justify-between rounded-[8px] bg-sales-brand-soft px-3 py-2">
              <span className="text-[12px] font-semibold text-sales-text-primary">Deal ready</span>
              <button
                type="button"
                onClick={onCreateDeal}
                className="rounded-[7px] bg-sales-brand px-2.5 py-1 text-[11px] font-semibold text-sales-brand-text"
              >
                Create Deal
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function MissingPrompt({
  field,
  onInsert,
}: {
  field: QualificationAssistField;
  onInsert: (text: string) => void;
}) {
  if (!field.suggestedQuestion) return null;
  return (
    <div className="rounded-[8px] border border-sales-border bg-sales-surface-subtle px-3 py-2">
      <p className="text-[11px] font-semibold text-sales-text-primary">Missing: {field.label}</p>
      <p className="mt-0.5 text-[12px] text-sales-text-secondary">{field.suggestedQuestion}</p>
      <button
        type="button"
        onClick={() => onInsert(field.suggestedQuestion!)}
        className="mt-1.5 text-[11px] font-semibold text-[#4D7C0F] hover:underline"
      >
        Insert into message
      </button>
    </div>
  );
}
