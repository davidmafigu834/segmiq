"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  BriefcaseBusiness,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  Inbox,
  Phone,
  Target,
  Trophy,
  User,
  X,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { cn } from "@/lib/ui/cn";
import {
  Avatar,
  Badge,
  Button,
  IconButton,
  Skeleton,
} from "@/components/sales/ui";
import { useSalesChartColors } from "@/lib/sales/use-sales-chart-colors";
import { formatDealCurrency } from "@/lib/sales/format";
import { GoalProgressRing } from "./GoalProgressRing";
import type { CompanyTeamMemberOverview, CompanyTeamMemberTableRow } from "./types";
import type { CompanyActivityItem } from "../types";
import { SiWhatsapp } from "react-icons/si";

function ActivityIcon({ kind }: { kind: CompanyActivityItem["kind"] }) {
  if (kind === "whatsapp") return <SiWhatsapp size={14} className="text-sales-whatsapp" />;
  if (kind === "quote") return <BriefcaseBusiness size={14} className="text-[#60A5FA]" />;
  if (kind === "call") return <Phone size={14} />;
  if (kind === "won") return <Trophy size={14} className="text-sales-success" />;
  if (kind === "deal") return <BriefcaseBusiness size={14} className="text-sales-teal-fg" />;
  if (kind === "lead") return <Inbox size={14} className="text-sales-info-fg" />;
  return <Activity size={14} />;
}

function MicroKpi({
  icon,
  label,
  value,
  danger,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  danger?: boolean;
}) {
  return (
    <div className="flex min-h-[68px] items-start gap-2.5 rounded-[10px] border border-sales-border-subtle bg-sales-surface-raised px-2.5 py-2.5">
      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-[8px] bg-sales-neutral-100 text-sales-text-secondary">
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-[11px] leading-snug text-sales-text-muted">{label}</p>
        <p
          className={cn(
            "mt-0.5 truncate text-[14px] font-semibold tabular-nums leading-tight",
            danger ? "text-sales-warning-fg" : "text-sales-text-primary"
          )}
        >
          {value}
        </p>
      </div>
    </div>
  );
}

