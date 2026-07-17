"use client";

import { useState, useEffect } from "react";
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
  Target,
  Bell,
  FileText,
  DollarSign,
  CheckCircle2,
  Percent,
  TrendingUp,
  TrendingDown,
} from "lucide-react";
import { formatCurrencyUsd, leadJoinName } from "@/lib/format";
import { GrowthTrendChart, type GrowthTrendPoint } from "@/components/dashboard/GrowthTrendChart";
import {
  canNudgeRetargeting,
  retargetingStatusLabel,
  RETARGETING_PROGRESS_SHOW_RATIO,
  type RetargetingStatusView,
} from "@/lib/retargeting-shared";
import { LossInsightsSection } from "@/components/dashboard/LossInsightsSection";
import { RevenueForecastCard, type ForecastCardData } from "@/components/dashboard/RevenueForecastCard";
import { WhatsAppHubReportSection } from "@/components/reports/WhatsAppHubReportSection";
import type { WhatsAppHubReport } from "@/lib/whatsapp-hub-report";
import { useAddHubSheet } from "@/components/sales/AddToHubSheet";
import { PageHeader } from "@/components/ui";
import ClientDashboardSkeleton from "./ClientDashboardSkeleton";

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
  leads?: { name: string | null } | { name: string | null }[] | null;
};

type DashboardData = {
  assignmentMode?: "direct" | "pool" | "round_robin";
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
  quotationsMetrics: {
    sentCount: number;
    totalQuotedValue: number;
    acceptedCount: number;
    acceptedValue: number;
    conversionPct: number | null;
  };
  recentWins: RecentWin[];
  pulseMetrics: {
    weekLeads: number;
    contactRate: number | null;
    weekWon: number;
    totalActiveLeads: number;
  };
  deltas?: {
    weekLeadsPct: number | null;
    weekWonPct: number | null;
    contactRatePts: number | null;
  };
  growthTrend?: GrowthTrendPoint[];
  forecast?: ForecastCardData | null;
  clientName: string;
  retargeting?: RetargetingStatusView | null;
  whatsappHub?: WhatsAppHubReport | null;
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
  { key: "WHATSAPP_INBOUND", label: "WhatsApp chat" },
  { key: "MANUAL", label: "Manual" },
  { key: "REFERRAL", label: "Referral" },
];

