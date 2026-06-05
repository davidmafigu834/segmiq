"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Phone,
  CalendarClock,
  CheckCircle,
  MinusCircle,
  Send,
  ChevronRight,
  ChevronDown,
  Trophy,
  Activity,
  Users,
} from "lucide-react";
import {
  classifyLeadLane,
  sortWithinLane,
  sortCallNowLane,
  LANE_ORDER,
  type LeadLane,
} from "@/lib/lead-lanes";
import { isRetargetingGraduated, type RetargetingStatusView } from "@/lib/retargeting";
import { type PriorityLead, timeAgo } from "@/lib/sales-priority-lead";
import { PriorityLeadCard } from "@/components/sales/PriorityLeadCard";
import { RetargetingBanners } from "@/components/sales/RetargetingBanner";
import { useSalesLogSheet } from "@/components/sales/SalesLogFab";

// ============================================
// TYPES
// ============================================

type ActivityEvent = {
  id: string;
  event_type: string;
  event_data: Record<string, unknown> | null;
  channel?: string | null;
  created_at: string;
  lead_id: string;
  leads: { name: string | null }[] | null;
};

type RecentWin = {
  id: string;
  deal_value: number | null;
  days_to_close: number | null;
  created_at: string;
  leads: { name: string | null }[] | null;
};

type DashboardData = {
  priorityLeads: PriorityLead[];
  allActiveLeads: PriorityLead[];
  numbers: {
    totalActive: number;
    calledToday: number;
    followUpToday: number;
    wonThisMonth: number;
  };
  recentActivity: ActivityEvent[];
  recentWins: RecentWin[];
  retargetingStatuses?: RetargetingStatusView[];
  debug?: {
    queryUserId: string;
    totalAllLeads: number;
    totalActive: number;
    statuses: Record<string, number>;
    sample: Array<{ id: string; status: string; created_at: string; assigned_to_id: string | null }>;
  };
};

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "morning";
  if (h < 17) return "afternoon";
  return "evening";
}

const LANE_META: Record<LeadLane, { eyebrow: string; title: string }> = {
  call_now: { eyebrow: "Speed to lead", title: "Call now" },
  follow_ups: { eyebrow: "Promised", title: "Follow-ups due today" },
  recover: { eyebrow: "Slipped", title: "Recover — slipped" },
  nurture: { eyebrow: "Low intent", title: "Nurture" },
};

function formatEventType(type: string, data: Record<string, unknown> | null, channel?: string | null): string {
  const d = data ?? {};
  const map: Record<string, (d: Record<string, unknown>) => string> = {
    CALL_LOGGED: (d) => {
      const out = String(d.outcome ?? "").toLowerCase().replace(/_/g, " ");
      const ch = (channel as string | undefined) || (d.channel as string | undefined) || "call";
      return ch === "whatsapp" ? `Contacted via WhatsApp — ${out}` : `Call — ${out}`;
    },
    DOCUMENT_SENT: (d) => `Sent ${String(d.document_name ?? "document")}`,
    STATUS_CHANGED: (d) =>
      `Moved to ${String(d.to_status ?? "").toLowerCase()}`,
    FOLLOW_UP_SET: () => "Follow-up scheduled",
  };
  return map[type]?.(d) ?? type.replace(/_/g, " ").toLowerCase();
}

