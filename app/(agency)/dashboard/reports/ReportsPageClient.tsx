"use client";

import { Suspense } from "react";
import { ReportsControls, type ClientOption } from "@/components/reports/ReportsControls";
import { ReportsDashboard } from "@/components/reports/ReportsDashboard";

function ReportsPageSkeleton() {
  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <div className="h-4 w-40 animate-pulse rounded bg-surface-card-alt" />
        <div className="h-10 w-56 animate-pulse rounded bg-surface-card-alt" />
      </div>
      <div className="h-24 animate-pulse rounded-xl bg-surface-card-alt" />
      <div className="h-96 animate-pulse rounded-xl bg-surface-card-alt" />
    </div>
  );
}

function ReportsPageContent({ clients }: { clients: ClientOption[] }) {
  return (
    <div className="min-w-0 space-y-6 sm:space-y-8">
      <div className="flex min-w-0 flex-col gap-5 border-b border-[var(--border)] pb-5 layout:flex-row layout:items-start layout:justify-between layout:gap-8">
        <div className="min-w-0">
          <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink-tertiary">PLATFORM / Reports</p>
          <h1 className="mt-1 font-display text-[26px] leading-tight tracking-display text-ink-primary sm:text-[32px] layout:text-[40px]">
            Reports
          </h1>
          <p className="mt-2 max-w-xl text-[13px] leading-relaxed text-ink-secondary sm:text-sm">
            Portfolio performance, lead volume, and team rankings across your clients.
          </p>
        </div>
        <div className="min-w-0 w-full layout:max-w-[640px] layout:shrink-0">
          <ReportsControls clients={clients} />
        </div>
      </div>
      <ReportsDashboard />
    </div>
  );
}

export function ReportsPageClient({ clients }: { clients: ClientOption[] }) {
  return (
    <Suspense fallback={<ReportsPageSkeleton />}>
      <ReportsPageContent clients={clients} />
    </Suspense>
  );
}
