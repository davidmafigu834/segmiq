"use client";

import { useMemo, useState } from "react";
import { CheckCircle, Phone } from "lucide-react";
import {
  classifyLeadLane,
  filterByLane,
  sortCallNowLane,
  matchesQualifiers,
  type LeadTier,
} from "@/lib/lead-lanes";
import { excludeGraduatedLeads } from "@/lib/retargeting-shared";
import type { PriorityLead } from "@/lib/sales-priority-lead";
import { PriorityLeadCard } from "@/components/sales/PriorityLeadCard";
import { useSalesLogSheet } from "@/components/sales/SalesLogFab";
import { EmptyState } from "@/components/ui";

type TierFilter = "all" | "hot" | "same_day";
type FitFilter = "all" | "fit";
type SortMode = "priority" | "newest";

export function CallNowClient({
  leads,
  repName,
}: {
  leads: PriorityLead[];
  repName: string;
}) {
  const [now] = useState(() => new Date());
  const [tierFilter, setTierFilter] = useState<TierFilter>("all");
  const [serviceFilter, setServiceFilter] = useState<string>("all");
  const [fitFilter, setFitFilter] = useState<FitFilter>("all");
  const [sortMode, setSortMode] = useState<SortMode>("priority");
  const { openLogSheet, logSheetProps } = useSalesLogSheet();

  const callNowLeads = useMemo(
    () => excludeGraduatedLeads(filterByLane(leads, "call_now", now), now),
    [leads, now]
  );

  const serviceOptions = useMemo(() => {
    const types = new Set<string>();
    for (const l of callNowLeads) {
      if (l.project_type?.trim()) types.add(l.project_type.trim());
    }
    return Array.from(types).sort();
  }, [callNowLeads]);

  const displayed = useMemo(() => {
    let filtered = callNowLeads;

    if (tierFilter !== "all") {
      filtered = filtered.filter(
        (l) => classifyLeadLane(l, now).tier === (tierFilter as LeadTier)
      );
    }

    if (serviceFilter !== "all") {
      filtered = filtered.filter(
        (l) => (l.project_type ?? "").trim() === serviceFilter
      );
    }

    if (fitFilter === "fit") {
      filtered = filtered.filter((l) =>
        matchesQualifiers(l, l.qualifiers ?? null).matched
      );
    }

    if (sortMode === "newest") {
      return [...filtered].sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    }

    return sortCallNowLane(filtered, now);
  }, [callNowLeads, tierFilter, serviceFilter, fitFilter, sortMode, now]);

  const { sheet } = logSheetProps(leads);

  const selectClass =
    "h-9 px-3 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border)] text-[13px] text-[var(--text-primary)] focus:border-[var(--border-hover)] focus:outline-none";

  return (
    <div>
      <p className="text-[13px] text-[var(--text-secondary)] mb-4">
        {callNowLeads.length} fresh lead{callNowLeads.length === 1 ? "" : "s"} waiting for first contact.
      </p>

      {callNowLeads.length > 0 && (
        <div className="ag-fade-in flex flex-wrap items-center gap-2 mb-6">
          <select
            value={tierFilter}
            onChange={(e) => setTierFilter(e.target.value as TierFilter)}
            className={selectClass}
            aria-label="Filter by tier"
          >
            <option value="all">All tiers</option>
            <option value="hot">Hot (&lt; 2h)</option>
            <option value="same_day">Same day</option>
          </select>

          <select
            value={serviceFilter}
            onChange={(e) => setServiceFilter(e.target.value)}
            className={selectClass}
            aria-label="Filter by service"
          >
            <option value="all">All services</option>
            {serviceOptions.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>

          <select
            value={fitFilter}
            onChange={(e) => setFitFilter(e.target.value as FitFilter)}
            className={selectClass}
            aria-label="Filter by campaign fit"
          >
            <option value="all">All leads</option>
            <option value="fit">Campaign fit only</option>
          </select>

          <select
            value={sortMode}
            onChange={(e) => setSortMode(e.target.value as SortMode)}
            className={selectClass}
            aria-label="Sort order"
          >
            <option value="priority">Sort: Priority</option>
            <option value="newest">Sort: Newest</option>
          </select>
        </div>
      )}

      {callNowLeads.length === 0 ? (
        <div className="ag-fade-in rounded-lg border border-[var(--border)] bg-[var(--surface-card)]">
          <EmptyState icon={CheckCircle} title="All caught up" description="No fresh leads are waiting for a first call right now." />
        </div>
      ) : displayed.length === 0 ? (
        <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-card)]">
          <EmptyState title="No matching leads" description="Change or clear a filter to see more leads." />
        </div>
      ) : (
        <div className="ag-fade-in ag-delay-1 flex flex-col gap-2">
          {displayed.map((lead) => (
            <PriorityLeadCard
              key={lead.id}
              lead={lead}
              lane="call_now"
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
