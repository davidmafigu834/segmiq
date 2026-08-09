"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  CalendarClock,
  CalendarDays,
  CircleCheck,
  CircleDollarSign,
  Clock3,
  Download,
  FileText,
  Lightbulb,
  ListFilter,
  MapPin,
  Phone,
  Target,
  TrendingUp,
  Trophy,
  UsersRound,
} from "lucide-react";
import {
  Button,
  DataTable,
  DataTableBody,
  DataTableEl,
  DataTableHead,
  DataTableRow,
  DataTableTd,
  DataTableTh,
  EmptyState,
  LeadIdentity,
  MenuSelect,
  PipelineStageBadge,
  Progress,
  SalesAreaChart,
  SegmentedControl,
  Skeleton,
} from "@/components/sales/ui";
import { BrandIcon } from "@/components/sales/ui/BrandIcon";
import { formatDealCurrency, formatPercent, formatRelativeTime, formatStageLabel } from "@/lib/sales/format";
import { formatResponseTime } from "@/lib/sales/sales-dashboard-display";
import {
  buildSalesReportsCsv,
  SALES_REPORT_PERIODS,
  SALES_REPORT_SOURCES,
  type SalesReportGranularity,
  type SalesReportPeriodId,
  type SalesReportSourceFilter,
  type SalesReportsPayload,
} from "@/lib/sales/sales-reports-data";
import { ReportCard } from "./reports/ReportCard";
import { ReportKpiCard } from "./reports/ReportKpiCard";
import { PerformanceTrendChart } from "./reports/PerformanceTrendChart";

type TabId = "overview" | "pipeline" | "sources" | "activity" | "forecast";

function vsLabel(periodLabel: string): string {
  const cleaned = periodLabel.replace(/^Last /i, "").replace(/^This /i, "");
  return `vs last ${cleaned.toLowerCase()}`;
}

function trendWithVs(
  trend: SalesReportsPayload["kpis"]["leadsCreated"]["trend"],
  periodLabel: string
) {
  if (!trend || trend.direction === "none") return null;
  if (trend.direction === "new") {
    return { direction: trend.direction, label: `New ${vsLabel(periodLabel)}` };
  }
  if (trend.direction === "flat") return { direction: trend.direction, label: trend.label };
  return {
    direction: trend.direction,
    label: `${trend.label} ${vsLabel(periodLabel)}`,
  };
}

function SourceIcon({ sourceKey }: { sourceKey: string }) {
  if (sourceKey === "whatsapp") return <BrandIcon brand="whatsapp" size={14} />;
  if (sourceKey === "facebook") return <BrandIcon brand="facebook" size={14} />;
  return null;
}

