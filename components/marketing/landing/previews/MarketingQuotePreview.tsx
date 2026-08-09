import { FileText } from "lucide-react";

/** Static marketing preview — quotation + follow-up. */
export default function MarketingQuotePreview() {
  return (
    <div
      className="marketing-product-chrome overflow-hidden rounded-t-[12px] border border-b-0 border-[#E4E7EC] bg-[#F7F8FA] p-2.5"
      aria-hidden
    >
      <div className="rounded-[10px] border border-[#E4E7EC] bg-white p-3">
        <div className="flex items-start gap-2.5">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#F2F4F7] text-[#667085]">
            <FileText className="h-4 w-4" strokeWidth={1.8} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[10px] font-medium text-[#667085]">Quote sent</p>
              <span className="rounded-md bg-[#EFF8FF] px-1.5 py-0.5 text-[9px] font-semibold text-[#175CD3]">
                Sent
              </span>
            </div>
            <p className="mt-0.5 text-[12px] font-semibold tabular-nums text-[#101828]">Q-2026-045</p>
            <p className="mt-0.5 truncate text-[11px] text-[#344054]">Samson Kandare</p>
            <p className="mt-1 text-[15px] font-semibold tracking-tight tabular-nums text-[#101828]">
              $18,400
            </p>
          </div>
        </div>

        <div className="mt-3 rounded-lg border border-[#E4E7EC] bg-[#FCFCFD] px-2.5 py-2">
          <p className="text-[9px] font-semibold uppercase tracking-[0.06em] text-[#98A2B3]">
            Follow-up
          </p>
          <p className="mt-1 text-[11px] font-semibold text-[#101828]">Tomorrow · 09:00</p>
          <p className="mt-0.5 text-[10px] text-[#667085]">Call Samson Kandare</p>
        </div>

        <div className="mt-2.5 flex items-center justify-between gap-2">
          <span className="inline-flex h-7 items-center rounded-md border border-[#E4E7EC] bg-white px-2.5 text-[10px] font-semibold text-[#101828]">
            View quote
          </span>
          <div className="min-w-0 text-right">
            <p className="truncate text-[9px] font-medium text-[#98A2B3]">Q-2026-046</p>
            <p className="truncate text-[10px] text-[#667085]">Bright Future Solar · $7,450</p>
            <span className="mt-0.5 inline-flex rounded-md bg-[#ECFDF3] px-1.5 py-px text-[8px] font-semibold text-[#027A48]">
              Accepted
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
