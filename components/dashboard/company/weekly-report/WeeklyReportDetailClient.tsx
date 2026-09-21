"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { ArrowLeft, Download, MoreHorizontal, Printer } from "lucide-react";
import useSWR from "swr";
import {
  Button,
  ConfirmDialog,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Popover,
  PopoverContent,
  PopoverTrigger,
  SegmentedControl,
  Skeleton,
  useSalesToast,
} from "@/components/sales/ui";
import { salesMenuTriggerClass } from "@/components/sales/ui/Button";
import { CompanyWorkspaceShell } from "@/components/dashboard/company/CompanyWorkspaceShell";
import { P } from "@/lib/auth/rbac/permissions";
import { usePermissions } from "@/hooks/usePermissions";
import type { UserRole } from "@/types";
import type { AttentionItem, WeeklyReportDetail } from "@/lib/sales/weekly-team-report/types";
import { ReportDocument } from "./ReportDocument";
import { ReportNav } from "./ReportNav";
import { ReportSkeleton } from "./ReportSkeleton";
import { EvidenceDrawer } from "./EvidenceDrawer";
import { GenerationProgress } from "./ReportStatus";
import { friendlyGenerationError, isGenerating, pdfUrl } from "./format";

const PdfViewer = dynamic(() => import("./PdfViewer").then((mod) => mod.PdfViewer), {
  ssr: false,
  loading: () => (
    <div className="space-y-3 p-4">
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-[60vh] w-full" />
    </div>
  ),
});

async function fetcher(url: string): Promise<{ report: WeeklyReportDetail }> {
  const res = await fetch(url);
  if (res.status === 404) throw new Error("Not found");
  if (!res.ok) throw new Error("Failed to load report");
  return res.json();
}