export function SalesReportsClient() {
  const searchParams = useSearchParams();
  const initialTab = (() => {
    const raw = searchParams.get("tab");
    if (raw === "pipeline" || raw === "sources" || raw === "activity" || raw === "forecast" || raw === "overview") {
      return raw;
    }
    return "overview";
  })();
  const [tab, setTab] = useState<TabId>(initialTab);
  const [period, setPeriod] = useState<SalesReportPeriodId>("last_30");
  const [source, setSource] = useState<SalesReportSourceFilter>("all");
  const [granularity, setGranularity] = useState<SalesReportGranularity | "auto">("auto");
  const [data, setData] = useState<SalesReportsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const params = new URLSearchParams({
        period,
        source,
      });
      if (granularity !== "auto") params.set("granularity", granularity);
      const res = await fetch(`/api/sales/reports?${params}`);
      if (!res.ok) throw new Error("Failed");
      const json = (await res.json()) as SalesReportsPayload;
      setData(json);
    } catch {
      setError(true);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [period, source, granularity]);

  useEffect(() => {
    void load();
  }, [load]);

  const exportCsv = () => {
    if (!data) return;
    const csv = buildSalesReportsCsv(data);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `segmiq-sales-report-${period}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const periodLabel = data?.meta.periodLabel ?? "selected period";
  const currency = data?.currency ?? "USD";

  const granularityOptions = useMemo(() => {
    const days =
      data?.meta.from && data?.meta.to
        ? (new Date(data.meta.to).getTime() - new Date(data.meta.from).getTime()) / 86400000
        : 30;
    const opts: { value: SalesReportGranularity | "auto"; label: string }[] = [
      { value: "auto", label: "Auto" },
    ];
    if (days <= 45) opts.push({ value: "daily", label: "Daily" });
    if (days <= 180) opts.push({ value: "weekly", label: "Weekly" });
    opts.push({ value: "monthly", label: "Monthly" });
    return opts;
  }, [data?.meta.from, data?.meta.to]);

  return (
    <div className="w-full space-y-4">
      {/* Tabs + filters */}
      <div className="flex flex-col gap-3">
        <div className="min-w-0 overflow-x-auto">
          <SegmentedControl
            aria-label="Report section"
            value={tab}
            onChange={setTab}
            options={[
              { value: "overview", label: "Overview" },
              { value: "pipeline", label: "Pipeline" },
              { value: "sources", label: "Sources" },
              { value: "activity", label: "Activity" },
              { value: "forecast", label: "Forecast" },
            ]}
          />
        </div>
        <div className="flex h-10 min-w-0 flex-wrap items-center gap-2">
          <MenuSelect
            aria-label="Date range"
            value={period}
            onChange={setPeriod}
            leadingIcon={<CalendarDays size={14} strokeWidth={1.8} />}
            options={SALES_REPORT_PERIODS.map((p) => ({ value: p.id, label: p.label }))}
          />
          <MenuSelect
            aria-label="Lead source"
            value={source}
            onChange={setSource}
            leadingIcon={<ListFilter size={14} strokeWidth={1.8} />}
            options={SALES_REPORT_SOURCES.map((s) => ({ value: s.id, label: s.label }))}
          />
          <Button
            variant="secondary"
            size="md"
            className="ml-auto h-10 shrink-0 whitespace-nowrap rounded-[10px]"
            leftIcon={<Download size={16} strokeWidth={1.8} />}
            onClick={exportCsv}
            disabled={!data}
          >
            Export
          </Button>
        </div>
      </div>

      {data?.insight ? (
        <aside className="flex items-start gap-2.5 rounded-sales-lg border border-sales-brand-border bg-[var(--sales-brand-soft-solid,#F3FCE3)] px-3.5 py-2.5 text-[13px] leading-snug text-sales-text-primary">
          <Lightbulb size={16} strokeWidth={1.8} className="mt-0.5 shrink-0 text-sales-brand-fg" aria-hidden />
          <p>{data.insight}</p>
        </aside>
      ) : null}

      {error ? (
        <ReportCard title="Couldn't load reports">
          <EmptyState
            title="Couldn't load performance data"
            description="Refresh to try again."
            size="compact"
            action={
              <Button variant="secondary" size="sm" onClick={() => void load()}>
                Retry
              </Button>
            }
          />
        </ReportCard>
      ) : null}

      {loading && !data ? <ReportsSkeleton /> : null}

      {data && tab === "overview" ? (
        <OverviewTab
          data={data}
          periodLabel={periodLabel}
          currency={currency}
          granularity={granularity}
          granularityOptions={granularityOptions}
          onGranularity={(g) => setGranularity(g)}
          onOpenSources={() => setTab("sources")}
          onOpenPipeline={() => setTab("pipeline")}
          onOpenActivity={() => setTab("activity")}
        />
      ) : null}

      {data && tab === "pipeline" ? <PipelineTab data={data} currency={currency} /> : null}
      {data && tab === "sources" ? <SourcesTab data={data} currency={currency} /> : null}
      {data && tab === "activity" ? <ActivityTab data={data} /> : null}
      {data && tab === "forecast" ? (
        <ReportCard title="Forecast">
          <EmptyState
            title="Forecasting is not available yet"
            description="Weighted pipeline and close forecasts need product forecasting logic first."
            size="compact"
          />
        </ReportCard>
      ) : null}
    </div>
  );
}

function OverviewTab({
  data,
  periodLabel,
  currency,
  granularity,
  granularityOptions,
  onGranularity,
  onOpenSources,
  onOpenPipeline,
  onOpenActivity,
}: {
  data: SalesReportsPayload;
  periodLabel: string;
  currency: string;
  granularity: SalesReportGranularity | "auto";
  granularityOptions: { value: SalesReportGranularity | "auto"; label: string }[];
  onGranularity: (g: SalesReportGranularity | "auto") => void;
  onOpenSources: () => void;
  onOpenPipeline: () => void;
  onOpenActivity: () => void;
}) {
  const k = data.kpis;
  const revenueLabel = currency === "USD" ? "Revenue (USD)" : `Revenue (${currency})`;
  const showProjectCol = data.topOpportunities.some(
    (r) => r.project && r.project !== "—" && r.project.trim() !== ""
  );
  const showScoreCol =
    !showProjectCol && data.topOpportunities.some((r) => r.score != null);
  const conversionPts = k.conversionRate.trend.changePct;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 items-stretch gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <ReportKpiCard
          label="Leads created"
          value={String(k.leadsCreated.value)}
          trend={trendWithVs(k.leadsCreated.trend, periodLabel)}
          icon={UsersRound}
          iconTint="bg-[#ECFDF3] text-[#16A34A]"
        />
        <ReportKpiCard
          label="Deals won"
          value={String(k.dealsWon.value)}
          supporting={
            k.dealsWon.value > 0
              ? formatDealCurrency(k.dealsWon.wonValue, { currency })
              : undefined
          }
          trend={trendWithVs(k.dealsWon.trend, periodLabel)}
          icon={Trophy}
          iconTint="bg-[#EFF6FF] text-[#2563EB]"
        />
        <ReportKpiCard
          label="Pipeline value"
          value={formatDealCurrency(k.pipelineValue.value, { currency })}
          tip="Current value of your open assigned deals (point-in-time, not period total)."
          trend={trendWithVs(k.pipelineValue.trend, periodLabel)}
          icon={CircleDollarSign}
          iconTint="bg-[#F5F3FF] text-[#7C3AED]"
        />
        <ReportKpiCard
          label="Conversion rate"
          value={formatPercent(k.conversionRate.value)}
          supporting={k.conversionRate.supporting}
          tip="Deals won divided by deals closed (won + lost) during the selected period."
          trend={
            conversionPts == null || k.conversionRate.trend.direction === "none"
              ? null
              : {
                  direction: k.conversionRate.trend.direction,
                  label: `${conversionPts > 0 ? "+" : ""}${conversionPts} pts ${vsLabel(periodLabel)}`,
                }
          }
          icon={TrendingUp}
          iconTint="bg-[#FFF7ED] text-[#EA580C]"
        />
        <ReportKpiCard
          label="Avg. response time"
          value={formatResponseTime(k.avgResponseMinutes.value)}
          supporting={k.avgResponseMinutes.supporting}
          icon={Clock3}
          iconTint="bg-[#EFF8FF] text-[#2563EB]"
        />
        <ReportKpiCard
          label="Follow-ups completed"
          value={String(k.followUpsCompleted.value)}
          supporting={
            k.followUpsCompleted.overdue > 0 ? undefined : k.followUpsCompleted.supporting
          }
          trend={
            k.followUpsCompleted.overdue > 0
              ? { direction: "alert", label: `${k.followUpsCompleted.overdue} overdue` }
              : null
          }
          icon={CircleCheck}
          iconTint="bg-[var(--sales-brand-soft-solid,#F3FCE3)] text-[#4D7C0F]"
        />
      </div>

      <div className="grid items-stretch gap-4 lg:grid-cols-[minmax(0,1.7fr)_minmax(320px,1fr)]">
        <ReportCard
          equalHeight
          title="Performance trend"
          action={
            <MenuSelect
              aria-label="Chart granularity"
              size="sm"
              align="right"
              value={granularity}
              onChange={onGranularity}
              triggerClassName="h-9"
              options={granularityOptions}
            />
          }
        >
          <div className="mb-2 flex flex-wrap gap-3 text-[11px] text-sales-text-secondary">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-sm bg-sales-brand" /> Leads created
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-sales-info" /> Deals won
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-sales-purple" /> {revenueLabel}
            </span>
          </div>
          <div className="h-[220px]">
            <PerformanceTrendChart data={data.performanceSeries} currency={currency} />
          </div>
        </ReportCard>

        <ReportCard equalHeight title="My goal progress">
          <GoalProgress data={data} currency={currency} />
        </ReportCard>
      </div>

      <div className="grid items-stretch gap-4 md:grid-cols-2 lg:grid-cols-3">
        <ReportCard
          equalHeight
          title="Lead sources"
          footer={
            <button
              type="button"
              className="text-[12px] font-medium text-sales-brand-fg hover:underline"
              onClick={onOpenSources}
            >
              View full source report →
            </button>
          }
        >
          <LeadSourcesList data={data} />
        </ReportCard>

        <ReportCard
          equalHeight
          title="Pipeline funnel"
          footer={
            <button
              type="button"
              className="text-[12px] font-medium text-sales-brand-fg hover:underline"
              onClick={onOpenPipeline}
            >
              View pipeline report →
            </button>
          }
        >
          <FunnelView stages={data.funnel} />
        </ReportCard>

        <ReportCard
          equalHeight
          className="md:col-span-2 lg:col-span-1"
          title="Activity breakdown"
          footer={
            <button
              type="button"
              className="text-[12px] font-medium text-sales-brand-fg hover:underline"
              onClick={onOpenActivity}
            >
              View activity report →
            </button>
          }
        >
          <ActivityList items={data.activity} />
        </ReportCard>
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-12">
        <div className="flex flex-col gap-4 lg:col-span-4">
          <ReportCard
            title="Where deals pause"
            footer={
              <Link
                href="/sales/leads"
                className="text-[12px] font-medium text-sales-brand-fg hover:underline"
              >
                View details →
              </Link>
            }
          >
            <PauseList data={data} />
          </ReportCard>

          <ReportCard
            title="Follow-up performance"
            footer={
              <Link
                href="/sales/followups"
                className="text-[12px] font-medium text-sales-brand-fg hover:underline"
              >
                View insights →
              </Link>
            }
          >
            <FollowUpBlock data={data} />
          </ReportCard>
        </div>

        <div className="lg:col-span-8">
          <ReportCard
            title="Top opportunities"
            footer={
              <Link
                href="/sales/leads"
                className="text-[12px] font-medium text-sales-brand-fg hover:underline"
              >
                View all opportunities →
              </Link>
            }
          >
            <OpportunitiesTable
              rows={data.topOpportunities}
              currency={currency}
              showProject={showProjectCol}
              showScore={showScoreCol}
            />
          </ReportCard>
        </div>
      </div>
    </div>
  );
}

function GoalProgress({ data, currency }: { data: SalesReportsPayload; currency: string }) {
  const g = data.goal;

  if (!g.hasTarget) {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-sales-md bg-[#F2F4F7] text-sales-text-secondary">
            <Target size={18} strokeWidth={1.8} aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="text-[14px] font-semibold text-sales-text-primary">No monthly target assigned</p>
            <p className="mt-1 text-[12px] text-sales-text-secondary">
              Set a target to track progress toward your monthly goal.
            </p>
          </div>
        </div>
        <div className="rounded-sales-md border border-sales-border-subtle bg-sales-surface-subtle px-3 py-3">
          <p className="text-[11px] text-sales-text-muted">Revenue won this month</p>
          <p className="mt-1 text-[22px] font-semibold tabular-nums text-sales-success">
            {formatDealCurrency(g.achieved, { currency })}
          </p>
        </div>
        <Link
          href="/sales/goals"
          className="inline-flex h-10 items-center justify-center rounded-[9px] bg-sales-brand px-3.5 text-[13px] font-semibold text-sales-brand-text hover:bg-sales-brand-hover"
        >
          Set goal
        </Link>
      </div>
    );
  }

  const r = 42;
  const c = 2 * Math.PI * r;
  return (
    <div>
      <div className="flex items-center gap-5">
        <div className="relative flex h-[100px] w-[100px] shrink-0 items-center justify-center">
          <svg width="100" height="100" viewBox="0 0 108 108" aria-hidden>
            <circle cx="54" cy="54" r={r} fill="none" stroke="#EAECF0" strokeWidth={8} />
            <circle
              cx="54"
              cy="54"
              r={r}
              fill="none"
              stroke="#D4FF4F"
              strokeWidth={8}
              strokeLinecap="round"
              strokeDasharray={c}
              strokeDashoffset={c - (g.progressPct / 100) * c}
              transform="rotate(-90 54 54)"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-[20px] font-semibold tabular-nums text-sales-text-primary">
              {g.progressPct}%
            </span>
            <span className="text-[10px] font-medium text-sales-text-muted">of target</span>
          </div>
        </div>
        <dl className="min-w-0 flex-1 divide-y divide-sales-border-subtle">
          <div className="flex items-baseline justify-between gap-3 py-2 first:pt-0">
            <dt className="text-[12px] text-sales-text-muted">Target</dt>
            <dd className="text-[13px] font-semibold tabular-nums">
              {formatDealCurrency(g.target, { currency })}
            </dd>
          </div>
          <div className="flex items-baseline justify-between gap-3 py-2">
            <dt className="text-[12px] text-sales-text-muted">Achieved</dt>
            <dd className="text-[13px] font-semibold tabular-nums text-sales-success">
              {formatDealCurrency(g.achieved, { currency })}
            </dd>
          </div>
          <div className="flex items-baseline justify-between gap-3 py-2 last:pb-0">
            <dt className="text-[12px] text-sales-text-muted">Remaining</dt>
            <dd className="text-[13px] font-semibold tabular-nums">
              {formatDealCurrency(g.remaining, { currency })}
            </dd>
          </div>
        </dl>
      </div>
      <div className="mt-3">
        <Progress value={g.progressPct} />
      </div>
      <div className="mt-4 h-[100px]">
        <SalesAreaChart
          data={g.series}
          emptyTitle="No goal progress data yet"
          emptyDescription="Won deals will chart your progress through the period."
        />
      </div>
      <Link
        href="/sales/goals"
        className="mt-3 inline-block text-[12px] font-medium text-sales-brand-fg hover:underline"
      >
        View full goal →
      </Link>
    </div>
  );
}

const SOURCE_BAR: Record<string, string> = {
  whatsapp: "#25D366",
  facebook: "#1877F2",
  referral: "#8B5CF6",
  website: "#F59E0B",
  manual: "#667085",
  other: "#98A2B3",
};

function LeadSourcesList({ data }: { data: SalesReportsPayload }) {
  const items = data.leadSources.items.filter((s) => s.count > 0);
  if (data.leadSources.total === 0 || items.length === 0) {
    return (
      <p className="py-6 text-center text-[13px] text-sales-text-muted">
        No lead-source data for this period.
      </p>
    );
  }
  return (
    <ul className="space-y-2.5">
      {items.map((s) => (
        <li key={s.key}>
          <div className="mb-1 flex items-center justify-between gap-2 text-[13px]">
            <span className="inline-flex min-w-0 items-center gap-2 font-medium text-sales-text-primary">
              <SourceIcon sourceKey={s.key} />
              <span className="truncate">{s.label}</span>
            </span>
            <span className="shrink-0 tabular-nums text-sales-text-secondary">
              {s.count}
              <span className="ml-2 text-sales-text-muted">{s.pct}%</span>
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-[#EAECF0]">
            <div
              className="h-full rounded-full"
              style={{
                width: `${Math.max(s.pct, 4)}%`,
                background: SOURCE_BAR[s.key] ?? "#D4FF4F",
              }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

function FunnelView({
  stages,
}: {
  stages: SalesReportsPayload["funnel"];
}) {
  return (
    <div className="grid grid-cols-5 gap-1">
      {stages.map((stage, i) => (
        <div key={stage.id} className="min-w-0">
          <div
            className="flex min-h-[76px] flex-col items-center justify-center rounded-sales-md px-1 py-2 text-center"
            style={{ background: `${stage.color}14` }}
          >
            <p className="truncate text-[10px] font-medium text-sales-text-secondary">{stage.label}</p>
            <p className="mt-1 text-[18px] font-semibold tabular-nums text-sales-text-primary">
              {stage.count}
            </p>
            <p className="mt-0.5 text-[9px] tabular-nums text-sales-text-muted">
              {i === 0
                ? "\u00a0"
                : stage.rateOfPrevious == null
                  ? "—"
                  : `${stage.rateOfPrevious}% of prev`}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

function ActivityList({ items }: { items: SalesReportsPayload["activity"] }) {
  const iconFor = (key: string) => {
    if (key === "calls") return <Phone size={14} strokeWidth={1.8} className="text-sales-text-secondary" />;
    if (key === "whatsapp") return <BrandIcon brand="whatsapp" size={14} />;
    if (key === "quotes") return <FileText size={14} strokeWidth={1.8} className="text-sales-text-secondary" />;
    if (key === "site_visits") return <MapPin size={14} strokeWidth={1.8} className="text-sales-text-secondary" />;
    return <CalendarClock size={14} strokeWidth={1.8} className="text-sales-text-secondary" />;
  };
  if (items.every((i) => i.count === 0)) {
    return (
      <p className="py-8 text-center text-[13px] text-sales-text-muted">
        No activity logged in this period.
      </p>
    );
  }
  return (
    <ul className="space-y-1">
      {items.map((a) => (
        <li key={a.key} className="flex h-[36px] items-center gap-2.5">
          <span className="flex w-5 shrink-0 justify-center">{iconFor(a.key)}</span>
          <span className="w-[118px] shrink-0 truncate text-[13px] font-medium text-sales-text-primary">
            {a.label}
          </span>
          <div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-[#EAECF0]">
            <div
              className="h-full rounded-full bg-sales-brand"
              style={{ width: `${a.count > 0 ? Math.max(a.relative, 4) : 0}%` }}
            />
          </div>
          <span className="w-8 shrink-0 text-right text-[13px] font-semibold tabular-nums">
            {a.count}
          </span>
        </li>
      ))}
    </ul>
  );
}

function PauseList({ data }: { data: SalesReportsPayload }) {
  if (data.dealPauses.items.length === 0) {
    return (
      <p className="py-8 text-center text-[13px] text-sales-text-muted">
        Not enough deal-pause data yet.
      </p>
    );
  }
  return (
    <ul className="space-y-3">
      {data.dealPauses.items.map((p) => (
        <li key={p.key}>
          <div className="mb-1 flex items-center justify-between gap-2 text-[13px]">
            <span className="font-medium text-sales-text-primary">{p.label}</span>
            <span className="tabular-nums text-sales-text-secondary">
              {p.count}
              <span className="ml-2 text-sales-text-muted">{p.pct}%</span>
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-[#EAECF0]">
            <div
              className="h-full rounded-full bg-sales-warning"
              style={{ width: `${Math.min(Math.max(p.pct, p.count > 0 ? 4 : 0), 72)}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

function FollowUpBlock({ data }: { data: SalesReportsPayload }) {
  const f = data.followUpPerformance;
  return (
    <div className="grid grid-cols-2 gap-2.5">
      <MetricMini
        label="Due today"
        value={String(f.dueToday)}
        href="/sales/followups"
        linkLabel="View list"
        icon={<CalendarClock size={14} strokeWidth={1.8} className="text-sales-info" />}
      />
      <MetricMini
        label="Completed this week"
        value={String(f.completedThisWeek)}
        href="/sales/followups"
        linkLabel="View list"
        icon={<CircleCheck size={14} strokeWidth={1.8} className="text-sales-success" />}
      />
      <MetricMini
        label="Overdue"
        value={String(f.overdue)}
        href="/sales/followups"
        linkLabel="View list"
        warn={f.overdue > 0}
        icon={<Clock3 size={14} strokeWidth={1.8} className="text-sales-warning" />}
      />
      {f.bestTimeAvailable && f.bestTime ? (
        <MetricMini
          label="Best time to follow up"
          value={f.bestTime}
          icon={<TrendingUp size={14} strokeWidth={1.8} className="text-sales-purple" />}
        />
      ) : (
        <div className="rounded-sales-md border border-sales-border-subtle bg-sales-surface px-3 py-3">
          <div className="flex items-start justify-between gap-2">
            <p className="text-[11px] text-sales-text-muted">Best time to follow up</p>
            <TrendingUp size={14} strokeWidth={1.8} className="text-sales-purple" aria-hidden />
          </div>
          <p className="mt-2 text-[20px] font-semibold text-sales-text-primary">—</p>
          <p className="mt-1 text-[12px] leading-snug text-sales-text-secondary">
            Not enough activity data yet
          </p>
        </div>
      )}
    </div>
  );
}

function MetricMini({
  label,
  value,
  href,
  linkLabel,
  warn,
  icon,
}: {
  label: string;
  value: string;
  href?: string;
  linkLabel?: string;
  warn?: boolean;
  icon?: ReactNode;
}) {
  return (
    <div className="rounded-sales-md border border-sales-border-subtle bg-sales-surface px-3 py-3">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] text-sales-text-muted">{label}</p>
        {icon}
      </div>
      <p
        className={`mt-1.5 text-[22px] font-semibold tabular-nums text-sales-text-primary ${
          warn ? "text-sales-warning" : ""
        }`}
      >
        {value}
      </p>
      {href && linkLabel ? (
        <Link
          href={href}
          className="mt-1.5 inline-block text-[11px] font-medium text-sales-brand-fg hover:underline"
        >
          {linkLabel}
        </Link>
      ) : null}
    </div>
  );
}

