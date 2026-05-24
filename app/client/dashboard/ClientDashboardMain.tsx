"use client";

import { useRouter } from "next/navigation";
import {
  PhoneOff,
  CalendarClock,
  Clock,
  Users,
  Trophy,
  Send,
  LayoutGrid,
  Building2,
  Tag,
  BarChart2,
  UserPlus,
  ChevronRight,
} from "lucide-react";

// ============================================
// TYPES
// ============================================

type SalespersonStat = {
  id: string;
  name: string;
  assignedLeads: number;
  weekLeads: number;
  contactRate: number | null;
  wonThisWeek: number;
  wonThisMonth: number;
  calledToday: number;
  sentThisWeek: number;
  activeToday: boolean;
};

type RecentWin = {
  lead_id: string;
  salesperson_name: string | null;
  deal_value?: number | null;
  days_to_close: number | null;
  created_at: string;
  leads?: { name: string | null }[] | null;
};

type DashboardData = {
  focus: {
    uncontacted: number;
    followUpToday: number;
    staleLeads: number;
  };
  pipeline: Record<string, number>;
  scoreDistribution: {
    hot: number;
    warm: number;
    cold: number;
    total: number;
  };
  sourceCounts: Record<string, number>;
  salespersonStats: SalespersonStat[];
  assetsSent: {
    total: number;
    portfolio: number;
    projects: number;
    pricing: number;
    documents: number;
  };
  recentWins: RecentWin[];
  pulseMetrics: {
    weekLeads: number;
    contactRate: number | null;
    weekWon: number;
    totalActiveLeads: number;
  };
  clientName: string;
};

// ============================================
// CONSTANTS
// ============================================

const PIPELINE_STAGES = [
  { key: "NEW", label: "New", color: "var(--text-tertiary)" },
  { key: "CONTACTED", label: "Contacted", color: "#4A7AB5" },
  { key: "QUALIFIED", label: "Qualified", color: "#C49A3C" },
  { key: "NEGOTIATING", label: "Negotiating", color: "#E8602C" },
  { key: "WON", label: "Won", color: "var(--success)" },
  { key: "LOST", label: "Lost", color: "var(--error)" },
];

const SOURCE_ROWS = [
  { key: "FACEBOOK", label: "Facebook" },
  { key: "LANDING_PAGE", label: "Profile page" },
  { key: "MANUAL", label: "Manual" },
  { key: "REFERRAL", label: "Referral" },
];

const GHOST_WIDTHS: Record<string, number> = {
  FACEBOOK: 65,
  LANDING_PAGE: 40,
  MANUAL: 25,
  REFERRAL: 15,
};

// ============================================
// HELPERS
// ============================================

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "morning";
  if (h < 17) return "afternoon";
  return "evening";
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function contactRateColour(rate: number | null): string {
  if (rate === null) return "text-[var(--text-tertiary)]";
  if (rate >= 70) return "text-[var(--success)]";
  if (rate >= 40) return "text-[var(--warning)]";
  return "text-[var(--error)]";
}

// ============================================
// MAIN COMPONENT
// ============================================

