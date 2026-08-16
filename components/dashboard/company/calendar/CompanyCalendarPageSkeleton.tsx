"use client";

import { Skeleton } from "@/components/sales/ui";
import {
  CompanyPageSkeletonShell,
  KpiRowSkeleton,
  PageHeaderSkeleton,
  SurfaceCardSkeleton,
} from "@/components/dashboard/company/skeletons/CompanySkeletonPrimitives";
import { COMPANY_KPI_COUNTS, COMPANY_KPI_GRID } from "@/lib/sales/company-skeleton-grids";

export function CompanyCalendarPageSkeleton() {
  return (
    <CompanyPageSkeletonShell label="Loading company calendar">
      <div className="space-y-4 sm:space-y-5">
        <PageHeaderSkeleton titleWidth="w-56" subtitleWidth="w-[28rem]" />
        <KpiRowSkeleton count={COMPANY_KPI_COUNTS.calendar} gridClass={COMPANY_KPI_GRID.calendar} />
        <div className="grid min-w-0 grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
          <section className="sd-card min-w-0 overflow-hidden">
            <div className="flex flex-col gap-3 border-b border-sales-border-subtle px-3 py-3 sm:px-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-center gap-1.5">
                <Skeleton className="h-10 w-10 rounded-[9px]" />
                <Skeleton className="h-10 w-10 rounded-[9px]" />
                <Skeleton className="h-10 w-16 rounded-[9px]" />
                <Skeleton className="ml-1 h-4 w-40" />
              </div>
              <div className="flex items-center gap-2">
                <Skeleton className="h-10 w-44 rounded-[9px]" />
                <Skeleton className="h-10 w-24 rounded-[9px]" />
              </div>
            </div>
            <div className="divide-y divide-sales-border-subtle">
              {Array.from({ length: 5 }, (_, index) => (
                <div key={index} className="grid h-[88px] grid-cols-[72px_1fr] sm:h-[112px] sm:grid-cols-[96px_1fr] layout:h-[132px] layout:grid-cols-[156px_1fr]">
                  <div className="border-r border-sales-border-subtle p-3">
                    <Skeleton className="h-3 w-10" />
                    <Skeleton className="mt-2 h-3 w-14" />
                  </div>
                  <div className="space-y-2 p-3">
                    <Skeleton className="h-8 w-[55%] rounded-[10px]" />
                    <Skeleton className="h-8 w-[38%] rounded-[10px]" />
                  </div>
                </div>
              ))}
            </div>
          </section>
          <div className="hidden xl:block">
            <SurfaceCardSkeleton bodyClassName="h-[520px]" />
          </div>
        </div>
      </div>
    </CompanyPageSkeletonShell>
  );
}
