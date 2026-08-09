/** Static mini UI — lead qualification / assignment for Tafadzwa Moyo. */
export default function QualificationPreview() {
  return (
    <div className="mt-4 rounded-[10px] border border-[#E4E7EC] bg-white p-2.5" aria-hidden>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-[11px] font-semibold text-[#101828]">Tafadzwa Moyo</p>
          <p className="mt-0.5 text-[9px] text-[#667085]">5kW Solar Installation</p>
        </div>
        <span className="shrink-0 rounded-full bg-[#FEF2F2] px-1.5 py-0.5 text-[8px] font-semibold text-[#B42318]">
          Hot
        </span>
      </div>

      <div className="mt-2.5 rounded-lg border border-[#E4E7EC] bg-[#FCFCFD] px-2 py-2">
        <div className="flex items-end justify-between">
          <p className="text-[9px] font-medium text-[#667085]">Lead score</p>
          <p className="text-[16px] font-semibold tabular-nums tracking-tight text-[#101828]">86</p>
        </div>
        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[#F2F4F7]">
          <div className="h-full w-[86%] rounded-full bg-[#D4FF4F]" />
        </div>
      </div>

      <dl className="mt-2 space-y-1.5">
        {[
          ["Budget", "$6,000–$10,000"],
          ["Timeline", "1–3 months"],
          ["Assigned to", "Tendai M."],
        ].map(([label, value]) => (
          <div key={label} className="flex items-center justify-between gap-2">
            <dt className="text-[9px] text-[#98A2B3]">{label}</dt>
            <dd className="truncate text-[10px] font-medium text-[#101828]">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
