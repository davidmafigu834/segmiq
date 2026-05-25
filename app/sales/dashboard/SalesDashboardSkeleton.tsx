export default function SalesDashboardSkeleton() {
  return (
    <div className="px-4 pt-6 pb-28 md:px-6 layout:pb-10 layout:px-8">
      {/* Numbers strip skeleton */}
      <div className="grid grid-cols-2 min-[600px]:grid-cols-4 gap-3 mb-8">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="h-[90px] rounded-xl bg-[var(--surface-card)] border border-[var(--border)] animate-pulse"
          />
        ))}
      </div>
      {/* Priority list skeleton */}
      <div className="flex flex-col gap-3">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div
            key={i}
            className="h-[76px] rounded-xl bg-[var(--surface-card)] border border-[var(--border)] animate-pulse"
            style={{ opacity: 1 - i * 0.1 }}
          />
        ))}
      </div>
    </div>
  );
}
