"use client";

import { KpiStat } from "./DataDisplay";
import type { SalesKpiItem } from "@/components/dashboard/sales/types";
import { COMPANY_KPI_GRID } from "@/lib/sales/company-skeleton-grids";

const DEFAULT_PRIMARY_IDS = ["pipeline", "pipeline-value", "customer-pipeline-value", "won"] as const;

function pickPrimary(
  items: SalesKpiItem[],
  primaryId?: string
): { primary: SalesKpiItem; secondary: SalesKpiItem[] } {
  const preferred =
    (primaryId ? items.find((item) => item.id === primaryId) : undefined) ??
    items.find((item) => (DEFAULT_PRIMARY_IDS as readonly string[]).includes(item.id)) ??
    items[0];

  if (!preferred) {
    return { primary: items[0]!, secondary: [] };
  }

  return {
    primary: preferred,
    secondary: items.filter((item) => item.id !== preferred.id),
  };
}

/** Primary pipeline/revenue card on the left; secondary KPIs share its height on the right. */
export function KpiHeroStrip({
  items,
  primaryId = "pipeline",
  className = COMPANY_KPI_GRID.dashboard,
}: {
  items: SalesKpiItem[];
  primaryId?: string;
  className?: string;
}) {
  if (items.length === 0) return null;

  if (items.length === 1) {
    return (
      <div className={className || undefined}>
        <KpiStat item={items[0]!} variant="primary" />
      </div>
    );
  }

  const { primary, secondary } = pickPrimary(items, primaryId);

  return (
    <div className={className}>
      <div className="min-w-0 md:w-[min(34%,280px)] md:shrink-0">
        <KpiStat item={primary} variant="primary" />
      </div>
      {/* Absolute fill so the right stack cannot grow taller than the primary. */}
      <div className="relative min-w-0 flex-1">
        <div className="flex flex-col gap-2 md:absolute md:inset-0">
          {secondary.map((item) => (
            <KpiStat key={item.id} item={item} variant="row" />
          ))}
        </div>
      </div>
    </div>
  );
}
