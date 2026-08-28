"use client";

import Link from "next/link";
import { CompanyDashCard, CompanyDashEmpty, DashLink } from "./CompanyDashCard";
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
    <CompanyDashCard
      title="Deals at risk"
      className="dashboard-panel--attention"
      action={total > 0 ? <DashLink href={viewAllHref}>View all at-risk Deals</DashLink> : null}
    >
      {!hasActiveDeals ? (
        <CompanyDashEmpty
          title="No active Deals yet"
          description="Qualified opportunities will appear here once your sales team creates Deals from Leads."
          action={<DashLink href="/client/leads">View Leads</DashLink>}
        />
      ) : items.length === 0 ? (
        <CompanyDashEmpty
          title="No Deals currently need risk attention"
          description="Stale Deals and missing next actions will surface here."
        />
      ) : (
        <ul className="divide-y divide-[rgba(128,151,200,0.07)]">
          {items.map((item) => (
            <li key={item.id}>
              <Link
                href={item.href}
                className="dashboard-list-row relative flex items-start justify-between gap-3 py-2.5 pl-4 pr-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-sales-brand"
              >
                <span className="absolute inset-y-2 left-0 w-[3px] rounded-full bg-sales-danger" aria-hidden />
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-semibold text-sales-text-primary">{item.name}</p>
                  <p className="mt-0.5 text-[12px] text-sales-text-muted">{item.reason}</p>
                  {item.ownerName ? (
                    <p className="mt-1 text-[11px] text-sales-text-muted">Owner · {item.ownerName}</p>
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
    </CompanyDashCard>
  );
}
