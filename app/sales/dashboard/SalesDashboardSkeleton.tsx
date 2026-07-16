export default function SalesDashboardSkeleton() {
  return (
    <div className="w-full pb-20">
      <div className="mb-6 border-b border-[var(--border)] pb-5">
        <div className="shimmer mb-2 h-3 w-32 rounded" />
        <div className="shimmer h-7 w-64 max-w-[70vw] rounded" />
        <div className="shimmer mt-2 h-4 w-96 max-w-[85vw] rounded" />
      </div>
      <div className="shimmer mb-5 h-[76px] rounded-lg border border-[var(--border)]" />
      {/* Numbers strip skeleton */}
      <div className="grid grid-cols-2 min-[600px]:grid-cols-4 gap-3 mb-8">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="shimmer h-[90px] rounded-lg border border-[var(--border)]"
          />
        ))}
      </div>
      {/* Priority list skeleton */}
      <div className="flex flex-col gap-3">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div
            key={i}
            className="shimmer h-[76px] rounded-lg border border-[var(--border)]"
            style={{ opacity: 1 - i * 0.1 }}
          />
        ))}
      </div>
    </div>
  );
}
