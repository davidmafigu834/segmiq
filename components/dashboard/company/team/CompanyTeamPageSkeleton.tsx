"use client";

import {
  CompanyPageSkeletonShell,
  KpiRowSkeleton,
  PageHeaderSkeleton,
  SurfaceCardSkeleton,
  TableCardSkeleton,
} from "@/components/dashboard/company/skeletons/CompanySkeletonPrimitives";
import { COMPANY_KPI_COUNTS, COMPANY_KPI_GRID } from "@/lib/sales/company-skeleton-grids";

export function CompanyTeamPageSkeleton() {
  return (
    <CompanyPageSkeletonShell label="Loading team">
      <div className="space-y-4 sm:space-y-5">
        <PageHeaderSkeleton titleWidth="w-40" subtitleWidth="w-96" />
        <KpiRowSkeleton count={COMPANY_KPI_COUNTS.team} gridClass={COMPANY_KPI_GRID.team} />
        <TableCardSkeleton rows={6} />
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <SurfaceCardSkeleton bodyClassName="h-[140px]" />
          <SurfaceCardSkeleton bodyClassName="h-[140px]" />
          <SurfaceCardSkeleton bodyClassName="h-[140px]" />
        </div>
      </div>
    </CompanyPageSkeletonShell>
  );
}
