"use client";

import Link from "next/link";
import { cn } from "@/lib/ui/cn";
import { Avatar, Badge } from "@/components/sales/ui";
import { CompanyDashCard, CompanyDashEmpty, DashLink, PeriodChip } from "./CompanyDashCard";
import type { CompanyDailyTeamMemberRow, CompanyDailyTeamReport } from "./types";
import { useCompanyWorkspace } from "@/components/company/CompanyWorkspaceContext";

function MemberIdentity({ row }: { row: CompanyDailyTeamMemberRow }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <Avatar name={row.name} src={row.avatarUrl} size="sm" />
      <div className="min-w-0">
        <p className="truncate text-[13px] font-semibold text-sales-text-primary">{row.name}</p>
        <p className="truncate text-[11px] text-sales-text-muted">{row.roleLabel}</p>
      </div>
    </div>
  );
}

function StatCell({
  value,
  emphasize,
}: {
  value: number;
  emphasize?: "warning" | "success";
}) {
  if (value <= 0) {
    return <span className="text-[13px] tabular-nums text-sales-text-secondary">0</span>;
  }
  if (emphasize === "warning") {
    return (
      <Badge tone="warning" appearance="soft">
        {value}
      </Badge>
    );
  }
  return (
    <span
      className={cn(
        "text-[13px] font-semibold tabular-nums",
        emphasize === "success" ? "text-sales-success-fg" : "text-sales-text-primary"
      )}
    >
      {value}
    </span>
  );
}

function SummaryChip({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "default" | "warning";
}) {
  return (
    <div className="min-w-0 rounded-[10px] bg-sales-surface-subtle px-3 py-2.5">
      <p className="truncate text-[10px] font-medium uppercase tracking-[0.04em] text-sales-text-muted">
        {label}
      </p>
      <p
        className={cn(
          "mt-0.5 text-[18px] font-semibold tabular-nums leading-none",
          tone === "warning" && value > 0 ? "text-sales-warning-fg" : "text-sales-text-primary"
        )}
      >
        {value}
      </p>
    </div>
  );
}

