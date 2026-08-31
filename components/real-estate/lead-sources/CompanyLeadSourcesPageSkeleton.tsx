"use client";

import {
  CompanyPageSkeletonShell,
  KpiRowSkeleton,
  PageHeaderSkeleton,
  TableCardSkeleton,
} from "@/components/dashboard/company/skeletons/CompanySkeletonPrimitives";
import { COMPANY_KPI_COUNTS, COMPANY_KPI_GRID } from "@/lib/sales/company-skeleton-grids";

export function CompanyLeadSourcesPageSkeleton() {
  return (
    <CompanyPageSkeletonShell label="Loading lead sources">
      <div className="space-y-4 sm:space-y-5">
        <PageHeaderSkeleton titleWidth="w-44" subtitleWidth="w-96" />
        <KpiRowSkeleton count={COMPANY_KPI_COUNTS.sources} gridClass={COMPANY_KPI_GRID.sources} />
        <TableCardSkeleton />
      </div>
    </CompanyPageSkeletonShell>
  );
}
