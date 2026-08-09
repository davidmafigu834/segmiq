/** Match sales pipeline accents without importing client-only sales modules. */
const STAGE_ACCENT = {
  NEW: "#2684FF",
  CONTACTED: "#22C55E",
  NEGOTIATING: "#F59E0B",
  PROPOSAL_SENT: "#8B5CF6",
} as const;

const STAGES = [
  {
    id: "NEW" as const,
    count: 8,
    value: "$18,400",
    lead: "Kelvin Manyika",
    project: "Solar Installation",
  },
  {
    id: "CONTACTED" as const,
    count: 6,
    value: "$24,600",
    lead: "Simbai Chikomo",
    project: "Roofing",
  },
  {
    id: "NEGOTIATING" as const,
    count: 3,
    value: "$24,350",
    lead: "Tendai Chivasa",
    project: "Solar Installation",
    hot: true,
  },
  {
    id: "PROPOSAL_SENT" as const,
    count: 4,
    value: "$38,900",
    lead: "Barnes Madziva",
    project: "Construction",
  },
] as const;

const LABELS = {
  NEW: "New",
  CONTACTED: "Contacted",
  NEGOTIATING: "Negotiating",
  PROPOSAL_SENT: "Proposal sent",
} as const;

/** Static marketing preview — compact SegmiQ pipeline stages. */
export default function MarketingPipelinePreview() {
  return (
    <div
      className="marketing-product-chrome overflow-hidden rounded-t-[12px] border border-b-0 border-[#E4E7EC] bg-[#F7F8FA] p-2.5"
      aria-hidden
    >
      <div className="grid grid-cols-2 gap-2">
        {STAGES.map((stage) => {
          const accent = STAGE_ACCENT[stage.id];
          return (
            <div
              key={stage.id}
              className="overflow-hidden rounded-[10px] border border-[#E4E7EC] bg-white"
              style={{ borderTopWidth: 2, borderTopColor: accent }}
            >
              <div className="flex items-baseline justify-between gap-1 px-2 pt-2">
                <p className="text-[9px] font-semibold uppercase tracking-[0.04em] text-[#667085]">
                  {LABELS[stage.id]}
                </p>
                <p className="text-[11px] font-semibold tabular-nums text-[#101828]">{stage.count}</p>
              </div>
              <p className="px-2 text-[9px] font-medium tabular-nums text-[#98A2B3]">{stage.value}</p>
              <div className="mx-1.5 mb-1.5 mt-1.5 rounded-md border border-[#F2F4F7] bg-[#FCFCFD] px-1.5 py-1.5">
                <div className="flex items-start justify-between gap-1">
                  <p className="truncate text-[10px] font-semibold text-[#101828]">{stage.lead}</p>
                  {"hot" in stage && stage.hot ? (
                    <span className="shrink-0 rounded-full bg-[#FEF2F2] px-1.5 py-px text-[8px] font-semibold text-[#B42318]">
                      Hot · 82
                    </span>
                  ) : null}
                </div>
                <p className="mt-0.5 truncate text-[9px] text-[#667085]">{stage.project}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
