"use client";

import {
  CompanyPageSkeletonShell,
  KpiRowSkeleton,
  PageHeaderSkeleton,
  TableCardSkeleton,
} from "@/components/dashboard/company/skeletons/CompanySkeletonPrimitives";
import { COMPANY_KPI_COUNTS, COMPANY_KPI_GRID } from "@/lib/sales/company-skeleton-grids";

export function CompanyWebsiteLeadsPageSkeleton() {
  return (
    <CompanyPageSkeletonShell label="Loading website leads">
      <div className="space-y-4 sm:space-y-5">
        <PageHeaderSkeleton titleWidth="w-44" subtitleWidth="w-96" />
        <KpiRowSkeleton count={COMPANY_KPI_COUNTS.websiteLeads} gridClass={COMPANY_KPI_GRID.websiteLeads} />
        <TableCardSkeleton />
      </div>
    </CompanyPageSkeletonShell>
  );
}