function OpportunitiesTable({
  rows,
  currency,
  showProject = true,
  showScore = false,
}: {
  rows: SalesReportsPayload["topOpportunities"];
  currency: string;
  showProject?: boolean;
  showScore?: boolean;
}) {
  if (rows.length === 0) {
    return (
      <p className="py-8 text-center text-[13px] text-sales-text-muted">
        No active opportunities right now.
      </p>
    );
  }

  return (
    <>
      <div className="hidden md:block">
        <DataTable className="border-0 shadow-none">
          <DataTableEl className="table-fixed w-full min-w-0">
            <DataTableHead>
              <tr>
                <DataTableTh className="w-[28%]">Customer</DataTableTh>
                {showProject ? <DataTableTh className="w-[22%]">Project</DataTableTh> : null}
                {showScore ? <DataTableTh className="w-[12%]">Score</DataTableTh> : null}
                <DataTableTh className="w-[17%]">Stage</DataTableTh>
                <DataTableTh className="w-[14%]">Value</DataTableTh>
                <DataTableTh className="w-[16%]">Last activity</DataTableTh>
              </tr>
            </DataTableHead>
            <DataTableBody>
              {rows.map((row) => (
                <DataTableRow
                  key={row.id}
                  className="h-12 cursor-pointer"
                  onClick={() => {
                    window.location.href = row.href;
                  }}
                >
                  <DataTableTd>
                    <LeadIdentity name={row.name} size="sm" href={row.href} />
                  </DataTableTd>
                  {showProject ? (
                    <DataTableTd className="truncate text-sales-text-secondary" title={row.project}>
                      {row.project}
                    </DataTableTd>
                  ) : null}
                  {showScore ? (
                    <DataTableTd className="tabular-nums text-sales-text-secondary">
                      {row.score ?? "—"}
                    </DataTableTd>
                  ) : null}
                  <DataTableTd>
                    <PipelineStageBadge status={row.status} label={formatStageLabel(row.status)} />
                  </DataTableTd>
                  <DataTableTd>
                    <span className="font-semibold tabular-nums">
                      {row.value > 0 ? formatDealCurrency(row.value, { currency }) : "—"}
                    </span>
                  </DataTableTd>
                  <DataTableTd className="text-sales-text-muted">
                    {formatRelativeTime(row.lastActivity)}
                  </DataTableTd>
                </DataTableRow>
              ))}
            </DataTableBody>
          </DataTableEl>
        </DataTable>
      </div>
      <div className="space-y-2 md:hidden">
        {rows.map((row) => (
          <Link
            key={row.id}
            href={row.href}
            className="block rounded-sales-md border border-sales-border-subtle px-3 py-3 hover:bg-sales-surface-hover"
          >
            <div className="flex items-start justify-between gap-2">
              <LeadIdentity name={row.name} size="sm" />
              <PipelineStageBadge status={row.status} label={formatStageLabel(row.status)} />
            </div>
            <dl className="mt-2.5 grid grid-cols-2 gap-x-3 gap-y-1.5 text-[12px]">
              {showProject ? (
                <>
                  <dt className="text-sales-text-muted">Project</dt>
                  <dd className="text-right text-sales-text-secondary">{row.project}</dd>
                </>
              ) : null}
              {showScore ? (
                <>
                  <dt className="text-sales-text-muted">Score</dt>
                  <dd className="text-right tabular-nums text-sales-text-secondary">
                    {row.score ?? "—"}
                  </dd>
                </>
              ) : null}
              <dt className="text-sales-text-muted">Value</dt>
              <dd className="text-right font-semibold tabular-nums text-sales-text-primary">
                {row.value > 0 ? formatDealCurrency(row.value, { currency }) : "—"}
              </dd>
              <dt className="text-sales-text-muted">Last activity</dt>
              <dd className="text-right text-sales-text-secondary">
                {formatRelativeTime(row.lastActivity)}
              </dd>
            </dl>
          </Link>
        ))}
      </div>
    </>
  );
}

