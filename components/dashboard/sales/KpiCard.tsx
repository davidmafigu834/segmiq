"use client";

import type { ReactNode } from "react";
import { KpiStat } from "@/components/sales/ui/DataDisplay";
import type { SalesKpiItem } from "./types";
import { Card, CardHeader, CardTitle } from "@/components/sales/ui/Card";

/** @deprecated Prefer KpiStat from @/components/sales/ui — kept as thin alias. */
export function KpiCard({ item }: { item: SalesKpiItem }) {
  return <KpiStat item={item} />;
}

export function CardShell({
  title,
  action,
  children,
  className = "",
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Card className={`sd-card dashboard-panel overflow-hidden border-0 shadow-none ${className}`.trim()}>
      <CardHeader action={action} className="dashboard-panel-header border-sales-border-subtle">
        <CardTitle className="dashboard-section-title tracking-[-0.02em]">{title}</CardTitle>
      </CardHeader>
      {children}
    </Card>
  );
}
