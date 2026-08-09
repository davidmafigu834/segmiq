"use client";

import { useMemo, useState } from "react";
import { Globe2, MoreHorizontal, Users } from "lucide-react";
import { SiFacebook, SiWhatsapp } from "react-icons/si";
import {
  buildLeadSources,
  LEAD_SOURCE_PERIOD_OPTIONS,
  type LeadSourcePeriod,
  type SalesDashboardRaw,
} from "@/lib/sales/sales-dashboard-view";
import type { SalesLeadSourceItem } from "./types";
import { CardShell } from "./KpiCard";
import { MenuSelect } from "@/components/sales/ui/MenuSelect";
import { cn } from "@/lib/ui/cn";

function SourceIcon({ brand }: { brand: SalesLeadSourceItem["brand"] }) {
  if (brand === "whatsapp") return <SiWhatsapp size={16} color="#25D366" aria-hidden />;
  if (brand === "facebook") return <SiFacebook size={16} color="#1877F2" aria-hidden />;
  if (brand === "referral") {
    return <Users size={16} strokeWidth={1.8} className="text-sales-text-secondary" aria-hidden />;
  }
  if (brand === "website") {
    return <Globe2 size={16} strokeWidth={1.8} className="text-sales-text-secondary" aria-hidden />;
  }
  return <MoreHorizontal size={16} strokeWidth={1.8} className="text-sales-text-muted" aria-hidden />;
}

export function LeadSourcesCard({ data }: { data: SalesDashboardRaw }) {
  const [period, setPeriod] = useState<LeadSourcePeriod>("this_month");
  const sources = useMemo(() => buildLeadSources(data, period), [data, period]);
  const maxCount = Math.max(...sources.map((s) => s.count), 1);

  return (
    <CardShell
      title="Top lead sources"
      action={
        <MenuSelect
          aria-label="Lead sources date range"
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
      {sources.every((s) => s.count === 0) ? (
        <p className="py-6 text-center text-[13px] text-sales-text-muted">No lead sources yet</p>
      ) : (
        <ul className="space-y-3.5">
          {sources.map((s) => (
            <li key={s.id}>
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <span className="inline-flex min-w-0 items-center gap-2 text-[13px] font-medium text-sales-text-primary">
                  <SourceIcon brand={s.brand} />
                  <span className="truncate">{s.label}</span>
                </span>
                <span className="flex shrink-0 items-center gap-2 text-[12px]">
                  <span className="font-semibold tabular-nums text-sales-text-primary">{s.count}</span>
                  {s.trendLabel ? (
                    <span
                      className={cn(
                        "tabular-nums",
                        s.trendDirection === "up"
                          ? "text-[#16A34A]"
                          : s.trendDirection === "down"
                            ? "text-sales-danger"
                            : "text-sales-text-muted"
                      )}
                    >
                      {s.trendLabel}
                    </span>
                  ) : null}
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-[var(--sales-border-subtle)]">
                <div
                  className="h-full rounded-full bg-sales-brand"
                  style={{
                    width: `${s.count > 0 ? Math.max((s.count / maxCount) * 100, 4) : 0}%`,
                  }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </CardShell>
  );
}
