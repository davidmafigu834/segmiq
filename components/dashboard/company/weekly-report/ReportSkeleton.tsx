"use client";

import { Skeleton } from "@/components/sales/ui";

export function ReportSkeleton() {
  return (
    <div className="mx-auto w-full max-w-3xl space-y-8 px-4 py-8">
      <Skeleton className="h-5 w-40" />
      <Skeleton className="h-9 w-80" />
      <Skeleton className="h-24 w-full" />
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Skeleton className="h-16" />
        <Skeleton className="h-16" />
        <Skeleton className="h-16" />
        <Skeleton className="h-16" />
      </div>
      <Skeleton className="h-40 w-full" />
      <Skeleton className="h-28 w-full" />
    </div>
  );
}
