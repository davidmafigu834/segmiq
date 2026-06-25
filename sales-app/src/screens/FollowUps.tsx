import { useCallback, useEffect, useMemo, useState } from "react";
import { isToday, isPast, startOfDay } from "./date-utils";
import { OfflineBanner } from "../components/OfflineBanner";
import { ScreenHeader } from "../components/ScreenHeader";
import { TabBar, type TabId } from "../components/TabBar";
import { LeadRowCard } from "../components/LeadRowCard";
import { useOnline } from "../hooks/useOnline";
import { fetchLeads } from "../lib/leads";
import { formatFollowUpDate } from "../lib/format";
import type { LeadRow } from "../lib/types";

type Props = {
  userName: string;
  onTabChange: (tab: TabId) => void;
  onOpenLead: (lead: LeadRow) => void;
  onLogCall: (leadId?: string, channel?: "call" | "whatsapp") => void;
  followUpBadge: number;
  syncBadge: number;
};

export function FollowUps({
  userName,
  onTabChange,
  onOpenLead,
  onLogCall,
  followUpBadge,
  syncBadge,
}: Props) {
  const online = useOnline();
  const [leads, setLeads] = useState<LeadRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await fetchLeads();
      setLeads(
        rows.filter(
          (l) =>
            l.follow_up_date &&
            !["WON", "LOST", "NOT_QUALIFIED"].includes(l.status)
        )
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const { today, overdue, upcoming } = useMemo(() => {
    const todayList: LeadRow[] = [];
    const overdueList: LeadRow[] = [];
    const upcomingList: LeadRow[] = [];
    for (const lead of leads) {
      if (!lead.follow_up_date) continue;
      const d = new Date(lead.follow_up_date);
      if (isToday(d)) todayList.push(lead);
      else if (isPast(startOfDay(d))) overdueList.push(lead);
      else upcomingList.push(lead);
    }
    const byDate = (a: LeadRow, b: LeadRow) =>
      new Date(a.follow_up_date!).getTime() - new Date(b.follow_up_date!).getTime();
    return {
      today: todayList.sort(byDate),
      overdue: overdueList.sort(byDate),
      upcoming: upcomingList.sort(byDate),
    };
  }, [leads]);

  function renderSection(title: string, items: LeadRow[]) {
    if (items.length === 0) return null;
    return (
      <section className="mb-6">
        <p className="eyebrow mb-2">{title}</p>
        <div className="space-y-2">
          {items.map((lead) => (
            <div key={lead.id}>
              <p className="mb-1 px-1 text-[12px] text-ink-tertiary">
                {lead.follow_up_date ? formatFollowUpDate(lead.follow_up_date) : ""}
              </p>
              <LeadRowCard
                lead={lead}
                repName={userName}
                onOpen={onOpenLead}
                onLogCall={(l, ch) => onLogCall(l.id, ch)}
              />
            </div>
          ))}
        </div>
      </section>
    );
  }

  return (
    <div className="flex min-h-full flex-col bg-bg-primary pb-28">
      {!online ? <OfflineBanner /> : null}
      <ScreenHeader eyebrow="Scheduled" title="Follow-ups" subtitle={`${leads.length} total`} />

      <div className="flex-1 px-5 pt-4">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 animate-pulse rounded-xl bg-bg-tertiary" />
            ))}
          </div>
        ) : leads.length === 0 ? (
          <p className="py-12 text-center text-[15px] text-ink-tertiary">No follow-ups scheduled</p>
        ) : (
          <>
            {renderSection("Overdue", overdue)}
            {renderSection("Due today", today)}
            {renderSection("Upcoming", upcoming)}
          </>
        )}
      </div>

      <TabBar
        active="followups"
        onChange={onTabChange}
        followUpBadge={followUpBadge}
        syncBadge={syncBadge}
      />
    </div>
  );
}
