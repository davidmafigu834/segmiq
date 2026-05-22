"use client";

import { useEffect, useState } from "react";
import { ClientReportsControls } from "@/components/client-reports/ClientReportsControls";
import { ClientExportCsvButton } from "@/components/client-reports/ClientExportCsvButton";
import { ClientReportsDashboard } from "@/components/client-reports/ClientReportsDashboard";

export function ClientReportsPageClient({ clientName }: { clientName: string }) {
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 2500);
    return () => window.clearTimeout(t);
  }, [toast]);

  return (
    <>
      {toast ? (
        <div
          role="status"
          className="fixed bottom-6 right-6 z-50 rounded-md border border-border bg-surface-sidebar px-4 py-2 text-sm text-[var(--text-on-dark)] shadow-lg"
        >
          {toast}
        </div>
      ) : null}

      <div className="mb-10 flex flex-col gap-6 layout:flex-row layout:items-start layout:justify-between">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-wide text-ink-tertiary">
            {clientName} / REPORTS
          </p>
          <h1 className="font-display text-[26px] leading-none tracking-display text-ink-primary sm:text-[36px]">Performance</h1>
          <p className="mt-2 text-[14px] text-[var(--text-secondary)]">
            Here&apos;s what&apos;s happening in your pipeline.
          </p>
        </div>
        <div className="flex flex-col items-stretch gap-4 layout:items-end">
          <div className="flex flex-wrap justify-end gap-2">
            <button type="button" className="btn-ghost" onClick={() => setToast("Coming soon")}>
              Share report
            </button>
            <ClientExportCsvButton />
          </div>
          <ClientReportsControls />
        </div>
      </div>
      <ClientReportsDashboard />
    </>
  );
}
