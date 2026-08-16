"use client";

import { Skeleton } from "@/components/sales/ui";

export function InboxSkeleton() {
  return (
    <div className="flex min-h-0 flex-1 overflow-hidden bg-sales-bg" aria-busy aria-label="Loading inbox">
      <div className="hidden w-[360px] shrink-0 border-r border-sales-border bg-sales-surface p-3 sm:block">
        <Skeleton className="mb-4 h-4 w-40" />
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="mb-3 flex gap-3 border-b border-sales-border-subtle pb-3">
            <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
            <div className="min-w-0 flex-1 space-y-2 pt-0.5">
              <div className="flex justify-between gap-2">
                <Skeleton className="h-3 w-28" />
                <Skeleton className="h-3 w-12" />
              </div>
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-2/3" />
            </div>
          </div>
        ))}
      </div>
      <div className="flex min-w-0 flex-1 flex-col bg-sales-bg">
        <div className="flex items-center gap-3 border-b border-sales-border bg-sales-surface px-4 py-3">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-3 w-36" />
            <Skeleton className="h-3 w-24" />
          </div>
        </div>
        <div className="flex flex-1 flex-col justify-end gap-3 p-4">
          <Skeleton className="ml-auto h-14 w-[55%] rounded-[12px] bg-sales-brand-soft" />
          <Skeleton className="h-16 w-[60%] rounded-[12px] bg-sales-surface" />
          <Skeleton className="ml-auto h-10 w-[40%] rounded-[12px] bg-sales-brand-soft" />
        </div>
      </div>
      <div className="hidden w-[360px] shrink-0 border-l border-sales-border bg-sales-surface p-4 lg:block">
        <Skeleton className="mb-4 h-4 w-32" />
        <div className="mb-4 flex gap-3">
          <Skeleton className="h-12 w-12 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3 w-28" />
            <Skeleton className="h-3 w-20" />
          </div>
        </div>
        <Skeleton className="mx-auto mb-4 h-20 w-20 rounded-full" />
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="mb-3 space-y-1.5">
            <Skeleton className="h-2.5 w-20" />
            <Skeleton className="h-2 w-full rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
