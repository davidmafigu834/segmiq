"use client";

export function AvailabilityCard() {
  return (
    <div className="cal-card border-sales-border bg-sales-surface p-2.5 text-sales-text-primary">
      <p className="mb-2 text-[14px] font-semibold text-sales-text-primary">My availability</p>
      <div>
        <p className="text-[12px] font-medium text-sales-text-secondary">Working hours</p>
        <p className="mt-0.5 text-[13px] font-semibold text-sales-text-primary">Not configured</p>
        <p className="mt-1.5 text-[12px] leading-snug text-sales-text-muted">
          Working hours are not stored yet, so free/busy is unavailable.
        </p>
      </div>
    </div>
  );
}
