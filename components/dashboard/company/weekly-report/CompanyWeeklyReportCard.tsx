/* Hallmark · component: card · genre: modern-minimal · theme: Segmiq CRM
 * states: default · hover · focus · active · disabled · loading · error · success
 * contrast: pass (sales tokens)
 */
"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { Download } from "lucide-react";
import { Button, Skeleton } from "@/components/sales/ui";
import { salesMenuTriggerClass } from "@/components/sales/ui/Button";
import { CompanyDashCard } from "@/components/dashboard/company/CompanyDashCard";
import type { WeeklyReportListItem } from "@/lib/sales/weekly-team-report/types";
import { cn } from "@/lib/ui/cn";
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
  const headerAction =
    latest?.status === "ready" && latest.generatedAt ? (
      <span className="text-[11px] text-sales-text-muted">Generated {generatedLabel(latest.generatedAt)}</span>
    ) : (
      <Link
        href="/client/reports/weekly"
        className="text-[12px] font-medium text-sales-text-secondary transition-colors hover:text-sales-text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--sales-btn-focus-outline,#d4ff4f)]"
      >
        All reports
      </Link>
    );

  return (
    <CompanyDashCard
      title="Weekly team report"
      action={headerAction}
      className="dashboard-panel--focus weekly-report-dash-card"
    >
      {loading ? (
        <LoadingBody />
      ) : error ? (
        <ErrorBody />
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
        <GeneratingCard latest={latest} />
      ) : (
        <ReadyCard latest={latest} canDownload={canDownload} />
      )}
    </CompanyDashCard>
  );
}

function LoadingBody() {
  return (
    <div className="grid gap-5 px-4 py-4 layout:px-5 layout:py-5 lg:grid-cols-[minmax(0,1.3fr)_minmax(14rem,0.9fr)]">
      <div className="space-y-3">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-7 w-56" />
        <Skeleton className="h-16 w-full" />
      </div>
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-[8px] bg-sales-border-subtle">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-sales-surface px-3 py-3">
            <Skeleton className="h-3 w-12" />
            <Skeleton className="mt-2 h-6 w-16" />
          </div>
        ))}
      </div>
    </div>
  );
}

function ErrorBody() {
  return (
    <SplitShell
      left={
        <>
          <p className="text-[15px] font-semibold tracking-[-0.02em] text-sales-text-primary">
            Could not load the weekly report
          </p>
          <p className="mt-2 text-[13px] leading-relaxed text-sales-text-secondary">
            Try again in a moment from Reports.
          </p>
        </>
      }
      right={
        <Link href="/client/reports/weekly" className={cn(salesMenuTriggerClass({ size: "sm" }), "w-full justify-center")}>
          Open reports
        </Link>
      }
    />
  );
}

function EmptyCard() {
  return (
    <SplitShell
      left={
        <>
          <p className="text-[15px] font-semibold tracking-[-0.02em] text-sales-text-primary">
            Not enough activity yet
          </p>
          <p className="mt-2 text-[13px] leading-relaxed text-sales-text-secondary">
            SegmiQ needs more team activity before it can produce a useful briefing. It appears automatically after a
            sales week closes.
          </p>
        </>
      }
      right={
        <Link href="/client/reports/weekly" className={cn(salesMenuTriggerClass({ variant: "secondary", size: "sm" }), "w-full justify-center")}>
          View available activity
        </Link>
      }
    />
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
    <SplitShell
      left={
        <>
          <p className="text-[12px] text-sales-text-muted">{latest.periodLabel}</p>
          <p className="mt-2 text-[15px] font-semibold tracking-[-0.02em] text-sales-text-primary">
            {"This week's report did not finish"}
          </p>
          <p className="mt-2 text-[13px] leading-relaxed text-sales-text-secondary">{friendlyGenerationError(null)}</p>
        </>
      }
      right={
        <div className="flex flex-col gap-2">
          {canGenerate && onRetry ? (
            <Button size="sm" className="w-full" onClick={onRetry}>
              Try again
            </Button>
          ) : null}
          {previousReadyId ? (
            <Link
              href={`/client/reports/weekly/${previousReadyId}`}
              className={cn(salesMenuTriggerClass({ variant: "secondary", size: "sm" }), "w-full justify-center")}
            >
              View previous report
            </Link>
          ) : null}
        </div>
      }
    />
  );
}

