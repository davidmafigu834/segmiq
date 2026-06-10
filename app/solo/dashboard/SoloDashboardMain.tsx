"use client";

import { useEffect, useMemo, useState } from "react";
import { Phone } from "lucide-react";
import {
  classifyLeadLane,
  sortWithinLane,
  sortCallNowLane,
  type LeadLane,
} from "@/lib/lead-lanes";
import { isRetargetingGraduated } from "@/lib/retargeting-shared";
import type { PriorityLead } from "@/lib/sales-priority-lead";
import { PriorityLanes } from "@/components/sales/PriorityLanes";
import { RetargetingBanners } from "@/components/sales/RetargetingBanner";
import { PulseBar } from "@/components/dashboard/PulseBar";
import { useSalesLogSheet } from "@/components/sales/SalesLogFab";
import type { SoloDashboardData } from "@/lib/dashboard-data";
import SalesDashboardSkeleton from "@/app/sales/dashboard/SalesDashboardSkeleton";

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "morning";
  if (h < 17) return "afternoon";
  return "evening";
}

export default function SoloDashboardMain({
  data,
  session,
}: {
  data: SoloDashboardData;
  session: { user?: { name?: string | null } | null };
}) {
  const firstName = session.user?.name?.split(" ")[0] ?? "there";
  const repName = session.user?.name ?? "";
  const { openLogSheet, logSheetProps } = useSalesLogSheet();
  const { sheet } = logSheetProps(data.sales.allActiveLeads);

  const [now] = useState(() => new Date());
  const [nurtureOpen, setNurtureOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const lanes = useMemo(() => {
    const all = data.sales.allActiveLeads ?? [];
    const buckets: Record<LeadLane, PriorityLead[]> = {
      call_now: [],
      follow_ups: [],
      recover: [],
      nurture: [],
    };
    for (const lead of all) {
      const lane = classifyLeadLane(lead, now).lane;
      if ((lane === "call_now" || lane === "recover") && isRetargetingGraduated(lead, now)) {
        continue;
      }
      buckets[lane].push(lead);
    }
    return {
      call_now: sortCallNowLane(buckets.call_now, now),
      follow_ups: sortWithinLane(buckets.follow_ups),
      recover: sortWithinLane(buckets.recover),
      nurture: sortWithinLane(buckets.nurture),
    } as Record<LeadLane, PriorityLead[]>;
  }, [data.sales.allActiveLeads, now]);

  const hasAnyLeads = (data.sales.allActiveLeads?.length ?? 0) > 0;

  const summaryLine = `${data.overnightNewLeads} new lead${data.overnightNewLeads === 1 ? "" : "s"} overnight · ${data.followUpsDueToday} follow-up${data.followUpsDueToday === 1 ? "" : "s"} due today`;

  if (!mounted) return <SalesDashboardSkeleton />;

  return (
    <div>
      <header className="mb-6 flex items-center justify-between gap-4">
        <span className="font-display text-xl tracking-tight text-[var(--accent)]">Segmiq</span>
        <div className="min-w-0 text-right">
          <p className="truncate text-[13px] font-semibold text-[var(--text-primary)]">{repName}</p>
          <p className="truncate text-[12px] text-[var(--text-tertiary)]">{data.clientName}</p>
        </div>
      </header>

      <div className="mb-6">
        <h1
          className="text-3xl tracking-tight text-[var(--text-primary)] mb-2"
          style={{ fontFamily: "var(--font-instrument-serif), 'Instrument Serif', Georgia, serif" }}
        >
          Good {getGreeting()}, {firstName}
        </h1>
        <p className="text-[14px] text-[var(--text-secondary)]">{summaryLine}</p>
      </div>

      <div className="mb-2">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-[var(--text-tertiary)] mb-3">
          Your business
        </p>
        <PulseBar metrics={data.businessMetrics} />
      </div>

      {(data.sales.retargetingStatuses?.length ?? 0) > 0 && (
        <RetargetingBanners statuses={data.sales.retargetingStatuses!} />
      )}

      <PriorityLanes
        lanes={lanes}
        now={now}
        repName={repName}
        hasAnyLeads={hasAnyLeads}
        nurtureOpen={nurtureOpen}
        onNurtureOpenChange={setNurtureOpen}
        onOpenLogSheet={openLogSheet}
      />

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
