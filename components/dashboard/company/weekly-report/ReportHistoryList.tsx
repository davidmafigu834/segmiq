"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { MoreHorizontal } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/sales/ui";
import { salesMenuTriggerClass } from "@/components/sales/ui/Button";
import type { WeeklyReportListItem } from "@/lib/sales/weekly-team-report/types";
import { generatedLabel, pdfUrl, teamResultLabel } from "./format";
import { StatusLabel } from "./ReportStatus";

export function ReportHistoryList({
  reports,
  canDownload,
}: {
  reports: WeeklyReportListItem[];
  canDownload: boolean;
}) {
  const router = useRouter();
  if (reports.length === 0) return null;

  return (
    <div className="mt-8">
      <h2 className="text-[15px] font-semibold text-sales-text-primary">Previous weeks</h2>
      <div className="mt-3 hidden overflow-hidden rounded-[10px] border border-sales-border-subtle md:block">
        <table className="w-full text-left text-[13px]">
          <thead className="bg-sales-surface-subtle text-[11px] font-medium text-sales-text-muted">
            <tr>
              <th className="px-4 py-2.5 font-medium">Period</th>
              <th className="px-4 py-2.5 font-medium">Team result</th>
              <th className="px-4 py-2.5 font-medium">Key issue</th>
              <th className="px-4 py-2.5 font-medium">Generated</th>
              <th className="px-4 py-2.5 font-medium">Status</th>
              <th className="px-4 py-2.5 font-medium"><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            {reports.map((report, index) => {
              const previous = reports[index + 1];
              return (
                <tr
                  key={report.id}
                  className="cursor-pointer border-t border-sales-border-subtle hover:bg-sales-surface-hover"
                  onClick={() => router.push(`/client/reports/weekly/${report.id}`)}
                >
                  <td className="px-4 py-3 font-medium text-sales-text-primary">
                    <Link
                      href={`/client/reports/weekly/${report.id}`}
                      className="hover:underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {report.periodLabel}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-sales-text-secondary">{resultWithTrend(report, previous)}</td>
                  <td className="max-w-[240px] truncate px-4 py-3 text-sales-text-secondary">
                    {report.keyIssue || "—"}
                  </td>
                  <td className="px-4 py-3 text-sales-text-muted">{generatedLabel(report.generatedAt)}</td>
                  <td className="px-4 py-3">
                    <StatusLabel status={report.status} />
                  </td>
                  <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                    <RowMenu report={report} canDownload={canDownload} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <ul className="mt-3 space-y-3 md:hidden">
        {reports.map((report, index) => {
          const previous = reports[index + 1];
          return (
            <li key={report.id} className="rounded-[10px] border border-sales-border-subtle px-4 py-3">
              <div className="flex items-start justify-between gap-2">
                <button
                  type="button"
                  onClick={() => router.push(`/client/reports/weekly/${report.id}`)}
                  className="min-w-0 flex-1 text-left"
                >
                  <p className="font-medium text-sales-text-primary">{report.periodLabel}</p>
                  <p className="mt-1 text-[13px] text-sales-text-secondary">{resultWithTrend(report, previous)}</p>
                  <p className="mt-1 text-[12px] text-sales-text-muted">{report.keyIssue || "No key issue recorded"}</p>
                </button>
                <RowMenu report={report} canDownload={canDownload} />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function resultWithTrend(report: WeeklyReportListItem, previous?: WeeklyReportListItem) {
  const base = teamResultLabel(report);
  if (report.dealsWon == null || previous?.dealsWon == null) return base;
  const delta = report.dealsWon - previous.dealsWon;
  if (delta === 0) return `${base} · unchanged`;
  return `${base} · ${delta > 0 ? "up" : "down"} from ${previous.dealsWon}`;
}

function RowMenu({ report, canDownload }: { report: WeeklyReportListItem; canDownload: boolean }) {
  const router = useRouter();
  return (
    <DropdownMenu align="end">
      <DropdownMenuTrigger
        className={salesMenuTriggerClass({ variant: "ghost", size: "sm" })}
        aria-label={`Actions for ${report.periodLabel}`}
      >
        <MoreHorizontal size={16} strokeWidth={1.8} />
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem onSelect={() => router.push(`/client/reports/weekly/${report.id}`)}>
          Open report
        </DropdownMenuItem>
        {canDownload && report.hasPdf ? (
          <DropdownMenuItem onSelect={() => { window.location.href = pdfUrl(report.id); }}>
            Download PDF
          </DropdownMenuItem>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
