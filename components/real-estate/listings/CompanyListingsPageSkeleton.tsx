"use client";

import {
  CompanyPageSkeletonShell,
  KpiRowSkeleton,
  PageHeaderSkeleton,
  TableCardSkeleton,
} from "@/components/dashboard/company/skeletons/CompanySkeletonPrimitives";
import { COMPANY_KPI_COUNTS, COMPANY_KPI_GRID } from "@/lib/sales/company-skeleton-grids";

export function CompanyListingsPageSkeleton() {
  return (
    <CompanyPageSkeletonShell label="Loading listings">
      <div className="space-y-4 sm:space-y-5">
        <PageHeaderSkeleton titleWidth="w-32" subtitleWidth="w-96" />
        <KpiRowSkeleton count={COMPANY_KPI_COUNTS.listings} gridClass={COMPANY_KPI_GRID.listings} />
        <TableCardSkeleton />
      </div>
    </CompanyPageSkeletonShell>
  );
}
