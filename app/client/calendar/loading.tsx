export default function CompanyCalendarLoading() {
  return (
    <div className="min-h-screen bg-sales-bg p-4 sm:p-6 layout:pl-[252px] layout:pr-8">
      <div className="animate-pulse">
        <div className="h-3 w-24 rounded bg-sales-neutral-100" />
        <div className="mt-3 h-8 w-40 rounded bg-sales-neutral-100" />
        <div className="mt-2 h-4 w-80 max-w-full rounded bg-sales-neutral-100" />
        <div className="mt-7 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
          {Array.from({ length: 6 }, (_, index) => <div key={index} className="h-[112px] rounded-[12px] border border-sales-border bg-sales-surface" />)}
        </div>
        <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
          <div className="overflow-hidden rounded-[13px] border border-sales-border bg-sales-surface">
            <div className="h-[112px] border-b border-sales-border-subtle" />
            {Array.from({ length: 5 }, (_, index) => <div key={index} className="grid h-[116px] grid-cols-[156px_1fr] border-b border-sales-border-subtle last:border-b-0"><div className="border-r border-sales-border-subtle" /><div /></div>)}
          </div>
          <div className="hidden h-[692px] rounded-[13px] border border-sales-border bg-sales-surface xl:block" />
        </div>
      </div>
    </div>
  );
}
