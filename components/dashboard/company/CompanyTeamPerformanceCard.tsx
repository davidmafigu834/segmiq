"use client";

import Link from "next/link";
import { cn } from "@/lib/ui/cn";
import { Avatar, Badge, Progress } from "@/components/sales/ui";
import { formatDealValue } from "@/lib/sales/sales-dashboard-display";
import { CompanyDashCard, CompanyDashEmpty, DashLink, PeriodChip } from "./CompanyDashCard";
import type { CompanyTeamMemberRow } from "./types";

function GoalCell({ row }: { row: CompanyTeamMemberRow }) {
  if (!row.hasGoal || row.goalProgressPct == null) {
    return <span className="text-[12px] text-sales-text-muted">No Goal</span>;
  }
  const pct = row.goalProgressPct;
  return (
    <div className="min-w-[108px]">
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="text-[12px] font-semibold tabular-nums text-sales-text-primary">{pct}%</span>
      </div>
      <Progress
        value={pct}
        tone={pct >= 100 ? "success" : pct >= 60 ? "brand" : "warning"}
        className="h-1.5"
      />
    </div>
  );
}

function MemberIdentity({ row }: { row: CompanyTeamMemberRow }) {
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

function FollowUpCell({ count }: { count: number }) {
  if (count <= 0) {
    return <span className="text-[13px] tabular-nums text-sales-text-secondary">0</span>;
  }
  return (
    <Badge tone="warning" appearance="soft">
      {count}
    </Badge>
  );
}

export function CompanyTeamPerformanceCard({
  rows,
  teamTotal,
  viewAllHref,
}: {
  rows: CompanyTeamMemberRow[];
  teamTotal: number;
  viewAllHref: string;
}) {
  const totals = {
    activeDeals: rows.reduce((sum, row) => sum + row.activeDeals, 0),
    pipeline: rows.reduce((sum, row) => sum + row.pipelineValueKnown, 0),
    dealsWon: rows.reduce((sum, row) => sum + row.dealsWon, 0),
    followUpsDue: rows.reduce((sum, row) => sum + row.followUpsDue, 0),
  };

  return (
    <CompanyDashCard
      title="Team performance"
      className="dashboard-panel--table"
      action={<PeriodChip>This month</PeriodChip>}
    >
      {rows.length === 0 ? (
        <CompanyDashEmpty
          title="No salespeople added yet"
          description="Add team members to track Deals, Goals and follow-ups."
          action={<DashLink href={viewAllHref}>Add team member</DashLink>}
        />
      ) : (
        <>
          <div className="hidden overflow-x-auto layout:block">
            <table className="dashboard-table w-full min-w-[640px] text-left">
              <thead>
                <tr className="border-b border-sales-border-subtle bg-sales-surface-subtle text-[10px] font-semibold uppercase tracking-[0.08em] text-sales-text-muted">
                  <th className="px-5 py-2.5 font-semibold">Salesperson</th>
                  <th className="px-3 py-2.5 text-right font-semibold">Active Deals</th>
                  <th className="px-3 py-2.5 text-right font-semibold">Pipeline</th>
                  <th className="px-3 py-2.5 text-right font-semibold">Won</th>
                  <th className="px-3 py-2.5 text-right font-semibold">Follow-ups</th>
                  <th className="px-5 py-2.5 font-semibold">Goal</th>
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
                    <td className="px-3 py-3 text-right text-[13px] tabular-nums text-sales-text-primary">
                      {row.activeDeals}
                    </td>
                    <td className="px-3 py-3 text-right text-[13px] tabular-nums text-sales-text-primary">
                      {row.pipelineValueLabel}
                    </td>
                    <td className="px-3 py-3 text-right text-[13px] tabular-nums text-sales-text-primary">
                      {row.dealsWon}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <FollowUpCell count={row.followUpsDue} />
                    </td>
                    <td className="px-5 py-3">
                      <GoalCell row={row} />
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
                    {totals.activeDeals}
                  </td>
                  <td className="px-3 py-2.5 text-right text-[12px] font-semibold tabular-nums text-sales-text-primary">
                    {formatDealValue(totals.pipeline, { compact: true })}
                  </td>
                  <td className="px-3 py-2.5 text-right text-[12px] font-semibold tabular-nums text-sales-text-primary">
                    {totals.dealsWon}
                  </td>
                  <td className="px-3 py-2.5 text-right text-[12px] font-semibold tabular-nums text-sales-text-primary">
                    {totals.followUpsDue}
                  </td>
                  <td className="px-5 py-2.5" />
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
                  <div className="flex items-start justify-between gap-3">
                    <MemberIdentity row={row} />
                    <GoalCell row={row} />
                  </div>
                  <dl className="mt-3 grid grid-cols-4 gap-2 text-center">
                    <div className="rounded-[10px] bg-sales-surface-subtle px-1.5 py-2">
                      <dt className="text-[10px] font-medium uppercase tracking-[0.04em] text-sales-text-muted">
                        Deals
                      </dt>
                      <dd className="mt-0.5 text-[13px] font-semibold tabular-nums text-sales-text-primary">
                        {row.activeDeals}
                      </dd>
                    </div>
                    <div className="rounded-[10px] bg-sales-surface-subtle px-1.5 py-2">
                      <dt className="text-[10px] font-medium uppercase tracking-[0.04em] text-sales-text-muted">
                        Pipeline
                      </dt>
                      <dd className="mt-0.5 truncate text-[13px] font-semibold tabular-nums text-sales-text-primary">
                        {row.pipelineValueLabel}
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
                </Link>
              </li>
            ))}
          </ul>

          <div className="border-t border-sales-border-subtle px-5 py-3">
            <DashLink href={viewAllHref}>
              View full team report
              {teamTotal > rows.length ? ` (${teamTotal})` : ""}
            </DashLink>
          </div>
        </>
      )}
    </CompanyDashCard>
  );
}
