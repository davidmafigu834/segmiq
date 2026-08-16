"use client";

import { Skeleton } from "@/components/sales/ui";
import {
  CompanyPageSkeletonShell,
  PageHeaderSkeleton,
  SurfaceCardSkeleton,
  TableCardSkeleton,
} from "@/components/dashboard/company/skeletons/CompanySkeletonPrimitives";

export function CompanyBillingPageSkeleton() {
  return (
    <CompanyPageSkeletonShell label="Loading billing">
      <div className="flex min-w-0 flex-col gap-4 overflow-x-hidden">
        <PageHeaderSkeleton titleWidth="w-32" subtitleWidth="w-[28rem]" showPrimaryAction={false} />

        <div className="grid min-w-0 grid-cols-1 gap-4 layout:grid-cols-[minmax(0,1fr)_minmax(350px,390px)]">
          <div className="flex min-w-0 flex-col gap-4">
            <SurfaceCardSkeleton bodyClassName="h-[160px]" />
            <div className="sd-card overflow-hidden p-5">
              <Skeleton className="mb-4 h-4 w-36" />
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                {Array.from({ length: 4 }, (_, index) => (
                  <div key={index} className="space-y-2 rounded-[10px] border border-sales-border-subtle p-3">
                    <Skeleton className="h-3 w-20" />
                    <Skeleton className="h-6 w-16" />
                    <Skeleton className="h-2 w-full rounded-full" />
                  </div>
                ))}
              </div>
            </div>
            <TableCardSkeleton rows={5} />
          </div>
          <div className="hidden layout:flex layout:flex-col layout:gap-4">
            <SurfaceCardSkeleton bodyClassName="h-[180px]" />
            <SurfaceCardSkeleton bodyClassName="h-[140px]" />
            <SurfaceCardSkeleton bodyClassName="h-[120px]" />
          </div>
        </div>
      </div>
    </CompanyPageSkeletonShell>
  );
}
