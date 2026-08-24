"use client";

import type { ReactNode } from "react";
import { CompanyWorkspaceShell } from "@/components/dashboard/company/CompanyWorkspaceShell";
import { Skeleton } from "@/components/sales/ui";
import { cn } from "@/lib/ui/cn";

export function CompanyPageSkeletonShell({
  children,
  label,
  immersive = false,
  preferCollapsedSidebar = false,
}: {
  children: ReactNode;
  label: string;
  immersive?: boolean;
  preferCollapsedSidebar?: boolean;
}) {
  return (
    <CompanyWorkspaceShell
      userName="Company Manager"
      unreadNotifications={0}
      notificationRole="CLIENT_MANAGER"
      immersive={immersive}
      preferCollapsedSidebar={preferCollapsedSidebar}
    >
      <div aria-busy="true" aria-label={label}>
        {children}
      </div>
    </CompanyWorkspaceShell>
  );
}

export function PageHeaderSkeleton({
  titleWidth = "w-64",
  subtitleWidth = "w-80",
  showPrimaryAction = true,
}: {
  titleWidth?: string;
  subtitleWidth?: string;
  showPrimaryAction?: boolean;
}) {
  return (
    <div className="min-w-0">
      <div className="hidden min-h-10 items-center justify-between gap-3 layout:flex">
        <Skeleton className="h-3 w-36" />
        <div className="ml-auto flex shrink-0 items-center justify-end gap-2">
          <Skeleton className="h-10 w-[220px] rounded-sales-md" />
          <Skeleton className="h-10 w-[84px] rounded-sales-md" />
          {showPrimaryAction ? <Skeleton className="h-10 w-32 rounded-sales-md" /> : null}
          <Skeleton className="h-8 w-8 rounded-full" />
        </div>
      </div>
      <div className="min-w-0 layout:mt-3.5 layout:border-t layout:border-sales-border-subtle layout:pt-4">
        <Skeleton className={cn("h-7 max-w-full sm:h-8 layout:h-8", titleWidth)} />
        <Skeleton className={cn("mt-2 h-3.5 max-w-full sm:h-4", subtitleWidth)} />
      </div>
    </div>
  );
}

export function KpiCardSkeleton() {
  return (
    <article className="sd-card relative flex h-full min-h-[118px] min-w-0 flex-col justify-between overflow-hidden p-3.5 sm:min-h-[128px] sm:p-4">
      <div className="flex items-start justify-between gap-2">
        <Skeleton className="h-3 w-[72%] max-w-[7.5rem]" />
        <Skeleton className="h-7 w-7 shrink-0 rounded-sales-sm sm:h-8 sm:w-8" />
      </div>
      <div className="min-w-0">
        <Skeleton className="h-7 w-16 sm:h-8" />
        <Skeleton className="mt-2 h-3 w-24" />
      </div>
    </article>
  );
}

export function KpiRowSkeleton({ count, gridClass }: { count: number; gridClass: string }) {
  return (
    <div className={gridClass}>
      {Array.from({ length: count }, (_, index) => (
        <KpiCardSkeleton key={index} />
      ))}
    </div>
  );
}

export function SurfaceCardSkeleton({
  className,
  bodyClassName = "h-[220px]",
}: {
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <div className={cn("sd-card overflow-hidden", className)}>
      <div className="flex items-center justify-between gap-3 border-b border-sales-border-subtle px-5 py-3.5">
        <Skeleton className="h-4 w-36" />
        <Skeleton className="h-3 w-16" />
      </div>
      <div className={cn("space-y-3 p-5", bodyClassName)}>
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-[88%]" />
        <Skeleton className="h-3 w-[72%]" />
        <Skeleton className="h-3 w-[54%]" />
      </div>
    </div>
  );
}

export function TableCardSkeleton({
  rows = 8,
  showToolbar = true,
}: {
  rows?: number;
  showToolbar?: boolean;
}) {
  return (
    <div className="sd-card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-sales-border-subtle px-4 py-3.5 sm:px-5">
        <div className="flex gap-2">
          <Skeleton className="h-8 w-16 rounded-sales-md" />
          <Skeleton className="h-8 w-20 rounded-sales-md" />
          <Skeleton className="hidden h-8 w-16 rounded-sales-md sm:block" />
        </div>
        {showToolbar ? (
          <div className="flex gap-2">
            <Skeleton className="h-9 w-40 rounded-sales-md" />
            <Skeleton className="h-9 w-24 rounded-sales-md" />
          </div>
        ) : null}
      </div>
      <div className="hidden grid-cols-6 gap-3 border-b border-sales-border-subtle px-5 py-2.5 md:grid">
        {Array.from({ length: 6 }, (_, index) => (
          <Skeleton key={index} className="h-3 w-16" />
        ))}
      </div>
      <div className="divide-y divide-sales-border-subtle">
        {Array.from({ length: rows }, (_, index) => (
          <div key={index} className="flex items-center gap-3 px-4 py-3 sm:px-5">
            <Skeleton className="h-9 w-9 shrink-0 rounded-full" />
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-3 w-[42%]" />
              <Skeleton className="h-3 w-[28%]" />
            </div>
            <Skeleton className="hidden h-3 w-16 md:block" />
            <Skeleton className="hidden h-6 w-16 rounded-full md:block" />
          </div>
        ))}
      </div>
    </div>
  );
}
