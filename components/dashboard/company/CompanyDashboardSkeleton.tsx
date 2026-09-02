"use client";

import {
  CompanyPageSkeletonShell,
  KpiRowSkeleton,
  PageHeaderSkeleton,
  SurfaceCardSkeleton,
} from "@/components/dashboard/company/skeletons/CompanySkeletonPrimitives";
import { COMPANY_KPI_COUNTS, COMPANY_KPI_GRID } from "@/lib/sales/company-skeleton-grids";

export default function CompanyDashboardSkeleton() {
  return (
    <CompanyPageSkeletonShell label="Loading company dashboard">
      <div className="space-y-4 sm:space-y-5">
        <PageHeaderSkeleton titleWidth="w-72" subtitleWidth="w-[28rem]" />

        <div className="layout:hidden">
          <SurfaceCardSkeleton bodyClassName="h-[72px]" />
        </div>

        <KpiRowSkeleton count={COMPANY_KPI_COUNTS.dashboard} gridClass={COMPANY_KPI_GRID.dashboard} />

        <div className="hidden layout:block">
          <SurfaceCardSkeleton bodyClassName="h-[72px]" />
        </div>

        <SurfaceCardSkeleton bodyClassName="h-[520px]" />

        <div className="grid w-full grid-cols-1 gap-4 layout:grid-cols-[minmax(0,1.1fr)_minmax(280px,0.9fr)] layout:gap-5">
          <SurfaceCardSkeleton bodyClassName="h-[240px]" />
          <div className="hidden layout:block">
            <SurfaceCardSkeleton bodyClassName="h-[240px]" />
          </div>
        </div>

        <div className="grid w-full grid-cols-1 gap-4 layout:grid-cols-[minmax(0,1.55fr)_minmax(280px,0.95fr)] layout:gap-5">
          <SurfaceCardSkeleton bodyClassName="h-[280px]" />
          <div className="space-y-4 layout:space-y-5">
            <div className="layout:hidden">
              <SurfaceCardSkeleton bodyClassName="h-[220px]" />
            </div>
            <SurfaceCardSkeleton bodyClassName="h-[220px]" />
          </div>
        </div>

        <SurfaceCardSkeleton bodyClassName="h-[180px]" />

        <div className="grid w-full grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3 layout:gap-5">
          <SurfaceCardSkeleton bodyClassName="h-[220px]" />
          <SurfaceCardSkeleton bodyClassName="h-[220px]" />
          <SurfaceCardSkeleton bodyClassName="h-[220px]" />
        </div>
      </div>
    </CompanyPageSkeletonShell>
  );
}
