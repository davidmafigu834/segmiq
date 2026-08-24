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
    <Card className={`sd-card overflow-hidden border-0 shadow-none ${className}`.trim()}>
      <CardHeader action={action} className="border-sales-border-subtle px-5 py-3.5">
        <CardTitle className="tracking-[-0.02em]">{title}</CardTitle>
      </CardHeader>
      {children}
    </Card>
  );
}
