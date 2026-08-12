export function CompanyPipelinePageSkeleton() {
  return (
    <div
      className="sales-dashboard-premium space-y-4 sm:space-y-5"
      aria-busy="true"
      aria-label="Loading pipeline"
    >
      <div className="space-y-2">
        <div className="hidden h-4 w-40 animate-pulse rounded bg-sales-neutral-100 layout:block" />
        <div className="h-8 w-36 max-w-full animate-pulse rounded bg-sales-neutral-100" />
        <div className="h-4 w-96 max-w-full animate-pulse rounded bg-sales-neutral-100" />
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="min-h-[104px] animate-pulse rounded-[14px] border border-sales-border bg-sales-surface"
          />
        ))}
      </div>
      <div className="h-[520px] animate-pulse rounded-[14px] border border-sales-border bg-sales-surface" />
    </div>
  );
}
