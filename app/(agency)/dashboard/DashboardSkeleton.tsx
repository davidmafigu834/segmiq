export function DashboardSkeleton() {
  return (
    <div className="animate-pulse space-y-8">
      <div className="space-y-2">
        <div className="h-4 w-40 rounded-sm bg-surface-card-alt" />
        <div className="h-3 w-48 rounded-sm bg-surface-card-alt" />
      </div>
      <div className="grid grid-cols-2 gap-5 border-y border-border py-5 md:grid-cols-5">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="space-y-2">
            <div className="h-2.5 w-20 rounded-sm bg-surface-card-alt" />
            <div className="h-7 w-16 rounded-sm bg-surface-card-alt" />
            <div className="h-2.5 w-24 rounded-sm bg-surface-card-alt" />
          </div>
        ))}
      </div>
      <div className="grid gap-8 lg:grid-cols-2">
        <div className="h-36 rounded-md bg-surface-card-alt" />
        <div className="h-36 rounded-md bg-surface-card-alt" />
      </div>
      <div className="h-48 rounded-md bg-surface-card-alt" />
    </div>
  );
}
