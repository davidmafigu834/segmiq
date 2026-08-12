"use client";

import Link from "next/link";
import { cn } from "@/lib/ui/cn";
import { CardShell } from "@/components/dashboard/sales/KpiCard";
import type { CompanyTeamMemberRow } from "./types";

function GoalCell({ row }: { row: CompanyTeamMemberRow }) {
  if (!row.hasGoal || row.goalProgressPct == null) {
    return <span className="text-[12px] text-sales-text-muted">No Goal</span>;
  }
  const pct = row.goalProgressPct;
  return (
    <div className="min-w-[120px]">
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="text-[12px] font-semibold tabular-nums text-sales-text-primary">
          {pct}%
        </span>
      </div>
      <div
        className="h-1.5 overflow-hidden rounded-full bg-sales-neutral-100"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${row.name} goal progress ${pct}%`}
      >
        <div
          className="h-full rounded-full bg-sales-brand"
          style={{ width: `${Math.min(100, pct)}%` }}
        />
      </div>
    </div>
  );
}

function Avatar({ row }: { row: CompanyTeamMemberRow }) {
  if (row.avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={row.avatarUrl}
        alt=""
        className="h-9 w-9 shrink-0 rounded-full object-cover"
      />
    );
  }
  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sales-neutral-100 text-[11px] font-semibold text-sales-text-secondary">
      {row.initials}
    </span>
  );
}

function MemberIdentity({ row }: { row: CompanyTeamMemberRow }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <Avatar row={row} />
      <div className="min-w-0">
        <p className="truncate text-[13px] font-semibold text-sales-text-primary">{row.name}</p>
        <p className="truncate text-[11px] text-sales-text-muted">{row.roleLabel}</p>
      </div>
    </div>
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
  return (
    <CardShell
      title="Team performance"
      action={<span className="text-[12px] font-medium text-sales-text-muted">This month</span>}
    >
      {rows.length === 0 ? (
        <div className="px-5 py-8 text-center">
          <p className="text-[13px] font-medium text-sales-text-primary">
            No salespeople added yet
          </p>
          <p className="mt-1 text-[12px] text-sales-text-muted">
            Add team members to track Deals, Goals and follow-ups.
          </p>
          <Link
            href={viewAllHref}
            className="mt-3 inline-flex min-h-11 items-center text-[13px] font-semibold text-sales-brand-fg hover:underline"
          >
            Add team member
          </Link>
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden overflow-x-auto layout:block">
            <table className="w-full min-w-[640px] text-left">
              <thead>
                <tr className="border-b border-sales-border-subtle bg-[var(--sales-neutral-100)] text-[11px] font-semibold uppercase tracking-[0.04em] text-sales-text-muted">
                  <th className="px-5 py-2.5 font-semibold">Salesperson</th>
                  <th className="px-3 py-2.5 font-semibold">Active Deals</th>
                  <th className="px-3 py-2.5 font-semibold">Pipeline Value</th>
                  <th className="px-3 py-2.5 font-semibold">Deals Won</th>
                  <th className="px-3 py-2.5 font-semibold">Follow-ups due</th>
                  <th className="px-5 py-2.5 font-semibold">Goal progress</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-sales-border-subtle">
                {rows.map((row) => (
                  <tr
                    key={row.id}
                    className="transition-colors hover:bg-sales-surface-hover"
                  >
                    <td className="px-5 py-3">
                      <Link href={row.href} className="block min-w-0">
                        <MemberIdentity row={row} />
                      </Link>
                    </td>
                    <td className="px-3 py-3 text-[13px] tabular-nums text-sales-text-primary">
                      {row.activeDeals}
                    </td>
                    <td className="px-3 py-3 text-[13px] tabular-nums text-sales-text-primary">
                      {row.pipelineValueLabel}
                    </td>
                    <td className="px-3 py-3 text-[13px] tabular-nums text-sales-text-primary">
                      {row.dealsWon}
                    </td>
                    <td className="px-3 py-3">
                      <span
                        className={cn(
                          "text-[13px] tabular-nums",
                          row.followUpsDue > 0
                            ? "font-semibold text-sales-warning-fg"
                            : "text-sales-text-primary"
                        )}
                      >
                        {row.followUpsDue}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <GoalCell row={row} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile / tablet cards */}
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
                  <dl className="mt-3 grid grid-cols-2 gap-2 text-[12px]">
                    <div>
                      <dt className="text-sales-text-muted">Active Deals</dt>
                      <dd className="font-semibold tabular-nums text-sales-text-primary">
                        {row.activeDeals}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-sales-text-muted">Pipeline</dt>
                      <dd className="font-semibold tabular-nums text-sales-text-primary">
                        {row.pipelineValueLabel}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-sales-text-muted">Won</dt>
                      <dd className="font-semibold tabular-nums text-sales-text-primary">
                        {row.dealsWon}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-sales-text-muted">Follow-ups due</dt>
                      <dd
                        className={cn(
                          "font-semibold tabular-nums",
                          row.followUpsDue > 0
                            ? "text-sales-warning-fg"
                            : "text-sales-text-primary"
                        )}
                      >
                        {row.followUpsDue}
                      </dd>
                    </div>
                  </dl>
                  <p className="mt-3 text-[12px] font-medium text-sales-brand-fg">
                    View performance
                  </p>
                </Link>
              </li>
            ))}
          </ul>

          <div className="border-t border-sales-border-subtle px-5 py-3">
            <Link
              href={viewAllHref}
              className="text-[12px] font-medium text-sales-text-secondary transition-colors hover:text-sales-text-primary"
            >
              View full team report
              {teamTotal > rows.length ? ` (${teamTotal})` : ""}
            </Link>
          </div>
        </>
      )}
    </CardShell>
  );
}
