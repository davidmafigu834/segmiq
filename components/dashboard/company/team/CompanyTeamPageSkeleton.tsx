export function CompanyTeamPageSkeleton() {
  return (
    <div
      className="sales-dashboard-premium space-y-4 sm:space-y-5"
      aria-busy="true"
      aria-label="Loading team"
    >
      <div className="space-y-2">
        <div className="hidden h-4 w-32 animate-pulse rounded bg-sales-neutral-100 layout:block" />
        <div className="h-8 w-40 max-w-full animate-pulse rounded bg-sales-neutral-100" />
        <div className="h-4 w-96 max-w-full animate-pulse rounded bg-sales-neutral-100" />
      </div>
      <div className="grid grid-cols-2 gap-3 min-[900px]:grid-cols-3 xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="min-h-[104px] animate-pulse rounded-[14px] border border-sales-border bg-sales-surface"
          />
        ))}
      </div>
      <div className="h-[420px] animate-pulse rounded-[14px] border border-sales-border bg-sales-surface" />
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="h-[190px] animate-pulse rounded-[14px] border border-sales-border bg-sales-surface"
          />
        ))}
      </div>
    </div>
  );
}
