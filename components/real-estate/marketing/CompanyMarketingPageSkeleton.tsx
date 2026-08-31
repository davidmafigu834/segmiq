"use client";

import {
  CompanyPageSkeletonShell,
  KpiRowSkeleton,
  PageHeaderSkeleton,
  TableCardSkeleton,
} from "@/components/dashboard/company/skeletons/CompanySkeletonPrimitives";
import { COMPANY_KPI_COUNTS, COMPANY_KPI_GRID } from "@/lib/sales/company-skeleton-grids";

export function CompanyMarketingPageSkeleton() {
  return (
    <CompanyPageSkeletonShell label="Loading marketing">
      <div className="space-y-4 sm:space-y-5">
        <PageHeaderSkeleton titleWidth="w-40" subtitleWidth="w-96" />
        <KpiRowSkeleton count={COMPANY_KPI_COUNTS.marketing} gridClass={COMPANY_KPI_GRID.marketing} />
        <TableCardSkeleton />
      </div>
    </CompanyPageSkeletonShell>
  );
}
