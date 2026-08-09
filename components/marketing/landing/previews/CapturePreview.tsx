import { SiFacebook, SiWhatsapp } from "react-icons/si";
import { CalendarDays, ClipboardList, Globe } from "lucide-react";

/** Static mini UI — enquiry sources → one new lead (Tafadzwa Moyo). */
export default function CapturePreview() {
  return (
    <div className="mt-4 rounded-[10px] border border-[#E4E7EC] bg-[#F7F8FA] p-2.5" aria-hidden>
      <div className="flex flex-wrap items-center justify-center gap-1.5">
        <span className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-[#E4E7EC] bg-white">
          <SiWhatsapp size={13} color="#25D366" />
        </span>
        <span className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-[#E4E7EC] bg-white">
          <SiFacebook size={13} color="#1877F2" />
        </span>
        <span className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-[#E4E7EC] bg-white text-[#667085]">
          <Globe className="h-3.5 w-3.5" strokeWidth={1.8} />
        </span>
        <span className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-[#E4E7EC] bg-white text-[#667085]">
          <ClipboardList className="h-3.5 w-3.5" strokeWidth={1.8} />
        </span>
        <span className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-[#E4E7EC] bg-white text-[#667085]">
          <CalendarDays className="h-3.5 w-3.5" strokeWidth={1.8} />
        </span>
      </div>

      <div className="mx-auto my-1.5 h-3 w-px bg-[#D0D5DD]" />

      <div className="rounded-lg border border-[#E4E7EC] bg-white px-2.5 py-2">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[9px] font-semibold uppercase tracking-[0.06em] text-[#98A2B3]">
            New lead
          </p>
          <span className="rounded-full bg-[#FEF2F2] px-1.5 py-px text-[8px] font-semibold text-[#B42318]">
            Hot · 82
          </span>
        </div>
        <p className="mt-1 text-[11px] font-semibold text-[#101828]">Tafadzwa Moyo</p>
        <p className="mt-0.5 text-[10px] text-[#667085]">5kW Solar Installation · WhatsApp</p>
      </div>
    </div>
  );
}