export default function SalesDashboardMain({
  data,
  session,
}: {
  data: DashboardData;
  session: unknown;
}) {
  const router = useRouter();
  const s = session as { user?: { name?: string | null } } | null;
  const firstName = s?.user?.name?.split(" ")[0] ?? "there";
  const today = new Date().toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  const repName = s?.user?.name ?? "";
  const { openLogSheet, logSheetProps } = useSalesLogSheet();
  const { sheet } = logSheetProps(data.allActiveLeads);

  // Captured once on mount so lanes stay stable across incidental re-renders
  // (the per-second SLA countdown runs on its own timer).
  const [now] = useState(() => new Date());
  const [nurtureOpen, setNurtureOpen] = useState(false);

  const lanes = useMemo(() => {
    const all = data.allActiveLeads ?? [];
    const buckets: Record<LeadLane, PriorityLead[]> = {
      call_now: [],
      follow_ups: [],
      recover: [],
      nurture: [],
    };
    for (const lead of all) {
      const lane = classifyLeadLane(lead, now).lane;
      if (
        (lane === "call_now" || lane === "recover") &&
        isRetargetingGraduated(lead, now)
      ) {
        continue;
      }
      buckets[lane].push(lead);
    }
    return {
      call_now: sortCallNowLane(buckets.call_now, now),
      follow_ups: sortWithinLane(buckets.follow_ups),
      recover: sortWithinLane(buckets.recover),
      nurture: sortWithinLane(buckets.nurture),
    } as Record<LeadLane, PriorityLead[]>;
  }, [data.allActiveLeads, now]);

  const hasAnyLeads = (data.allActiveLeads?.length ?? 0) > 0;

  function seeAllHref(lane: LeadLane): string | null {
    if (lane === "call_now") return "/sales/call-now";
    if (lane === "recover") return "/sales/recover";
    return null;
  }

  return (
    <div>
      {/* ============================================
          HEADER
          ============================================ */}
      <div className="mb-8">
        <p className="mb-1 font-mono text-[11px] uppercase tracking-[0.1em] text-[var(--text-tertiary)]">
          {today}
        </p>
        <h1 className="font-display text-3xl tracking-tight text-[var(--text-primary)]">
          Good {getGreeting()}, {firstName}
        </h1>
      </div>

      {(data.retargetingStatuses?.length ?? 0) > 0 && (
        <RetargetingBanners statuses={data.retargetingStatuses!} />
      )}

      {/* ============================================
          NUMBERS STRIP — 4 compact stat cards
          ============================================ */}
      <div className="ag-fade-in grid grid-cols-2 min-[600px]:grid-cols-4 gap-3 mb-8">
        {[
          {
            label: "Active leads",
            value: data.numbers.totalActive,
            colour: "var(--text-primary)",
            icon: Users,
          },
          {
            label: "Called today",
            value: data.numbers.calledToday,
            colour:
              data.numbers.calledToday > 0 ? "var(--success)" : "var(--text-disabled)",
            icon: Phone,
          },
          {
            label: "Follow-ups due",
            value: data.numbers.followUpToday,
            colour:
              data.numbers.followUpToday > 0 ? "var(--warning)" : "var(--text-disabled)",
            icon: CalendarClock,
          },
          {
            label: "Won this month",
            value: data.numbers.wonThisMonth,
            colour:
              data.numbers.wonThisMonth > 0 ? "var(--accent)" : "var(--text-disabled)",
            icon: Trophy,
          },
        ].map((stat) => (
          <div
            key={stat.label}
            className="rounded-xl border border-[var(--border)] bg-[var(--surface-card)] p-5 flex flex-col items-center"
          >
            <stat.icon size={14} className="mb-2 text-[var(--text-disabled)]" />
            <p
              className="font-display text-3xl font-semibold leading-none mb-1"
              style={{ color: stat.colour }}
            >
              {stat.value}
            </p>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--text-tertiary)] text-center">
              {stat.label}
            </p>
          </div>
        ))}
      </div>

      {data.numbers.totalActive === 0 && data.debug ? (
        <div className="mb-6 rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface-card)] p-4 text-[12px] text-[var(--text-secondary)]">
          <div className="mb-2 font-mono text-[11px] uppercase tracking-[0.08em] text-[var(--text-tertiary)]">Debug</div>
          <pre className="overflow-auto whitespace-pre-wrap">{JSON.stringify(data.debug, null, 2)}</pre>
        </div>
      ) : null}

      {/* ============================================
          PRIORITY LEAD LIST
          ============================================ */}
      <div className="mb-8">
        <div className="ag-fade-in flex items-center justify-between mb-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-[var(--text-tertiary)] mb-0.5">
              Today
            </p>
            <h2 className="text-[18px] font-semibold text-[var(--text-primary)]">
              Your priorities
            </h2>
          </div>
          <button
            type="button"
            onClick={() => router.push("/sales/leads")}
            className="flex items-center gap-1 text-[12px] font-semibold text-[var(--accent)] hover:opacity-80 transition-opacity"
          >
            All leads
            <ChevronRight size={12} />
          </button>
        </div>

        {!hasAnyLeads ? (
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-card)] flex flex-col items-center justify-center py-16 text-center px-5">
            <CheckCircle className="w-8 h-8 text-[var(--success)] mb-3" />
            <p className="text-[15px] font-semibold text-[var(--text-primary)] mb-1">
              All caught up
            </p>
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

              // Nurture renders as a single collapsed, expandable row.
              if (lane === "nurture") {
                return (
                  <section key={lane} className={`ag-fade-in ${delayClass}`}>
                    <button
                      type="button"
                      onClick={() => setNurtureOpen((o) => !o)}
                      className="w-full flex items-center justify-between gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-card)] px-5 py-4 hover:border-[var(--border-hover)] transition-colors text-left"
                      aria-expanded={nurtureOpen}
                    >
                      <div className="flex items-center gap-2">
                        <MinusCircle size={15} className="text-[var(--text-tertiary)]" />
                        <span className="text-[14px] font-semibold text-[var(--text-primary)]">
                          {meta.title}
                        </span>
                        <span className="text-[13px] text-[var(--text-tertiary)]">
                          {count}
                        </span>
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
                            onOpenLogSheet={openLogSheet}
                          />
                        ))}
                        {count > 5 && (
                          <button
                            type="button"
                            onClick={() => router.push("/sales/leads")}
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

              return (
                <section key={lane} className={`ag-fade-in ${delayClass}`}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-baseline gap-2">
                      <h3 className="text-[14px] font-semibold text-[var(--text-primary)]">
                        {meta.title}
                      </h3>
                      <span className="text-[13px] text-[var(--text-tertiary)]">
                        {count}
                      </span>
                    </div>
                    {(seeAllHref(lane)
                      ? lane === "recover"
                        ? count > 0
                        : count > 5
                      : count > 5) && seeAllHref(lane) ? (
                      <button
                        type="button"
                        onClick={() => router.push(seeAllHref(lane)!)}
                        className="flex items-center gap-1 text-[12px] font-semibold text-[var(--accent)] hover:opacity-80 transition-opacity"
                      >
                        See all ({count})
                        <ChevronRight size={12} />
                      </button>
                    ) : count > 5 ? (
                      <button
                        type="button"
                        onClick={() => router.push("/sales/leads")}
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
                        onOpenLogSheet={openLogSheet}
                      />
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </div>

      {/* ============================================
          RECENT ACTIVITY + WINS — two columns on desktop
          ============================================ */}
      <div className="ag-fade-in ag-delay-2 grid grid-cols-1 gap-6 min-[900px]:grid-cols-2">

        {/* RECENT ACTIVITY */}
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-card)] overflow-hidden">
          <div className="px-5 py-4 border-b border-[var(--border)]">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-[var(--text-tertiary)] mb-0.5">
              History
            </p>
            <h2 className="text-[18px] font-semibold text-[var(--text-primary)]">
              Your recent activity
            </h2>
          </div>

          {data.recentActivity.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center px-5">
              <Activity className="w-7 h-7 text-[var(--text-disabled)] mb-3" />
              <p className="text-[13px] text-[var(--text-tertiary)]">
                No activity logged yet today
              </p>
            </div>
          ) : (
            <div>
              {data.recentActivity.map((event, i) => {
                const Icon =
                  event.event_type === "CALL_LOGGED"
                    ? Phone
                    : event.event_type === "DOCUMENT_SENT"
                    ? Send
                    : event.event_type === "STATUS_CHANGED"
                    ? ChevronRight
                    : Activity;

                return (
                  <div
                    key={event.id}
                    className={`flex items-start gap-3 px-5 py-3 hover:bg-[var(--bg-tertiary)] transition-colors ${
                      i < data.recentActivity.length - 1
                        ? "border-b border-[var(--border)]"
                        : ""
                    }`}
                  >
                    <div className="w-7 h-7 rounded-full bg-[var(--bg-quaternary)] border border-[var(--border)] flex items-center justify-center shrink-0 mt-0.5">
                      <Icon size={13} className="text-[var(--text-tertiary)]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] text-[var(--text-secondary)] leading-snug mb-0.5">
                        {formatEventType(event.event_type, event.event_data, (event as { channel?: string | null }).channel)}
                        {" — "}
                        <span className="text-[var(--text-primary)] font-semibold">
                          {event.leads?.[0]?.name ?? "Unknown"}
                        </span>
                      </p>
                      <p className="text-[11px] text-[var(--text-tertiary)]">
                        {timeAgo(event.created_at)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* WINS THIS MONTH */}
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-card)] overflow-hidden">
          <div className="px-5 py-4 border-b border-[var(--border)]">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-[var(--text-tertiary)] mb-0.5">
              Deals
            </p>
            <h2 className="text-[18px] font-semibold text-[var(--text-primary)]">
              Won this month
            </h2>
          </div>

          {data.recentWins.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center px-5">
              <Trophy className="w-7 h-7 text-[var(--text-disabled)] mb-3" />
              <p className="text-[13px] text-[var(--text-tertiary)]">
                No wins yet this month. Keep going.
              </p>
            </div>
          ) : (
            <div>
              {data.recentWins.map((win, i) => (
                <div
                  key={win.id}
                  className={`flex items-center justify-between gap-4 px-5 py-3 hover:bg-[var(--bg-tertiary)] transition-colors ${
                    i < data.recentWins.length - 1 ? "border-b border-[var(--border)]" : ""
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-semibold text-[var(--text-primary)] truncate mb-0.5">
                      {win.leads?.[0]?.name ?? "Unknown lead"}
                    </p>
                    <p className="text-[11px] text-[var(--text-tertiary)]">
                      {win.days_to_close ?? 0}d to close
                      {" · "}
                      {timeAgo(win.created_at)}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    {win.deal_value ? (
                      <p className="text-[13px] font-semibold text-[var(--success)]">
                        ${Number(win.deal_value).toLocaleString()}
                      </p>
                    ) : (
                      <Trophy size={14} className="text-[var(--success)]" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ============================================
          FLOATING LOG CALL BUTTON
          ============================================ */}
      <button
        type="button"
        onClick={() => openLogSheet("")}
        className="fixed right-5 bottom-[calc(72px+env(safe-area-inset-bottom))] z-30 w-14 h-14 rounded-full bg-[var(--accent)] text-[var(--accent-foreground)] flex items-center justify-center shadow-[var(--shadow-accent-glow)] hover:bg-[var(--accent-hover)] transition-colors"
        aria-label="Log a call"
      >
        <Phone size={22} />
      </button>

      {/* ============================================
          QUICK LOG SHEET
          ============================================ */}
      {sheet}
    </div>
  );
}
