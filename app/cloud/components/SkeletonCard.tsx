import type { CSSProperties } from "react";

export function SkeletonBone({
  className = "",
  style,
}: {
  className?: string;
  style?: CSSProperties;
}) {
  return <div className={`cloud-skeleton ${className}`.trim()} style={style} aria-hidden />;
}

export function SkeletonCard({ height = 200, square = false }: { height?: number; square?: boolean }) {
  return (
    <div className="cloud-card overflow-hidden">
      <div className="flex items-center justify-between gap-2 px-3.5 pb-1 pt-3.5">
        <SkeletonBone className="h-5 w-16 rounded-full" />
        <SkeletonBone className="h-7 w-7 rounded-lg" />
      </div>
      <SkeletonBone
        className={square ? "aspect-square w-full rounded-none" : "w-full rounded-none"}
        style={square ? undefined : { height }}
      />
      <div className="space-y-2 px-3 pb-3.5 pt-2.5">
        <SkeletonBone className="h-3.5 w-[70%] rounded-md" />
        <SkeletonBone className="h-2.5 w-[45%] rounded-md" />
      </div>
    </div>
  );
}

export function SkeletonPhotoGrid() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <SkeletonCard key={i} square />
      ))}
    </div>
  );
}

export function SkeletonScrollRow() {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="cloud-card overflow-hidden">
          <SkeletonBone className="h-[140px] w-full rounded-none" />
          <div className="space-y-2 p-4">
            <SkeletonBone className="h-3.5 w-[65%] rounded-md" />
            <SkeletonBone className="h-2.5 w-[40%] rounded-md" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function SkeletonProjectsToolbar() {
  return (
    <div className="cloud-toolbar mb-5">
      <div className="cloud-toolbar-search">
        <SkeletonBone className="h-10 w-full rounded-[10px]" />
      </div>
      <div className="cloud-toolbar-actions">
        <SkeletonBone className="h-10 w-[168px] max-w-full rounded-[10px]" />
        <SkeletonBone className="h-10 w-[124px] rounded-[10px]" />
      </div>
    </div>
  );
}

export function SkeletonDashboardHome() {
  return (
    <>
      <div className="mb-6 space-y-2">
        <SkeletonBone className="h-3 w-24 rounded-md" />
        <SkeletonBone className="h-9 w-56 max-w-full rounded-md" />
      </div>
      <div className="cloud-stat-grid mb-6">
        <div className="cloud-card p-5">
          <SkeletonBone className="mb-3 h-3 w-24 rounded-md" />
          <SkeletonBone className="mb-2 h-9 w-32 rounded-md" />
          <SkeletonBone className="h-2.5 w-40 rounded-md" />
          <SkeletonBone className="mt-4 h-1.5 w-full rounded-full" />
        </div>
        <div className="cloud-card p-5">
          <SkeletonBone className="mb-3 h-3 w-16 rounded-md" />
          <SkeletonBone className="h-8 w-12 rounded-md" />
        </div>
        <div className="cloud-card p-5">
          <SkeletonBone className="mb-3 h-3 w-14 rounded-md" />
          <SkeletonBone className="h-8 w-12 rounded-md" />
        </div>
      </div>
      <div className="mb-8 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonBone key={i} className="h-12 w-full rounded-[12px]" />
        ))}
      </div>
      <SkeletonBone className="mb-3 h-3 w-28 rounded-md" />
      <SkeletonScrollRow />
    </>
  );
}

export function SkeletonProjectDetail() {
  return (
    <div className="cloud-page !pb-0">
      <SkeletonBone className="mb-3 h-3.5 w-16 rounded-md" />
      <SkeletonBone className="mb-6 h-7 w-[55%] max-w-md rounded-md" />
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <SkeletonBone key={i} className="aspect-square w-full rounded-[12px]" />
        ))}
      </div>
    </div>
  );
}

export function SkeletonMilestoneList({ count = 3 }: { count?: number }) {
  return (
    <div className="flex flex-col gap-2.5">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="cloud-card p-4">
          <div className="flex items-start gap-3">
            <SkeletonBone className="h-9 w-9 shrink-0 rounded-full" />
            <div className="min-w-0 flex-1 space-y-2">
              <SkeletonBone className="h-3.5 w-[55%] rounded-md" />
              <SkeletonBone className="h-2.5 w-[35%] rounded-md" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function SkeletonAnalytics() {
  return (
    <>
      <div className="grid grid-cols-3 gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="cloud-card p-4">
            <SkeletonBone className="mb-3 h-8 w-8 rounded-lg" />
            <SkeletonBone className="mb-2 h-7 w-12 rounded-md" />
            <SkeletonBone className="h-2.5 w-16 rounded-md" />
          </div>
        ))}
      </div>
      <div className="mt-6">
        <SkeletonBone className="mb-3 h-3 w-36 rounded-md" />
        <div className="cloud-card space-y-3 p-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 py-1">
              <SkeletonBone className="h-9 w-9 shrink-0 rounded-lg" />
              <div className="min-w-0 flex-1 space-y-2">
                <SkeletonBone className="h-3 w-[50%] rounded-md" />
                <SkeletonBone className="h-2.5 w-[30%] rounded-md" />
              </div>
              <SkeletonBone className="h-3 w-10 rounded-md" />
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

export function SkeletonListRows({ count = 4 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="cloud-card flex items-center gap-4 px-5 py-4">
          <SkeletonBone className="h-10 w-10 shrink-0 rounded-full" />
          <div className="min-w-0 flex-1 space-y-2">
            <SkeletonBone className="h-3.5 w-[40%] rounded-md" />
            <SkeletonBone className="h-2.5 w-[55%] rounded-md" />
          </div>
          <SkeletonBone className="h-8 w-8 shrink-0 rounded-lg" />
        </div>
      ))}
    </div>
  );
}

export function SkeletonBilling() {
  return (
    <>
      <div className="cloud-card mb-6 p-5">
        <SkeletonBone className="mb-2 h-3 w-24 rounded-md" />
        <SkeletonBone className="mb-2 h-7 w-28 rounded-md" />
        <SkeletonBone className="h-3 w-64 max-w-full rounded-md" />
      </div>
      <div className="mb-5 flex justify-center">
        <SkeletonBone className="h-11 w-48 rounded-[10px]" />
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="cloud-card space-y-3 p-5">
            <SkeletonBone className="h-3 w-16 rounded-md" />
            <SkeletonBone className="h-8 w-20 rounded-md" />
            <SkeletonBone className="h-2.5 w-full rounded-md" />
            <SkeletonBone className="h-10 w-full rounded-[10px]" />
          </div>
        ))}
      </div>
    </>
  );
}
