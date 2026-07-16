"use client";

import { useSearchParams } from "next/navigation";
import { Download } from "lucide-react";
import { effectiveReportQueryString } from "@/lib/reports/report-range";

export function ExportCsvButton() {
  const searchParams = useSearchParams();
  const qs = effectiveReportQueryString(searchParams);
  return (
    <a
      href={`/api/reports/agency/export?${qs}`}
      className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-border px-3 py-2.5 text-sm text-ink-secondary hover:border-border-strong sm:w-auto sm:py-1.5"
    >
      <Download className="h-4 w-4 shrink-0" strokeWidth={1.5} />
      Export CSV
    </a>
  );
}
