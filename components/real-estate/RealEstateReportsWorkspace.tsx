"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CompanyKpiCard } from "@/components/dashboard/company/CompanyKpiCard";
import { LISTING_STATUS_LABEL } from "@/lib/real-estate/listings";
import type { OperationsReport } from "@/lib/real-estate/operations-report";
import type { ListingStatus } from "@/types";

function rate(value: number | null): string {
  return value == null ? "—" : `${value}%`;
}

export function RealEstateReportsWorkspace({ clientId }: { clientId: string }) {
  const [report, setReport] = useState<OperationsReport | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const to = new Date();
    to.setDate(to.getDate() + 1);
    to.setHours(0, 0, 0, 0);
    const from = new Date(to);
    from.setDate(from.getDate() - 30);
    fetch(
      `/api/clients/${clientId}/operations-report?from=${encodeURIComponent(from.toISOString())}&to=${encodeURIComponent(to.toISOString())}`
    )
      .then((r) => r.json())
      .then((json: OperationsReport) => {
        if (!cancelled) setReport(json);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [clientId]);

  if (loading || !report) {
    return (
      <div className="space-y-3" aria-busy>
        <div className="grid grid-cols-[repeat(2,minmax(0,1fr))] gap-3 md:grid-cols-[repeat(3,minmax(0,1fr))] layout:grid-cols-[repeat(6,minmax(0,1fr))]">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="shimmer h-[96px] rounded-[14px]" />
          ))}
        </div>
        <div className="shimmer h-[240px] rounded-[14px]" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-[repeat(2,minmax(0,1fr))] gap-3 md:grid-cols-[repeat(3,minmax(0,1fr))] layout:grid-cols-[repeat(6,minmax(0,1fr))]">
        <CompanyKpiCard
          item={{
            id: "enquiries",
            label: "Enquiries",
            value: String(report.enquiries.total),
            supporting: "Last 30 days",
            icon: "enquiries",
            href: "/client/leads",
          }}
        />
        <CompanyKpiCard
          item={{
            id: "viewings",
            label: "Viewings",
            value: String(report.viewings.scheduled + report.viewings.completed),
            supporting: `${report.viewings.completed} completed`,
            icon: "followups",
            href: "/client/viewings",
          }}
        />
        <CompanyKpiCard
          item={{
            id: "conversion",
            label: "Enquiry → viewing",
            value: rate(report.conversions.enquiryToViewing),
            supporting: `${rate(report.conversions.enquiryToWon)} to won`,
            icon: "deals",
          }}
        />
        <CompanyKpiCard
          item={{
            id: "stock",
            label: "Live / managed",
            value: `${report.stock.available}`,
            supporting: `${report.stock.property_management} under management`,
            icon: "companies",
            href: "/client/listings",
          }}
        />
        <CompanyKpiCard
          item={{
            id: "offers",
            label: "Under offer",
            value: String(report.stock.underOffer),
            supporting: `${report.stock.sold} sold`,
            icon: "pipeline",
            href: "/client/offers",
          }}
        />
        <CompanyKpiCard
          item={{
            id: "sold",
            label: "Sold / rented",
            value: String(report.stock.sold + report.stock.rented),
            supporting: "Closed stock",
            icon: "won",
            href: "/client/listings",
          }}
        />
      </div>

      <div className="grid gap-3 layout:grid-cols-2">
        <section className="workspace-card rounded-[14px] border border-sales-border bg-sales-surface">
          <div className="border-b border-sales-border-subtle px-5 py-3">
            <h2 className="text-[14px] font-semibold text-sales-text-primary">Conversions</h2>
            <p className="text-[12px] text-sales-text-muted">Enquiry cohort from the last 30 days</p>
          </div>
          <dl className="grid grid-cols-2 gap-px bg-sales-border-subtle">
            {[
              ["Qualified", rate(report.conversions.enquiryToQualified), `${report.enquiries.qualified} qualified`],
              ["To a viewing", rate(report.conversions.enquiryToViewing), `${report.viewings.completed} completed`],
              ["Viewing → offer", rate(report.conversions.viewingToOffer), "Accepted path"],
              ["Enquiry → won", rate(report.conversions.enquiryToWon), "Concluded"],
            ].map(([label, value, hint]) => (
              <div key={label} className="bg-sales-surface px-5 py-4">
                <dt className="text-[11px] text-sales-text-muted">{label}</dt>
                <dd className="mt-1 text-[20px] font-semibold tabular-nums text-sales-text-primary">{value}</dd>
                <p className="mt-0.5 text-[11px] text-sales-text-secondary">{hint}</p>
              </div>
            ))}
          </dl>
        </section>

        <section className="workspace-card rounded-[14px] border border-sales-border bg-sales-surface">
          <div className="border-b border-sales-border-subtle px-5 py-3">
            <h2 className="text-[14px] font-semibold text-sales-text-primary">Enquiries by source</h2>
          </div>
          {report.enquiries.bySource.length === 0 ? (
            <p className="px-5 py-8 text-[13px] text-sales-text-muted">No enquiries in this period.</p>
          ) : (
            <ul className="divide-y divide-sales-border-subtle">
              {report.enquiries.bySource.map((row) => (
                <li key={row.source} className="flex items-center justify-between px-5 py-2.5 text-[13px]">
                  <span className="text-sales-text-primary">{row.label}</span>
                  <span className="tabular-nums font-semibold text-sales-text-primary">{row.count}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="workspace-card overflow-hidden rounded-[14px] border border-sales-border bg-sales-surface">
        <div className="border-b border-sales-border-subtle px-5 py-3">
          <h2 className="text-[14px] font-semibold text-sales-text-primary">Popular properties</h2>
          <p className="text-[12px] text-sales-text-muted">Most enquiries and viewings in the last 30 days</p>
        </div>
        {report.popularProperties.length === 0 ? (
          <p className="px-5 py-8 text-[13px] text-sales-text-muted">No property activity in this period.</p>
        ) : (
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-sales-border-subtle text-[11px] font-semibold uppercase tracking-wide text-sales-text-muted">
                <th className="px-5 py-2.5">Property</th>
                <th className="px-3 py-2.5">Type</th>
                <th className="px-3 py-2.5">Status</th>
                <th className="px-3 py-2.5 text-right">Enquiries</th>
                <th className="px-3 py-2.5 text-right">Viewings</th>
                <th className="px-5 py-2.5 text-right">Offers</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-sales-border-subtle">
              {report.popularProperties.map((row) => (
                <tr key={row.listingId}>
                  <td className="px-5 py-2.5">
                    <Link
                      href={`/client/listings/${row.listingId}`}
                      className="text-[13px] font-semibold text-sales-text-primary hover:underline"
                    >
                      {row.label}
                    </Link>
                  </td>
                  <td className="px-3 py-2.5 text-[12px] text-sales-text-secondary">{row.type}</td>
                  <td className="px-3 py-2.5 text-[12px] text-sales-text-secondary">
                    {LISTING_STATUS_LABEL[row.status as ListingStatus] ?? row.status}
                  </td>
                  <td className="px-3 py-2.5 text-right text-[13px] tabular-nums">{row.enquiries}</td>
                  <td className="px-3 py-2.5 text-right text-[13px] tabular-nums">{row.viewings}</td>
                  <td className="px-5 py-2.5 text-right text-[13px] tabular-nums">{row.offers}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
