"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { format, parseISO } from "date-fns";
import {
  ArrowUpRight,
  Check,
  Circle,
  Globe,
  MoreHorizontal,
  Pencil,
  Plus,
  Target,
  Trophy,
  Users,
} from "lucide-react";
import { SiFacebook, SiWhatsapp } from "react-icons/si";
import {
  Button,
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
  EmptyState,
  MenuSelect,
  Skeleton,
  useSalesToast,
} from "@/components/sales/ui";
import {
  GoalComparisonBars,
  GoalProgressChart,
  GoalProgressRing,
  GoalSourceDonut,
  SOURCE_COLORS,
} from "@/components/sales/goals/GoalCharts";
import { SetGoalDialog } from "@/components/sales/goals/SetGoalDialog";
import { formatDealCurrency } from "@/lib/sales/format";
import { formatGoalDate } from "@/lib/sales/goals/period";
import type { SalesGoalsPayload } from "@/lib/sales/goals/types";
import { cn } from "@/lib/ui/cn";

function SourceIcon({ sourceKey }: { sourceKey: string }) {
  if (sourceKey === "whatsapp") return <SiWhatsapp size={14} color="#25D366" aria-hidden />;
  if (sourceKey === "facebook") return <SiFacebook size={14} color="#2684FF" aria-hidden />;
  if (sourceKey === "referral") return <Users size={14} strokeWidth={1.8} className="text-[#8B5CF6]" />;
  if (sourceKey === "website") return <Globe size={14} strokeWidth={1.8} className="text-[#F59E0B]" />;
  return <MoreHorizontal size={14} strokeWidth={1.8} className="text-sales-text-muted" />;
}

