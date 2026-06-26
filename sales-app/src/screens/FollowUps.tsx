import { useCallback, useEffect, useMemo, useState } from "react";
import { OfflineBanner } from "../components/OfflineBanner";
import { FollowUpsCalendar } from "../components/FollowUpsCalendar";
import { ScreenHeader } from "../components/ScreenHeader";
import { TabBar, type TabId } from "../components/TabBar";
import { LeadRowCard } from "../components/LeadRowCard";
import { useOnline } from "../hooks/useOnline";
import {
  buildFollowUpCountByDateKey,
  filterLeadsByDateKey,
  groupFollowUps,
  isDateKeyOverdue,
  isDateKeyToday,
  type FollowUpGroupKey,
} from "../lib/follow-ups-view";
import { formatDayHeading, startOfMonth } from "../lib/calendar-utils";
import { fetchLeads } from "../lib/leads";
import type { LeadRow } from "../lib/types";

type Props = {
  userName: string;
  onTabChange: (tab: TabId) => void;
  onOpenLead: (lead: LeadRow) => void;
  onLogCall: (leadId?: string, channel?: "call" | "whatsapp") => void;
  followUpBadge: number;
  syncBadge: number;
};

const GROUP_LABELS: Record<FollowUpGroupKey, string> = {
  OVERDUE: "Overdue",
  TODAY: "Due today",
  TOMORROW: "Tomorrow",
  THIS_WEEK: "This week",
  LATER: "Later",
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
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(null);

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

  const countByDateKey = useMemo(() => buildFollowUpCountByDateKey(leads), [leads]);
  const groups = useMemo(() => groupFollowUps(leads), [leads]);

  const selectedDayLeads = useMemo(() => {
    if (!selectedDateKey) return [];
    return filterLeadsByDateKey(leads, selectedDateKey);
  }, [leads, selectedDateKey]);

  const weekCount =
    groups.OVERDUE.length +
    groups.TODAY.length +
    groups.TOMORROW.length +
    groups.THIS_WEEK.length;

  function renderLeadList(items: LeadRow[], overdue?: boolean) {
    return (
      <div className="space-y-2">
        {items.map((lead) => (
          <div
            key={lead.id}
            className={overdue ? "rounded-xl ring-1 ring-[var(--error)]/30" : undefined}
          >
            <LeadRowCard
              lead={lead}
              repName={userName}
              onOpen={onOpenLead}
              onLogCall={(l, ch) => onLogCall(l.id, ch)}
            />
          </div>
        ))}
      </div>
    );
  }

  function renderGroupedSections() {
    const order: FollowUpGroupKey[] = [
      "OVERDUE",
      "TODAY",
      "TOMORROW",
      "THIS_WEEK",
      "LATER",
    ];
    const hasAny = order.some((k) => groups[k].length > 0);
    if (!hasAny) {
      return (
        <p className="py-8 text-center text-[15px] text-ink-tertiary">No follow-ups scheduled</p>
      );
    }

    return (
      <div className="space-y-6">
        {order.map((key) => {
          const items = groups[key];
          if (items.length === 0) return null;
          return (
            <section key={key}>
              <div className="mb-2 flex items-center gap-2">
                {key === "OVERDUE" ? (
                  <span className="h-1.5 w-1.5 rounded-full bg-[var(--error)]" aria-hidden />
                ) : null}
                <p
                  className={`eyebrow mb-0 ${key === "OVERDUE" ? "text-[var(--error)]" : ""}`}
                >
                  {GROUP_LABELS[key]}
                </p>
                <span className="font-mono text-[10px] text-ink-tertiary">{items.length}</span>
              </div>
              {renderLeadList(items, key === "OVERDUE")}
            </section>
          );
        })}
      </div>
    );
  }

  return (
    <div className="flex min-h-full flex-col bg-bg-primary pb-28">
      {!online ? <OfflineBanner /> : null}
      <ScreenHeader eyebrow="Scheduled" title="Follow-ups" badge={`${leads.length} total`} />

      <div className="flex-1 px-5 pt-4">
        {loading && leads.length === 0 ? (
          <div className="space-y-3">
            <div className="h-[340px] animate-pulse rounded-2xl bg-bg-tertiary" />
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 animate-pulse rounded-xl bg-bg-tertiary" />
            ))}
          </div>
        ) : (
          <div className="space-y-5 pb-4">
            {/* Week summary */}
            <p className="text-[14px] leading-snug text-ink-secondary">
              {weekCount > 0
                ? `${weekCount} follow-up${weekCount === 1 ? "" : "s"} due this week`
                : "Nothing scheduled this week"}
              {groups.OVERDUE.length > 0 ? (
                <span className="text-[var(--error)]">
                  {" "}
                  · {groups.OVERDUE.length} overdue
                </span>
              ) : null}
            </p>

            <FollowUpsCalendar
              month={month}
              onMonthChange={setMonth}
              countByDateKey={countByDateKey}
              selectedDateKey={selectedDateKey}
              onSelectDate={setSelectedDateKey}
            />

            {selectedDateKey ? (
              <section>
                <div className="mb-3 flex items-center justify-between gap-2">
                  <div>
                    <p className="eyebrow mb-0.5">
                      {isDateKeyToday(selectedDateKey) ? "Today" : "Selected day"}
                    </p>
                    <p className="text-[15px] font-medium text-ink-primary">
                      {formatDayHeading(selectedDateKey)}
                    </p>
                  </div>
                  {isDateKeyOverdue(selectedDateKey) ? (
                    <span className="rounded-full bg-[rgba(255,68,68,0.12)] px-2.5 py-1 font-mono text-[10px] uppercase tracking-wide text-[var(--error)]">
                      Overdue
                    </span>
                  ) : null}
                </div>
                {selectedDayLeads.length === 0 ? (
                  <p className="rounded-2xl border border-dashed border-border bg-bg-tertiary px-4 py-8 text-center text-[14px] text-ink-tertiary">
                    No follow-ups on this day
                  </p>
                ) : (
                  renderLeadList(selectedDayLeads, isDateKeyOverdue(selectedDateKey))
                )}
              </section>
            ) : (
              renderGroupedSections()
            )}
          </div>
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