function PerformanceChart({
  points,
  hasHistory,
  currency,
}: {
  points: CompanyTeamMemberOverview["performanceTrend"];
  hasHistory: boolean;
  currency: string;
}) {
  const colors = useSalesChartColors();
  if (!hasHistory) {
    return (
      <div className="flex min-h-[140px] items-center justify-center px-2 text-center">
        <p className="text-[12px] text-sales-text-muted">Not enough performance history yet.</p>
      </div>
    );
  }
  return (
    <div className="h-[140px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={points} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="memberPerfFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#D4FF4F" stopOpacity={0.28} />
              <stop offset="100%" stopColor="#D4FF4F" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke={colors.grid} vertical={false} strokeDasharray="3 6" />
          <XAxis
            dataKey="label"
            tick={{ fill: colors.textMuted, fontSize: 10 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            width={40}
            tick={{ fill: colors.textMuted, fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) =>
              Number(v) >= 1000 ? `${Math.round(Number(v) / 1000)}k` : String(v)
            }
          />
          <Tooltip
            contentStyle={{
              background: colors.surfaceRaised,
              border: `1px solid ${colors.border}`,
              borderRadius: 10,
              color: colors.textPrimary,
              fontSize: 12,
            }}
            formatter={(value) => [
              formatDealCurrency(Number(value ?? 0), { currency }),
              "Won revenue",
            ]}
          />
          <Area
            type="monotone"
            dataKey="value"
            stroke="#D4FF4F"
            strokeWidth={2}
            fill="url(#memberPerfFill)"
            dot={{ r: 3, fill: "#D4FF4F", stroke: colors.surface, strokeWidth: 1 }}
            activeDot={{ r: 4, fill: "#D4FF4F", stroke: colors.surface }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function CompanyTeamMemberPanel({
  row,
  overview,
  loading,
  error,
  onRetry,
  onClose,
  onViewProfile,
  onReassign,
  onSetGoal,
  onViewPipeline,
  canReassign,
  canSetGoals,
  stacked,
  overlay,
}: {
  row: CompanyTeamMemberTableRow | null;
  overview: CompanyTeamMemberOverview | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  onClose: () => void;
  onViewProfile: () => void;
  onReassign: () => void;
  onSetGoal: () => void;
  onViewPipeline: () => void;
  canReassign: boolean;
  canSetGoals: boolean;
  stacked?: boolean;
  overlay?: boolean;
}) {
  const name = overview?.name ?? row?.name ?? "Team member";
  const title = overview?.titleLabel ?? row?.titleLabel ?? "";
  const isActive = overview?.isActive ?? row?.isActive ?? true;
  const avatar = overview?.avatarUrl ?? row?.avatarUrl ?? null;

  const body = (
    <>
      <div className="flex items-start gap-3 border-b border-sales-border-subtle px-4 py-4">
        <Avatar name={name} src={avatar} size="xl" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[18px] font-semibold leading-tight tracking-[-0.02em] text-sales-text-primary">
            {name}
          </p>
          <p className="mt-0.5 truncate text-[12px] text-sales-text-secondary">{title}</p>
          <div className="mt-1.5">
            <Badge tone={isActive ? "success" : "neutral"}>{isActive ? "Active" : "Inactive"}</Badge>
          </div>
        </div>
        <IconButton aria-label="Close member detail" size="sm" onClick={onClose}>
          <X size={16} />
        </IconButton>
      </div>

      {error ? (
        <div className="px-4 py-8 text-center">
          <p className="text-[13px] font-medium text-sales-text-primary">
            We couldn&apos;t load this team member&apos;s performance.
          </p>
          <Button variant="secondary" size="sm" className="mt-3" onClick={onRetry}>
            Retry
          </Button>
        </div>
      ) : loading && !overview ? (
        <div className="space-y-4 px-4 py-4">
          <Skeleton className="h-20 w-full" />
          <div className="grid grid-cols-3 gap-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-[68px]" />
            ))}
          </div>
          <Skeleton className="h-[140px] w-full" />
        </div>
      ) : overview ? (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="border-b border-sales-border-subtle px-4 py-4">
            <p className="mb-3 text-[12px] font-semibold text-sales-text-primary">Goal progress</p>
            {overview.hasGoal && overview.goalProgressPct != null ? (
              <div className="flex items-center gap-4">
                <GoalProgressRing pct={overview.goalProgressPct} size={80} />
                <div className="min-w-0 flex-1">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-[11px] text-sales-text-muted">Monthly goal</p>
                      <p className="text-[14px] font-semibold tabular-nums text-sales-text-primary">
                        {overview.goalTargetLabel}
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] text-sales-text-muted">Achieved</p>
                      <p className="text-[14px] font-semibold tabular-nums text-sales-text-primary">
                        {overview.goalAchievedLabel}
                      </p>
                    </div>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--sales-chart-track,var(--sales-neutral-100))]">
                    <div
                      className="h-full rounded-full bg-sales-brand"
                      style={{ width: `${Math.min(100, overview.goalProgressPct)}%` }}
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-[10px] border border-dashed border-sales-border px-3 py-4">
                <p className="text-[13px] font-medium text-sales-text-primary">No Goal set</p>
                <p className="mt-1 text-[12px] text-sales-text-muted">
                  Set a Goal to track this salesperson&apos;s progress.
                </p>
                {canSetGoals ? (
                  <Button variant="primary" size="sm" className="mt-3" onClick={onSetGoal}>
                    Set Goal
                  </Button>
                ) : null}
              </div>
            )}
          </div>

          <div className="grid grid-cols-3 gap-2 border-b border-sales-border-subtle px-4 py-3">
            <MicroKpi
              icon={<BriefcaseBusiness size={14} />}
              label="Active Deals"
              value={String(overview.activeDeals)}
            />
            <MicroKpi
              icon={<CircleDollarSign size={14} />}
              label="Pipeline Value"
              value={overview.pipelineValueLabel}
            />
            <MicroKpi
              icon={<Trophy size={14} />}
              label="Deals Won"
              value={String(overview.dealsWon)}
            />
            <MicroKpi
              icon={<AlertTriangle size={14} />}
              label="Overdue follow-ups"
              value={String(overview.overdueFollowUps)}
              danger={overview.overdueFollowUps > 0}
            />
            <MicroKpi
              icon={<Clock3 size={14} />}
              label="Avg. response time"
              value={overview.avgResponseLabel}
            />
            <MicroKpi
              icon={<Target size={14} />}
              label="Win rate"
              value={overview.closedDealsCount === 0 ? "—" : overview.winRateLabel}
            />
          </div>

          <div className="border-b border-sales-border-subtle px-4 py-3">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-[12px] font-semibold text-sales-text-primary">Performance trend</p>
              <span className="text-[11px] text-sales-text-muted">Last 6 months</span>
            </div>
            <p className="mb-2 text-[11px] text-sales-text-muted">Won Deal revenue</p>
            <PerformanceChart
              points={overview.performanceTrend}
              hasHistory={overview.hasPerformanceHistory}
              currency={overview.goalCurrency}
            />
          </div>

          <div
            className={cn(
              "grid flex-1 gap-0 border-b border-sales-border-subtle",
              stacked ? "grid-cols-1" : "grid-cols-2"
            )}
          >
            <div className={cn("px-4 py-3", !stacked && "border-r border-sales-border-subtle")}>
              <p className="mb-2 text-[12px] font-semibold text-sales-text-primary">Needs attention</p>
              {overview.needsAttention.length === 0 ? (
                <p className="text-[12px] text-sales-text-muted">No urgent issues need attention.</p>
              ) : (
                <ul className="space-y-1.5">
                  {overview.needsAttention.map((item) => (
                    <li key={item.id}>
                      <Link
                        href={item.href}
                        className="flex items-center gap-2 rounded-[8px] px-1 py-1 text-left hover:bg-sales-surface-hover"
                      >
                        <Clock3 size={14} className="shrink-0 text-sales-warning-fg" />
                        <span className="min-w-0 flex-1 truncate text-[12px] text-sales-text-primary">
                          {item.label}
                        </span>
                        <ChevronRight size={14} className="shrink-0 text-sales-text-muted" />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="px-4 py-3">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-[12px] font-semibold text-sales-text-primary">Recent activity</p>
                <Link
                  href="/client/leads"
                  className="text-[11px] font-medium text-sales-text-secondary hover:text-sales-text-primary"
                >
                  View all
                </Link>
              </div>
              {overview.recentActivity.length === 0 ? (
                <p className="text-[12px] text-sales-text-muted">No recent sales activity.</p>
              ) : (
                <ul className="space-y-2.5">
                  {overview.recentActivity.map((item) => {
                    const inner = (
                      <div className="flex items-start gap-2">
                        <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-[6px] bg-sales-neutral-100 text-sales-text-secondary">
                          <ActivityIcon kind={item.kind} />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-[12px] font-medium leading-snug text-sales-text-primary">
                            {item.title}
                          </p>
                          {item.detail ? (
                            <p className="truncate text-[11px] text-sales-text-muted">{item.detail}</p>
                          ) : null}
                        </div>
                        <span className="shrink-0 text-[11px] text-sales-text-muted">
                          {item.timeLabel}
                        </span>
                      </div>
                    );
                    return (
                      <li key={item.id}>
                        {item.href ? (
                          <Link href={item.href} className="block hover:opacity-90">
                            {inner}
                          </Link>
                        ) : (
                          inner
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>

          <div className="mt-auto flex items-center gap-2 px-4 py-3">
            <IconButton aria-label="View profile" size="md" onClick={onViewProfile}>
              <User size={16} />
            </IconButton>
            {canReassign ? (
              <IconButton aria-label="Reassign Leads" size="md" onClick={onReassign}>
                <Inbox size={16} />
              </IconButton>
            ) : null}
            {canSetGoals ? (
              <IconButton
                aria-label={overview.hasGoal ? "Edit Goal" : "Set Goal"}
                size="md"
                onClick={onSetGoal}
              >
                <Target size={16} />
              </IconButton>
            ) : null}
            <Button variant="primary" size="sm" className="ml-auto" onClick={onViewPipeline}>
              View pipeline
            </Button>
          </div>
        </div>
      ) : null}
    </>
  );

  if (overlay) {
    return (
      <div className="fixed inset-0 z-40 flex justify-end">
        <button
          type="button"
          className="absolute inset-0 bg-black/40"
          aria-label="Close member detail"
          onClick={onClose}
        />
        <aside className="relative z-10 flex h-full w-full flex-col overflow-y-auto border-l border-sales-border bg-sales-surface shadow-sales-popover md:max-w-[440px]">
          {body}
        </aside>
      </div>
    );
  }

  return (
    <aside className="flex h-full min-h-0 w-full flex-col overflow-hidden workspace-card rounded-[14px] border border-sales-border bg-sales-surface shadow-sales-card">
      {body}
    </aside>
  );
}
