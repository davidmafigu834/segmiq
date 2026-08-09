import { Camera, FileText, Trophy } from "lucide-react";

/** Static mini UI — deal won + project documented for Tafadzwa Moyo. */
export default function CloseDocumentPreview() {
  return (
    <div className="mt-4 space-y-2" aria-hidden>
      <div className="rounded-[10px] border border-[#E4E7EC] bg-white px-2.5 py-2.5">
        <div className="flex items-center gap-2">
          <span className="grid h-7 w-7 place-items-center rounded-full bg-[#F7FEE7] text-[#4D7C0F]">
            <Trophy className="h-3.5 w-3.5" strokeWidth={1.8} />
          </span>
          <div className="min-w-0">
            <p className="text-[9px] font-semibold uppercase tracking-[0.06em] text-[#027A48]">
              Deal won
            </p>
            <p className="truncate text-[11px] font-semibold text-[#101828]">Tafadzwa Moyo</p>
          </div>
          <p className="ml-auto shrink-0 text-[13px] font-semibold tabular-nums text-[#101828]">
            $6,800
          </p>
        </div>
      </div>

      <div className="rounded-[10px] border border-[#E8E4DC] bg-[#F7F4EF] px-2.5 py-2.5">
        <p className="text-[9px] font-semibold uppercase tracking-[0.06em] text-[#98A2B3]">
          Project documented
        </p>
        <p className="mt-1 truncate text-[11px] font-semibold text-[#101828]">
          5kW Solar Installation
        </p>
        <div className="mt-2 flex items-center gap-3">
          <span className="inline-flex items-center gap-1 text-[9px] font-medium text-[#667085]">
            <Camera className="h-3 w-3" strokeWidth={1.8} />
            3 photos
          </span>
          <span className="inline-flex items-center gap-1 text-[9px] font-medium text-[#667085]">
            <FileText className="h-3 w-3" strokeWidth={1.8} />
            2 documents
          </span>
          <span className="ml-auto rounded-md bg-[#ECFDF3] px-1.5 py-0.5 text-[8px] font-semibold text-[#027A48]">
            Completed
          </span>
        </div>
      </div>
    </div>
  );
}
