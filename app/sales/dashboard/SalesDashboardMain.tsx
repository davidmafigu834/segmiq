"use client";

import { useState, useMemo, useEffect } from "react";
import {
  Phone,
  UserPlus,
  CalendarClock,
  Send,
  ChevronRight,
  Trophy,
  Activity,
  Sparkles,
} from "lucide-react";
import {
  classifyLeadLane,
  sortWithinLane,
  sortCallNowLane,
  type LeadLane,
} from "@/lib/lead-lanes";
import {
  isRetargetingGraduated,
  type RetargetingStatusView,
} from "@/lib/retargeting-shared";
import { leadJoinName } from "@/lib/format";
import { type PriorityLead, timeAgo } from "@/lib/sales-priority-lead";
import { PriorityLanes } from "@/components/sales/PriorityLanes";
import { RetargetingBanners } from "@/components/sales/RetargetingBanner";
import { useSalesLogSheet } from "@/components/sales/SalesLogFab";
import { useAddHubSheet } from "@/components/sales/AddToHubSheet";
import SalesDashboardSkeleton from "./SalesDashboardSkeleton";

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
  leads: { name: string | null } | { name: string | null }[] | null;
};

type RecentWin = {
  id: string;
  deal_value: number | null;
  days_to_close: number | null;
  created_at: string;
  leads: { name: string | null } | { name: string | null }[] | null;
};

