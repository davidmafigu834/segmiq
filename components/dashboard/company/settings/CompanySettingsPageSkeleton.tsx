"use client";

import { Skeleton } from "@/components/sales/ui";
import {
  CompanyPageSkeletonShell,
  PageHeaderSkeleton,
  SurfaceCardSkeleton,
} from "@/components/dashboard/company/skeletons/CompanySkeletonPrimitives";

const TAB_WIDTHS = ["w-20", "w-16", "w-36", "w-28", "w-24", "w-24", "w-14", "w-20"];

export function CompanySettingsPageSkeleton() {
  return (
    <CompanyPageSkeletonShell label="Loading settings">
      <div className="flex min-w-0 flex-col gap-4 overflow-x-hidden pb-8">
        <PageHeaderSkeleton titleWidth="w-32" subtitleWidth="w-[28rem]" showPrimaryAction={false} />

        <div className="flex min-w-0 gap-1 overflow-x-auto border-b border-sales-border-subtle scrollbar-hide">
          {TAB_WIDTHS.map((width, index) => (
            <div key={index} className="relative shrink-0 px-3 py-2.5">
              <Skeleton className={`h-3.5 ${width}`} />
              {index === 0 ? (
                <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-sales-brand/40" aria-hidden />
              ) : null}
            </div>
          ))}
        </div>

        <Skeleton className="h-11 w-full rounded-[10px] layout:hidden" />

        <div className="grid min-w-0 grid-cols-1 gap-5 layout:grid-cols-[220px_minmax(0,1fr)_320px]">
          <aside className="hidden min-w-0 space-y-1 layout:block">
            {Array.from({ length: 6 }, (_, index) => (
              <Skeleton key={index} className="h-10 w-full rounded-[10px]" />
            ))}
          </aside>
          <div className="min-w-0 space-y-4">
            <SurfaceCardSkeleton bodyClassName="h-[220px]" />
            <SurfaceCardSkeleton bodyClassName="h-[180px]" />
            <SurfaceCardSkeleton bodyClassName="h-[160px]" />
          </div>
          <div className="hidden min-w-0 space-y-4 layout:block">
            <SurfaceCardSkeleton bodyClassName="h-[140px]" />
            <SurfaceCardSkeleton bodyClassName="h-[120px]" />
            <SurfaceCardSkeleton bodyClassName="h-[100px]" />
          </div>
        </div>
      </div>
    </CompanyPageSkeletonShell>
  );
}
