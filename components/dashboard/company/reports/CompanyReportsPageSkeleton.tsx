"use client";

import { Skeleton } from "@/components/sales/ui";
import {
  CompanyPageSkeletonShell,
  PageHeaderSkeleton,
} from "@/components/dashboard/company/skeletons/CompanySkeletonPrimitives";
import { ReportOverviewSkeleton } from "@/components/dashboard/company/reports/ReportOverviewSkeleton";

export function CompanyReportsPageSkeleton() {
  return (
    <CompanyPageSkeletonShell label="Loading reports">
      <div className="flex min-w-0 flex-col gap-4 overflow-x-hidden">
        <PageHeaderSkeleton titleWidth="w-36" subtitleWidth="w-80" showPrimaryAction={false} />
        <div className="flex min-w-0 gap-1 overflow-x-auto border-b border-sales-border-subtle pb-px scrollbar-hide">
          {Array.from({ length: 9 }, (_, index) => (
            <Skeleton key={index} className="mb-2 h-8 w-20 shrink-0 rounded-sales-md" />
          ))}
        </div>
        <ReportOverviewSkeleton />
      </div>
    </CompanyPageSkeletonShell>
  );
}
