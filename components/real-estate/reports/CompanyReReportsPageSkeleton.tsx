"use client";

import {
  CompanyPageSkeletonShell,
  KpiRowSkeleton,
  PageHeaderSkeleton,
  TableCardSkeleton,
} from "@/components/dashboard/company/skeletons/CompanySkeletonPrimitives";
import { COMPANY_KPI_COUNTS, COMPANY_KPI_GRID } from "@/lib/sales/company-skeleton-grids";

export function CompanyReReportsPageSkeleton() {
  return (
    <CompanyPageSkeletonShell label="Loading reports">
      <div className="space-y-4 sm:space-y-5">
        <PageHeaderSkeleton titleWidth="w-32" subtitleWidth="w-80" showPrimaryAction={false} />
        <KpiRowSkeleton count={COMPANY_KPI_COUNTS.reports} gridClass={COMPANY_KPI_GRID.reports} />
        <TableCardSkeleton />
      </div>
    </CompanyPageSkeletonShell>
  );
}
