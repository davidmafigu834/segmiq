"use client";

import { useMemo, useState } from "react";
import { Footprints, Globe2, MoreHorizontal, UserRoundPlus } from "lucide-react";
import { SiFacebook, SiWhatsapp } from "react-icons/si";
import {
  buildLeadSources,
  LEAD_SOURCE_PERIOD_OPTIONS,
  type LeadSourcePeriod,
  type SalesDashboardRaw,
} from "@/lib/sales/sales-dashboard-view";
import type { SalesLeadSourceItem } from "./types";
import { CardShell } from "./KpiCard";
import { MenuSelect, SalesDonutChart } from "@/components/sales/ui";

function SourceIcon({ brand }: { brand: SalesLeadSourceItem["brand"] }) {
  if (brand === "whatsapp") {
    return <SiWhatsapp size={14} className="text-[#25D366]" aria-hidden />;
  }
  if (brand === "facebook") {
    return <SiFacebook size={14} className="text-[#1877F2]" aria-hidden />;
  }
  if (brand === "referral") {
    return <UserRoundPlus size={14} strokeWidth={2} className="text-[#9366FF]" aria-hidden />;
  }
  if (brand === "walkin") {
    return <Footprints size={14} strokeWidth={2} className="text-sales-text-primary" aria-hidden />;
  }
  if (brand === "website") {
    return <Globe2 size={14} strokeWidth={2} className="text-[#38BDF8]" aria-hidden />;
  }
  return <MoreHorizontal size={14} strokeWidth={2} className="text-sales-text-secondary" aria-hidden />;
}

const BRAND_COLORS: Record<SalesLeadSourceItem["brand"], string> = {
  whatsapp: "#25D366",
  facebook: "#1877F2",
  referral: "#9366FF",
  website: "#38BDF8",
  walkin: "#64748B",
  other: "#7B8BA8",
};

export function SourceMixCard({ data }: { data: SalesDashboardRaw }) {
  const [period, setPeriod] = useState<LeadSourcePeriod>("this_month");
  const sources = useMemo(() => buildLeadSources(data, period), [data, period]);
  const total = sources.reduce((s, x) => s + x.count, 0);
  const chartData = sources.filter((s) => s.count > 0);

  return (
    <CardShell
      title="Source mix"
      className="dashboard-panel--analytics"
      action={
        <MenuSelect
          aria-label="Source mix date range"
          size="sm"
          align="right"
          value={period}
          onChange={setPeriod}
          options={LEAD_SOURCE_PERIOD_OPTIONS.map((o) => ({
            value: o.id,
            label: o.label,
          }))}
        />
      }
    >
      <div className="px-5 py-5">
        {total === 0 ? (
          <p className="py-6 text-center text-[13px] text-sales-text-muted">No enquiries in this period</p>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="relative mx-auto h-[160px] w-[160px]" aria-label={`${total} enquiries by source`}>
              <SalesDonutChart
                data={chartData.map((s) => ({
                  name: s.label,
                  value: s.count,
                  color: BRAND_COLORS[s.brand],
                }))}
                showLegend={false}
                centerLabel="Enquiries"
                centerValue={total}
              />
            </div>

            <ul className="space-y-2">
              {sources.map((s) => {
                const pct = total > 0 ? Math.round((s.count / total) * 100) : 0;
                return (
                  <li key={s.id} className="flex items-center justify-between gap-3 text-[12px]">
                    <span className="inline-flex min-w-0 items-center gap-2 text-sales-text-primary">
                      <SourceIcon brand={s.brand} />
                      <span className="truncate font-medium">{s.label}</span>
                    </span>
                    <span className="shrink-0 tabular-nums text-sales-text-secondary">
                      {s.count} · {pct}%
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>
    </CardShell>
  );
}
