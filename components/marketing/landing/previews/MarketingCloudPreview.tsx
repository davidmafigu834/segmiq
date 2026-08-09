import { Camera, FileText, FolderOpen } from "lucide-react";

/** Static marketing preview — SegmiQ Cloud project workspace. */
export default function MarketingCloudPreview() {
  return (
    <div
      className="marketing-product-chrome overflow-hidden rounded-t-[12px] border border-b-0 border-[#E4E7EC] bg-[#F7F4EF]"
      aria-hidden
    >
      <div className="border-b border-[#E8E4DC] px-3 py-2.5">
        <p className="text-[9px] font-semibold uppercase tracking-[0.08em] text-[#98A2B3]">
          Project
        </p>
        <div className="mt-1 flex items-center justify-between gap-2">
          <p className="truncate text-[12px] font-semibold text-[#101828]">
            Borrowdale Solar Installation
          </p>
          <span className="shrink-0 rounded-md bg-[#ECFDF3] px-1.5 py-0.5 text-[9px] font-semibold text-[#027A48]">
            Completed
          </span>
        </div>
      </div>

      {/* Editorial project hero — soft visual, not a stock illustration */}
      <div className="relative mx-2.5 mt-2.5 aspect-[16/9] overflow-hidden rounded-[10px] border border-[#E4E7EC]">
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(145deg, #E8EDF2 0%, #D6DEE8 42%, #C5D0DC 100%)",
          }}
        />
        <div
          className="absolute inset-0 opacity-40"
          style={{
            backgroundImage:
              "linear-gradient(90deg, rgba(255,255,255,.35) 1px, transparent 1px), linear-gradient(rgba(255,255,255,.25) 1px, transparent 1px)",
            backgroundSize: "18px 18px",
          }}
        />
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#101828]/45 to-transparent px-2.5 py-2">
          <p className="text-[10px] font-semibold text-white">Site documentation</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-1.5 p-2.5">
        {[
          { label: "Site photos", Icon: Camera },
          { label: "Documents", Icon: FileText },
          { label: "Proposal", Icon: FolderOpen },
        ].map(({ label, Icon }) => (
          <div
            key={label}
            className="rounded-lg border border-[#E8E4DC] bg-white/90 px-1.5 py-2 text-center"
          >
            <Icon className="mx-auto h-3.5 w-3.5 text-[#667085]" strokeWidth={1.8} />
            <p className="mt-1 truncate text-[8px] font-medium text-[#667085]">{label}</p>
          </div>
        ))}
      </div>

      <div className="border-t border-[#E8E4DC] px-3 py-2">
        <p className="text-[10px] font-medium text-[#667085]">Project documented</p>
      </div>
    </div>
  );
}
