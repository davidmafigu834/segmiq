export default function CommercialLoading() {
  return (
    <div className="space-y-5" role="status" aria-label="Loading commercial overview">
      <div className="h-56 animate-pulse rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] motion-reduce:animate-none" />
      <div className="grid gap-5 xl:grid-cols-2">
        <div className="h-72 animate-pulse rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] motion-reduce:animate-none" />
        <div className="h-72 animate-pulse rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] motion-reduce:animate-none" />
      </div>
      <span className="sr-only">Loading commercial records</span>
    </div>
  );
}
