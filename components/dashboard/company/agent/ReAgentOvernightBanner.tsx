"use client";

import Link from "next/link";
import { Bot, ChevronRight } from "lucide-react";
import type { ReOvernightAgentSummary } from "@/lib/agent/real-estate/overnight-summary";

export function ReAgentOvernightBanner({
  summary,
  agentActivityHref = "/client/agent",
  viewingApprovalsHref = "/client/inbox",
}: {
  summary: ReOvernightAgentSummary;
  agentActivityHref?: string;
  viewingApprovalsHref?: string;
}) {
  const hasActivity =
    summary.executionsCompleted > 0 ||
    summary.repliesSent > 0 ||
    summary.viewingApprovalsPending > 0 ||
    summary.humanHandoffs > 0;

  return (
    <div className="rounded-[12px] border border-sales-border bg-gradient-to-r from-sales-brand-soft/50 to-sales-surface px-4 py-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sales-brand/15 text-sales-brand">
            <Bot size={16} />
          </span>
          <div className="min-w-0">
            <p className="text-[12px] font-semibold uppercase tracking-[0.06em] text-sales-text-muted">
              SegmiQ Agent · {summary.windowLabel}
            </p>
            <p className="mt-0.5 text-[13px] font-medium leading-snug text-sales-text-primary">
              {summary.summaryLine}
            </p>
            {hasActivity && summary.highlights.length ? (
              <ul className="mt-2 space-y-0.5 text-[11px] text-sales-text-secondary">
                {summary.highlights.slice(0, 3).map((line) => (
                  <li key={line}>• {line}</li>
                ))}
              </ul>
            ) : null}
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          {summary.viewingApprovalsPending > 0 ? (
            <Link
              href={viewingApprovalsHref}
              className="inline-flex h-8 items-center gap-1 rounded-[8px] bg-amber-600 px-3 text-[11px] font-semibold text-white hover:bg-amber-700"
            >
              {summary.viewingApprovalsPending} viewing approval
              {summary.viewingApprovalsPending === 1 ? "" : "s"}
              <ChevronRight size={14} />
            </Link>
          ) : null}
          <Link
            href={agentActivityHref}
            className="inline-flex h-8 items-center gap-1 rounded-[8px] border border-sales-border bg-sales-surface px-3 text-[11px] font-medium text-sales-text-primary hover:bg-sales-surface-hover"
          >
            Agent activity
            <ChevronRight size={14} />
          </Link>
        </div>
      </div>
    </div>
  );
}

export function ReAgentTeamVisibilityTable({
  rows,
}: {
  rows: Array<{
    agentId: string;
    agentName: string;
    executionsCompleted: number;
    humanHandoffs: number;
    viewingApprovalsPending: number;
  }>;
}) {
  if (!rows.length) return null;
  return (
    <div className="overflow-hidden rounded-[12px] border border-sales-border bg-sales-surface">
      <div className="border-b border-sales-border-subtle px-4 py-3">
        <h3 className="text-[12px] font-semibold text-sales-text-primary">Team agent activity</h3>
        <p className="text-[11px] text-sales-text-muted">Handled conversations and handoffs in this window</p>
      </div>
      <table className="w-full text-left text-[11px]">
        <thead className="bg-sales-surface-subtle text-sales-text-muted">
          <tr>
            <th className="px-4 py-2 font-medium">Agent</th>
            <th className="px-4 py-2 font-medium">Handled</th>
            <th className="px-4 py-2 font-medium">Handoffs</th>
            <th className="px-4 py-2 font-medium">Viewings</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.agentId} className="border-t border-sales-border-subtle">
              <td className="px-4 py-2.5 font-medium text-sales-text-primary">{row.agentName}</td>
              <td className="px-4 py-2.5 tabular-nums text-sales-text-secondary">{row.executionsCompleted}</td>
              <td className="px-4 py-2.5 tabular-nums text-sales-text-secondary">{row.humanHandoffs}</td>
              <td className="px-4 py-2.5 tabular-nums text-sales-text-secondary">
                {row.viewingApprovalsPending > 0 ? row.viewingApprovalsPending : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