const GHOST_WIDTHS: Record<string, number> = {
  FACEBOOK: 65,
  LANDING_PAGE: 40,
  WHATSAPP_INBOUND: 35,
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

function DeltaBadge({
  pct,
  suffix,
}: {
  pct: number | null;
  suffix: string;
}) {
  if (pct === null) {
    return (
      <p className="text-[12px] font-medium text-[var(--text-tertiary)]">
        vs last week
      </p>
    );
  }
  const up = pct > 0;
  const flat = pct === 0;
  const Icon = up ? TrendingUp : TrendingDown;
  const cls = flat
    ? "text-[var(--text-tertiary)]"
    : up
      ? "text-[var(--success)]"
      : "text-[var(--error)]";
  return (
    <p className={`flex items-center gap-1 text-[12px] font-semibold ${cls}`}>
      {!flat && <Icon size={12} />}
      {up ? "+" : ""}
      {pct}
      {suffix}
      <span className="font-medium text-[var(--text-tertiary)]"> vs last week</span>
    </p>
  );
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
  const [mounted, setMounted] = useState(false);
  const [nudging, setNudging] = useState(false);
  const { openAddHubSheet, addHubSheetProps } = useAddHubSheet();
  const { hubSheet } = addHubSheetProps(data.assignmentMode ?? "direct", {
    mode: "manager",
    clientId: session.clientId as string,
  });
  const firstName = (session?.user?.name as string | undefined)?.split(" ")[0] || "there";
  const rt = data.retargeting;
  const showRetargeting =
    rt &&
    rt.leadCount > 0 &&
    (rt.status !== "building" ||
      rt.leadCount >= rt.threshold * RETARGETING_PROGRESS_SHOW_RATIO);
  const today = new Date().toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  useEffect(() => {
    setMounted(true);
  }, []);

  const maxPipeline = Math.max(...Object.values(data.pipeline), 1);
  const hasSourceData = Object.values(data.sourceCounts).some((v) => v > 0);
  const maxSource = Math.max(...Object.values(data.sourceCounts), 1);

  if (!mounted) return <ClientDashboardSkeleton />;

  return (
    <div className="min-w-0 w-full max-w-full overflow-x-hidden pb-20">
      {hubSheet}

      <PageHeader
        className="mb-6 ag-fade-in"
        eyebrow={`${data.clientName} · ${today}`}
        title={`Good ${getGreeting()}, ${firstName}`}
        description="Team performance, pipeline health, and what needs attention today."
        actions={
          <button
            type="button"
            onClick={openAddHubSheet}
            className="inline-flex h-9 items-center gap-2 rounded-lg bg-[var(--accent)] px-4 text-[13px] font-semibold text-[var(--accent-foreground)] transition-colors hover:bg-[var(--accent-hover)]"
          >
            <UserPlus size={14} />
            Add lead
          </button>
        }
      />

      {/* Quick navigation */}
      <div className="ag-fade-in mb-6 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => router.push("/client/leads")}
          className="flex h-9 items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--bg-tertiary)] px-4 text-[13px] font-semibold text-[var(--text-secondary)] transition-colors hover:border-[var(--border-hover)] hover:text-[var(--text-primary)]"
        >
          <Users size={14} />
          All leads
        </button>
        <button
          type="button"
          onClick={() => router.push("/client/reports")}
          className="flex h-9 items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--bg-tertiary)] px-4 text-[13px] font-semibold text-[var(--text-secondary)] transition-colors hover:border-[var(--border-hover)] hover:text-[var(--text-primary)]"
        >
          <BarChart2 size={14} />
          Reports
        </button>
        <button
          type="button"
          onClick={() => router.push("/client/team")}
          className="flex h-9 items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--bg-tertiary)] px-4 text-[13px] font-semibold text-[var(--text-secondary)] transition-colors hover:border-[var(--border-hover)] hover:text-[var(--text-primary)]"
        >
          <Users size={14} />
          Team
        </button>
      </div>

      {showRetargeting && rt && (
        <div className="ag-fade-in mb-8 rounded-xl border border-[var(--border)] bg-[var(--surface-card)] p-5">
          <div className="flex items-start gap-3">
            <Target size={18} className="shrink-0 mt-0.5 text-[var(--accent)]" />
            <div className="min-w-0 flex-1">
              <p className="text-[14px] font-semibold text-[var(--text-primary)] mb-1">
                Retargeting audience
              </p>
              <p className="text-[13px] text-[var(--text-secondary)]">
                {retargetingStatusLabel(rt.status)} · {rt.leadCount} graduated
                leads
                {rt.status === "building" &&
                  ` — opens at ${rt.threshold} leads`}
              </p>
              {rt.status === "ad_live" && rt.adLiveAt && (
                <p className="text-[12px] text-[var(--text-tertiary)] mt-1">
                  Ad went live{" "}
                  {new Date(rt.adLiveAt).toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "short",
                  })}
                </p>
              )}
              {(rt.status === "ready" || rt.status === "ad_pending") &&
                canNudgeRetargeting(rt.lastNudgeAt) && (
                  <button
                    type="button"
                    disabled={nudging}
                    onClick={async () => {
                      setNudging(true);
                      try {
                        await fetch("/api/sales/retargeting/nudge", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ clientId: rt.clientId }),
                        });
                        router.refresh();
                      } finally {
                        setNudging(false);
                      }
                    }}
                    className="mt-3 inline-flex items-center gap-2 h-9 px-4 rounded-lg bg-[var(--accent)] text-[var(--accent-foreground)] text-[13px] font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
                  >
                    <Bell size={14} />
                    {nudging ? "Sending…" : "Request ad"}
                  </button>
                )}
            </div>
          </div>
        </div>
      )}

      {/* ============================================
          TODAY'S FOCUS — 3 urgent numbers
          ============================================ */}
      <div className="ag-fade-in mb-8 grid min-w-0 grid-cols-1 gap-2 min-[480px]:grid-cols-3">
        {(
          [
            {
              label: "Uncontacted",
              value: data.focus.uncontacted,
              description: "Never been called",
              icon: PhoneOff,
              urgent: data.focus.uncontacted > 0,
              href: "/client/leads/pipeline?status=NEW",
              colour: data.focus.uncontacted > 0 ? "var(--error)" : "var(--text-disabled)",
            },
            {
              label: "Follow-ups due",
              value: data.focus.followUpToday,
              description: "Scheduled for today",
              icon: CalendarClock,
              urgent: data.focus.followUpToday > 0,
              href: "/client/leads/pipeline?followup=today",
              colour: data.focus.followUpToday > 0 ? "var(--warning)" : "var(--text-disabled)",
            },
            {
              label: "Stale leads",
              value: data.focus.staleLeads,
              description: "No activity 7+ days",
              icon: Clock,
              urgent: data.focus.staleLeads > 0,
              href: "/client/leads/pipeline?stale=true",
              colour: data.focus.staleLeads > 0 ? "var(--error)" : "var(--text-disabled)",
            },
          ] as const
        ).map((item) => {
          const ItemIcon = item.icon;
          return (
          <button
            key={item.label}
            type="button"
            onClick={() => router.push(item.href)}
            className="rounded-lg border border-[var(--border)] bg-[var(--surface-card)] p-3.5 text-left transition-colors hover:border-[var(--border-hover)]"
          >
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-[var(--text-tertiary)]">
                {item.label}
              </p>
              <ItemIcon size={14} style={{ color: item.colour }} />
            </div>
            <p className="text-2xl font-semibold tabular-nums leading-none text-[var(--text-primary)]">
              {item.value}
            </p>
            <p className={`mt-1.5 text-[12px] font-medium ${
              item.urgent ? "text-[var(--error)]" : "text-[var(--text-tertiary)]"
            }`}>
              {item.description}
            </p>
          </button>
        );
        })}
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
                deltaPct: data.deltas?.weekLeadsPct ?? null,
                deltaSuffix: "%",
              },
              {
                label: "Contact rate",
                value:
                  data.pulseMetrics.contactRate !== null
                    ? `${data.pulseMetrics.contactRate}%`
                    : "—",
                deltaPct: data.deltas?.contactRatePts ?? null,
                deltaSuffix: "pts",
              },
              {
                label: "Won this week",
                value: String(data.pulseMetrics.weekWon),
                deltaPct: data.deltas?.weekWonPct ?? null,
                deltaSuffix: "%",
              },
              {
                label: "Active leads",
                value: String(data.pulseMetrics.totalActiveLeads),
                deltaPct: null as number | null,
                deltaSuffix: "%",
              },
            ] as const
          ).map((metric) => (
            <div key={metric.label} className="flex flex-col gap-1">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-[var(--text-tertiary)]">
                {metric.label}
              </p>
              <p
                className="text-2xl font-semibold tabular-nums leading-none text-[var(--text-primary)]"
              >
                {metric.value}
              </p>
              <DeltaBadge pct={metric.deltaPct} suffix={metric.deltaSuffix} />
            </div>
          ))}
        </div>
      </div>

      {data.whatsappHub && data.whatsappHub.summary.activeChats + data.whatsappHub.summary.newChats > 0 ? (
        <div className="ag-fade-in ag-delay-1 mb-8 rounded-xl border border-[var(--border)] bg-[var(--surface-card)] p-4 sm:p-5">
          <WhatsAppHubReportSection
            report={data.whatsappHub}
            inboxHref="/client/leads/pipeline"
          />
        </div>
      ) : null}

      {/* ============================================
          GROWTH TREND
          ============================================ */}
      {data.growthTrend && data.growthTrend.length > 0 && (
        <div className="ag-fade-in ag-delay-1 mb-8">
          <GrowthTrendChart data={data.growthTrend} />
        </div>
      )}

      {data.forecast && (
        <div className="ag-fade-in ag-delay-1 mb-8">
          <RevenueForecastCard data={data.forecast} />
        </div>
      )}

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
                    <span className="font-display text-[16px] font-semibold text-[var(--text-primary)] w-7 text-right shrink-0">
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
          QUOTATIONS THIS WEEK
          ============================================ */}
      <div className="ag-fade-in ag-delay-3 mb-8 rounded-xl border border-[var(--border)] bg-[var(--surface-card)] p-5">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-[var(--text-tertiary)] mb-1">
          Quotations
        </p>
        <h2 className="text-[18px] font-semibold text-[var(--text-primary)] mb-5">
          Quotes &amp; revenue this week
        </h2>

        <div className="grid grid-cols-2 gap-3 min-[700px]:grid-cols-4">
          {(
            [
              {
                label: "Quotes sent",
                value: String(data.quotationsMetrics.sentCount),
                icon: FileText,
                colourClass: "text-[var(--accent)]",
              },
              {
                label: "Value quoted",
                value: formatCurrencyUsd(data.quotationsMetrics.totalQuotedValue),
                icon: DollarSign,
                colourClass: "text-[#60a5fa]",
              },
              {
                label: "Accepted value",
                value: formatCurrencyUsd(data.quotationsMetrics.acceptedValue),
                icon: CheckCircle2,
                colourClass: "text-[var(--success)]",
              },
              {
                label: "Quote → win",
                value:
                  data.quotationsMetrics.conversionPct == null
                    ? "—"
                    : `${data.quotationsMetrics.conversionPct}%`,
                icon: Percent,
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
              <p className="font-display text-[24px] font-semibold text-[var(--text-primary)] leading-none">
                {stat.value}
              </p>
            </div>
          ))}
        </div>
        {data.quotationsMetrics.acceptedCount > 0 ? (
          <p className="mt-3 text-[12px] text-[var(--text-tertiary)]">
            {data.quotationsMetrics.acceptedCount} of {data.quotationsMetrics.sentCount} quotes
            accepted this week.
          </p>
        ) : null}
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
                      {leadJoinName(win.leads) ?? "Unknown"}
                    </p>
                    <p suppressHydrationWarning className="text-[11px] text-[var(--text-tertiary)]">
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

      {session?.clientId ? (
        <div className="ag-fade-in ag-delay-3 mb-8">
          <LossInsightsSection clientId={session.clientId as string} />
        </div>
      ) : null}

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

      <button
        type="button"
        onClick={openAddHubSheet}
        className="fixed bottom-[calc(72px+env(safe-area-inset-bottom))] right-[max(1rem,env(safe-area-inset-right))] z-30 flex h-11 items-center gap-2 rounded-lg border border-[var(--border-hover)] bg-[var(--accent)] px-4 text-[13px] font-semibold text-[var(--accent-foreground)] shadow-[var(--shadow-lg)] transition-colors hover:bg-[var(--accent-hover)] layout:bottom-6 layout:right-6"
      >
        <UserPlus size={17} />
        <span className="hidden sm:inline">Add lead</span>
      </button>
    </div>
  );
}
