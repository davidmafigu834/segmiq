"use client";

import { useSearchParams } from "next/navigation";
import { Download } from "lucide-react";

export function ClientExportCsvButton() {
  const searchParams = useSearchParams();
  const qs = searchParams.toString();
  if (!qs.includes("from")) return null;
  return (
    <a
      href={`/api/reports/client/export?${qs}`}
      className="inline-flex h-9 items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--bg-tertiary)] px-3.5 text-[13px] font-medium text-[var(--text-secondary)] transition-colors hover:border-[var(--border-hover)] hover:text-[var(--text-primary)]"
    >
      <Download className="h-4 w-4" strokeWidth={1.5} />
      Export CSV
    </a>
  );
}
