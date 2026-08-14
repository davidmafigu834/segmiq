export default function CompanyCalendarLoading() {
  return (
    <div className="min-h-screen bg-sales-bg p-4 sm:p-6 layout:pl-[252px] layout:pr-8">
      <div className="animate-pulse">
        <div className="h-3 w-24 rounded bg-sales-neutral-100" />
        <div className="mt-3 h-8 w-40 rounded bg-sales-neutral-100" />
        <div className="mt-2 h-4 w-80 max-w-full rounded bg-sales-neutral-100" />
        <div className="mt-8 grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
          <div className="h-[720px] rounded-[13px] border border-sales-border bg-sales-surface" />
          <div className="hidden h-[720px] rounded-[13px] border border-sales-border bg-sales-surface xl:block" />
        </div>
      </div>
    </div>
  );
}
