"use client";

import { KpiStat, type KpiStatVariant } from "@/components/sales/ui/DataDisplay";
import type { SalesKpiItem } from "@/components/dashboard/sales/types";

export function CompanyKpiCard({
  item,
  variant = "default",
}: {
  item: SalesKpiItem;
  variant?: KpiStatVariant;
}) {
  return <KpiStat item={item} variant={variant} />;
}
