"use client";

import { useEffect, useState } from "react";
import { ClientReportsControls } from "@/components/client-reports/ClientReportsControls";
import { ClientExportCsvButton } from "@/components/client-reports/ClientExportCsvButton";
import { ClientReportsDashboard } from "@/components/client-reports/ClientReportsDashboard";
import { PageHeader } from "@/components/ui";

export function ClientReportsPageClient({ clientName }: { clientName: string }) {
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 2500);
    return () => window.clearTimeout(t);
  }, [toast]);

  return (
    <div className="min-w-0 w-full max-w-full overflow-x-hidden pb-16">
      {toast ? (
        <div
          role="status"
          className="fixed bottom-[calc(72px+env(safe-area-inset-bottom))] right-4 z-50 rounded-lg border border-[var(--border)] bg-[var(--surface-card)] px-4 py-2.5 text-sm text-[var(--text-primary)] shadow-[var(--shadow-lg)] layout:bottom-6"
        >
          {toast}
        </div>
      ) : null}

      <PageHeader
        className="mb-6 ag-fade-in"
        eyebrow={`${clientName} / Reports`}
        title="Performance"
        description="Pipeline movement, team output, and wins for the selected period."
        actions={
          <div className="flex flex-wrap justify-end gap-2">
            <button
              type="button"
              className="inline-flex h-9 items-center rounded-lg border border-[var(--border)] bg-[var(--bg-tertiary)] px-3.5 text-[13px] font-medium text-[var(--text-secondary)] transition-colors hover:border-[var(--border-hover)] hover:text-[var(--text-primary)]"
              onClick={() => setToast("Coming soon")}
            >
              Share report
            </button>
            <ClientExportCsvButton />
          </div>
        }
      />

      <div className="ag-fade-in ag-delay-1 mb-8">
        <ClientReportsControls />
      </div>

      <ClientReportsDashboard />
    </div>
  );
}
