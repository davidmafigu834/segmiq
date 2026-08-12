"use client";

import { PracticeLeadScenario } from "./PracticeLeadScenario";
import { PracticePipelineScenario } from "./PracticePipelineScenario";
import { PracticeTasksScenario } from "./PracticeTasksScenario";
import { PracticeQuoteScenario } from "./PracticeQuoteScenario";
import { PracticeWhatsAppScenario } from "./PracticeWhatsAppScenario";
import { PracticeGoalsScenario } from "./PracticeGoalsScenario";
import type { PracticeScenarioId } from "@/lib/sales/training/types";

export function PracticeScenarioHost({ scenario }: { scenario: PracticeScenarioId }) {
  return (
    <div
      className="fixed inset-x-0 top-14 bottom-[var(--sales-mobile-nav-height,64px)] z-[85] overflow-y-auto bg-sales-bg p-4 layout:inset-y-0 layout:left-[var(--sales-sidebar-current-width,228px)] layout:right-0 layout:bottom-0 layout:top-0 layout:p-6"
      aria-label="Practice scenario"
    >
      <div className="mx-auto max-w-3xl">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <span className="rounded-[6px] bg-[rgba(212,255,79,0.28)] px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-sales-brand-text">
            Practice
          </span>
          <p className="text-[12px] text-sales-text-secondary">
            Actions here don&apos;t affect your real sales data.
          </p>
        </div>
        {scenario === "lead-to-deal" ? <PracticeLeadScenario /> : null}
        {scenario === "pipeline-stage" ? <PracticePipelineScenario /> : null}
        {scenario === "daily-plan-followup" ? <PracticeTasksScenario /> : null}
        {scenario === "quotation" ? <PracticeQuoteScenario /> : null}
        {scenario === "whatsapp-hub" ? <PracticeWhatsAppScenario /> : null}
        {scenario === "goals-overview" ? <PracticeGoalsScenario /> : null}
      </div>
    </div>
  );
}
