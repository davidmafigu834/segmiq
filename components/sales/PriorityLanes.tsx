"use client";

import { useRouter } from "next/navigation";
import { CheckCircle, ChevronDown, ChevronRight, MinusCircle } from "lucide-react";
import { LANE_ORDER, type LeadLane } from "@/lib/lead-lanes";
import type { PriorityLead } from "@/lib/sales-priority-lead";
import { PriorityLeadCard } from "@/components/sales/PriorityLeadCard";

const LANE_META: Record<LeadLane, { eyebrow: string; title: string }> = {
  call_now: { eyebrow: "Speed to lead", title: "Call now" },
  follow_ups: { eyebrow: "Promised", title: "Follow-ups due" },
  recover: { eyebrow: "Slipped", title: "Recover — slipped" },
  nurture: { eyebrow: "Low intent", title: "Nurture" },
};

function defaultSeeAllHref(lane: LeadLane): string | null {
  if (lane === "call_now") return "/sales/call-now";
  if (lane === "recover") return "/sales/recover";
  return null;
}

export type PriorityLanesProps = {
  lanes: Record<LeadLane, PriorityLead[]>;
  now: Date;
  repName: string;
  hasAnyLeads: boolean;
  nurtureOpen: boolean;
  onNurtureOpenChange: (open: boolean) => void;
  onOpenLogSheet: (leadId?: string, channel?: "call" | "whatsapp") => void;
  allLeadsHref?: string;
  seeAllHref?: (lane: LeadLane) => string | null;
  showHeader?: boolean;
};

export function PriorityLanes({
  lanes,
  now,
  repName,
  hasAnyLeads,
  nurtureOpen,
  onNurtureOpenChange,
  onOpenLogSheet,
  allLeadsHref = "/sales/leads",
  seeAllHref = defaultSeeAllHref,
  showHeader = true,
}: PriorityLanesProps) {
  const router = useRouter();

  return (
    <div className="mb-8">
      {showHeader ? (
        <div className="ag-fade-in flex items-center justify-between mb-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-[var(--text-tertiary)] mb-0.5">
              Today
            </p>
            <h2 className="text-[18px] font-semibold text-[var(--text-primary)]">Your priorities</h2>
          </div>
          <button
            type="button"
            onClick={() => router.push(allLeadsHref)}
            className="flex items-center gap-1 text-[12px] font-semibold text-[var(--accent)] hover:opacity-80 transition-opacity"
          >
            All leads
            <ChevronRight size={12} />
          </button>
        </div>
      ) : null}

      {!hasAnyLeads ? (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-card)] flex flex-col items-center justify-center py-16 text-center px-5">
          <CheckCircle className="w-8 h-8 text-[var(--success)] mb-3" />
          <p className="text-[15px] font-semibold text-[var(--text-primary)] mb-1">All caught up</p>
          <p className="text-[13px] text-[var(--text-tertiary)]">
            No active leads assigned to you right now.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {LANE_ORDER.map((lane, laneIndex) => {
            const laneLeads = lanes[lane];
            const count = laneLeads.length;
            if (count === 0) return null;

            const meta = LANE_META[lane];
            const delayClass = `ag-delay-${Math.min(laneIndex + 1, 5)}`;

            if (lane === "nurture") {
              return (
                <section key={lane} className={`ag-fade-in ${delayClass}`}>
                  <button
                    type="button"
                    onClick={() => onNurtureOpenChange(!nurtureOpen)}
                    className="w-full flex items-center justify-between gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-card)] px-5 py-4 hover:border-[var(--border-hover)] transition-colors text-left"
                    aria-expanded={nurtureOpen}
                  >
                    <div className="flex items-center gap-2">
                      <MinusCircle size={15} className="text-[var(--text-tertiary)]" />
                      <span className="text-[14px] font-semibold text-[var(--text-primary)]">{meta.title}</span>
                      <span className="text-[13px] text-[var(--text-tertiary)]">{count}</span>
                    </div>
                    <ChevronDown
                      size={16}
                      className={`text-[var(--text-tertiary)] transition-transform ${
                        nurtureOpen ? "rotate-180" : ""
                      }`}
                    />
                  </button>

                  {nurtureOpen && (
                    <div className="flex flex-col gap-2 mt-2">
                      {laneLeads.slice(0, 5).map((lead) => (
                        <PriorityLeadCard
                          key={lead.id}
                          lead={lead}
                          lane={lane}
                          now={now}
                          repName={repName}
                          onOpenLogSheet={onOpenLogSheet}
                        />
                      ))}
                      {count > 5 && (
                        <button
                          type="button"
                          onClick={() => router.push(allLeadsHref)}
                          className="flex items-center justify-center gap-1 py-2 text-[12px] font-semibold text-[var(--accent)] hover:opacity-80 transition-opacity"
                        >
                          See all ({count})
                          <ChevronRight size={12} />
                        </button>
                      )}
                    </div>
                  )}
                </section>
              );
            }

            const laneSeeAll = seeAllHref(lane);

            return (
              <section key={lane} className={`ag-fade-in ${delayClass}`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-baseline gap-2">
                    <h3 className="text-[14px] font-semibold text-[var(--text-primary)]">{meta.title}</h3>
                    <span className="text-[13px] text-[var(--text-tertiary)]">{count}</span>
                  </div>
                  {(laneSeeAll ? (lane === "recover" ? count > 0 : count > 5) : count > 5) && laneSeeAll ? (
                    <button
                      type="button"
                      onClick={() => router.push(laneSeeAll)}
                      className="flex items-center gap-1 text-[12px] font-semibold text-[var(--accent)] hover:opacity-80 transition-opacity"
                    >
                      See all ({count})
                      <ChevronRight size={12} />
                    </button>
                  ) : count > 5 ? (
                    <button
                      type="button"
                      onClick={() => router.push(allLeadsHref)}
                      className="flex items-center gap-1 text-[12px] font-semibold text-[var(--accent)] hover:opacity-80 transition-opacity"
                    >
                      See all ({count})
                      <ChevronRight size={12} />
                    </button>
                  ) : null}
                </div>
                <div className="flex flex-col gap-2">
                  {laneLeads.slice(0, 5).map((lead) => (
                    <PriorityLeadCard
                      key={lead.id}
                      lead={lead}
                      lane={lane}
                      now={now}
                      repName={repName}
                      onOpenLogSheet={onOpenLogSheet}
                    />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
