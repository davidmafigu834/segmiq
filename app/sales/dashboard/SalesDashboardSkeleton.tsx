export default function SalesDashboardSkeleton() {
  return (
    <div className="sales-dashboard-premium min-h-[100dvh] bg-sales-bg p-4 layout:pl-[228px] layout:p-6">
      <div className="shimmer mb-5 h-20 rounded-[14px]" />
      <div className="mb-4 grid grid-cols-2 gap-3 min-[900px]:grid-cols-3 xl:grid-cols-6">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="shimmer h-[110px] rounded-[14px]" />
        ))}
      </div>
      <div className="shimmer mb-4 h-[120px] rounded-[14px]" />
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.7fr_0.95fr]">
        <div className="space-y-4">
          <div className="shimmer h-[280px] rounded-[14px]" />
          <div className="shimmer h-[320px] rounded-[14px]" />
        </div>
        <div className="space-y-4">
          <div className="shimmer h-[220px] rounded-[14px]" />
          <div className="shimmer h-[180px] rounded-[14px]" />
        </div>
      </div>
    </div>
  );
}
