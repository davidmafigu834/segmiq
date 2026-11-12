"use client";

const choice = "flex min-h-14 w-full items-center justify-between gap-3 rounded-[12px] border border-sales-border bg-sales-surface px-4 py-4 text-left transition-colors hover:bg-sales-surface-hover focus-visible:outline-none focus-visible:shadow-[var(--sales-focus-ring)]";

export function MandateChoice({ onSole, onOpen }: { onSole: () => void; onOpen: () => void }) {
  return (
    <div className="re-in space-y-5">
      <div>
        <p className="text-[13px] font-medium text-sales-text-muted">Seller link</p>
        <h1 className="mt-1 font-display text-[32px] font-semibold leading-none tracking-[-0.03em]">Choose a mandate</h1>
        <p className="mt-2 max-w-[52ch] text-[14px] text-sales-text-secondary">The seller signs the form you choose. The commission is 5% of the selling price, plus VAT at 15.5% of that commission, on both.</p>
      </div>
      <div className="grid gap-3">
        <button type="button" onClick={onSole} className={choice}>
          <span>
            <span className="block text-[16px] font-semibold">Sole mandate</span>
            <span className="mt-1 block max-w-[58ch] text-[13px] leading-relaxed text-sales-text-secondary">Landlords Junction is the only agency that may sell for at least two months. Commission can still be due if they introduced the buyer.</span>
          </span>
          <span className="shrink-0 text-[13px] font-semibold text-sales-text-muted">Open</span>
        </button>
        <button type="button" onClick={onOpen} className={choice}>
          <span>
            <span className="block text-[16px] font-semibold">Open mandate to sell</span>
            <span className="mt-1 block max-w-[58ch] text-[13px] leading-relaxed text-sales-text-secondary">The appointment runs from a start date to an end date. The seller completes the property file, and their identity details.</span>
          </span>
          <span className="shrink-0 text-[13px] font-semibold text-sales-text-muted">Open</span>
        </button>
      </div>
    </div>
  );
}