export function SalesGoalsClient() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { toast } = useSalesToast();
  const periodParam = searchParams.get("period");

  const [data, setData] = useState<SalesGoalsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sheet, setSheet] = useState<"create" | "edit" | null>(null);

  const setPeriod = useCallback(
    (period: string) => {
      const sp = new URLSearchParams(searchParams.toString());
      sp.set("period", period);
      router.replace(`${pathname}?${sp.toString()}`);
    },
    [pathname, router, searchParams]
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const q = periodParam ? `?period=${encodeURIComponent(periodParam)}` : "";
      const res = await fetch(`/api/sales/goals${q}`);
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        const code = (json as { code?: string }).code;
        setError(
          code === "GOALS_SCHEMA_MISSING"
            ? "Goals database table is missing. Apply migration 086_sales_goals.sql, then retry."
            : ((json as { error?: string }).error ?? "Couldn't load goal progress.")
        );
        setData(null);
        return;
      }
      setData(json as SalesGoalsPayload);
    } catch {
      setError("Couldn't load goal progress.");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [periodParam]);

  useEffect(() => {
    void load();
  }, [load]);

  const hasGoal = !!data?.goal;
  const currency = data?.currency ?? "USD";

  return (
    <div className="w-full space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-[14px] font-semibold text-sales-text-primary">Monthly goal overview</h2>
        </div>
        <div className="flex items-center gap-2">
          {data?.periodOptions?.length ? (
            <MenuSelect
              aria-label="Goal period"
              value={data.periodKey}
              onChange={setPeriod}
              options={data.periodOptions.map((o) => ({
                value: o.value,
                label: o.label,
              }))}
            />
          ) : null}
          {hasGoal && data?.goal?.editable ? (
            <Button
              variant="primary"
              size="md"
              leftIcon={<Pencil size={14} strokeWidth={1.8} />}
              onClick={() => setSheet("edit")}
            >
              Edit goal
            </Button>
          ) : !hasGoal ? (
            <Button
              variant="primary"
              size="md"
              leftIcon={<Plus size={14} strokeWidth={1.8} />}
              onClick={() => setSheet("create")}
            >
              Set goal
            </Button>
          ) : null}
        </div>
      </div>

      {loading && !data ? <GoalsSkeleton /> : null}

      {error && !data ? (
        <Card>
          <CardContent className="py-10">
            <EmptyState
              title="Couldn't load goal progress"
              description={error}
              action={
                <Button variant="secondary" size="sm" onClick={() => void load()}>
                  Retry
                </Button>
              }
            />
          </CardContent>
        </Card>
      ) : null}

      {data && data.lifecycle === "no_goal" ? (
        <NoGoalState
          data={data}
          onSetGoal={() => setSheet("create")}
        />
      ) : null}

      {data && data.goal && data.lifecycle === "upcoming" ? (
        <UpcomingGoal data={data} onEdit={() => setSheet("edit")} />
      ) : null}

      {data && data.goal && data.lifecycle !== "no_goal" && data.lifecycle !== "upcoming" ? (
        <>
          {(data.lifecycle === "completed_success" || data.progress.aboveTarget > 0) &&
          data.progress.progressPct >= 100 ? (
            <div className="flex min-h-[48px] items-center gap-3 rounded-[12px] border border-[#D1FADF] bg-[#F6FEF9] px-3.5 py-2.5">
              <Trophy size={16} strokeWidth={1.8} className="shrink-0 text-[#027A48]" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-semibold text-sales-text-primary">Goal achieved</p>
                <p className="text-[12px] text-sales-text-secondary">
                  {data.progress.aboveTarget > 0
                    ? `You've exceeded your ${data.periodLabel} target by ${formatDealCurrency(data.progress.aboveTarget, { currency })}.`
                    : `You've hit your ${data.periodLabel} revenue target.`}
                </p>
              </div>
            </div>
          ) : null}

          <div className="grid items-stretch gap-4 xl:grid-cols-12">
            <Card className="xl:col-span-9">
              <CardContent className="flex h-full min-h-[300px] flex-col gap-4 p-4 lg:flex-row lg:items-stretch lg:gap-5 lg:p-5">
                <div className="flex flex-col items-center justify-center gap-4 lg:w-[28%] lg:flex-col lg:items-center">
                  <GoalProgressRing pct={data.progress.progressPct} />
                  <dl className="w-full max-w-[200px] space-y-3">
                    <div>
                      <dd className="text-[22px] font-semibold tabular-nums tracking-[-0.03em] text-sales-text-primary">
                        {formatDealCurrency(data.progress.achieved, { currency })}
                      </dd>
                      <dt className="text-[12px] text-sales-text-muted">achieved</dt>
                    </div>
                    <div>
                      <dd className="text-[16px] font-semibold tabular-nums text-sales-text-primary">
                        {formatDealCurrency(data.goal.target, { currency })}
                      </dd>
                      <dt className="text-[12px] text-sales-text-muted">monthly target</dt>
                    </div>
                    <div>
                      <dd className="text-[16px] font-semibold tabular-nums text-[#8B5CF6]">
                        {data.lifecycle === "completed_shortfall"
                          ? formatDealCurrency(data.progress.shortfall, { currency })
                          : data.progress.aboveTarget > 0
                            ? `+${formatDealCurrency(data.progress.aboveTarget, { currency })}`
                            : formatDealCurrency(data.progress.remaining, { currency })}
                      </dd>
                      <dt className="text-[12px] text-sales-text-muted">
                        {data.lifecycle === "completed_shortfall"
                          ? "short of target"
                          : data.progress.aboveTarget > 0
                            ? "above target"
                            : "remaining"}
                      </dt>
                    </div>
                  </dl>
                </div>
                <div className="min-w-0 flex-1 lg:w-[72%]">
                  <p className="mb-2 text-[13px] font-semibold text-sales-text-primary">
                    Progress over time
                  </p>
                  {data.progress.achieved === 0 ? (
                    <div className="flex h-[200px] flex-col items-center justify-center rounded-[10px] border border-dashed border-sales-border bg-[#FAFBFC] px-4 text-center">
                      <p className="text-[13px] font-medium text-sales-text-primary">
                        No revenue won yet this month
                      </p>
                      <p className="mt-1 text-[12px] text-sales-text-muted">
                        Your progress will update when a deal is marked Won.
                      </p>
                    </div>
                  ) : (
                    <div className="h-[200px]">
                      <GoalProgressChart
                        series={data.series}
                        target={data.goal.target}
                        currency={currency}
                      />
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <GoalDetailsCard
              data={data}
              onEdit={data.goal.editable ? () => setSheet("edit") : undefined}
            />
          </div>

          <div className="grid items-stretch gap-4 md:grid-cols-2 xl:grid-cols-3">
            <ProgressBySourceCard data={data} />
            <PeriodComparisonCard data={data} />
            <GoalMilestonesCard data={data} />
          </div>

          <div className="grid items-stretch gap-4 xl:grid-cols-12">
            <RecentActivityCard data={data} />
            <TipsCard data={data} />
          </div>
        </>
      ) : null}

      {sheet ? (
        <SetGoalDialog
          mode={sheet}
          goalId={data?.goal?.id}
          initialPeriodKey={data?.periodKey ?? periodParam ?? ""}
          initialTarget={data?.goal?.target}
          currency={currency}
          onClose={() => setSheet(null)}
          onSuccess={({ periodKey, mode, target }) => {
            toast({
              tone: "success",
              title: mode === "create" ? "Goal set" : "Goal updated",
              description:
                mode === "create"
                  ? `Your ${goalPeriodBoundsLabel(periodKey)} revenue target is ${formatDealCurrency(target, { currency })}.`
                  : "Your monthly revenue target has been updated.",
            });
            setPeriod(periodKey);
            void load();
          }}
        />
      ) : null}
    </div>
  );
}

function goalPeriodBoundsLabel(periodKey: string) {
  try {
    const [y, m] = periodKey.split("-").map(Number);
    return format(new Date(y!, m! - 1, 1), "MMMM");
  } catch {
    return "monthly";
  }
}

function GoalsSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 xl:grid-cols-12">
        <Skeleton className="h-[300px] rounded-[12px] xl:col-span-9" />
        <Skeleton className="h-[300px] rounded-[12px] xl:col-span-3" />
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <Skeleton className="h-[260px] rounded-[12px]" />
        <Skeleton className="h-[260px] rounded-[12px]" />
        <Skeleton className="h-[260px] rounded-[12px]" />
      </div>
    </div>
  );
}

