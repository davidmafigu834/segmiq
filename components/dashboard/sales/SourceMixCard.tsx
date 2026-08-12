"use client";

import { useMemo, useState } from "react";
import { Footprints, Globe2, MoreHorizontal, UserRoundPlus } from "lucide-react";
import { SiFacebook, SiWhatsapp } from "react-icons/si";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import {
  buildLeadSources,
  LEAD_SOURCE_PERIOD_OPTIONS,
  type LeadSourcePeriod,
  type SalesDashboardRaw,
} from "@/lib/sales/sales-dashboard-view";
import type { SalesLeadSourceItem } from "./types";
import { CardShell } from "./KpiCard";
import { MenuSelect } from "@/components/sales/ui/MenuSelect";
import { useSalesChartColors } from "@/lib/sales/use-sales-chart-colors";

function SourceIcon({ brand }: { brand: SalesLeadSourceItem["brand"] }) {
  if (brand === "whatsapp") {
    return <SiWhatsapp size={14} className="text-[#25D366]" aria-hidden />;
  }
  if (brand === "facebook") {
    return <SiFacebook size={14} className="text-[#1877F2]" aria-hidden />;
  }
  if (brand === "referral") {
    return <UserRoundPlus size={14} strokeWidth={2} className="text-sales-text-primary" aria-hidden />;
  }
  if (brand === "walkin") {
    return <Footprints size={14} strokeWidth={2} className="text-sales-text-primary" aria-hidden />;
  }
  if (brand === "website") {
    return <Globe2 size={14} strokeWidth={2} className="text-sales-text-primary" aria-hidden />;
  }
  return <MoreHorizontal size={14} strokeWidth={2} className="text-sales-text-secondary" aria-hidden />;
}

const BRAND_COLORS: Record<SalesLeadSourceItem["brand"], string> = {
  whatsapp: "#25D366",
  facebook: "#1877F2",
  referral: "#64748B",
  website: "#0EA5E9",
  walkin: "#78716C",
  other: "#94A3B8",
};

export function SourceMixCard({ data }: { data: SalesDashboardRaw }) {
  const [period, setPeriod] = useState<LeadSourcePeriod>("this_month");
  const sources = useMemo(() => buildLeadSources(data, period), [data, period]);
  const total = sources.reduce((s, x) => s + x.count, 0);
  const chartColors = useSalesChartColors();
  const chartData = sources.filter((s) => s.count > 0);

  return (
    <CardShell
      title="Source mix"
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
      <div className="px-4 py-4 sm:px-5">
        {total === 0 ? (
          <p className="py-6 text-center text-[13px] text-sales-text-muted">No enquiries in this period</p>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="relative mx-auto h-[160px] w-[160px]" aria-label={`${total} enquiries by source`}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartData}
                    dataKey="count"
                    nameKey="label"
                    innerRadius={48}
                    outerRadius={72}
                    paddingAngle={2}
                    stroke="none"
                  >
                    {chartData.map((s) => (
                      <Cell key={s.id} fill={BRAND_COLORS[s.brand]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      background: chartColors.surfaceRaised,
                      border: `1px solid ${chartColors.border}`,
                      borderRadius: 10,
                      color: chartColors.textPrimary,
                      fontSize: 12,
                    }}
                    formatter={(value, name) => [
                      `${value ?? 0} (${total > 0 ? Math.round((Number(value ?? 0) / total) * 100) : 0}%)`,
                      String(name ?? ""),
                    ]}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <p className="text-[20px] font-semibold tabular-nums text-sales-text-primary">{total}</p>
                <p className="text-[10px] font-medium text-sales-text-muted">Enquiries</p>
              </div>
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
