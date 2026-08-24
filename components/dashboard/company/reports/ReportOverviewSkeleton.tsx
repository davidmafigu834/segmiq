"use client";

import { Skeleton } from "@/components/sales/ui";
import { reportKpiGridClass } from "./ReportKpiCard";

export function ReportOverviewSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-busy="true" aria-label="Loading reports">
      <section className={reportKpiGridClass(6)}>
        {Array.from({ length: 6 }).map((_, i) => (
          <article
            key={i}
            className="sd-card relative flex h-full min-h-[128px] min-w-0 flex-col overflow-hidden p-3.5 sm:min-h-[136px] sm:p-4"
          >
            <div className="flex items-center gap-2.5">
              <Skeleton className="h-8 w-8 shrink-0 rounded-full sm:h-9 sm:w-9" />
              <Skeleton className="h-3 w-24" />
            </div>
            <Skeleton className="mt-2.5 h-7 w-20 sm:h-8" />
            <div className="mt-auto flex items-end justify-between gap-2 pt-2">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-6 w-14 sm:w-[72px]" />
            </div>
          </article>
        ))}
      </section>
      <div className="grid min-w-0 grid-cols-1 gap-4 layout:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,20rem)]">
        <div className="flex min-w-0 flex-col gap-4">
          <Skeleton className="h-[280px] rounded-[12px] layout:h-[320px]" />
          <Skeleton className="h-[260px] rounded-[12px] layout:h-[300px]" />
        </div>
        <div className="flex min-w-0 flex-col gap-4">
          <Skeleton className="h-[280px] rounded-[12px] layout:h-[320px]" />
          <Skeleton className="h-[260px] rounded-[12px] layout:h-[300px]" />
        </div>
        <div className="flex min-w-0 flex-col gap-4">
          <Skeleton className="h-[140px] rounded-[12px]" />
          <Skeleton className="h-[160px] rounded-[12px]" />
          <Skeleton className="h-[160px] rounded-[12px]" />
        </div>
      </div>
    </div>
  );
}
