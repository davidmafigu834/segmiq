"use client";

import Link from "next/link";
import {
  CheckCircle2,
  FileText,
  Handshake,
  PhoneCall,
  Send,
  Sparkles,
  Target,
  UserPlus,
} from "lucide-react";
import { cn } from "@/lib/ui/cn";
import { Avatar, Badge } from "@/components/sales/ui";
import { CompanyDashCard, CompanyDashEmpty, DashLink, PeriodChip } from "./CompanyDashCard";
import type { CompanyDailyTeamMemberRow, CompanyDailyTeamReport } from "./types";
import { useCompanyWorkspace } from "@/components/company/CompanyWorkspaceContext";
import {
  assessDailyReportDay,
  buildSalespersonDailyNarrative,
  buildTeamDailySummaryNarrative,
  type DailyReportDayTone,
} from "@/lib/sales/company-daily-team-report-narrative";

const DAY_TONE_STYLES: Record<
  DailyReportDayTone,
  { badge: "success" | "warning" | "neutral" | "info"; className: string }
> = {
  strong: {
    badge: "success",
    className: "border-sales-success/20 bg-sales-success-soft/40",
  },
  attention: {
    badge: "warning",
    className: "border-sales-warning/25 bg-sales-warning-soft/35",
  },
  quiet: {
    badge: "neutral",
    className: "border-sales-border-subtle bg-sales-surface-subtle/70",
  },
  on_track: {
    badge: "info",
    className: "border-sales-border-subtle bg-sales-surface-subtle/70",
  },
};

function TeamMetric({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "default" | "success" | "warning";
}) {
  return (
    <div className="min-w-[88px] flex-1 rounded-[10px] border border-sales-border-subtle bg-sales-surface px-3 py-2.5">
      <p className="text-[10px] font-medium uppercase tracking-[0.04em] text-sales-text-muted">
        {label}
      </p>
      <p
        className={cn(
          "mt-1 text-[20px] font-semibold tabular-nums leading-none",
          tone === "success" && value > 0 && "text-sales-success-fg",
          tone === "warning" && value > 0 && "text-sales-warning-fg",
          (!tone || tone === "default" || value <= 0) && "text-sales-text-primary"
        )}
      >
        {value}
      </p>
    </div>
  );
}

function ReportMetric({
  icon: Icon,
  label,
  value,
  emphasize,
}: {
  icon: typeof UserPlus;
  label: string;
  value: number;
  emphasize?: "success" | "warning";
}) {
  return (
    <div className="flex min-w-0 flex-1 items-center gap-2 rounded-[10px] bg-sales-surface-subtle px-2.5 py-2">
      <span
        className={cn(
          "flex h-7 w-7 shrink-0 items-center justify-center rounded-[8px]",
          emphasize === "success" && value > 0 && "bg-sales-success-soft text-sales-success-fg",
          emphasize === "warning" && value > 0 && "bg-sales-warning-soft text-sales-warning-fg",
          (!emphasize || value <= 0) && "bg-sales-surface text-sales-text-muted"
        )}
      >
        <Icon size={14} strokeWidth={1.8} aria-hidden />
      </span>
      <div className="min-w-0">
        <p className="truncate text-[10px] font-medium uppercase tracking-[0.04em] text-sales-text-muted">
          {label}
        </p>
        <p
          className={cn(
            "text-[15px] font-semibold tabular-nums leading-none",
            emphasize === "success" && value > 0 && "text-sales-success-fg",
            emphasize === "warning" && value > 0 && "text-sales-warning-fg",
            (!emphasize || value <= 0) && "text-sales-text-primary"
          )}
        >
          {value}
        </p>
      </div>
    </div>
  );
}

