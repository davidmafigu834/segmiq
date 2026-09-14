export function DashboardSkeleton() {
  return (
    <div className="animate-pulse space-y-10">
      <div className="flex justify-end pb-1">
        <div className="h-8 w-28 rounded-md bg-surface-card-alt" />
      </div>
      <div className="grid min-h-[104px] grid-cols-2 gap-5 border-y border-border py-5 md:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="space-y-2">
            <div className="h-2.5 w-20 rounded-sm bg-surface-card-alt" />
            <div className="h-8 w-24 rounded-sm bg-surface-card-alt" />
            <div className="h-2.5 w-16 rounded-sm bg-surface-card-alt" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-8 border-y border-border py-8 min-[1100px]:grid-cols-[3fr_2fr] min-[1100px]:gap-0">
        <div className="space-y-3">
          <div className="h-4 w-48 rounded-sm bg-surface-card-alt" />
          <div className="h-40 rounded-sm bg-surface-card-alt" />
        </div>
        <div className="space-y-3 min-[1100px]:ml-8 min-[1100px]:border-l min-[1100px]:border-border min-[1100px]:pl-8">
          <div className="h-4 w-32 rounded-sm bg-surface-card-alt" />
          <div className="h-48 rounded-sm bg-surface-card-alt" />
        </div>
      </div>
      <div className="grid grid-cols-1 border-y border-border min-[800px]:grid-cols-2">
        {[0, 1].map((i) => (
          <div key={i} className="h-48 bg-surface-card-alt/70 min-[800px]:odd:border-l min-[800px]:odd:border-border" />
        ))}
      </div>
      <div className="space-y-4 border-t border-border pt-8">
        <div className="h-5 w-40 rounded-sm bg-surface-card-alt" />
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-40 border-t border-border bg-surface-card-alt/40" />
        ))}
      </div>
    </div>
  );
}