function GeneratingCard({ latest }: { latest: WeeklyReportListItem }) {
  return (
    <SplitShell
      left={
        <>
          <p className="text-[12px] text-sales-text-muted">{latest.periodLabel}</p>
          <div className="mt-3">
            <GenerationProgress status={latest.status} />
          </div>
        </>
      }
      right={
        <p className="text-[13px] leading-relaxed text-sales-text-muted">
          {"This card will fill with the week's numbers as soon as the briefing is ready."}
        </p>
      }
    />
  );
}

function ReadyCard({ latest, canDownload }: { latest: WeeklyReportListItem; canDownload?: boolean }) {
  const snapshot = [
    { label: "Leads", value: latest.newLeads == null ? "-" : String(latest.newLeads) },
    { label: "Won", value: latest.dealsWon == null ? "-" : String(latest.dealsWon) },
    {
      label: "Revenue",
      value: latest.revenueWon == null ? "-" : formatCompactMoney(latest.revenueWon, latest.currency),
    },
    { label: "Issues", value: String(latest.findingCount) },
  ];

  return (
    <SplitShell
      left={
        <>
          <ReadyIndicator />
          <h3 className="mt-3 text-[20px] font-semibold tracking-[-0.03em] text-sales-text-primary">
            {latest.periodLabel}
          </h3>
          <p className="mt-2 text-[14px] leading-relaxed text-sales-text-secondary">{briefingLine(latest)}</p>
        </>
      }
      right={
        <>
          <dl className="grid grid-cols-2 overflow-hidden rounded-[8px] border border-sales-border-subtle">
            {snapshot.map((item, index) => (
              <div
                key={item.label}
                className={[
                  "px-3 py-3",
                  index < 2 ? "border-b border-sales-border-subtle" : "",
                  index % 2 === 0 ? "border-r border-sales-border-subtle" : "",
                ].join(" ")}
              >
                <dt className="text-[11px] text-sales-text-muted">{item.label}</dt>
                <dd className="mt-1 text-[18px] font-semibold tabular-nums tracking-[-0.02em] text-sales-text-primary">
                  {item.value}
                </dd>
              </div>
            ))}
          </dl>
          <div className="mt-3 grid grid-cols-1 gap-2 min-[420px]:grid-cols-2">
            <Link
              href={`/client/reports/weekly/${latest.id}`}
              className={cn(salesMenuTriggerClass({ size: "sm" }), "w-full justify-center")}
            >
              View report
            </Link>
            {canDownload && latest.hasPdf ? (
              <a
                href={pdfUrl(latest.id)}
                className={cn(salesMenuTriggerClass({ variant: "secondary", size: "sm" }), "w-full justify-center")}
              >
                <Download size={14} strokeWidth={1.8} aria-hidden />
                Download PDF
              </a>
            ) : (
              <span className="hidden min-[420px]:block" />
            )}
          </div>
        </>
      }
    />
  );
}

function SplitShell({ left, right }: { left: ReactNode; right: ReactNode }) {
  return (
    <div className="grid items-start gap-5 px-4 py-4 layout:px-5 layout:py-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(15rem,0.9fr)] lg:gap-6">
      <div className="min-w-0">{left}</div>
      <div className="min-w-0 lg:border-l lg:border-sales-border-subtle lg:pl-5">{right}</div>
    </div>
  );
}

function briefingLine(latest: WeeklyReportListItem): string {
  if (latest.lowData) {
    return "Limited activity this week, so the briefing stays factual rather than pattern-heavy.";
  }
  if (latest.keyIssue) return latest.keyIssue;
  const headline = latest.headline?.trim() ?? "";
  if (!headline) return "The weekly sales briefing is ready for the management review.";
  const first = headline.split(/(?<=\.)\s/)[0] ?? headline;
  return first;
}
