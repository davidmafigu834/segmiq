import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronRight } from "lucide-react";
import { OfflineBanner } from "../components/OfflineBanner";
import { ScreenHeader } from "../components/ScreenHeader";
import { StatsStrip } from "../components/StatsStrip";
import { MirrorCard } from "../components/MirrorCard";
import { TabBar, type TabId } from "../components/TabBar";
import { LeadRowCard } from "../components/LeadRowCard";
import { CrmCard } from "../components/crm";
import { useOnline } from "../hooks/useOnline";
import { getGreeting } from "../lib/format";
import {
  classifyLeadLane,
  LANE_ORDER,
  sortCallNowLane,
  sortWithinLane,
  type LeadLane,
} from "../lib/lead-lanes";
import { fetchDashboard } from "../lib/leads";
import type { DashboardData, LeadRow } from "../lib/types";

const LANE_META: Record<LeadLane, { eyebrow: string; title: string }> = {
  call_now: { eyebrow: "Speed to lead", title: "Call now" },
  follow_ups: { eyebrow: "Promised", title: "Follow-ups due" },
  recover: { eyebrow: "Slipped", title: "Recover" },
  nurture: { eyebrow: "Low intent", title: "Nurture" },
};

type Props = {
  userName: string;
  onTabChange: (tab: TabId) => void;
  onOpenLead: (lead: LeadRow) => void;
  onLogCall: (leadId?: string, channel?: "call" | "whatsapp") => void;
  followUpBadge: number;
  syncBadge: number;
};

export function Today({
  userName,
  onTabChange,
  onOpenLead,
  onLogCall,
  followUpBadge,
  syncBadge,
}: Props) {
  const online = useOnline();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [nurtureOpen, setNurtureOpen] = useState(false);
  const [now] = useState(() => new Date());

  const firstName = userName.split(" ")[0] ?? "there";
  const today = new Date().toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await fetchDashboard();
      setData(d);
    } catch {
      /* keep cached */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const lanes = useMemo(() => {
    const all = data?.allActiveLeads ?? [];
    const buckets: Record<LeadLane, LeadRow[]> = {
      call_now: [],
      follow_ups: [],
      recover: [],
      nurture: [],
    };
    for (const lead of all) {
      const lane = classifyLeadLane(lead, now).lane;
      buckets[lane].push(lead);
    }
    buckets.call_now = sortCallNowLane(buckets.call_now, now);
    buckets.follow_ups = sortWithinLane(buckets.follow_ups);
    buckets.recover = sortWithinLane(buckets.recover);
    buckets.nurture = sortWithinLane(buckets.nurture);
    return buckets;
  }, [data, now]);

  const hasLeads = (data?.allActiveLeads.length ?? 0) > 0;

  return (
    <div className="flex min-h-full flex-col bg-bg-primary pb-28">
      {!online ? <OfflineBanner /> : null}
      <ScreenHeader eyebrow={today} title={`Good ${getGreeting()}, ${firstName}`}>
        {data ? (
          <StatsStrip
            numbers={data.numbers}
            onSelectCallNow={() => onTabChange("leads")}
            onSelectFollowUps={() => onTabChange("followups")}
          />
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-[58px] animate-pulse rounded-xl bg-bg-tertiary" />
            ))}
          </div>
        )}
      </ScreenHeader>

      <div className="flex-1 px-5 pt-5">
        {data ? (
          <div className="mb-6">
            <MirrorCard mirror={data.mirror} />
          </div>
        ) : null}

        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="eyebrow mb-0.5">Today</p>
            <h2 className="text-[18px] font-semibold text-ink-primary">Your priorities</h2>
          </div>
          <button
            type="button"
            onClick={() => onTabChange("leads")}
            className="flex items-center gap-1 text-[13px] font-semibold text-accent"
          >
            All leads
            <ChevronRight size={14} />
          </button>
        </div>

        {loading && !data ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 animate-pulse rounded-xl bg-bg-tertiary" />
            ))}
          </div>
        ) : !hasLeads ? (
          <CrmCard className="flex flex-col items-center px-5 py-16 text-center">
            <p className="text-[16px] font-semibold text-ink-primary">All caught up</p>
            <p className="mt-1 text-[14px] text-ink-tertiary">No active leads assigned to you.</p>
          </CrmCard>
        ) : (
          <div className="space-y-6">
            {LANE_ORDER.map((lane) => {
              const laneLeads = lanes[lane];
              if (laneLeads.length === 0) return null;
              const meta = LANE_META[lane];

              if (lane === "nurture") {
                return (
                  <section key={lane}>
                    <button
                      type="button"
                      onClick={() => setNurtureOpen((v) => !v)}
                      className="mb-2 flex w-full items-center justify-between rounded-xl border border-border bg-surface-card px-4 py-3"
                    >
                      <span className="text-[15px] font-semibold">{meta.title}</span>
                      <span className="text-[13px] text-ink-tertiary">{laneLeads.length}</span>
                    </button>
                    {nurtureOpen ? (
                      <div className="space-y-2">
                        {laneLeads.slice(0, 10).map((lead) => (
                          <LeadRowCard
                            key={lead.id}
                            lead={lead}
                            repName={userName}
                            now={now}
                            onOpen={onOpenLead}
                            onLogCall={(l, ch) => onLogCall(l.id, ch)}
                          />
                        ))}
                      </div>
                    ) : null}
                  </section>
                );
              }

              return (
                <section key={lane}>
                  <p className="eyebrow mb-1">{meta.eyebrow}</p>
                  <h3 className="mb-3 text-[16px] font-semibold text-ink-primary">
                    {meta.title}{" "}
                    <span className="text-ink-tertiary">({laneLeads.length})</span>
                  </h3>
                  <div className="space-y-2">
                    {laneLeads.slice(0, lane === "call_now" ? 8 : 5).map((lead) => (
                      <LeadRowCard
                        key={lead.id}
                        lead={lead}
                        repName={userName}
                        now={now}
                        onOpen={onOpenLead}
                        onLogCall={(l, ch) => onLogCall(l.id, ch)}
                      />
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </div>

      <TabBar
        active="today"
        onChange={onTabChange}
        followUpBadge={followUpBadge}
        syncBadge={syncBadge}
      />
    </div>
  );
}