export function WeeklyReportDetailClient({
  reportId,
  unreadNotifications,
  notificationRole,
  userName,
  avatarUrl,
  companyName,
  companyLogoUrl,
  whatsappBadge = 0,
}: {
  reportId: string;
  unreadNotifications: number;
  notificationRole: UserRole;
  userName: string;
  avatarUrl?: string | null;
  companyName?: string;
  companyLogoUrl?: string | null;
  whatsappBadge?: number;
}) {
  const { can } = usePermissions();
  const { toast } = useSalesToast();
  const { data, error, isLoading, mutate } = useSWR(`/api/reports/weekly/${reportId}`, fetcher, {
    revalidateOnFocus: false,
    refreshInterval: (current) => {
      const report = current?.report;
      if (!report) return 0;
      if (isGenerating(report.status)) return 4000;
      if (report.status === "ready" && report.payload && !report.hasPdf) return 5000;
      return 0;
    },
  });
  const [view, setView] = useState<"report" | "pdf">("report");
  const [retrying, setRetrying] = useState(false);
  const [confirmRegen, setConfirmRegen] = useState(false);
  const [evidence, setEvidence] = useState<{
    title: string;
    explanation: string;
    items: AttentionItem[];
  } | null>(null);

  const report = data?.report;
  const payload = report?.payload ?? null;
  const canDownload = can(P.REPORTS_TEAM_DOWNLOAD);
  const canGenerate = can(P.REPORTS_TEAM_GENERATE);

  const agendaText = useMemo(() => {
    const items = payload?.ai.meetingAgenda ?? [];
    return items.map((item, i) => `${i + 1}. ${item}`).join("\n");
  }, [payload]);

  async function regenerate() {
    setRetrying(true);
    try {
      const res = await fetch("/api/reports/weekly", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ periodStartDate: report?.periodStartDate, force: true }),
      });
      if (res.status === 403) {
        toast({ title: "You do not have permission to generate this report", tone: "error" });
        return;
      }
      if (!res.ok) {
        toast({ title: "Report generation failed", tone: "error" });
        return;
      }
      toast({ title: "Report regeneration started", tone: "info" });
      setConfirmRegen(false);
      setTimeout(() => void mutate(), 2500);
    } finally {
      setRetrying(false);
    }
  }

  function downloadPdf() {
    if (!report?.hasPdf) return;
    window.location.href = pdfUrl(report.id);
    toast({ title: "Report downloaded", tone: "success" });
  }

  async function copyAgenda() {
    if (!agendaText) return;
    try {
      await navigator.clipboard.writeText(agendaText);
      toast({ title: "Copied meeting agenda", tone: "success" });
    } catch {
      toast({ title: "Could not copy the agenda", tone: "error" });
    }
  }

  const title = payload?.cover.title ?? "Weekly Sales Performance Report";
  const period = report?.periodLabel ?? "";

  return (
    <CompanyWorkspaceShell
      companyName={companyName}
      companyLogoUrl={companyLogoUrl}
      userName={userName}
      avatarUrl={avatarUrl}
      unreadNotifications={unreadNotifications}
      notificationRole={notificationRole}
      whatsappBadge={whatsappBadge}
      preferCollapsedSidebar
    >
      <header className="weekly-report-toolbar sticky top-0 z-20 -mx-4 border-b border-sales-border-subtle bg-sales-bg/92 px-4 py-2.5 backdrop-blur-sm sm:-mx-6 sm:px-6 layout:-mx-8 layout:px-8">
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <Link
            href="/client/reports/weekly"
            className="inline-flex min-h-10 items-center gap-1.5 text-[13px] font-medium text-sales-text-secondary hover:text-sales-text-primary"
          >
            <ArrowLeft size={15} strokeWidth={1.8} aria-hidden />
            Back to reports
          </Link>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-semibold text-sales-text-primary">{title}</p>
            <p className="truncate text-[12px] text-sales-text-muted">{period}</p>
          </div>
          {payload ? (
            <SegmentedControl
              aria-label="Report view"
              value={view}
              onChange={setView}
              className="h-9"
              options={[
                { value: "report", label: "Report" },
                { value: "pdf", label: "PDF" },
              ]}
            />
          ) : null}
          {canDownload && report?.hasPdf ? (
            <Button
              size="sm"
              variant="secondary"
              className="hidden sm:inline-flex"
              leftIcon={<Download size={14} strokeWidth={1.8} />}
              onClick={downloadPdf}
            >
              Download PDF
            </Button>
          ) : report && !report.hasPdf && payload ? (
            <span className="hidden text-[12px] text-sales-text-muted sm:inline">PDF still being prepared</span>
          ) : null}
          {report && (report.hasPdf || canGenerate) ? (
            <DropdownMenu align="end">
              <DropdownMenuTrigger
                className={salesMenuTriggerClass({ variant: "ghost", size: "sm" })}
                aria-label="More report actions"
              >
                <MoreHorizontal size={16} strokeWidth={1.8} />
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                {canDownload && report.hasPdf ? (
                  <DropdownMenuItem icon={<Download size={14} />} onSelect={downloadPdf}>
                    Download PDF
                  </DropdownMenuItem>
                ) : null}
                {report.hasPdf ? (
                  <DropdownMenuItem
                    icon={<Printer size={14} />}
                    onSelect={() => window.open(pdfUrl(report.id, true), "_blank", "noopener,noreferrer")}
                  >
                    Print
                  </DropdownMenuItem>
                ) : null}
                {canGenerate ? (
                  <DropdownMenuItem onSelect={() => setConfirmRegen(true)}>Regenerate</DropdownMenuItem>
                ) : null}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </div>
      </header>

      {isLoading ? <ReportSkeleton /> : null}
      {error ? (
        <div className="mx-auto max-w-[44rem] py-10">
          <p className="text-[16px] font-semibold text-sales-text-primary">This report was not found</p>
          <p className="mt-2 text-[14px] text-sales-text-secondary">
            It may belong to another organisation, or it is no longer available.
          </p>
        </div>
      ) : null}

      {report && !payload && isGenerating(report.status) ? (
        <div className="mx-auto max-w-[44rem] py-10">
          <p className="text-[12px] font-medium text-sales-text-muted">{report.periodLabel}</p>
          <div className="mt-4">
            <GenerationProgress status={report.status} />
          </div>
        </div>
      ) : null}

      {report && !payload && report.status === "failed" ? (
        <div className="mx-auto max-w-[44rem] py-10">
          <p className="text-[16px] font-semibold text-sales-text-primary">We could not finish this week's report</p>
          <p className="mt-2 text-[14px] text-sales-text-secondary">{friendlyGenerationError(report.generationError)}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {canGenerate ? (
              <Button size="sm" loading={retrying} onClick={() => setConfirmRegen(true)}>
                Try again
              </Button>
            ) : null}
            <Link
              href="/client/reports/weekly"
              className="inline-flex h-8 items-center px-3 text-[12px] font-medium text-sales-text-secondary hover:text-sales-text-primary"
            >
              View previous reports
            </Link>
          </div>
        </div>
      ) : null}

      {report && payload && view === "report" ? (
        <div className="mt-4 flex items-start gap-10">
          <div className="min-w-0 flex-1">
            <div className="mb-4 xl:hidden">
              <Popover>
                <PopoverTrigger className={salesMenuTriggerClass({ variant: "secondary", size: "sm" })}>
                  Contents
                </PopoverTrigger>
                <PopoverContent className="w-[240px]">
                  <ReportNav compact onJump={() => undefined} />
                </PopoverContent>
              </Popover>
            </div>
            <ReportDocument
              payload={payload}
              onEvidence={(title, explanation, items) => setEvidence({ title, explanation, items })}
              onCopyAgenda={() => void copyAgenda()}
            />
          </div>
          <aside className="sticky top-[4.5rem] hidden w-52 shrink-0 xl:block">
            <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-sales-text-muted">Contents</p>
            {report.findingCount > 0 ? (
              <p className="mt-2 text-[12px] text-sales-text-secondary">
                {report.findingCount} {report.findingCount === 1 ? "finding" : "findings"} require review
              </p>
            ) : (
              <p className="mt-2 text-[12px] text-sales-text-muted">No urgent findings this week</p>
            )}
            <div className="mt-4">
              <ReportNav />
            </div>
            {canDownload && report.hasPdf ? (
              <button
                type="button"
                onClick={downloadPdf}
                className="mt-6 text-[12px] font-medium text-sales-text-secondary hover:text-sales-text-primary"
              >
                Download PDF
              </button>
            ) : null}
          </aside>
        </div>
      ) : null}

      {report && payload && view === "pdf" ? <PdfViewer reportId={reportId} available={Boolean(report.hasPdf)} /> : null}

      <EvidenceDrawer
        open={Boolean(evidence)}
        title={evidence?.title ?? ""}
        explanation={evidence?.explanation ?? ""}
        items={evidence?.items ?? []}
        currency={payload?.cover.currency ?? report?.currency ?? "USD"}
        onClose={() => setEvidence(null)}
      />

      <ConfirmDialog
        open={confirmRegen}
        onOpenChange={setConfirmRegen}
        title="Regenerate report?"
        description={`This will create a new analysis using the latest available data for ${period || "this period"}.`}
        confirmLabel="Regenerate"
        cancelLabel="Cancel"
        loading={retrying}
        onConfirm={() => void regenerate()}
      />
    </CompanyWorkspaceShell>
  );
}
