import { SiWhatsapp } from "react-icons/si";
import { FileText, Phone } from "lucide-react";

/** Static mini UI — follow-up timeline + quote for Tafadzwa Moyo. */
export default function FollowUpQuotePreview() {
  return (
    <div className="mt-4 space-y-2" aria-hidden>
      <div className="rounded-[10px] border border-[#E4E7EC] bg-white px-2.5 py-2">
        <ul className="space-y-2">
          {[
            { icon: "wa" as const, label: "SegmiQ Agent replied", time: "10:15 AM" },
            { icon: "call" as const, label: "Callback booked", time: "10:40 AM" },
            { icon: "quote" as const, label: "Quote prepared", time: "11:05 AM" },
          ].map((row) => (
            <li key={row.label} className="flex items-center gap-2">
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-[#F2F4F7]">
                {row.icon === "wa" ? (
                  <SiWhatsapp size={11} color="#25D366" />
                ) : row.icon === "call" ? (
                  <Phone className="h-3 w-3 text-[#667085]" strokeWidth={1.8} />
                ) : (
                  <FileText className="h-3 w-3 text-[#667085]" strokeWidth={1.8} />
                )}
              </span>
              <span className="min-w-0 flex-1 truncate text-[10px] font-medium text-[#101828]">
                {row.label}
              </span>
              <span className="shrink-0 text-[9px] tabular-nums text-[#98A2B3]">{row.time}</span>
            </li>
          ))}
        </ul>
        <div className="mt-2 border-t border-[#F2F4F7] pt-2">
          <p className="text-[9px] font-medium text-[#667085]">Follow-up</p>
          <p className="mt-0.5 text-[10px] font-semibold text-[#101828]">Tomorrow, 09:00</p>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 rounded-[10px] border border-[#E4E7EC] bg-[#FCFCFD] px-2.5 py-2">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold tabular-nums text-[#101828]">Q-2026-045</p>
          <p className="truncate text-[9px] text-[#667085]">Tafadzwa Moyo · 5kW Solar</p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-[12px] font-semibold tabular-nums text-[#101828]">$6,800</p>
          <span className="mt-0.5 inline-flex rounded-md bg-[#EFF8FF] px-1.5 py-px text-[8px] font-semibold text-[#175CD3]">
            Prepared
          </span>
        </div>
      </div>
    </div>
  );
}
