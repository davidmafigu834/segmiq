"use client";

import {
  CompanyPageSkeletonShell,
  KpiRowSkeleton,
  PageHeaderSkeleton,
  TableCardSkeleton,
} from "@/components/dashboard/company/skeletons/CompanySkeletonPrimitives";
import { COMPANY_KPI_COUNTS, COMPANY_KPI_GRID } from "@/lib/sales/company-skeleton-grids";

export function CompanyCustomersPageSkeleton() {
  return (
    <CompanyPageSkeletonShell label="Loading customers">
      <div className="space-y-4 sm:space-y-5">
        <PageHeaderSkeleton titleWidth="w-40" subtitleWidth="w-80" />
        <KpiRowSkeleton count={COMPANY_KPI_COUNTS.customers} gridClass={COMPANY_KPI_GRID.customers} />
        <TableCardSkeleton />
      </div>
    </CompanyPageSkeletonShell>
  );
}
