import { ShieldAlert } from "lucide-react";

/** Static mini UI — Agent stops and briefs a human. */
export default function AgentHandoverPreview() {
  return (
    <div className="mt-4 space-y-2" aria-hidden>
      <div className="rounded-[10px] border border-[#F9DBAF] bg-[#FFFCF5] px-2.5 py-2.5">
        <div className="flex items-center gap-2">
          <span className="grid h-7 w-7 place-items-center rounded-full bg-[#FFF7ED] text-[#B54708]">
            <ShieldAlert className="h-3.5 w-3.5" strokeWidth={1.8} />
          </span>
          <div className="min-w-0">
            <p className="text-[9px] font-semibold uppercase tracking-[0.06em] text-[#B54708]">
              Human needed
            </p>
            <p className="truncate text-[11px] font-semibold text-[#101828]">Chiedza Ndlovu</p>
          </div>
        </div>
        <p className="mt-2 text-[10px] leading-snug text-[#667085]">
          Customer asked for a discount on Q-2026-041. SegmiQ Agent stopped and briefed Tendai.
        </p>
      </div>
      <div className="rounded-[10px] border border-[#E4E7EC] bg-white px-2.5 py-2">
        <p className="text-[9px] font-medium text-[#667085]">Briefing</p>
        <p className="mt-0.5 text-[10px] font-semibold leading-snug text-[#101828]">
          Pricing is outside Agent authority. Take over to negotiate.
        </p>
      </div>
    </div>
  );
}
