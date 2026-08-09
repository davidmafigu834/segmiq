"use client";

export function AvailabilityCard() {
  return (
    <div className="cal-card p-2.5">
      <p className="mb-2 text-[14px] font-semibold text-[#101828]">My availability</p>
      <div>
        <p className="text-[12px] font-medium text-[#667085]">Working hours</p>
        <p className="mt-0.5 text-[13px] font-semibold text-[#101828]">Not configured</p>
        <p className="mt-1.5 text-[12px] leading-snug text-[#98A2B3]">
          Working hours are not stored yet, so free/busy is unavailable.
        </p>
      </div>
    </div>
  );
}
