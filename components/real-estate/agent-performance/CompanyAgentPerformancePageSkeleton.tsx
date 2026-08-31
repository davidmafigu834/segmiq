"use client";

import {
  CompanyPageSkeletonShell,
  KpiRowSkeleton,
  PageHeaderSkeleton,
  TableCardSkeleton,
} from "@/components/dashboard/company/skeletons/CompanySkeletonPrimitives";
import { COMPANY_KPI_COUNTS, COMPANY_KPI_GRID } from "@/lib/sales/company-skeleton-grids";

export function CompanyAgentPerformancePageSkeleton() {
  return (
    <CompanyPageSkeletonShell label="Loading agent performance">
      <div className="space-y-4 sm:space-y-5">
        <PageHeaderSkeleton titleWidth="w-52" subtitleWidth="w-96" />
        <KpiRowSkeleton count={COMPANY_KPI_COUNTS.agentPerformance} gridClass={COMPANY_KPI_GRID.agentPerformance} />
        <TableCardSkeleton />
      </div>
    </CompanyPageSkeletonShell>
  );
}