export default function ClientDashboardMain({
  data,
  session,
}: {
  data: DashboardData;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  session: any;
}) {
  const router = useRouter();
  const firstName = (session?.user?.name as string | undefined)?.split(" ")[0] || "there";
  const today = new Date().toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  const maxPipeline = Math.max(...Object.values(data.pipeline), 1);
  const hasSourceData = Object.values(data.sourceCounts).some((v) => v > 0);
  const maxSource = Math.max(...Object.values(data.sourceCounts), 1);

  return (
    <div>

      {/* ============================================
          PAGE HEADER
          ============================================ */}
      <div className="mb-8">
        <p className="mb-1 font-mono text-[11px] uppercase tracking-[0.1em] text-[var(--text-tertiary)]">
          {today}
        </p>
        <h1 className="font-display text-3xl tracking-tight text-[var(--text-primary)]">
          Good {getGreeting()}, {firstName}
        </h1>
      </div>

      {/* ============================================
          QUICK ACTIONS
          ============================================ */}
      <div className="flex items-center gap-2 flex-wrap mb-8">
        <button
          onClick={() => router.push("/client/leads/new")}
          className="flex items-center gap-2 px-4 h-9 rounded-lg bg-[var(--accent)] text-[var(--accent-foreground)] text-[13px] font-semibold hover:bg-[var(--accent-hover)] transition-colors"
        >
          <UserPlus size={14} />
          Add lead
        </button>
        <button
          onClick={() => router.push("/client/leads")}
          className="flex items-center gap-2 px-4 h-9 rounded-lg bg-[var(--bg-tertiary)] text-[var(--text-secondary)] text-[13px] font-semibold border border-[var(--border)] hover:border-[var(--border-hover)] hover:text-[var(--text-primary)] transition-colors"
        >
          <Users size={14} />
          All leads
        </button>
        <button
          onClick={() => router.push("/client/reports")}
          className="flex items-center gap-2 px-4 h-9 rounded-lg bg-[var(--bg-tertiary)] text-[var(--text-secondary)] text-[13px] font-semibold border border-[var(--border)] hover:border-[var(--border-hover)] hover:text-[var(--text-primary)] transition-colors"
        >
          <BarChart2 size={14} />
          Reports
        </button>
        <button
          onClick={() => router.push("/client/team")}
          className="flex items-center gap-2 px-4 h-9 rounded-lg bg-[var(--bg-tertiary)] text-[var(--text-secondary)] text-[13px] font-semibold border border-[var(--border)] hover:border-[var(--border-hover)] hover:text-[var(--text-primary)] transition-colors"
        >
          <Users size={14} />
          Team
        </button>
      </div>

      {/* ============================================
          TODAY'S FOCUS — 3 urgent numbers
          ============================================ */}
      <div className="ag-fade-in grid grid-cols-1 min-[480px]:grid-cols-3 gap-3 mb-8">
        {(
          [
            {
              label: "Uncontacted",
              value: data.focus.uncontacted,
              description: "Never been called",
              icon: PhoneOff,
              urgent: data.focus.uncontacted > 0,
              href: "/client/leads?status=NEW",
            },
            {
              label: "Follow-ups due",
              value: data.focus.followUpToday,
              description: "Scheduled for today",
              icon: CalendarClock,
              urgent: data.focus.followUpToday > 0,
              href: "/client/leads?followup=today",
            },
            {
              label: "Stale leads",
              value: data.focus.staleLeads,
              description: "No activity 7+ days",
              icon: Clock,
              urgent: data.focus.staleLeads > 0,
              href: "/client/leads?stale=true",
            },
          ] as const
        ).map((item) => (
          <div
            key={item.label}
            onClick={() => router.push(item.href)}
            className="rounded-xl border border-[var(--border)] bg-[var(--surface-card)] p-5 cursor-pointer hover:border-[var(--border-hover)] transition-colors"
          >
            <div className="flex items-center justify-between mb-3">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-[var(--text-tertiary)]">
                {item.label}
              </p>
              <item.icon size={15} className="text-[var(--text-disabled)]" />
            </div>
            <p className="font-display text-[36px] font-semibold leading-none text-[var(--text-primary)] mb-2">
              {item.value}
            </p>
            <p className={`text-[12px] font-medium ${
              item.urgent ? "text-[var(--error)]" : "text-[var(--text-tertiary)]"
            }`}>
              {item.description}
            </p>
          </div>
        ))}
      </div>

      {/* ============================================
          PULSE METRICS STRIP
          ============================================ */}
      <div className="ag-fade-in ag-delay-1 rounded-xl border border-[var(--border)] bg-[var(--surface-card)] p-5 mb-8">
        <div className="grid grid-cols-2 layout:grid-cols-4 gap-6">
          {(
            [
              {
                label: "Leads this week",
                value: String(data.pulseMetrics.weekLeads),
                delta: null as string | null,
                deltaKind: "neutral" as "neutral" | "negative",
              },
              {
                label: "Contact rate",
                value:
                  data.pulseMetrics.contactRate !== null
                    ? `${data.pulseMetrics.contactRate}%`
                    : "—",
                delta:
                  data.pulseMetrics.contactRate !== null &&
                  data.pulseMetrics.contactRate < 40
                    ? "Below target"
                    : null,
                deltaKind: (
                  data.pulseMetrics.contactRate !== null &&
                  data.pulseMetrics.contactRate < 40
                    ? "negative"
                    : "neutral"
                ) as "neutral" | "negative",
              },
              {
                label: "Won this week",
                value: String(data.pulseMetrics.weekWon),
                delta: null as string | null,
                deltaKind: "neutral" as "neutral" | "negative",
              },
              {
                label: "Active leads",
                value: String(data.pulseMetrics.totalActiveLeads),
                delta: null as string | null,
                deltaKind: "neutral" as "neutral" | "negative",
              },
            ] as const
          ).map((metric) => (
            <div key={metric.label} className="flex flex-col gap-1">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-[var(--text-tertiary)]">
                {metric.label}
              </p>
              <p
                className="font-display text-[36px] font-semibold text-[var(--text-primary)] leading-none"
              >
                {metric.value}
              </p>
              {metric.delta && (
                <p
                  className={`text-[12px] font-medium ${
                    metric.deltaKind === "negative"
                      ? "text-[var(--error)]"
                      : "text-[var(--text-tertiary)]"
                  }`}
                >
                  {metric.delta}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ============================================
          TEAM + PIPELINE — two column
          ============================================ */}
      <div className="ag-fade-in ag-delay-2 grid grid-cols-1 gap-6 min-[1000px]:grid-cols-[1fr_360px] mb-8">

        {/* TEAM PERFORMANCE */}
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-card)] overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-widest text-[var(--text-tertiary)] mb-0.5">
                Team
              </p>
              <h2 className="text-[18px] font-semibold text-[var(--text-primary)]">
                This week
              </h2>
            </div>
            <button
              onClick={() => router.push("/client/team")}
              className="flex items-center gap-1 text-[12px] font-semibold text-[var(--accent)] hover:opacity-80 transition-opacity"
            >
              Manage
              <ChevronRight size={12} />
            </button>
          </div>

          {/* Mobile: stacked cards */}
          <div className="md:hidden space-y-2 px-5 py-3">
            {data.salespersonStats.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <Users className="w-7 h-7 text-[var(--text-disabled)] mb-3" />
                <p className="text-[13px] text-[var(--text-tertiary)]">No salespeople yet</p>
              </div>
            ) : (
              data.salespersonStats.map((sp) => (
                <div key={sp.id} className="rounded-lg border border-[var(--border)] bg-[var(--bg-tertiary)] p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="relative shrink-0">
                        <div className="w-7 h-7 rounded-full bg-[var(--bg-quaternary)] border border-[var(--border)] flex items-center justify-center text-[10px] font-semibold text-[var(--text-secondary)]">
                          {getInitials(sp.name)}
                        </div>
                        <div className={`absolute bottom-0 right-0 w-[8px] h-[8px] rounded-full border border-[var(--surface-card)] ${
                          sp.activeToday ? "bg-[var(--success)]" : "bg-[var(--text-disabled)]"
                        }`} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[13px] font-semibold text-[var(--text-primary)] truncate">{sp.name}</p>
                        <p className="text-[10px] text-[var(--text-tertiary)]">{sp.assignedLeads} leads</p>
                      </div>
                    </div>
                    <p className={`text-[13px] font-semibold shrink-0 ${contactRateColour(sp.contactRate)}`}>
                      {sp.contactRate !== null ? `${sp.contactRate}%` : "—"}
                    </p>
                  </div>
                  <div className="mt-2 pt-2 border-t border-[var(--border)] grid grid-cols-3 gap-2">
                    {[
                      { label: "Won", val: sp.wonThisWeek, cls: sp.wonThisWeek > 0 ? "text-[var(--success)]" : "text-[var(--text-disabled)]" },
                      { label: "Calls", val: sp.calledToday, cls: sp.calledToday > 0 ? "text-[var(--text-primary)]" : "text-[var(--text-disabled)]" },
                      { label: "Sent", val: sp.sentThisWeek, cls: sp.sentThisWeek > 0 ? "text-[var(--text-primary)]" : "text-[var(--text-disabled)]" },
                    ].map(({ label, val, cls }) => (
                      <div key={label} className="text-center">
                        <p className="text-[9px] font-semibold uppercase tracking-wide text-[var(--text-tertiary)] mb-0.5">{label}</p>
                        <p className={`font-display text-[18px] font-semibold ${cls}`}>{val}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Desktop: scrollable table */}
          <div className="hidden md:block overflow-x-auto">
          {data.salespersonStats.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center px-5">
              <Users className="w-8 h-8 text-[var(--text-disabled)] mb-3" />
              <p className="text-[14px] font-semibold text-[var(--text-secondary)] mb-1">
                No salespeople yet
              </p>
              <p className="text-[12px] text-[var(--text-tertiary)] mb-4">
                Invite your first team member to start tracking performance.
              </p>
              <button
                onClick={() => router.push("/client/team")}
                className="px-4 h-9 rounded-lg bg-[var(--accent)] text-[var(--accent-foreground)] text-[13px] font-semibold hover:bg-[var(--accent-hover)] transition-colors"
              >
                Invite salesperson
              </button>
            </div>
          ) : (
            <>
              <div className="min-w-[480px] grid grid-cols-[1fr_80px_60px_60px_60px] gap-0 px-5 py-2 border-b border-[var(--border)]">
                {["Salesperson", "Contact %", "Won", "Calls", "Sent"].map(
                  (col, i) => (
                    <p
                      key={col}
                      className={`text-[10px] font-semibold uppercase tracking-widest text-[var(--text-tertiary)] ${
                        i > 0 ? "text-center" : ""
                      }`}
                    >
                      {col}
                    </p>
                  )
                )}
              </div>

              {data.salespersonStats.map((sp, index) => (
                <div
                  key={sp.id}
                  className={`min-w-[480px] grid grid-cols-[1fr_80px_60px_60px_60px] gap-0 px-5 py-3 items-center hover:bg-[var(--bg-tertiary)] transition-colors ${
                    index < data.salespersonStats.length - 1 ? "border-b border-[var(--border)]" : ""
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="relative shrink-0">
                      <div className="w-8 h-8 rounded-full bg-[var(--bg-quaternary)] border border-[var(--border)] flex items-center justify-center text-[11px] font-semibold text-[var(--text-secondary)]">
                        {getInitials(sp.name)}
                      </div>
                      <div
                        className={`absolute bottom-0 right-0 w-[9px] h-[9px] rounded-full border-[1.5px] border-[var(--bg-primary)] ${
                          sp.activeToday
                            ? "bg-[var(--success)]"
                            : "bg-[var(--text-disabled)]"
                        }`}
                      />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[13px] font-semibold text-[var(--text-primary)] truncate">
                        {sp.name}
                      </p>
                      <p className="text-[10px] text-[var(--text-tertiary)]">
                        {sp.assignedLeads} leads
                      </p>
                    </div>
                  </div>

                  <p className={`text-[14px] font-semibold text-center ${contactRateColour(sp.contactRate)}`}>
                    {sp.contactRate !== null ? `${sp.contactRate}%` : "—"}
                  </p>

                  <p className={`font-display text-[18px] font-semibold text-center ${
                    sp.wonThisWeek > 0 ? "text-[var(--success)]" : "text-[var(--text-disabled)]"
                  }`}>
                    {sp.wonThisWeek}
                  </p>

                  <p className={`font-display text-[18px] font-semibold text-center ${
                    sp.calledToday > 0 ? "text-[var(--text-primary)]" : "text-[var(--text-disabled)]"
                  }`}>
                    {sp.calledToday}
                  </p>

                  <p className={`font-display text-[18px] font-semibold text-center ${
                    sp.sentThisWeek > 0 ? "text-[var(--text-primary)]" : "text-[var(--text-disabled)]"
                  }`}>
                    {sp.sentThisWeek}
                  </p>
                </div>
              ))}
            </>
          )}
          </div>{/* end desktop table */}
        </div>

        {/* RIGHT COLUMN — pipeline + score */}
        <div className="flex flex-col gap-6">

          {/* PIPELINE */}
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-card)] p-5">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-[var(--text-tertiary)] mb-1">
              Pipeline
            </p>
            <h2 className="text-[18px] font-semibold text-[var(--text-primary)] mb-5">
              Lead stages
            </h2>

            <div className="flex flex-col gap-3">
              {PIPELINE_STAGES.map((stage) => {
                const count = data.pipeline[stage.key] || 0;
                const pct = Math.round((count / maxPipeline) * 100);
                return (
                  <div key={stage.key} className="flex items-center gap-3">
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-tertiary)] w-[80px] shrink-0">
                      {stage.label}
                    </span>
                    <div className="flex-1 h-[5px] rounded-full bg-[var(--bg-quaternary)] overflow-hidden">
                      <div
                        className="h-full rounded-full transition-[width] duration-700"
                        style={{ width: `${pct}%`, background: stage.color }}
                      />
                    </div>
                    <span
                      className="text-[16px] font-semibold text-[var(--text-primary)] w-7 text-right shrink-0"
                      style={{ fontFamily: "var(--font-instrument-serif)" }}
                    >
                      {count}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* SCORE DISTRIBUTION */}
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-card)] p-5">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-[var(--text-tertiary)] mb-1">
              Lead quality
            </p>
            <h2 className="text-[18px] font-semibold text-[var(--text-primary)] mb-5">
              {data.scoreDistribution.total} active leads
            </h2>

            <div className="flex flex-col gap-4">
              {(
                [
                  {
                    label: "Hot",
                    count: data.scoreDistribution.hot,
                    color: "var(--success)",
                    dotClass: "bg-[var(--success)]",
                  },
                  {
                    label: "Warm",
                    count: data.scoreDistribution.warm,
                    color: "var(--warning)",
                    dotClass: "bg-[var(--warning)]",
                  },
                  {
                    label: "Cold",
                    count: data.scoreDistribution.cold,
                    color: "var(--text-disabled)",
                    dotClass: "bg-[var(--text-disabled)]",
                  },
                ] as const
              ).map((tier) => {
                const pct =
                  data.scoreDistribution.total > 0
                    ? Math.round((tier.count / data.scoreDistribution.total) * 100)
                    : 0;
                return (
                  <div key={tier.label}>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${tier.dotClass}`} />
                        <span className="text-[12px] font-semibold text-[var(--text-secondary)]">
                          {tier.label}
                        </span>
                      </div>
                      <span
                        className="font-display text-[18px] font-semibold text-[var(--text-primary)]"
                      >
                        {tier.count}
                      </span>
                    </div>
                    <div className="h-[4px] rounded-full bg-[var(--bg-quaternary)] overflow-hidden">
                      <div
                        className="h-full rounded-full transition-[width] duration-700"
                        style={{ width: `${pct}%`, background: tier.color }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* ============================================
          ASSETS SENT + RECENT WINS — two column
          ============================================ */}
      <div className="ag-fade-in ag-delay-3 grid grid-cols-1 gap-6 min-[900px]:grid-cols-2 mb-8">

        {/* ASSETS SENT THIS WEEK */}
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-card)] p-5">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-[var(--text-tertiary)] mb-1">
            Engagement
          </p>
          <h2 className="text-[18px] font-semibold text-[var(--text-primary)] mb-5">
            Sent to prospects this week
          </h2>

          <div className="grid grid-cols-2 gap-3">
            {(
              [
                {
                  label: "Total sent",
                  value: data.assetsSent.total,
                  icon: Send,
                  colourClass: "text-[var(--accent)]",
                },
                {
                  label: "Portfolios",
                  value: data.assetsSent.portfolio,
                  icon: LayoutGrid,
                  colourClass: "text-[#60a5fa]",
                },
                {
                  label: "Projects",
                  value: data.assetsSent.projects,
                  icon: Building2,
                  colourClass: "text-[#a78bfa]",
                },
                {
                  label: "Pricing",
                  value: data.assetsSent.pricing,
                  icon: Tag,
                  colourClass: "text-[var(--warning)]",
                },
              ] as const
            ).map((stat) => (
              <div
                key={stat.label}
                className="rounded-lg border border-[var(--border)] bg-[var(--bg-tertiary)] p-4"
              >
                <div className="flex items-center gap-2 mb-2">
                  <stat.icon size={14} className={stat.colourClass} />
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--text-tertiary)]">
                    {stat.label}
                  </p>
                </div>
                <p
                  className="font-display text-[28px] font-semibold text-[var(--text-primary)] leading-none"
                >
                  {stat.value}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* RECENT WINS */}
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-card)] overflow-hidden">
          <div className="px-5 py-4 border-b border-[var(--border)]">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-[var(--text-tertiary)] mb-0.5">
              Deals
            </p>
            <h2 className="text-[18px] font-semibold text-[var(--text-primary)]">
              Recent wins
            </h2>
          </div>

          {data.recentWins.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center px-5">
              <Trophy className="w-7 h-7 text-[var(--text-disabled)] mb-3" />
              <p className="text-[13px] text-[var(--text-tertiary)]">
                No wins recorded yet
              </p>
            </div>
          ) : (
            <div>
              {data.recentWins.map((win, i) => (
                <div
                  key={win.lead_id}
                  className={`flex items-center justify-between gap-4 px-5 py-3 hover:bg-[var(--bg-tertiary)] transition-colors ${
                    i < data.recentWins.length - 1
                      ? "border-b border-[var(--border)]"
                      : ""
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-semibold text-[var(--text-primary)] truncate mb-0.5">
                      {win.leads?.[0]?.name ?? "Unknown"}
                    </p>
                    <p className="text-[11px] text-[var(--text-tertiary)]">
                      {win.salesperson_name ?? "Unknown"}
                      {" · "}
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
          LEAD SOURCES
          ============================================ */}
      <div className="ag-fade-in ag-delay-4 rounded-xl border border-[var(--border)] bg-[var(--surface-card)] p-5">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-[var(--text-tertiary)] mb-1">
          Sources
        </p>
        <h2 className="text-[18px] font-semibold text-[var(--text-primary)] mb-5">
          Where leads come from
        </h2>

        <div className="flex flex-col gap-3">
          {SOURCE_ROWS.map((source) => {
            const count = data.sourceCounts[source.key] || 0;
            const pct = hasSourceData
              ? Math.round((count / maxSource) * 100)
              : GHOST_WIDTHS[source.key];
            return (
              <div key={source.key} className="flex items-center gap-3">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-tertiary)] w-[90px] shrink-0">
                  {source.label}
                </span>
                <div className="flex-1 h-[5px] rounded-full bg-[var(--bg-quaternary)] overflow-hidden">
                  <div
                    className="h-full rounded-full bg-[var(--accent)] transition-[width] duration-700"
                    style={{
                      width: `${pct}%`,
                      opacity: hasSourceData ? 1 : 0.25,
                    }}
                  />
                </div>
                <span
                  className="font-display text-[17px] font-semibold text-[var(--text-primary)] w-8 text-right shrink-0"
                >
                  {hasSourceData ? count : "—"}
                </span>
              </div>
            );
          })}
        </div>

        {!hasSourceData && (
          <p className="text-[12px] text-[var(--text-tertiary)] text-center mt-4">
            Lead source data will appear here
          </p>
        )}
      </div>

    </div>
  );
}
