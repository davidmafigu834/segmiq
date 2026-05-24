export default function ClientDashboardSkeleton() {
  return (
    <div className="px-4 pt-6 pb-28 md:px-6 layout:pb-10 layout:px-8">
      {/* Page header */}
      <div className="mb-8">
        <div className="h-3 w-24 rounded bg-[var(--surface-card)] animate-pulse mb-2" />
        <div className="h-8 w-56 rounded bg-[var(--surface-card)] animate-pulse" />
      </div>

      {/* Quick actions */}
      <div className="flex items-center gap-2 mb-8">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="h-9 w-28 rounded-lg bg-[var(--surface-card)] border border-[var(--border)] animate-pulse"
          />
        ))}
      </div>

      {/* Focus strip */}
      <div className="grid grid-cols-3 gap-3 mb-8">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-[110px] rounded-xl bg-[var(--surface-card)] border border-[var(--border)] animate-pulse"
          />
        ))}
      </div>

      {/* Pulse bar */}
      <div className="h-[88px] rounded-xl bg-[var(--surface-card)] border border-[var(--border)] animate-pulse mb-8" />

      {/* Team + pipeline */}
      <div className="grid grid-cols-1 gap-6 min-[1000px]:grid-cols-[1fr_360px] mb-8">
        <div className="h-[320px] rounded-xl bg-[var(--surface-card)] border border-[var(--border)] animate-pulse" />
        <div className="flex flex-col gap-6">
          <div className="h-[150px] rounded-xl bg-[var(--surface-card)] border border-[var(--border)] animate-pulse" />
          <div className="h-[150px] rounded-xl bg-[var(--surface-card)] border border-[var(--border)] animate-pulse" />
        </div>
      </div>

      {/* Assets + wins */}
      <div className="grid grid-cols-1 gap-6 min-[900px]:grid-cols-2 mb-8">
        <div className="h-[220px] rounded-xl bg-[var(--surface-card)] border border-[var(--border)] animate-pulse" />
        <div className="h-[220px] rounded-xl bg-[var(--surface-card)] border border-[var(--border)] animate-pulse" />
      </div>

      {/* Sources */}
      <div className="h-[180px] rounded-xl bg-[var(--surface-card)] border border-[var(--border)] animate-pulse" />
    </div>
  );
}
