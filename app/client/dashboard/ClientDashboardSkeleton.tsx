export default function ClientDashboardSkeleton() {
  return (
    <div className="w-full pb-20">
      <div className="mb-6 border-b border-[var(--border)] pb-5">
        <div className="shimmer mb-2 h-3 w-40 rounded" />
        <div className="shimmer h-7 w-64 max-w-[70vw] rounded" />
        <div className="shimmer mt-2 h-4 w-96 max-w-[85vw] rounded" />
      </div>
      <div className="mb-6 flex flex-wrap gap-2">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="shimmer h-9 w-28 rounded-lg border border-[var(--border)]" />
        ))}
      </div>
      <div className="mb-8 grid grid-cols-1 gap-2 min-[480px]:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="shimmer h-[90px] rounded-lg border border-[var(--border)]" />
        ))}
      </div>
      <div className="shimmer mb-8 h-[88px] rounded-lg border border-[var(--border)]" />
      <div className="mb-8 grid grid-cols-1 gap-6 min-[1000px]:grid-cols-[1fr_360px]">
        <div className="shimmer h-[320px] rounded-lg border border-[var(--border)]" />
        <div className="flex flex-col gap-6">
          <div className="shimmer h-[150px] rounded-lg border border-[var(--border)]" />
          <div className="shimmer h-[150px] rounded-lg border border-[var(--border)]" />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-6 min-[900px]:grid-cols-2">
        <div className="shimmer h-[220px] rounded-lg border border-[var(--border)]" />
        <div className="shimmer h-[220px] rounded-lg border border-[var(--border)]" />
      </div>
    </div>
  );
}
