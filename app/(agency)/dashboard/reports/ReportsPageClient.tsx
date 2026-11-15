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
      <div className="min-w-0">
        <ReportsControls clients={clients} />
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