export function CompanyDailyTeamReportCard({
  report,
}: {
  report: CompanyDailyTeamReport;
}) {
  const { terminology, isRealEstate } = useCompanyWorkspace();
  const rowLabel = terminology.salesperson.singular;
  const { rows, totals } = report;
  const showQuotes = !isRealEstate;

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
          <div
            className={cn(
              "grid gap-2 border-b border-sales-border-subtle px-4 py-3 layout:px-5",
              showQuotes ? "grid-cols-2 min-[480px]:grid-cols-4 xl:grid-cols-7" : "grid-cols-2 min-[480px]:grid-cols-3 xl:grid-cols-5"
            )}
          >
            <SummaryChip label="New leads" value={totals.newLeads} />
            <SummaryChip label="Qualified" value={totals.qualified} />
            <SummaryChip label="Contacted" value={totals.contacted} />
            {showQuotes ? <SummaryChip label="Quotes prepared" value={totals.quotesPrepared} /> : null}
            {showQuotes ? <SummaryChip label="Quotes sent" value={totals.quotesSent} /> : null}
            <SummaryChip label="Won" value={totals.dealsWon} />
            <SummaryChip label="Follow-ups due" value={totals.followUpsDue} tone="warning" />
          </div>

          {totals.unassignedLeads > 0 ? (
            <div className="border-b border-sales-border-subtle bg-sales-warning-soft px-4 py-2 text-[12px] text-sales-warning-fg layout:px-5">
              {totals.unassignedLeads} new lead{totals.unassignedLeads === 1 ? "" : "s"} today still
              unassigned —{" "}
              <Link href="/client/leads?assigned=unassigned" className="font-medium underline-offset-2 hover:underline">
                review now
              </Link>
            </div>
          ) : null}

          <div className="hidden overflow-x-auto layout:block">
            <table className="dashboard-table w-full min-w-[720px] text-left">
              <thead>
                <tr className="border-b border-sales-border-subtle bg-sales-surface-subtle text-[10px] font-semibold uppercase tracking-[0.08em] text-sales-text-muted">
                  <th className="px-5 py-2.5 font-semibold">{rowLabel}</th>
                  <th className="px-3 py-2.5 text-right font-semibold">Leads</th>
                  <th className="px-3 py-2.5 text-right font-semibold">Qualified</th>
                  <th className="px-3 py-2.5 text-right font-semibold">Contacted</th>
                  {showQuotes ? (
                    <th className="px-3 py-2.5 text-right font-semibold">Quotes</th>
                  ) : null}
                  {showQuotes ? (
                    <th className="px-3 py-2.5 text-right font-semibold">Sent</th>
                  ) : null}
                  <th className="px-3 py-2.5 text-right font-semibold">Won</th>
                  <th className="px-5 py-2.5 text-right font-semibold">Follow-ups</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[rgba(125,148,194,0.07)]">
                {rows.map((row) => (
                  <tr key={row.id} className="dashboard-list-row">
                    <td className="px-5 py-3">
                      <Link href={row.href} className="block min-w-0">
                        <MemberIdentity row={row} />
                      </Link>
                    </td>
                    <td className="px-3 py-3 text-right">
                      <StatCell value={row.newLeads} />
                    </td>
                    <td className="px-3 py-3 text-right">
                      <StatCell value={row.qualified} emphasize="success" />
                    </td>
                    <td className="px-3 py-3 text-right">
                      <StatCell value={row.contacted} />
                    </td>
                    {showQuotes ? (
                      <td className="px-3 py-3 text-right">
                        <StatCell value={row.quotesPrepared} />
                      </td>
                    ) : null}
                    {showQuotes ? (
                      <td className="px-3 py-3 text-right">
                        <StatCell value={row.quotesSent} />
                      </td>
                    ) : null}
                    <td className="px-3 py-3 text-right">
                      <StatCell value={row.dealsWon} emphasize="success" />
                    </td>
                    <td className="px-5 py-3 text-right">
                      <StatCell value={row.followUpsDue} emphasize="warning" />
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-sales-border-subtle bg-sales-surface-subtle">
                  <td className="px-5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-sales-text-muted">
                    Team total
                  </td>
                  <td className="px-3 py-2.5 text-right text-[12px] font-semibold tabular-nums text-sales-text-primary">
                    {totals.newLeads}
                  </td>
                  <td className="px-3 py-2.5 text-right text-[12px] font-semibold tabular-nums text-sales-text-primary">
                    {totals.qualified}
                  </td>
                  <td className="px-3 py-2.5 text-right text-[12px] font-semibold tabular-nums text-sales-text-primary">
                    {totals.contacted}
                  </td>
                  {showQuotes ? (
                    <td className="px-3 py-2.5 text-right text-[12px] font-semibold tabular-nums text-sales-text-primary">
                      {totals.quotesPrepared}
                    </td>
                  ) : null}
                  {showQuotes ? (
                    <td className="px-3 py-2.5 text-right text-[12px] font-semibold tabular-nums text-sales-text-primary">
                      {totals.quotesSent}
                    </td>
                  ) : null}
                  <td className="px-3 py-2.5 text-right text-[12px] font-semibold tabular-nums text-sales-text-primary">
                    {totals.dealsWon}
                  </td>
                  <td className="px-5 py-2.5 text-right text-[12px] font-semibold tabular-nums text-sales-text-primary">
                    {totals.followUpsDue}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          <ul className="divide-y divide-sales-border-subtle layout:hidden">
            {rows.map((row) => (
              <li key={row.id}>
                <Link
                  href={row.href}
                  className="block px-4 py-4 transition-colors hover:bg-sales-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-sales-brand"
                >
                  <MemberIdentity row={row} />
                  <dl
                    className={cn(
                      "mt-3 grid gap-2 text-center",
                      showQuotes ? "grid-cols-3" : "grid-cols-4"
                    )}
                  >
                    <div className="rounded-[10px] bg-sales-surface-subtle px-1.5 py-2">
                      <dt className="text-[10px] font-medium uppercase tracking-[0.04em] text-sales-text-muted">
                        Leads
                      </dt>
                      <dd className="mt-0.5 text-[13px] font-semibold tabular-nums text-sales-text-primary">
                        {row.newLeads}
                      </dd>
                    </div>
                    <div className="rounded-[10px] bg-sales-surface-subtle px-1.5 py-2">
                      <dt className="text-[10px] font-medium uppercase tracking-[0.04em] text-sales-text-muted">
                        Qualified
                      </dt>
                      <dd className="mt-0.5 text-[13px] font-semibold tabular-nums text-sales-text-primary">
                        {row.qualified}
                      </dd>
                    </div>
                    {showQuotes ? (
                      <div className="rounded-[10px] bg-sales-surface-subtle px-1.5 py-2">
                        <dt className="text-[10px] font-medium uppercase tracking-[0.04em] text-sales-text-muted">
                          Quotes
                        </dt>
                        <dd className="mt-0.5 text-[13px] font-semibold tabular-nums text-sales-text-primary">
                          {row.quotesPrepared}
                        </dd>
                      </div>
                    ) : (
                      <div className="rounded-[10px] bg-sales-surface-subtle px-1.5 py-2">
                        <dt className="text-[10px] font-medium uppercase tracking-[0.04em] text-sales-text-muted">
                          Contacted
                        </dt>
                        <dd className="mt-0.5 text-[13px] font-semibold tabular-nums text-sales-text-primary">
                          {row.contacted}
                        </dd>
                      </div>
                    )}
                    {!showQuotes ? (
                      <div className="rounded-[10px] bg-sales-surface-subtle px-1.5 py-2">
                        <dt className="text-[10px] font-medium uppercase tracking-[0.04em] text-sales-text-muted">
                          Due
                        </dt>
                        <dd
                          className={cn(
                            "mt-0.5 text-[13px] font-semibold tabular-nums",
                            row.followUpsDue > 0 ? "text-sales-warning-fg" : "text-sales-text-primary"
                          )}
                        >
                          {row.followUpsDue}
                        </dd>
                      </div>
                    ) : null}
                  </dl>
                  {showQuotes ? (
                    <dl className="mt-2 grid grid-cols-3 gap-2 text-center">
                      <div className="rounded-[10px] bg-sales-surface-subtle px-1.5 py-2">
                        <dt className="text-[10px] font-medium uppercase tracking-[0.04em] text-sales-text-muted">
                          Sent
                        </dt>
                        <dd className="mt-0.5 text-[13px] font-semibold tabular-nums text-sales-text-primary">
                          {row.quotesSent}
                        </dd>
                      </div>
                      <div className="rounded-[10px] bg-sales-surface-subtle px-1.5 py-2">
                        <dt className="text-[10px] font-medium uppercase tracking-[0.04em] text-sales-text-muted">
                          Won
                        </dt>
                        <dd className="mt-0.5 text-[13px] font-semibold tabular-nums text-sales-text-primary">
                          {row.dealsWon}
                        </dd>
                      </div>
                      <div className="rounded-[10px] bg-sales-surface-subtle px-1.5 py-2">
                        <dt className="text-[10px] font-medium uppercase tracking-[0.04em] text-sales-text-muted">
                          Due
                        </dt>
                        <dd
                          className={cn(
                            "mt-0.5 text-[13px] font-semibold tabular-nums",
                            row.followUpsDue > 0 ? "text-sales-warning-fg" : "text-sales-text-primary"
                          )}
                        >
                          {row.followUpsDue}
                        </dd>
                      </div>
                    </dl>
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>

          <div className="border-t border-sales-border-subtle px-5 py-3">
            <DashLink href={report.viewReportsHref}>Open full today report</DashLink>
          </div>
        </>
      )}
    </CompanyDashCard>
  );
}
