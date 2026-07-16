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
import { EmptyState, SegmentedTabs } from "@/components/ui";

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

      <div className="scrollbar-hide ag-fade-in mb-6 overflow-x-auto">
        <SegmentedTabs
          aria-label="Filter slipped leads by age"
          value={activeTab}
          onValueChange={(value) => setActiveTab(value as RecoverAgeTier)}
          tabs={RECOVER_AGE_TABS.map(({ tier, label }) => ({
            value: tier,
            label: `${label} · ${tabBuckets[tier].length}`,
          }))}
        />
      </div>

      {recoverLeads.length === 0 ? (
        <div className="ag-fade-in rounded-lg border border-[var(--border)] bg-[var(--surface-card)]">
          <EmptyState icon={AlertTriangle} title="No slipped leads" description="Every assigned lead has been contacted or is still fresh." />
        </div>
      ) : activeLeads.length === 0 ? (
        <div className="ag-fade-in ag-delay-1 rounded-lg border border-[var(--border)] bg-[var(--surface-card)]">
          <EmptyState title="Nothing in this window" description="No slipped leads fall in this age range right now." />
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
        className="fixed bottom-[calc(72px+env(safe-area-inset-bottom))] right-5 z-30 flex h-11 items-center gap-2 rounded-lg bg-[var(--accent)] px-3.5 text-[var(--accent-foreground)] shadow-[var(--shadow-lg)] transition-colors hover:bg-[var(--accent-hover)] layout:bottom-6"
        aria-label="Log a call"
      >
        <Phone size={17} />
        <span className="hidden text-[13px] font-semibold sm:inline">Log call</span>
      </button>
      {sheet}
    </div>
  );
}
