"use client";

import Link from "next/link";
import { ArrowRight, Target } from "lucide-react";

export function FollowUpBanner({
  dueCount,
  overdueCount,
}: {
  dueCount: number;
  overdueCount: number;
}) {
  if (dueCount <= 0) return null;

  return (
    <aside className="flex flex-col gap-3 rounded-[14px] border border-[#E5E7EB] bg-gradient-to-r from-[#F7FEE7] via-[#FBFCFD] to-[#FBFCFD] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-start gap-3">
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#D4FF4F] text-[#101828]">
          <Target size={16} strokeWidth={1.8} aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="text-[14px] font-semibold text-[#101828]">
            You have {dueCount} follow-up{dueCount === 1 ? "" : "s"} due today
          </p>
          <p className="mt-0.5 text-[13px] text-[#667085]">
            {overdueCount > 0
              ? `${overdueCount} are overdue. Stay on top of your pipeline.`
              : "Stay on top of your pipeline."}
          </p>
        </div>
      </div>
      <Link
        href="/sales/followups"
        className="inline-flex h-10 min-w-[44px] shrink-0 items-center justify-center gap-1.5 rounded-[10px] bg-[#D4FF4F] px-4 text-[13px] font-semibold text-[#101828] transition-colors duration-150 hover:bg-[#c8f244] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#101828]/40"
      >
        View follow-ups
        <ArrowRight size={16} strokeWidth={1.8} aria-hidden />
      </Link>
    </aside>
  );
}
