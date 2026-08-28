"use client";

import Link from "next/link";
import type { SalesDealAttentionItem } from "./types";
import { CardShell } from "./KpiCard";
import { cn } from "@/lib/ui/cn";

function StageBadge({ label }: { label: string }) {
  return (
    <span className="inline-flex rounded-sales-sm border border-sales-border bg-sales-surface-raised px-1.5 py-0.5 text-[11px] font-medium text-sales-text-secondary">
      {label}
    </span>
  );
}

export function DealsAttentionCard({
  items,
  hasAnyDeals,
}: {
  items: SalesDealAttentionItem[];
  hasAnyDeals: boolean;
}) {
  return (
    <CardShell
      title="Deals requiring attention"
      className="dashboard-panel--attention dashboard-panel--table"
      action={
        <Link
          href="/sales/pipeline"
          className="text-[12px] font-medium text-sales-text-secondary transition-colors hover:text-sales-text-primary"
        >
          View all deals
        </Link>
      }
    >
      {!hasAnyDeals ? (
        <div className="px-5 py-5 text-center">
          <p className="text-[13px] font-medium text-sales-text-primary">No active Deals yet.</p>
          <p className="mt-1 text-[12px] text-sales-text-muted">
            Qualify your enquiries and create a Deal when a genuine opportunity is confirmed.
          </p>
          <Link
            href="/sales/call-now"
            className="mt-3 inline-flex min-h-11 items-center text-[13px] font-semibold text-sales-brand-fg hover:underline"
          >
            View leads
          </Link>
        </div>
      ) : items.length === 0 ? (
        <div className="px-5 py-5 text-center">
          <p className="text-[13px] font-medium text-sales-text-primary">
            No Deals need attention right now.
          </p>
          <p className="mt-1 text-[12px] text-sales-text-muted">
            Active Deals with clear next actions stay out of this list.
          </p>
        </div>
      ) : (
        <>
          <div className="hidden w-full md:block">
            <table className="dashboard-table w-full table-fixed text-left">
              <colgroup>
                <col className="w-[22%]" />
                <col className="w-[14%]" />
                <col className="w-[12%]" />
                <col className="w-[14%]" />
                <col className="w-[16%]" />
                <col className="w-[22%]" />
              </colgroup>
              <thead>
                <tr className="border-b border-sales-border-subtle bg-sales-surface-subtle text-[10px] font-semibold uppercase tracking-[0.08em] text-sales-text-muted">
                  <th className="px-5 py-2.5 font-semibold">Deal</th>
                  <th className="px-3 py-2.5 font-semibold">Customer</th>
                  <th className="px-3 py-2.5 font-semibold">Stage</th>
                  <th className="px-3 py-2.5 font-semibold">Estimated value</th>
                  <th className="px-3 py-2.5 font-semibold">Next action</th>
                  <th className="px-5 py-2.5 font-semibold">Why it needs attention</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[rgba(125,148,194,0.07)]">
                {items.map((item) => (
                  <tr
                    key={item.id}
                    className="dashboard-list-row h-[56px]"
                  >
                    <td className="px-5 py-2">
                      <Link
                        href={item.href}
                        className="flex min-w-0 items-center gap-2 text-[13px] font-semibold text-sales-text-primary hover:underline"
                      >
                        <span className="truncate">{item.name}</span>
                        {item.atRisk ? (
                          <span className="inline-flex shrink-0 rounded-sales-sm bg-sales-danger-soft px-1.5 py-0.5 text-[10px] font-semibold text-sales-danger-fg">
                            At risk
                          </span>
                        ) : null}
                      </Link>
                    </td>
                    <td className="truncate px-3 py-2 text-[12px] text-sales-text-secondary">
                      {item.customerName}
                    </td>
                    <td className="px-3 py-2">
                      <StageBadge label={item.stageLabel} />
                    </td>
                    <td className="px-3 py-2">
                      <p
                        className={cn(
                          "truncate text-[13px] font-semibold tabular-nums",
                          item.valueLabel.toLowerCase().includes("not estimated")
                            ? "font-medium text-sales-text-muted"
                            : "text-sales-text-primary"
                        )}
                      >
                        {item.valueLabel}
                      </p>
                      {item.valueBasisLabel ? (
                        <p className="truncate text-[10px] text-sales-text-muted">{item.valueBasisLabel}</p>
                      ) : null}
                    </td>
                    <td className="px-3 py-2">
                      <p
                        className={cn(
                          "truncate text-[12px] font-medium",
                          item.noNextAction ? "text-sales-danger" : "text-sales-text-primary"
                        )}
                      >
                        {item.nextActionLabel}
                      </p>
                      {item.nextActionWhen ? (
                        <p className="truncate text-[11px] text-sales-text-muted">{item.nextActionWhen}</p>
                      ) : null}
                    </td>
                    <td className="px-5 py-2 text-[12px] leading-snug text-sales-text-secondary">
                      <span className="line-clamp-2">{item.attentionReason}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className="divide-y divide-sales-border-subtle md:hidden">
            {items.map((item) => (
              <li key={item.id} className="px-4 py-3.5">
                <Link href={item.href} className="block">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-[14px] font-semibold text-sales-text-primary">{item.name}</p>
                    {item.atRisk ? (
                      <span className="shrink-0 rounded-sales-sm bg-sales-danger-soft px-1.5 py-0.5 text-[10px] font-semibold text-sales-danger-fg">
                        At risk
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-0.5 text-[12px] text-sales-text-secondary">{item.customerName}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <StageBadge label={item.stageLabel} />
                    <span
                      className={cn(
                        "text-[13px] font-semibold tabular-nums",
                        item.valueLabel.toLowerCase().includes("not estimated")
                          ? "font-medium text-sales-text-muted"
                          : "text-sales-text-primary"
                      )}
                    >
                      {item.valueLabel}
                    </span>
                  </div>
                  <p
                    className={cn(
                      "mt-2 text-[12px]",
                      item.noNextAction ? "font-medium text-sales-danger" : "text-sales-text-secondary"
                    )}
                  >
                    Next: {item.nextActionLabel}
                    {item.nextActionWhen ? ` · ${item.nextActionWhen}` : ""}
                  </p>
                  <p className="mt-1 text-[12px] text-sales-text-muted">
                    Why now: {item.attentionReason}
                  </p>
                </Link>
                <Link
                  href={item.href}
                  className="dashboard-action-btn dashboard-action-btn--next mt-3 inline-flex min-h-11 items-center rounded-sales-md px-3 text-[12px] font-semibold text-sales-text-primary hover:bg-sales-surface-hover"
                >
                  Open deal
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </CardShell>
  );
}