function NoGoalState({
  data,
  onSetGoal,
}: {
  data: SalesGoalsPayload;
  onSetGoal: () => void;
}) {
  const currency = data.currency;
  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="flex flex-col items-center px-6 py-12 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[rgba(212,255,79,0.22)] text-sales-text-primary">
            <Target size={22} strokeWidth={1.8} aria-hidden />
          </span>
          <h3 className="mt-4 text-[18px] font-semibold text-sales-text-primary">
            No sales goal set for {data.periodLabel.split(" ")[0]}
          </h3>
          <p className="mt-2 max-w-md text-[13px] text-sales-text-secondary">
            Set a revenue target to track your progress throughout the month. Won deals update your
            goal automatically.
          </p>
          <Button
            variant="primary"
            className="mt-5"
            leftIcon={<Plus size={14} strokeWidth={1.8} />}
            onClick={onSetGoal}
          >
            Set goal
          </Button>
        </CardContent>
      </Card>

      <div>
        <h3 className="mb-3 text-[14px] font-semibold text-sales-text-primary">
          Current performance
        </h3>
        <div className="grid gap-3 sm:grid-cols-3">
          <PerfTile
            label="Revenue won"
            value={formatDealCurrency(data.currentPerformance.revenueWon, { currency })}
          />
          <PerfTile label="Deals won" value={String(data.currentPerformance.dealsWon)} />
          <PerfTile
            label="Pipeline value"
            value={formatDealCurrency(data.currentPerformance.pipelineValue, { currency })}
          />
        </div>
      </div>
    </div>
  );
}

function PerfTile({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-[12px] text-sales-text-muted">{label}</p>
        <p className="mt-1 text-[22px] font-semibold tabular-nums text-sales-text-primary">{value}</p>
      </CardContent>
    </Card>
  );
}

