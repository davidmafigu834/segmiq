import { Skeleton } from "@/components/sales/ui";

export function CompanyCustomersPageSkeleton() {
  return <div className="sales-dashboard-premium min-h-full bg-sales-bg px-4 py-4 sm:px-6 layout:px-8 layout:py-6"><div className="space-y-5"><div className="flex items-start justify-between gap-4"><div className="space-y-2"><Skeleton className="h-3 w-28" /><Skeleton className="h-8 w-40" /><Skeleton className="h-4 w-80 max-w-full" /></div><Skeleton className="h-10 w-36" /></div><div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">{Array.from({ length: 5 }, (_, index) => <Skeleton key={index} className="h-[120px]" />)}</div><Skeleton className="h-[680px] w-full" /></div></div>;
}
