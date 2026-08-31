"use client";

import {
  CompanyPageSkeletonShell,
  KpiRowSkeleton,
  PageHeaderSkeleton,
  TableCardSkeleton,
} from "@/components/dashboard/company/skeletons/CompanySkeletonPrimitives";
import { COMPANY_KPI_COUNTS, COMPANY_KPI_GRID } from "@/lib/sales/company-skeleton-grids";

export function CompanyDevelopmentsPageSkeleton() {
  return (
    <CompanyPageSkeletonShell label="Loading developments">
      <div className="space-y-4 sm:space-y-5">
        <PageHeaderSkeleton titleWidth="w-44" subtitleWidth="w-96" />
        <KpiRowSkeleton count={COMPANY_KPI_COUNTS.developments} gridClass={COMPANY_KPI_GRID.developments} />
        <TableCardSkeleton />
      </div>
    </CompanyPageSkeletonShell>
  );
}
