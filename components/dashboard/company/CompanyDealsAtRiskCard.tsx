"use client";

import Link from "next/link";
import { CardShell } from "@/components/dashboard/sales/KpiCard";
import type { CompanyAtRiskDeal } from "./types";

export function CompanyDealsAtRiskCard({
  items,
  total,
  viewAllHref,
  hasActiveDeals,
}: {
  items: CompanyAtRiskDeal[];
  total: number;
  viewAllHref: string;
  hasActiveDeals: boolean;
}) {
  return (
    <CardShell
      title="Deals at Risk"
      action={
        total > 0 ? (
          <Link
            href={viewAllHref}
            className="text-[12px] font-medium text-sales-text-secondary transition-colors hover:text-sales-text-primary"
          >
            View all at-risk Deals
          </Link>
        ) : null
      }
    >
      {!hasActiveDeals ? (
        <div className="px-5 py-8 text-center">
          <p className="text-[13px] font-medium text-sales-text-primary">No active Deals yet</p>
          <p className="mt-1 text-[12px] text-sales-text-muted">
            Qualified opportunities will appear here once your sales team creates Deals from Leads.
          </p>
          <Link
            href="/client/leads"
            className="mt-3 inline-flex min-h-11 items-center text-[13px] font-semibold text-sales-brand-fg hover:underline"
          >
            View Leads
          </Link>
        </div>
      ) : items.length === 0 ? (
        <div className="px-5 py-8 text-center">
          <p className="text-[13px] font-medium text-sales-text-primary">
            No active Deals currently need risk attention.
          </p>
          <p className="mt-1 text-[12px] text-sales-text-muted">
            Stale Deals and missing next actions will surface here.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-sales-border-subtle">
          {items.map((item) => (
            <li key={item.id}>
              <Link
                href={item.href}
                className="flex min-h-[64px] items-start justify-between gap-3 px-5 py-3.5 transition-colors hover:bg-sales-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-sales-brand"
              >
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-semibold text-sales-text-primary">
                    {item.name}
                  </p>
                  <p className="mt-0.5 text-[12px] text-sales-text-muted">{item.reason}</p>
                  {item.ownerName ? (
                    <p className="mt-1 text-[11px] text-sales-text-muted">
                      Owner · {item.ownerName}
                    </p>
                  ) : null}
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-[13px] font-semibold tabular-nums text-sales-text-primary">
                    {item.valueLabel}
                  </p>
                  <p className="mt-0.5 text-[11px] text-sales-text-muted">{item.stageLabel}</p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </CardShell>
  );
}
