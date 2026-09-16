function SkeletonBlock({ className }: { className: string }) {
  return <div className={`shimmer rounded-[12px] ${className}`} aria-hidden="true" />;
}

export default function SalesLoading() {
  return (
    <div
      className="sales-dashboard-premium dashboard-shell flex min-h-[100dvh] w-full bg-sales-bg text-sales-text-primary"
      data-sales-portal="true"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <span className="sr-only">Loading salesperson workspace</span>

      <aside
        className="fixed inset-y-0 left-0 hidden w-[228px] border-r border-[var(--sales-sidebar-border)] bg-[var(--sales-sidebar-bg)] p-4 layout:block"
        aria-hidden="true"
      >
        <SkeletonBlock className="h-10 w-28" />
        <div className="mt-8 space-y-2">
          {[1, 2, 3, 4, 5, 6].map((item) => (
            <SkeletonBlock key={item} className="h-10 w-full" />
          ))}
        </div>
      </aside>

      <main className="sales-page-content min-w-0 flex-1 layout:ml-[228px]">
        <div className="sales-page-stack space-y-5">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <SkeletonBlock className="h-4 w-32" />
              <SkeletonBlock className="mt-4 h-8 w-[min(22rem,78vw)]" />
              <SkeletonBlock className="mt-2 h-4 w-[min(30rem,86vw)]" />
            </div>
            <SkeletonBlock className="hidden h-10 w-40 layout:block" />
          </div>

          <div className="grid grid-cols-2 gap-3 min-[900px]:grid-cols-3 xl:grid-cols-6">
            {[1, 2, 3, 4, 5, 6].map((item) => (
              <SkeletonBlock key={item} className="h-[124px]" />
            ))}
          </div>

          <SkeletonBlock className="h-[180px]" />
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <SkeletonBlock className="h-[280px]" />
            <SkeletonBlock className="h-[280px]" />
          </div>
        </div>
      </main>
    </div>
  );
}
