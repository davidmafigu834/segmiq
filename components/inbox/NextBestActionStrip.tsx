"use client";

import { CalendarDays, Check, FileText, Phone } from "lucide-react";
import type { NextBestAction } from "@/lib/inbox/next-best-action";

export function NextBestActionStrip({
  action,
  condensed = false,
  onCall,
  onSchedule,
  onViewQuote,
  onCompletePlan,
  completing = false,
}: {
  action: NextBestAction;
  condensed?: boolean;
  onCall?: () => void;
  onSchedule?: () => void;
  onViewQuote?: () => void;
  onCompletePlan?: () => void;
  completing?: boolean;
}) {
  return (
    <div className="flex min-h-[44px] shrink-0 items-center gap-3 border-b border-sales-border bg-sales-surface px-3 py-1.5 sm:px-4">
      <div className="min-w-0 flex-1">
        <p className="text-[9px] font-semibold uppercase tracking-[0.08em] text-sales-text-muted">
          {action.eyebrow}
        </p>
        <p className="truncate text-[13px] font-semibold text-sales-text-primary">{action.title}</p>
        {action.reason && !condensed ? (
          <p className="truncate text-[11px] text-sales-text-secondary">{action.reason}</p>
        ) : null}
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {action.showCall && onCall ? (
          <button type="button" onClick={onCall} className="wa-btn-secondary !h-8 !w-auto !px-2.5 !text-[11px]">
            <Phone size={13} strokeWidth={1.8} /> Call
          </button>
        ) : null}
        {action.showCompletePlan && onCompletePlan ? (
          <button
            type="button"
            disabled={completing}
            onClick={onCompletePlan}
            className="wa-btn-secondary !h-8 !w-auto !px-2.5 !text-[11px]"
          >
            <Check size={13} strokeWidth={1.8} />
            {completing ? "Saving…" : condensed ? "Complete" : "Complete action"}
          </button>
        ) : null}
        {action.showSchedule && onSchedule ? (
          <button type="button" onClick={onSchedule} className="wa-btn-secondary !h-8 !w-auto !px-2.5 !text-[11px] max-[640px]:hidden">
            <CalendarDays size={13} strokeWidth={1.8} />
            {condensed ? "Follow-up" : "Schedule follow-up"}
          </button>
        ) : null}
        {action.showViewQuote && onViewQuote ? (
          <button type="button" onClick={onViewQuote} className="wa-btn-secondary !h-8 !w-auto !px-2.5 !text-[11px] max-[720px]:hidden">
            <FileText size={13} strokeWidth={1.8} /> View quote
          </button>
        ) : null}
      </div>
    </div>
  );
}