function SalespersonDailyReport({
  row,
  report,
  showQuotes,
  leadSingular,
  leadPlural,
  dealLabel,
}: {
  row: CompanyDailyTeamMemberRow;
  report: CompanyDailyTeamReport;
  showQuotes: boolean;
  leadSingular: string;
  leadPlural: string;
  dealLabel: string;
}) {
  const assessment = assessDailyReportDay(row, showQuotes);
  const toneStyle = DAY_TONE_STYLES[assessment.tone];
  const narrative = buildSalespersonDailyNarrative(row, report, {
    leadSingular,
    leadPlural,
    dealSingular: dealLabel,
    dealPlural: `${dealLabel}s`,
    showQuotes,
  });

  return (
    <article
      className={cn(
        "rounded-[12px] border p-4 transition-colors layout:p-5",
        toneStyle.className
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <Link href={row.href} className="flex min-w-0 items-center gap-3">
          <Avatar name={row.name} src={row.avatarUrl} size="md" />
          <div className="min-w-0">
            <p className="truncate text-[14px] font-semibold text-sales-text-primary">{row.name}</p>
            <p className="truncate text-[12px] text-sales-text-muted">{row.roleLabel}</p>
          </div>
        </Link>
        <Badge tone={toneStyle.badge} appearance="soft">
          {assessment.label}
        </Badge>
      </div>

      <p className="mt-4 text-[13px] leading-[1.65] text-sales-text-secondary">{narrative}</p>

      <div
        className={cn(
          "mt-4 grid gap-2",
          showQuotes ? "grid-cols-2 sm:grid-cols-3 xl:grid-cols-4" : "grid-cols-2 sm:grid-cols-3"
        )}
      >
        <ReportMetric icon={UserPlus} label={`New ${leadPlural.toLowerCase()}`} value={row.newLeads} />
        <ReportMetric icon={Target} label="Qualified" value={row.qualified} emphasize="success" />
        <ReportMetric icon={PhoneCall} label="Contacted" value={row.contacted} />
        {showQuotes ? (
          <>
            <ReportMetric icon={FileText} label="Quotes prep." value={row.quotesPrepared} />
            <ReportMetric icon={Send} label="Quotes sent" value={row.quotesSent} />
          </>
        ) : null}
        <ReportMetric icon={Handshake} label={`${dealLabel}s won`} value={row.dealsWon} emphasize="success" />
        <ReportMetric
          icon={CheckCircle2}
          label="Follow-ups due"
          value={row.followUpsDue}
          emphasize="warning"
        />
      </div>
    </article>
  );
}

export function CompanyDailyTeamReportCard({
  report,
}: {
  report: CompanyDailyTeamReport;
}) {
  const { terminology, isRealEstate } = useCompanyWorkspace();
  const rowLabel = terminology.salesperson.singular;
  const rowPluralLabel = terminology.salesperson.plural;
  const leadLabel = terminology.lead.singular;
  const leadPluralLabel = terminology.lead.plural;
  const dealLabel = "Deal";
  const { rows, totals } = report;
  const showQuotes = !isRealEstate;

  const teamNarrative = buildTeamDailySummaryNarrative(report, {
    leadSingular: leadLabel,
    leadPlural: leadPluralLabel,
    dealSingular: dealLabel,
    dealPlural: `${dealLabel}s`,
    showQuotes,
  });

  return (
    <CompanyDashCard
      title="Daily team report"
      className="dashboard-panel--table"
      action={<PeriodChip>Today · {report.dateLabel}</PeriodChip>}
    >
      {rows.length === 0 ? (
        <CompanyDashEmpty
          title={isRealEstate ? "No agents added yet" : "No salespeople added yet"}
          description={
            isRealEstate
              ? "Add agents to see today’s inquiry and follow-up activity by person."
              : "Add team members to see today’s leads, qualifications and quotations by person."
          }
          action={<DashLink href="/client/team">{isRealEstate ? "Add agent" : "Add team member"}</DashLink>}
        />
      ) : (
        <>
          <div className="border-b border-sales-border-subtle px-4 py-4 layout:px-5">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sales-brand-soft-solid text-sales-brand-fg">
                <Sparkles size={17} strokeWidth={1.8} aria-hidden />
              </span>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-sales-text-muted">
                  Team summary
                </p>
                <p className="mt-1.5 text-[13px] leading-[1.65] text-sales-text-secondary">
                  {teamNarrative}
                </p>
              </div>
            </div>

            <div
              className={cn(
                "mt-4 flex gap-2 overflow-x-auto pb-0.5",
                showQuotes ? "min-[900px]:grid min-[900px]:grid-cols-7" : "min-[720px]:grid min-[720px]:grid-cols-5"
              )}
            >
              <TeamMetric label={`New ${leadPluralLabel.toLowerCase()}`} value={totals.newLeads} />
              <TeamMetric label="Qualified" value={totals.qualified} tone="success" />
              <TeamMetric label="Contacted" value={totals.contacted} />
              {showQuotes ? (
                <>
                  <TeamMetric label="Quotes prepared" value={totals.quotesPrepared} />
                  <TeamMetric label="Quotes sent" value={totals.quotesSent} />
                </>
              ) : null}
              <TeamMetric label="Won" value={totals.dealsWon} tone="success" />
              <TeamMetric label="Follow-ups due" value={totals.followUpsDue} tone="warning" />
            </div>
          </div>

          {totals.unassignedLeads > 0 ? (
            <div className="border-b border-sales-border-subtle bg-sales-warning-soft px-4 py-2.5 text-[12px] leading-relaxed text-sales-warning-fg layout:px-5">
              {totals.unassignedLeads} new {pluralize(totals.unassignedLeads, terminology.lead.singular, terminology.lead.plural).toLowerCase()} today still
              unassigned —{" "}
              <Link href="/client/leads?assigned=unassigned" className="font-medium underline-offset-2 hover:underline">
                review now
              </Link>
            </div>
          ) : null}

          <div className="space-y-3 px-4 py-4 layout:space-y-4 layout:px-5 layout:py-5">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-sales-text-muted">
                {rowLabel} reports
              </p>
              <p className="text-[11px] text-sales-text-muted">
                {rows.length} {pluralize(rows.length, rowLabel.toLowerCase(), rowPluralLabel.toLowerCase())}
              </p>
            </div>

            <div className="space-y-3 layout:space-y-4">
              {rows.map((row) => (
                <SalespersonDailyReport
                  key={row.id}
                  row={row}
                  report={report}
                  showQuotes={showQuotes}
                  leadSingular={leadLabel}
                  leadPlural={leadPluralLabel}
                  dealLabel={dealLabel}
                />
              ))}
            </div>
          </div>

          <div className="border-t border-sales-border-subtle px-5 py-3">
            <DashLink href={report.viewReportsHref}>Open full today report</DashLink>
          </div>
        </>
      )}
    </CompanyDashCard>
  );
}

function pluralize(count: number, singular: string, plural: string): string {
  return count === 1 ? singular : plural;
}
