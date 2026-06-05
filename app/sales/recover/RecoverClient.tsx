"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AlertTriangle, Phone } from "lucide-react";
import {
  filterByLane,
  recoverAgeTier,
  sortWithinLane,
  RECOVER_AGE_TABS,
  type RecoverAgeTier,
} from "@/lib/lead-lanes";
import { excludeGraduatedLeads } from "@/lib/retargeting-shared";
import type { PriorityLead } from "@/lib/sales-priority-lead";
import { PriorityLeadCard } from "@/components/sales/PriorityLeadCard";
import { useSalesLogSheet } from "@/components/sales/SalesLogFab";

const DEFAULT_TAB: RecoverAgeTier = "week";

export function RecoverClient({
  leads,
  repName,
}: {
  leads: PriorityLead[];
  repName: string;
}) {
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab") as RecoverAgeTier | null;
  const initialTab =
    tabParam && RECOVER_AGE_TABS.some((t) => t.tier === tabParam)
      ? tabParam
      : DEFAULT_TAB;

  const [now] = useState(() => new Date());
  const [activeTab, setActiveTab] = useState<RecoverAgeTier>(initialTab);
  const { openLogSheet, logSheetProps } = useSalesLogSheet();

  const recoverLeads = useMemo(
    () => excludeGraduatedLeads(filterByLane(leads, "recover", now), now),
    [leads, now]
  );

  const tabBuckets = useMemo(() => {
    const buckets: Record<RecoverAgeTier, PriorityLead[]> = {
      week: [],
      two_weeks: [],
      month: [],
      month_plus: [],
    };
    for (const lead of recoverLeads) {
      buckets[recoverAgeTier(lead, now)].push(lead);
    }
    for (const tier of RECOVER_AGE_TABS) {
      buckets[tier.tier] = sortWithinLane(buckets[tier.tier]);
    }
    return buckets;
  }, [recoverLeads, now]);

  const activeLeads = tabBuckets[activeTab];
  const { sheet } = logSheetProps(leads);

  return (
    <div>
      <p className="text-[13px] text-[var(--text-secondary)] mb-4">
        {recoverLeads.length} slipped lead{recoverLeads.length === 1 ? "" : "s"} still uncontacted.
      </p>

      <div className="ag-fade-in -mx-1 mb-6 overflow-x-auto">
        <div className="flex gap-1 min-w-max px-1 pb-1">
          {RECOVER_AGE_TABS.map(({ tier, label }) => {
            const count = tabBuckets[tier].length;
            const isActive = activeTab === tier;
            return (
              <button
                key={tier}
                type="button"
                onClick={() => setActiveTab(tier)}
                className={`relative flex items-center gap-1.5 px-4 py-2.5 rounded-lg border text-[13px] font-semibold whitespace-nowrap transition-colors ${
                  isActive
                    ? "border-[var(--accent)] text-[var(--accent)] bg-[var(--accent-muted)]"
                    : "border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--border-hover)]"
                }`}
              >
                {label}
                <span
                  className={`text-[12px] ${
                    isActive ? "text-[var(--accent)]" : "text-[var(--text-tertiary)]"
                  }`}
                >
                  {count}
                </span>
                {isActive && (
                  <span className="absolute bottom-0 left-3 right-3 h-0.5 rounded-full bg-[var(--accent)]" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {recoverLeads.length === 0 ? (
        <div className="ag-fade-in rounded-xl border border-[var(--border)] bg-[var(--surface-card)] flex flex-col items-center justify-center py-16 text-center px-5">
          <AlertTriangle className="w-8 h-8 text-[var(--warning)] mb-3" />
          <p className="text-[15px] font-semibold text-[var(--text-primary)] mb-1">
            No slipped leads
          </p>
          <p className="text-[13px] text-[var(--text-tertiary)]">
            Every assigned lead has been contacted or is still fresh.
          </p>
        </div>
      ) : activeLeads.length === 0 ? (
        <div className="ag-fade-in ag-delay-1 rounded-xl border border-[var(--border)] bg-[var(--surface-card)] flex flex-col items-center justify-center py-16 text-center px-5">
          <p className="text-[15px] font-semibold text-[var(--text-primary)] mb-1">
            Nothing in this window
          </p>
          <p className="text-[13px] text-[var(--text-tertiary)]">
            No slipped leads fall in this age range right now.
          </p>
        </div>
      ) : (
        <div className="ag-fade-in ag-delay-1 flex flex-col gap-2">
          {activeLeads.map((lead) => (
            <PriorityLeadCard
              key={lead.id}
              lead={lead}
              lane="recover"
              now={now}
              repName={repName}
              onOpenLogSheet={openLogSheet}
            />
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={() => openLogSheet("")}
        className="fixed right-5 bottom-[calc(72px+env(safe-area-inset-bottom))] z-30 w-14 h-14 rounded-full bg-[var(--accent)] text-[var(--accent-foreground)] flex items-center justify-center shadow-[var(--shadow-accent-glow)] hover:bg-[var(--accent-hover)] transition-colors"
        aria-label="Log a call"
      >
        <Phone size={22} />
      </button>
      {sheet}
    </div>
  );
}