function UpcomingGoal({
  data,
  onEdit,
}: {
  data: SalesGoalsPayload;
  onEdit: () => void;
}) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[12px] font-medium uppercase tracking-[0.04em] text-sales-text-muted">
            Upcoming
          </p>
          <h3 className="mt-1 text-[18px] font-semibold text-sales-text-primary">
            {data.periodLabel} goal
          </h3>
          <p className="mt-1 text-[13px] text-sales-text-secondary">
            Starts {formatGoalDate(data.periodStart)} · Target{" "}
            {formatDealCurrency(data.goal!.target, { currency: data.currency })}
          </p>
        </div>
        {data.goal?.editable ? (
          <Button variant="secondary" onClick={onEdit} leftIcon={<Pencil size={14} />}>
            Edit goal
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}

function GoalDetailsCard({
  data,
  onEdit,
}: {
  data: SalesGoalsPayload;
  onEdit?: () => void;
}) {
  const g = data.goal!;
  const rows = [
    { label: "Goal type", value: g.goalTypeLabel },
    { label: "Time period", value: g.periodTypeLabel },
    {
      label: "Target amount",
      value: formatDealCurrency(g.target, { currency: data.currency }),
    },
    { label: "Start date", value: formatGoalDate(g.periodStart) },
    { label: "End date", value: formatGoalDate(g.periodEnd) },
    {
      label: "Status",
      value:
        g.status === "COMPLETED"
          ? "Completed"
          : data.lifecycle === "completed_success"
            ? "Achieved"
            : "Active",
    },
  ];
  return (
    <Card className="xl:col-span-3">
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
        <CardTitle className="text-[14px]">Goal details</CardTitle>
        {onEdit ? (
          <button
            type="button"
            className="rounded-[8px] p-1.5 text-sales-text-muted hover:bg-sales-surface-hover hover:text-sales-text-primary"
            aria-label="Edit sales goal"
            onClick={onEdit}
          >
            <Pencil size={14} strokeWidth={1.8} />
          </button>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-0 px-4 pb-4">
        {rows.map((r) => (
          <div
            key={r.label}
            className="flex items-baseline justify-between gap-3 border-b border-sales-border-subtle py-2.5 last:border-0"
          >
            <span className="text-[12px] text-sales-text-muted">{r.label}</span>
            <span className="text-right text-[13px] font-medium text-sales-text-primary">
              {r.value}
            </span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function ProgressBySourceCard({ data }: { data: SalesGoalsPayload }) {
  const currency = data.currency;
  return (
    <Card className="flex h-full min-h-[260px] flex-col">
      <CardHeader className="pb-2">
        <CardTitle className="text-[14px]">Progress by source</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col">
        {data.progress.achieved <= 0 || data.sources.length === 0 ? (
          <EmptyState
            size="compact"
            title="No won revenue yet"
            description="Revenue contribution by lead source will appear here."
          />
        ) : data.sources.length === 1 ? (
          <ul className="space-y-2.5">
            {data.sources.map((s) => (
              <li key={s.key} className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-2 text-[13px] text-sales-text-primary">
                  <SourceIcon sourceKey={s.key} />
                  {s.label}
                </span>
                <span className="text-[13px] font-semibold tabular-nums">
                  {formatDealCurrency(s.value, { currency })} · {s.pct}%
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center">
            <GoalSourceDonut
              slices={data.sources}
              centerValue={data.progress.achieved}
              currency={currency}
            />
            <ul className="min-w-0 flex-1 space-y-2">
              {data.sources.map((s) => (
                <li key={s.key} className="flex items-center justify-between gap-2 text-[12px]">
                  <span className="inline-flex min-w-0 items-center gap-2 text-sales-text-secondary">
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ background: SOURCE_COLORS[s.key] ?? "#98A2B3" }}
                    />
                    <SourceIcon sourceKey={s.key} />
                    <span className="truncate">{s.label}</span>
                  </span>
                  <span className="shrink-0 tabular-nums font-medium text-sales-text-primary">
                    {formatDealCurrency(s.value, { currency })} · {s.pct}%
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
      <CardFooter>
        <Link
          href="/sales/reports?tab=sources"
          className="text-[12px] font-medium text-sales-brand-fg hover:underline"
        >
          View full source report →
        </Link>
      </CardFooter>
    </Card>
  );
}

function PeriodComparisonCard({ data }: { data: SalesGoalsPayload }) {
  const currency = data.currency;
  const t = data.comparison.trend;
  return (
    <Card className="flex h-full min-h-[260px] flex-col">
      <CardHeader className="pb-2">
        <CardTitle className="text-[14px]">This month vs last month</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-[22px] font-semibold tabular-nums text-sales-text-primary">
              {formatDealCurrency(data.comparison.thisMonth, { currency })}
            </p>
            <p className="text-[12px] text-sales-text-muted">This month</p>
          </div>
          <div className="text-right">
            {t.direction === "up" || t.direction === "down" ? (
              <p
                className={cn(
                  "inline-flex items-center gap-0.5 text-[13px] font-semibold",
                  t.direction === "up" ? "text-sales-success" : "text-sales-danger"
                )}
              >
                {t.direction === "up" ? <ArrowUpRight size={14} /> : null}
                {t.label}
              </p>
            ) : (
              <p className="text-[13px] font-medium text-sales-text-muted">{t.label}</p>
            )}
            <p className="text-[12px] text-sales-text-muted">
              vs last month · {formatDealCurrency(data.comparison.lastMonth, { currency })}
            </p>
          </div>
        </div>
        <div className="mt-3 flex-1">
          <GoalComparisonBars weeks={data.comparison.weeks} currency={currency} />
        </div>
      </CardContent>
    </Card>
  );
}

function GoalMilestonesCard({ data }: { data: SalesGoalsPayload }) {
  const currency = data.currency;
  return (
    <Card className="flex h-full min-h-[260px] flex-col md:col-span-2 xl:col-span-1">
      <CardHeader className="pb-2">
        <CardTitle className="text-[14px]">Goal milestones</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2.5">
        {data.milestones.map((m) => (
          <div key={m.pct} className="flex items-start gap-2.5">
            <span
              className={cn(
                "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                m.status === "achieved"
                  ? "bg-[#ECFDF3] text-[#027A48]"
                  : m.status === "in_progress"
                    ? "bg-[#EFF8FF] text-[#2563EB]"
                    : "bg-[#F2F4F7] text-sales-text-muted"
              )}
            >
              <Trophy size={14} strokeWidth={1.8} aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-semibold tabular-nums text-sales-text-primary">
                {formatDealCurrency(m.amount, { currency })}
              </p>
              <p className="text-[11px] text-sales-text-muted">{m.pct}% of target</p>
            </div>
            <div className="shrink-0 text-right">
              {m.status === "achieved" ? (
                <>
                  <p className="inline-flex items-center gap-1 text-[12px] font-medium text-sales-success">
                    Achieved <Check size={12} strokeWidth={2.4} />
                  </p>
                  <p className="text-[11px] text-sales-text-muted">
                    {m.crossedAt ? formatGoalDate(m.crossedAt) : "—"}
                  </p>
                </>
              ) : m.status === "in_progress" ? (
                <p className="inline-flex items-center gap-1 text-[12px] font-medium text-[#2563EB]">
                  In progress <Circle size={10} strokeWidth={2} />
                </p>
              ) : (
                <p className="text-[12px] font-medium text-sales-text-muted">Pending</p>
              )}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function RecentActivityCard({ data }: { data: SalesGoalsPayload }) {
  const currency = data.currency;
  return (
    <Card className="flex min-h-[240px] flex-col xl:col-span-9">
      <CardHeader className="pb-2">
        <CardTitle className="text-[14px]">Recent activity</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 overflow-x-auto px-0">
        {data.recentDeals.length === 0 ? (
          <div className="px-4">
            <EmptyState
              size="compact"
              title="No goal activity yet"
              description="Won deals that contribute to your target will appear here."
            />
          </div>
        ) : (
          <table className="w-full min-w-[640px] border-collapse text-left">
            <thead>
              <tr className="border-y border-sales-border-subtle text-[11px] font-medium text-sales-text-muted">
                <th className="px-4 py-2">Date</th>
                <th className="px-3 py-2">Activity</th>
                <th className="px-3 py-2">Amount</th>
                <th className="px-3 py-2">Source</th>
                <th className="px-3 py-2">Customer / Deal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-sales-border-subtle">
              {data.recentDeals.map((d) => (
                <tr key={d.id} className="text-[13px]">
                  <td className="whitespace-nowrap px-4 py-2.5 text-sales-text-secondary">
                    {format(parseISO(d.wonAt), "d MMM yyyy, h:mm a")}
                  </td>
                  <td className="px-3 py-2.5 font-medium text-sales-text-primary">Deal won</td>
                  <td className="px-3 py-2.5 font-semibold tabular-nums text-sales-text-primary">
                    {formatDealCurrency(d.amount, { currency })}
                  </td>
                  <td className="px-3 py-2.5">
                    <span className="inline-flex items-center gap-1.5 text-sales-text-secondary">
                      <SourceIcon sourceKey={d.sourceKey} />
                      {d.sourceLabel}
                    </span>
                  </td>
                  <td className="max-w-[220px] truncate px-3 py-2.5 text-sales-text-primary">
                    {d.customerName}
                    {d.project ? ` — ${d.project}` : ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </CardContent>
      <CardFooter>
        <Link
          href="/sales/won-lost"
          className="text-[12px] font-medium text-sales-brand-fg hover:underline"
        >
          View all activity →
        </Link>
      </CardFooter>
    </Card>
  );
}

function TipsCard({ data }: { data: SalesGoalsPayload }) {
  return (
    <Card className="flex min-h-[240px] flex-col xl:col-span-3">
      <CardHeader className="pb-2">
        <CardTitle className="text-[14px]">Tips to hit your goal</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 space-y-3">
        {data.recommendations.map((tip) => (
          <div key={tip.id} className="flex items-start gap-2.5">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#ECFDF3] text-[#027A48]">
              <Check size={12} strokeWidth={2.4} aria-hidden />
            </span>
            {tip.href ? (
              <Link
                href={tip.href}
                className="text-[13px] leading-snug text-sales-text-primary hover:text-sales-brand-fg"
              >
                {tip.text}
              </Link>
            ) : (
              <p className="text-[13px] leading-snug text-sales-text-primary">{tip.text}</p>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
