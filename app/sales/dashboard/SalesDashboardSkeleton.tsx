export default function SalesDashboardSkeleton() {
  return (
    <div className="sales-dashboard-premium min-h-[100dvh] bg-[#FDFDFE] p-6 layout:pl-[268px]">
      <div className="shimmer mb-6 h-24 rounded-[14px]" />
      <div className="mb-5 grid grid-cols-2 gap-3 min-[900px]:grid-cols-3 xl:grid-cols-5">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="shimmer h-[124px] rounded-[14px]" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1.5fr_1fr]">
        <div className="shimmer h-[420px] rounded-[14px]" />
        <div className="shimmer h-[420px] rounded-[14px]" />
      </div>
    </div>
  );
}
