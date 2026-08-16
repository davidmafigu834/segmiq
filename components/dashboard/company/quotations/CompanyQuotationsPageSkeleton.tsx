"use client";

import { Skeleton } from "@/components/sales/ui";
import {
  CompanyPageSkeletonShell,
  KpiRowSkeleton,
  PageHeaderSkeleton,
  TableCardSkeleton,
} from "@/components/dashboard/company/skeletons/CompanySkeletonPrimitives";
import { COMPANY_KPI_COUNTS, COMPANY_KPI_GRID } from "@/lib/sales/company-skeleton-grids";

export function CompanyQuotationsPageSkeleton() {
  return (
    <CompanyPageSkeletonShell label="Loading quotations">
      <div className="space-y-4 sm:space-y-5">
        <PageHeaderSkeleton titleWidth="w-44" subtitleWidth="w-[28rem]" />
        <div className="flex gap-2 layout:hidden">
          <Skeleton className="h-10 flex-1 rounded-sales-md" />
          <Skeleton className="h-10 w-24 rounded-sales-md" />
        </div>
        <KpiRowSkeleton count={COMPANY_KPI_COUNTS.quotations} gridClass={COMPANY_KPI_GRID.quotations} />
        <TableCardSkeleton />
      </div>
    </CompanyPageSkeletonShell>
  );
}
