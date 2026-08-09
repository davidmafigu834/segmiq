"use client";

export function InboxSkeleton() {
  return (
    <div className="flex min-h-0 flex-1 overflow-hidden" aria-busy aria-label="Loading inbox">
      <div className="hidden w-[360px] shrink-0 border-r border-[#E4E7EC] bg-white p-3 sm:block">
        <div className="mb-4 h-4 w-40 animate-pulse rounded bg-[#F2F4F7]" />
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="mb-3 flex gap-3 border-b border-[#F2F4F7] pb-3">
            <div className="h-10 w-10 shrink-0 animate-pulse rounded-full bg-[#F2F4F7]" />
            <div className="min-w-0 flex-1 space-y-2 pt-0.5">
              <div className="flex justify-between gap-2">
                <div className="h-3 w-28 animate-pulse rounded bg-[#F2F4F7]" />
                <div className="h-3 w-12 animate-pulse rounded bg-[#F8F9FB]" />
              </div>
              <div className="h-3 w-full animate-pulse rounded bg-[#F8F9FB]" />
              <div className="h-3 w-2/3 animate-pulse rounded bg-[#F8F9FB]" />
            </div>
          </div>
        ))}
      </div>
      <div className="flex min-w-0 flex-1 flex-col bg-[#F7F8FA]">
        <div className="flex items-center gap-3 border-b border-[#E4E7EC] bg-white px-4 py-3">
          <div className="h-10 w-10 animate-pulse rounded-full bg-[#F2F4F7]" />
          <div className="space-y-2">
            <div className="h-3 w-36 animate-pulse rounded bg-[#F2F4F7]" />
            <div className="h-3 w-24 animate-pulse rounded bg-[#F8F9FB]" />
          </div>
        </div>
        <div className="flex flex-1 flex-col justify-end gap-3 p-4">
          <div className="ml-auto h-14 w-[55%] animate-pulse rounded-[12px] bg-[rgba(212,255,79,0.18)]" />
          <div className="h-16 w-[60%] animate-pulse rounded-[12px] bg-white" />
          <div className="ml-auto h-10 w-[40%] animate-pulse rounded-[12px] bg-[rgba(212,255,79,0.18)]" />
        </div>
      </div>
      <div className="hidden w-[360px] shrink-0 border-l border-[#E4E7EC] bg-white p-4 lg:block">
        <div className="mb-4 h-4 w-32 animate-pulse rounded bg-[#F2F4F7]" />
        <div className="mb-4 flex gap-3">
          <div className="h-12 w-12 animate-pulse rounded-full bg-[#F2F4F7]" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-28 animate-pulse rounded bg-[#F2F4F7]" />
            <div className="h-3 w-20 animate-pulse rounded bg-[#F8F9FB]" />
          </div>
        </div>
        <div className="mx-auto mb-4 h-20 w-20 animate-pulse rounded-full bg-[#F2F4F7]" />
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="mb-3 space-y-1.5">
            <div className="h-2.5 w-20 animate-pulse rounded bg-[#F8F9FB]" />
            <div className="h-2 w-full animate-pulse rounded-full bg-[#F2F4F7]" />
          </div>
        ))}
      </div>
    </div>
  );
}
