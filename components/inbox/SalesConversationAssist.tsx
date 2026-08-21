"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarDays, Check, ChevronDown, FileText, Phone } from "lucide-react";
import {
  buildQualificationAssist,
  qualificationProgress,
  type QualificationAssistField,
} from "@/lib/inbox/qualification-assist";
import type { NextBestAction } from "@/lib/inbox/next-best-action";
import type { InboxConversation } from "@/lib/inbox/types";
import { getDealReadiness } from "@/lib/sales/deals/readiness";
import type { LeadRow } from "@/types";

const EXPANDED_STORAGE_KEY = "segmiq-sales-conversation-assist-expanded";

type Props = {
  conversation: InboxConversation;
  lead: LeadRow | null;
  action: NextBestAction | null;
  onCall?: () => void;
  onSchedule?: () => void;
  onViewQuote?: () => void;
  onCompletePlan?: () => void;
  completing?: boolean;
  onInsertQuestion: (text: string) => void;
  onCreateDeal?: () => void;
  canCreateDeal?: boolean;
};

export function SalesConversationAssist({
  conversation,
  lead,
  action,
  onCall,
  onSchedule,
  onViewQuote,
  onCompletePlan,
  completing = false,
  onInsertQuestion,
  onCreateDeal,
  canCreateDeal,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const showQualification = !conversation.activeDealId;

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

  useEffect(() => {
    try {
      setExpanded(localStorage.getItem(EXPANDED_STORAGE_KEY) === "1");
    } catch {
      /* ignore */
    }
    setHydrated(true);
  }, []);

  function toggleExpanded() {
    setExpanded((current) => {
      const next = !current;
      try {
        localStorage.setItem(EXPANDED_STORAGE_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  const summary = action?.title ?? "No next action scheduled";

  return (
    <div className="wa-sales-assist shrink-0 border-b border-sales-border bg-sales-surface">
      <button
        type="button"
        onClick={toggleExpanded}
        className="flex w-full items-center gap-2 px-3 py-1.5 text-left sm:px-4"
        aria-expanded={hydrated ? expanded : false}
      >
        <span className="shrink-0 text-[9px] font-semibold uppercase tracking-[0.07em] text-sales-text-muted">
          Selling
        </span>
        <span className="min-w-0 flex-1 truncate text-[12px] font-medium text-sales-text-primary">{summary}</span>
        {showQualification ? (
          <span className="shrink-0 text-[10px] tabular-nums text-sales-text-secondary">
            {progress.complete}/{progress.total}
          </span>
        ) : null}
        <ChevronDown
          size={14}
          className={`shrink-0 text-sales-text-muted transition-transform ${expanded ? "rotate-180" : ""}`}
        />
      </button>

      {expanded ? (
        <div className="space-y-2 border-t border-sales-border-subtle px-3 py-2 sm:px-4">
          {action ? (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[9px] font-semibold uppercase tracking-[0.07em] text-sales-text-muted">
                  {action.eyebrow}
                </p>
                <p className="truncate text-[12px] font-semibold text-sales-text-primary">{action.title}</p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                {action.showCall && onCall ? (
                  <button type="button" onClick={onCall} className="wa-btn-secondary !h-7 !w-auto !px-2 !text-[10px]">
                    <Phone size={12} strokeWidth={1.8} /> Call
                  </button>
                ) : null}
                {action.showCompletePlan && onCompletePlan ? (
                  <button
                    type="button"
                    disabled={completing}
                    onClick={onCompletePlan}
                    className="wa-btn-secondary !h-7 !w-auto !px-2 !text-[10px]"
                  >
                    <Check size={12} strokeWidth={1.8} />
                    {completing ? "Saving…" : "Complete"}
                  </button>
                ) : null}
                {action.showSchedule && onSchedule ? (
                  <button type="button" onClick={onSchedule} className="wa-btn-secondary !h-7 !w-auto !px-2 !text-[10px]">
                    <CalendarDays size={12} strokeWidth={1.8} /> Schedule
                  </button>
                ) : null}
                {action.showViewQuote && onViewQuote ? (
                  <button type="button" onClick={onViewQuote} className="wa-btn-secondary !h-7 !w-auto !px-2 !text-[10px]">
                    <FileText size={12} strokeWidth={1.8} /> Quote
                  </button>
                ) : null}
              </div>
            </div>
          ) : null}

          {showQualification ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-medium text-sales-text-primary">
                  Qualification {progress.complete}/{progress.total}
                </span>
                <span className="flex flex-1 items-center gap-0.5" aria-hidden>
                  {Array.from({ length: progress.total }).map((_, index) => (
                    <span
                      key={index}
                      className={`h-1 flex-1 max-w-5 rounded-[2px] ${
                        index < progress.complete ? "bg-sales-brand" : "bg-sales-neutral-100"
                      }`}
                    />
                  ))}
                </span>
              </div>
              {missing[0]?.suggestedQuestion ? (
                <MissingPrompt field={missing[0]} onInsert={onInsertQuestion} />
              ) : null}
              {readiness?.ready && canCreateDeal && onCreateDeal ? (
                <div className="flex items-center justify-between rounded-[8px] bg-sales-brand-soft px-2.5 py-1.5">
                  <span className="text-[11px] font-semibold text-sales-text-primary">Deal ready</span>
                  <button
                    type="button"
                    onClick={onCreateDeal}
                    className="rounded-[7px] bg-sales-brand px-2 py-0.5 text-[10px] font-semibold text-sales-brand-text"
                  >
                    Create Deal
                  </button>
                </div>
              ) : null}
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
    <div className="rounded-[8px] border border-sales-border bg-sales-surface-subtle px-2.5 py-1.5">
      <p className="text-[10px] font-semibold text-sales-text-primary">Missing: {field.label}</p>
      <button
        type="button"
        onClick={() => onInsert(field.suggestedQuestion!)}
        className="mt-0.5 text-[10px] font-semibold text-[#4D7C0F] hover:underline"
      >
        Insert question into message
      </button>
    </div>
  );
}
