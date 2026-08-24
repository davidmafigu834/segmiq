export default function SalesDashboardSkeleton() {
  return (
    <div className="sales-dashboard-premium min-h-[100dvh] bg-sales-bg p-4 layout:pl-[228px] layout:p-6">
      <div className="shimmer mb-5 h-20 rounded-[14px]" />
      <div className="mb-4 grid grid-cols-2 gap-3 min-[900px]:grid-cols-3 xl:grid-cols-6">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="shimmer h-[118px] rounded-[14px]" />
        ))}
      </div>
      <div className="shimmer mb-4 h-[120px] rounded-[14px]" />
      <div className="mb-4 space-y-4">
        <div className="shimmer h-[220px] rounded-[14px]" />
        <div className="shimmer h-[280px] rounded-[14px]" />
        <div className="shimmer h-[140px] rounded-[14px]" />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="shimmer h-[240px] rounded-[14px]" />
        ))}
      </div>
    </div>
  );
}
