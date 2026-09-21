"use client";

import Link from "next/link";
import { Download } from "lucide-react";
import { Button, Skeleton } from "@/components/sales/ui";
import { salesMenuTriggerClass } from "@/components/sales/ui/Button";
import { CompanyDashCard } from "@/components/dashboard/company/CompanyDashCard";
import type { WeeklyReportListItem } from "@/lib/sales/weekly-team-report/types";
import { formatCompactMoney, friendlyGenerationError, generatedLabel, isGenerating, pdfUrl } from "./format";
import { GenerationProgress, ReadyIndicator } from "./ReportStatus";

export function CompanyWeeklyReportCard({
  latest,
  previousReadyId,
  loading,
  error,
  onRetry,
  canGenerate,
  canDownload,
}: {
  latest: WeeklyReportListItem | null;
  previousReadyId?: string | null;
  loading?: boolean;
  error?: boolean;
  onRetry?: () => void;
  canGenerate?: boolean;
  canDownload?: boolean;
}) {
  return (
    <CompanyDashCard title="Weekly team report" className="dashboard-panel--focus weekly-report-dash-card">
      {loading ? (
        <div className="space-y-3 px-4 py-4 layout:px-5">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-8 w-48" />
        </div>
      ) : error ? (
        <div className="px-4 py-5 layout:px-5">
          <p className="text-[14px] font-medium text-sales-text-primary">Could not load the weekly report</p>
          <p className="mt-1 text-[13px] text-sales-text-muted">Try again in a moment from Reports.</p>
        </div>
      ) : !latest ? (
        <EmptyCard />
      ) : latest.status === "failed" ? (
        <FailedCard
          latest={latest}
          previousReadyId={previousReadyId}
          onRetry={onRetry}
          canGenerate={canGenerate}
        />
      ) : isGenerating(latest.status) ? (
        <div className="px-4 py-5 layout:px-5">
          <p className="text-[12px] font-medium text-sales-text-muted">{latest.periodLabel}</p>
          <div className="mt-3">
            <GenerationProgress status={latest.status} />
          </div>
        </div>
      ) : (
        <ReadyCard latest={latest} canDownload={canDownload} />
      )}
    </CompanyDashCard>
  );
}

function EmptyCard() {
  return (
    <div className="px-4 py-5 layout:px-5">
      <p className="text-[15px] font-semibold text-sales-text-primary">Not enough activity yet</p>
      <p className="mt-1 max-w-[54ch] text-[13px] leading-relaxed text-sales-text-secondary">
        SegmiQ needs more team activity before it can produce meaningful performance insights. The briefing appears automatically after a sales week closes.
      </p>
      <Link
        href="/client/reports/weekly"
        className="mt-3 inline-flex text-[13px] font-medium text-sales-text-secondary hover:text-sales-text-primary"
      >
        View available activity
      </Link>
    </div>
  );
}

function FailedCard({
  latest,
  previousReadyId,
  onRetry,
  canGenerate,
}: {
  latest: WeeklyReportListItem;
  previousReadyId?: string | null;
  onRetry?: () => void;
  canGenerate?: boolean;
}) {
  return (
    <div className="px-4 py-5 layout:px-5">
      <p className="text-[12px] font-medium text-sales-text-muted">{latest.periodLabel}</p>
      <p className="mt-2 text-[15px] font-semibold text-sales-text-primary">We could not finish this week’s report</p>
      <p className="mt-1 max-w-[54ch] text-[13px] text-sales-text-secondary">{friendlyGenerationError(null)}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        {canGenerate && onRetry ? (
          <Button size="sm" onClick={onRetry}>
            Try again
          </Button>
        ) : null}
        {previousReadyId ? (
          <Link
            href={`/client/reports/weekly/${previousReadyId}`}
            className="inline-flex h-8 items-center px-3 text-[12px] font-medium text-sales-text-secondary hover:text-sales-text-primary"
          >
            View previous report
          </Link>
        ) : null}
      </div>
    </div>
  );
}

function ReadyCard({ latest, canDownload }: { latest: WeeklyReportListItem; canDownload?: boolean }) {
  const snapshot = [
    latest.newLeads != null ? { label: "Leads", value: String(latest.newLeads) } : null,
    latest.dealsWon != null ? { label: "Won", value: String(latest.dealsWon) } : null,
    latest.revenueWon != null
      ? { label: "Revenue", value: formatCompactMoney(latest.revenueWon, latest.currency) }
      : null,
    latest.findingCount > 0 ? { label: "Issues", value: String(latest.findingCount) } : null,
  ].filter(Boolean) as Array<{ label: string; value: string }>;

  return (
    <div className="px-4 py-4 transition-[border-color,box-shadow] duration-150 layout:px-5 layout:py-5">
      <ReadyIndicator />
      <p className="mt-3 text-[12px] font-medium text-sales-text-muted">Sales performance report</p>
      <h3 className="mt-1 text-[18px] font-semibold tracking-[-0.02em] text-sales-text-primary">
        {latest.periodLabel}
      </h3>
      {latest.lowData ? (
        <p className="mt-2 max-w-[62ch] text-[14px] leading-relaxed text-sales-text-secondary">
          Only limited activity was recorded this week, so the briefing stays factual rather than pattern-heavy.
        </p>
      ) : (
        <p className="mt-2 max-w-[62ch] text-[14px] leading-relaxed text-sales-text-secondary">
          {latest.headline || "Weekly sales performance report is ready for the management review."}
        </p>
      )}
      {snapshot.length > 0 ? (
        <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-4">
          {snapshot.map((item) => (
            <div key={item.label}>
              <dt className="text-[11px] text-sales-text-muted">{item.label}</dt>
              <dd className="mt-0.5 text-[16px] font-semibold tabular-nums text-sales-text-primary">{item.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      <p className="mt-3 text-[12px] text-sales-text-muted">
        {latest.findingCount} {latest.findingCount === 1 ? "area" : "areas"} requiring management attention
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Link href={`/client/reports/weekly/${latest.id}`} className={salesMenuTriggerClass({ size: "sm" })}>
          View report
        </Link>
        {canDownload && latest.hasPdf ? (
          <a href={pdfUrl(latest.id)} className={salesMenuTriggerClass({ variant: "secondary", size: "sm" })}>
            <Download size={14} strokeWidth={1.8} aria-hidden />
            Download PDF
          </a>
        ) : null}
      </div>
      <p className="mt-3 text-[11px] text-sales-text-muted">Generated {generatedLabel(latest.generatedAt)}</p>
    </div>
  );
}