type DashboardData = {
  assignmentMode?: "direct" | "pool" | "round_robin";
  priorityLeads: PriorityLead[];
  allActiveLeads: PriorityLead[];
  mirror: {
    mode: "rules" | "stall";
    line: string;
    dominantReason?: string;
  };
  numbers: {
    totalActive: number;
    callNow: number;
    calledToday: number;
    followUpToday: number;
    slipped: number;
    convertLaterCount: number;
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
  const { openAddHubSheet, addHubSheetProps } = useAddHubSheet();
  const { hubSheet } = addHubSheetProps(data.assignmentMode ?? "direct");

  // Captured once on mount so lanes stay stable across incidental re-renders
  // (the per-second SLA countdown runs on its own timer).
  const [now] = useState(() => new Date());
  const [nurtureOpen, setNurtureOpen] = useState(false);

  // This view is entirely driven by the current time (lane classification, SLA
  // countdowns, relative timestamps, greeting). Rendering it during SSR/first
  // hydration would mismatch the server clock/timezone and force React to drop
  // the server HTML. Render the skeleton until mounted, then the live dashboard.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

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

  const mirrorLine =
    data.mirror?.line ??
    "Log every call so your mirror learns your patterns.";

  if (!mounted) return <SalesDashboardSkeleton />;

  return (
    <div className="min-w-0 w-full max-w-full overflow-x-hidden">
      {/* ============================================
          HEADER
          ============================================ */}
      <div className="mb-8">
        <p className="mb-1 font-mono text-[11px] uppercase tracking-[0.1em] text-[var(--text-tertiary)]">
          {today}
        </p>
        <h1 className="break-words font-display text-2xl tracking-tight text-[var(--text-primary)] sm:text-3xl">
          Good {getGreeting()}, {firstName}
        </h1>
      </div>

      {/* ============================================
          YOUR MIRROR — briefing strip
          ============================================ */}
      <div className="ag-fade-in mb-6 rounded-xl border border-[var(--border)] border-l-4 border-l-[var(--accent)] bg-[var(--surface-card)] px-4 py-4">
        <div className="mb-2 flex items-center gap-2">
          {data.mirror?.mode === "stall" ? (
            <Sparkles size={14} className="shrink-0 text-[var(--accent)]" aria-hidden />
          ) : null}
          <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--accent)]">
            Your mirror
          </p>
        </div>
        <p className="m-0 text-[14px] leading-relaxed text-[var(--text-secondary)]">
          {mirrorLine}
        </p>
      </div>

      {/* ============================================
          NUMBERS STRIP — 4 compact stat cards
          ============================================ */}
      <div className="ag-fade-in mb-8 grid min-w-0 grid-cols-2 gap-2.5 min-[600px]:grid-cols-4 sm:gap-3">
        {[
          {
            label: "Call now",
            value: data.numbers.callNow ?? 0,
            colour:
              (data.numbers.callNow ?? 0) > 0 ? "var(--accent)" : "var(--text-disabled)",
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
            label: "Logged today",
            value: data.numbers.calledToday,
            colour:
              data.numbers.calledToday > 0 ? "var(--success)" : "var(--text-disabled)",
            icon: Activity,
          },
          {
            label: "Won this month",
            value: data.numbers.wonThisMonth,
            colour:
              data.numbers.wonThisMonth > 0 ? "var(--accent)" : "var(--text-disabled)",
            icon: Trophy,
          },
        ].map((stat) => {
          const StatIcon = stat.icon;
          return (
          <div
            key={stat.label}
            className="flex min-w-0 flex-col items-center rounded-xl border border-[var(--border)] bg-[var(--surface-card)] p-3.5 sm:p-5"
          >
            <StatIcon size={14} className="mb-2 text-[var(--text-disabled)]" />
            <p
              className="font-display text-3xl font-semibold leading-none mb-1"
              style={{ color: stat.colour }}
            >
              {stat.value}
            </p>
            <p className="max-w-full break-words text-center text-[9px] font-semibold uppercase leading-tight tracking-wide text-[var(--text-tertiary)] min-[420px]:text-[10px] min-[420px]:tracking-widest">
              {stat.label}
            </p>
          </div>
        );
        })}
      </div>

      {(data.retargetingStatuses?.length ?? 0) > 0 && (
        <RetargetingBanners statuses={data.retargetingStatuses!} />
      )}

      {data.numbers.totalActive === 0 && data.debug ? (
        <div className="mb-6 rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface-card)] p-4 text-[12px] text-[var(--text-secondary)]">
          <div className="mb-2 font-mono text-[11px] uppercase tracking-[0.08em] text-[var(--text-tertiary)]">Debug</div>
          <pre className="overflow-auto whitespace-pre-wrap">{JSON.stringify(data.debug, null, 2)}</pre>
        </div>
      ) : null}

      <PriorityLanes
        lanes={lanes}
        now={now}
        repName={repName}
        hasAnyLeads={hasAnyLeads}
        nurtureOpen={nurtureOpen}
        onNurtureOpenChange={setNurtureOpen}
        onOpenLogSheet={openLogSheet}
      />

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
                          {leadJoinName(event.leads) ?? "Unknown"}
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
                      {leadJoinName(win.leads) ?? "Unknown lead"}
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

      <button
        type="button"
        onClick={openAddHubSheet}
        aria-label="Add to Customer Hub"
        className="fixed right-[max(1rem,env(safe-area-inset-right))] bottom-[calc(140px+env(safe-area-inset-bottom))] z-30 grid h-14 w-14 place-items-center rounded-full border border-[var(--border-hover)] bg-[var(--surface-card)] text-[var(--accent)] shadow-lg sm:right-5"
      >
        <UserPlus size={22} />
      </button>

      {/* ============================================
          FLOATING LOG CALL BUTTON
          ============================================ */}
      <button
        type="button"
        onClick={() => openLogSheet("")}
        className="fixed right-[max(1rem,env(safe-area-inset-right))] bottom-[calc(72px+env(safe-area-inset-bottom))] z-30 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--accent)] text-[var(--accent-foreground)] shadow-[var(--shadow-accent-glow)] transition-colors hover:bg-[var(--accent-hover)] sm:right-5"
        aria-label="Log a call"
      >
        <Phone size={22} />
      </button>

      {/* ============================================
          QUICK LOG SHEET
          ============================================ */}
      {sheet}
      {hubSheet}
    </div>
  );
}