function PipelineTab({ data, currency }: { data: SalesReportsPayload; currency: string }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <ReportCard title="Pipeline by stage">
        <ul className="space-y-3">
          {data.pipelineByStage.map((s) => (
            <li key={s.id} className="flex items-center justify-between gap-3 text-[13px]">
              <span className="inline-flex items-center gap-2 font-medium">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: s.color }} />
                {s.label}
              </span>
              <span className="tabular-nums text-sales-text-secondary">
                {s.count} · {s.value > 0 ? formatDealCurrency(s.value, { currency }) : "—"}
              </span>
            </li>
          ))}
        </ul>
      </ReportCard>
      <ReportCard title="Stage conversion">
        <FunnelView stages={data.funnel} />
      </ReportCard>
      <ReportCard title="Top active deals" className="lg:col-span-2">
        <OpportunitiesTable rows={data.topOpportunities} currency={currency} />
      </ReportCard>
    </div>
  );
}

function SourcesTab({ data, currency }: { data: SalesReportsPayload; currency: string }) {
  const rows = data.sourcesDetail.filter(
    (s) => s.leadsCreated > 0 || s.dealsWon > 0
  );
  if (rows.length === 0) {
    return (
      <ReportCard title="Sources">
        <EmptyState
          title="No lead-source data for this period"
          description="Try a wider date range."
          size="compact"
        />
      </ReportCard>
    );
  }
  return (
    <ReportCard title="Performance by source">
      <div className="space-y-2 md:hidden">
        {rows.map((s) => (
          <article
            key={s.key}
            className="rounded-[12px] border border-sales-border bg-sales-surface px-3.5 py-3"
          >
            <div className="flex items-center gap-2 font-medium text-sales-text-primary">
              <SourceIcon sourceKey={s.key} />
              {s.label}
            </div>
            <dl className="mt-2.5 grid grid-cols-2 gap-2 text-[12px]">
              <div>
                <dt className="text-sales-text-muted">Leads</dt>
                <dd className="font-semibold tabular-nums text-sales-text-primary">{s.leadsCreated}</dd>
              </div>
              <div>
                <dt className="text-sales-text-muted">Won</dt>
                <dd className="font-semibold tabular-nums text-sales-text-primary">{s.dealsWon}</dd>
              </div>
              <div>
                <dt className="text-sales-text-muted">Won value</dt>
                <dd className="font-semibold tabular-nums text-sales-text-primary">
                  {s.wonValue > 0 ? formatDealCurrency(s.wonValue, { currency }) : "—"}
                </dd>
              </div>
              <div>
                <dt className="text-sales-text-muted">Conversion</dt>
                <dd className="font-semibold tabular-nums text-sales-text-primary">
                  {formatPercent(s.conversionRate)}
                </dd>
              </div>
            </dl>
          </article>
        ))}
      </div>
      <DataTable className="hidden border-0 shadow-none md:block">
        <DataTableEl className="min-w-[560px]">
          <DataTableHead>
            <tr>
              <DataTableTh>Source</DataTableTh>
              <DataTableTh>Leads created</DataTableTh>
              <DataTableTh>Deals won</DataTableTh>
              <DataTableTh>Won value</DataTableTh>
              <DataTableTh>Conversion</DataTableTh>
            </tr>
          </DataTableHead>
          <DataTableBody>
            {rows.map((s) => (
              <DataTableRow key={s.key}>
                <DataTableTd>
                  <span className="inline-flex items-center gap-2 font-medium">
                    <SourceIcon sourceKey={s.key} />
                    {s.label}
                  </span>
                </DataTableTd>
                <DataTableTd className="tabular-nums">{s.leadsCreated}</DataTableTd>
                <DataTableTd className="tabular-nums">{s.dealsWon}</DataTableTd>
                <DataTableTd className="tabular-nums">
                  {s.wonValue > 0 ? formatDealCurrency(s.wonValue, { currency }) : "—"}
                </DataTableTd>
                <DataTableTd className="tabular-nums">
                  {formatPercent(s.conversionRate)}
                </DataTableTd>
              </DataTableRow>
            ))}
          </DataTableBody>
        </DataTableEl>
      </DataTable>
    </ReportCard>
  );
}

function ActivityTab({ data }: { data: SalesReportsPayload }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <ReportCard title="Activity breakdown">
        <ActivityList items={data.activity} />
      </ReportCard>
      <ReportCard title="Follow-up performance">
        <FollowUpBlock data={data} />
      </ReportCard>
    </div>
  );
}

function ReportsSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-[108px] rounded-sales-xl" />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.7fr)_minmax(320px,1fr)]">
        <Skeleton className="h-[340px] rounded-sales-xl" />
        <Skeleton className="h-[340px] rounded-sales-xl" />
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Skeleton className="h-[260px] rounded-sales-xl" />
        <Skeleton className="h-[260px] rounded-sales-xl" />
        <Skeleton className="h-[260px] rounded-sales-xl" />
      </div>
      <div className="grid items-start gap-4 lg:grid-cols-12">
        <div className="flex flex-col gap-4 lg:col-span-4">
          <Skeleton className="h-[250px] rounded-sales-xl" />
          <Skeleton className="h-[270px] rounded-sales-xl" />
        </div>
        <Skeleton className="h-[380px] lg:col-span-8 rounded-sales-xl" />
      </div>
    </div>
  );
}
