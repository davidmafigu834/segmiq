"use client";

import Link from "next/link";
import { Download } from "lucide-react";
import type { WeeklyReportListItem } from "@/lib/sales/weekly-team-report/types";
import { formatCompactMoney, generatedLabel, pdfUrl } from "./format";
import { ReadyIndicator } from "./ReportStatus";
import { salesMenuTriggerClass } from "@/components/sales/ui/Button";

export function LatestReportCard({
  report,
  canDownload,
}: {
  report: WeeklyReportListItem;
  canDownload: boolean;
}) {
  return (
    <article className="rounded-[10px] border border-sales-border-subtle bg-sales-surface px-4 py-5 layout:px-6 layout:py-6">
      <ReadyIndicator label="Latest" />
      <p className="mt-4 text-[12px] font-medium text-sales-text-muted">Weekly Sales Performance Report</p>
      <h2 className="mt-1 text-[26px] font-semibold tracking-[-0.03em] text-sales-text-primary">
        {report.periodLabel}
      </h2>
      <p className="mt-1 text-[12px] text-sales-text-muted">Generated {generatedLabel(report.generatedAt)}</p>
      {report.headline ? (
        <p className="mt-4 max-w-[68ch] text-[15px] leading-relaxed text-sales-text-secondary">{report.headline}</p>
      ) : report.lowData ? (
        <p className="mt-4 max-w-[68ch] text-[15px] leading-relaxed text-sales-text-secondary">
          Only limited activity was recorded this week, so the briefing stays factual rather than pattern-heavy.
        </p>
      ) : null}
      <dl className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Snapshot label="Leads" value={report.newLeads == null ? "—" : String(report.newLeads)} />
        <Snapshot label="Deals won" value={report.dealsWon == null ? "—" : String(report.dealsWon)} />
        <Snapshot
          label="Revenue"
          value={report.revenueWon == null ? "—" : formatCompactMoney(report.revenueWon, report.currency)}
        />
        <Snapshot label="Needs attention" value={String(report.findingCount)} />
      </dl>
      <div className="mt-5 flex flex-wrap gap-2">
        <Link href={`/client/reports/weekly/${report.id}`} className={salesMenuTriggerClass({ size: "sm" })}>
          Open report
        </Link>
        {canDownload && report.hasPdf ? (
          <a href={pdfUrl(report.id)} className={salesMenuTriggerClass({ variant: "secondary", size: "sm" })}>
            <Download size={14} strokeWidth={1.8} aria-hidden />
            Download
          </a>
        ) : null}
      </div>
    </article>
  );
}

function Snapshot({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] text-sales-text-muted">{label}</dt>
      <dd className="mt-1 text-[18px] font-semibold tabular-nums text-sales-text-primary">{value}</dd>
    </div>
  );
}
