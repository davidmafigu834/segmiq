"use client";

import { Suspense } from "react";
import { ReportsControls, type ClientOption } from "@/components/reports/ReportsControls";
import { ReportsDashboard } from "@/components/reports/ReportsDashboard";

export function ReportsPageClient({ clients }: { clients: ClientOption[] }) {
  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-6 layout:flex-row layout:items-start layout:justify-between">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink-tertiary">AGENCY / REPORTS</p>
          <h1 className="font-display text-[28px] tracking-display text-ink-primary md:text-[40px]">Reports</h1>
        </div>
        <Suspense fallback={<div className="h-24 w-full max-w-md animate-pulse rounded-md bg-surface-card-alt" />}>
          <ReportsControls clients={clients} />
        </Suspense>
      </div>
      <Suspense fallback={<div className="h-96 animate-pulse rounded-xl bg-surface-card-alt" />}>
        <ReportsDashboard />
      </Suspense>
    </div>
  );
}
