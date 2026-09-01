"use client";

import { useEffect, useId, useMemo, useState, type LucideIcon, type ReactNode } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  formatChartAxisLabel,
  formatChartCompact,
  formatChartCurrency,
  formatChartNumber,
  formatChartPercent,
  formatChartTooltipDate,
  humanizeChartSeriesName,
} from "@/lib/sales/chart-format";
import { SALES_CHART } from "@/lib/sales/design-tokens";
import { useSalesChartColors } from "@/lib/sales/use-sales-chart-colors";
import { cn } from "@/lib/ui/cn";

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return reduced;
}

export function ChartEmptyState({
  title,
  description,
  className,
}: {
  title: string;
  description?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex h-full min-h-[120px] flex-col items-center justify-center rounded-sales-md border border-dashed border-sales-border bg-sales-surface-subtle px-4 text-center",
        className
      )}
      role="status"
    >
      <p className="text-[13px] font-medium text-sales-text-primary">{title}</p>
      {description ? (
        <p className="mt-1 text-[12px] text-sales-text-muted">{description}</p>
      ) : null}
    </div>
  );
}

export function ChartErrorState({
  title = "Could not load chart",
  description = "Try refreshing the page.",
  className,
}: {
  title?: string;
  description?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex h-full min-h-[120px] flex-col items-center justify-center rounded-sales-md border border-sales-danger/20 bg-sales-danger-soft px-4 text-center",
        className
      )}
      role="alert"
    >
      <p className="text-[13px] font-medium text-sales-text-primary">{title}</p>
      {description ? (
        <p className="mt-1 text-[12px] text-sales-text-muted">{description}</p>
      ) : null}
    </div>
  );
}

export type ChartTooltipFormat = "number" | "currency" | "percent" | "compact";

export function SalesChartTooltip({
  active,
  payload,
  label,
  currency,
  valueFormat = "number",
  labelFormatter,
  formatValue,
}: {
  active?: boolean;
  payload?: Array<{ name?: string; value?: number | string; color?: string }>;
  label?: string;
  currency?: string;
  valueFormat?: ChartTooltipFormat;
  labelFormatter?: (label: string) => string;
  formatValue?: (value: number | string | undefined, seriesName: string) => string;
}) {
  if (!active || !payload?.length) return null;

  const defaultFormatValue = (value: number | string | undefined) => {
    const n = typeof value === "number" ? value : Number(value);
    if (!Number.isFinite(n)) return String(value ?? "—");
    switch (valueFormat) {
      case "currency":
        return formatChartCurrency(n, { currency });
      case "percent":
        return formatChartPercent(n, 1);
      case "compact":
        return formatChartCompact(n);
      default:
        return formatChartNumber(n);
    }
  };

  const displayLabel = label
    ? labelFormatter
      ? labelFormatter(label)
      : formatChartTooltipDate(label)
    : null;

  return (
    <div
      className="rounded-sales-lg border border-sales-border px-3 py-2 shadow-sales-popover"
      style={{ backgroundColor: "var(--sales-chart-tooltip-bg, var(--sales-surface-raised))" }}
    >
      {displayLabel ? (
        <p className="mb-1.5 text-[11px] text-sales-text-muted">{displayLabel}</p>
      ) : null}
      <div className="space-y-1">
        {payload.map((p, i) => (
          <div key={i} className="flex items-baseline justify-between gap-4">
            <span className="flex items-center gap-1.5 text-[12px] text-sales-text-secondary">
              {p.color ? (
                <span
                  className="inline-block h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: p.color }}
                  aria-hidden
                />
              ) : null}
              {humanizeChartSeriesName(String(p.name ?? ""))}
            </span>
            <span className="text-[12px] font-medium tabular-nums text-sales-text-primary">
              {formatValue
                ? formatValue(p.value, String(p.name ?? ""))
                : defaultFormatValue(p.value)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function defaultYAxisCurrency(v: number): string {
  return formatChartCurrency(v, { compact: true });
}

export function SalesSparkline({
  data,
  dataKey = "value",
  height = SALES_CHART.sparkline,
  color,
  className,
}: {
  data: Array<Record<string, string | number>>;
  dataKey?: string;
  height?: number;
  /** Override stroke/fill color — default brand. */
  color?: string;
  className?: string;
}) {
  const colors = useSalesChartColors();
  const reducedMotion = usePrefersReducedMotion();
  const gradientId = useId().replace(/:/g, "");
  const stroke = color ?? colors.brand;
  const has = data.some((d) => Number(d[dataKey] ?? 0) !== 0);
  if (!has || data.length < 2) return null;

  return (
    <div className={cn("w-full", className)} style={{ height }} aria-hidden>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 4, right: 2, left: 2, bottom: 4 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={stroke} stopOpacity={0.14} />
              <stop offset="100%" stopColor={stroke} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Tooltip
            content={
              <SalesChartTooltip valueFormat="number" labelFormatter={formatChartAxisLabel} />
            }
            cursor={false}
          />
          <Area
            type="monotone"
            dataKey={dataKey}
            stroke={stroke}
            strokeWidth={2}
            fill={`url(#${gradientId})`}
            dot={false}
            activeDot={{ r: 3, fill: stroke, strokeWidth: 0 }}
            isAnimationActive={!reducedMotion}
            animationDuration={SALES_CHART.animationMs}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function SalesLineChart({
  data,
  dataKey = "value",
  comparisonKey,
  xKey = "label",
  emptyTitle = "No data for this period",
  emptyDescription,
  valueFormat = "currency",
  currency,
  showLegend = false,
  primaryName = "Current period",
  comparisonName = "Previous period",
  comparisonDashed = false,
  comparisonColor,
  yDomainMinZero = true,
}: {
  data: Array<Record<string, string | number>>;
  dataKey?: string;
  comparisonKey?: string;
  xKey?: string;
  emptyTitle?: string;
  emptyDescription?: string;
  valueFormat?: ChartTooltipFormat;
  currency?: string;
  showLegend?: boolean;
  primaryName?: string;
  comparisonName?: string;
  comparisonDashed?: boolean;
  comparisonColor?: string;
  yDomainMinZero?: boolean;
}) {
  const colors = useSalesChartColors();
  const reducedMotion = usePrefersReducedMotion();
  const hasPrimary = data.some((d) => Number(d[dataKey] ?? 0) !== 0);
  const hasComparison =
    comparisonKey != null && data.some((d) => Number(d[comparisonKey] ?? 0) !== 0);
  if (!hasPrimary && !hasComparison) {
    return <ChartEmptyState title={emptyTitle} description={emptyDescription} />;
  }

  const max = Math.max(
    ...data.flatMap((d) => [
      Number(d[dataKey] ?? 0),
      comparisonKey ? Number(d[comparisonKey] ?? 0) : 0,
    ]),
    0
  );

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke={colors.grid} strokeDasharray="3 6" />
        <XAxis
          dataKey={xKey}
          tick={{ fill: colors.axis, fontSize: 11 }}
          tickFormatter={formatChartAxisLabel}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          domain={
            yDomainMinZero
              ? [0, Math.ceil(max * 1.1) || 100]
              : ["auto", "auto"]
          }
          tickFormatter={
            valueFormat === "currency"
              ? defaultYAxisCurrency
              : valueFormat === "percent"
                ? (v) => formatChartPercent(v)
                : (v) => formatChartCompact(v)
          }
          tick={{ fill: colors.axis, fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          width={42}
        />
        <Tooltip
          content={<SalesChartTooltip valueFormat={valueFormat} currency={currency} />}
        />
        {hasPrimary ? (
          <Line
            type="monotone"
            dataKey={dataKey}
            name={primaryName}
            stroke={colors.brand}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, fill: colors.textPrimary, stroke: colors.brand, strokeWidth: 2 }}
            connectNulls={false}
            isAnimationActive={!reducedMotion}
            animationDuration={SALES_CHART.animationMs}
          />
        ) : null}
        {comparisonKey && hasComparison ? (
          <Line
            type="monotone"
            dataKey={comparisonKey}
            name={comparisonName}
            stroke={comparisonColor ?? colors.purple}
            strokeWidth={1.75}
            strokeDasharray={comparisonDashed ? "5 4" : undefined}
            dot={false}
            activeDot={{ r: 3, fill: comparisonColor ?? colors.purple, strokeWidth: 0 }}
            connectNulls={false}
            isAnimationActive={!reducedMotion}
            animationDuration={SALES_CHART.animationMs}
          />
        ) : null}
        {showLegend && comparisonKey && hasComparison ? (
          <Legend
            verticalAlign="top"
            height={28}
            iconType="circle"
            iconSize={8}
            wrapperStyle={{ fontSize: 12, color: colors.textSecondary }}
          />
        ) : null}
      </LineChart>
    </ResponsiveContainer>
  );
}

export function SalesAreaChart({
  data,
  dataKey = "value",
  comparisonKey,
  xKey = "label",
  emptyTitle = "No data for this period",
  emptyDescription,
  valueFormat = "currency",
  currency,
  referenceY,
  referenceLabel,
  primaryName = "Current period",
  tooltipExtra,
}: {
  data: Array<Record<string, string | number>>;
  dataKey?: string;
  comparisonKey?: string;
  xKey?: string;
  emptyTitle?: string;
  emptyDescription?: string;
  valueFormat?: ChartTooltipFormat;
  currency?: string;
  referenceY?: number;
  referenceLabel?: string;
  primaryName?: string;
  tooltipExtra?: Array<{ dataKey: string; label: string; valueFormat?: ChartTooltipFormat }>;
}) {
  const colors = useSalesChartColors();
  const reducedMotion = usePrefersReducedMotion();
  const fillId = useId().replace(/:/g, "");
  const hasPrimary = data.some((d) => Number(d[dataKey] ?? 0) !== 0);
  const hasComparison =
    comparisonKey != null && data.some((d) => Number(d[comparisonKey] ?? 0) !== 0);
  if (!hasPrimary && !hasComparison) {
    return <ChartEmptyState title={emptyTitle} description={emptyDescription} />;
  }

  const max = Math.max(
    ...data.flatMap((d) => [
      Number(d[dataKey] ?? 0),
      comparisonKey ? Number(d[comparisonKey] ?? 0) : 0,
    ]),
    referenceY ?? 0,
    0
  );

  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={colors.brand} stopOpacity={0.12} />
            <stop offset="100%" stopColor={colors.brand} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke={colors.grid} strokeDasharray="3 6" />
        <XAxis
          dataKey={xKey}
          tick={{ fill: colors.axis, fontSize: 11 }}
          tickFormatter={formatChartAxisLabel}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          domain={[0, Math.ceil(max * 1.1) || 100]}
          tickFormatter={
            valueFormat === "currency"
              ? defaultYAxisCurrency
              : (v) => formatChartCompact(v)
          }
          tick={{ fill: colors.axis, fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          width={42}
        />
        <Tooltip
          content={({ active, payload, label }) => {
            const row = payload?.[0]?.payload as Record<string, string | number> | undefined;
            const basePayload = payload?.map((p) => ({
              name: String(p.name ?? ""),
              value: p.value as number | string | undefined,
              color: String(p.color ?? colors.brand),
            }));
            const extraPayload =
              row && tooltipExtra
                ? tooltipExtra.map((f) => ({
                    name: f.label,
                    value: row[f.dataKey],
                    color: undefined,
                  }))
                : [];
            return (
              <SalesChartTooltip
                active={active}
                label={String(label ?? "")}
                payload={[...(basePayload ?? []), ...extraPayload]}
                valueFormat={valueFormat}
                currency={currency}
                formatValue={
                  tooltipExtra
                    ? (value, name) => {
                        const n = typeof value === "number" ? value : Number(value);
                        const extra = tooltipExtra.find((f) => f.label === name);
                        if (extra) {
                          if (extra.valueFormat === "currency") {
                            return formatChartCurrency(Number.isFinite(n) ? n : 0, { currency });
                          }
                          return formatChartNumber(Number.isFinite(n) ? n : 0);
                        }
                        if (valueFormat === "currency") {
                          return formatChartCurrency(Number.isFinite(n) ? n : 0, { currency });
                        }
                        return formatChartNumber(Number.isFinite(n) ? n : 0);
                      }
                    : undefined
                }
              />
            );
          }}
        />
        {referenceY != null && referenceY > 0 ? (
          <ReferenceLine
            y={referenceY}
            stroke={colors.axis}
            strokeDasharray="4 4"
            label={
              referenceLabel
                ? {
                    value: referenceLabel,
                    position: "insideTopRight",
                    fill: colors.textSecondary,
                    fontSize: 11,
                  }
                : undefined
            }
          />
        ) : null}
        {comparisonKey && hasComparison ? (
          <Area
            type="monotone"
            dataKey={comparisonKey}
            name="Previous period"
            stroke={colors.purple}
            strokeWidth={1.75}
            fill="none"
            dot={false}
            activeDot={{ r: 3, fill: colors.purple, strokeWidth: 0 }}
            connectNulls={false}
            isAnimationActive={!reducedMotion}
            animationDuration={SALES_CHART.animationMs}
          />
        ) : null}
        {hasPrimary ? (
          <Area
            type="monotone"
            dataKey={dataKey}
            name={primaryName}
            stroke={colors.brand}
            strokeWidth={2}
            fill={`url(#${fillId})`}
            dot={false}
            activeDot={{ r: 4, fill: colors.textPrimary, stroke: colors.brand, strokeWidth: 2 }}
            connectNulls={false}
            isAnimationActive={!reducedMotion}
            animationDuration={SALES_CHART.animationMs}
          />
        ) : null}
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function SalesBarChart({
  data,
  dataKey = "value",
  xKey = "label",
  layout = "vertical",
  barColor,
  perBarColors,
  emptyTitle = "No data for this period",
  emptyDescription,
  valueFormat = "number",
  currency,
}: {
  data: Array<Record<string, string | number>>;
  dataKey?: string;
  xKey?: string;
  layout?: "vertical" | "horizontal";
  /** Single series color — default brand for restrained categorical charts. */
  barColor?: string;
  /** Per-bar colors when semantic/source identity matters. */
  perBarColors?: string[];
  emptyTitle?: string;
  emptyDescription?: string;
  valueFormat?: ChartTooltipFormat;
  currency?: string;
}) {
  const colors = useSalesChartColors();
  const reducedMotion = usePrefersReducedMotion();
  const has = data.some((d) => Number(d[dataKey] ?? 0) > 0);
  if (!has) {
    return <ChartEmptyState title={emptyTitle} description={emptyDescription} />;
  }

  const fill = barColor ?? colors.brand;
  const isHorizontal = layout === "horizontal";

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart
        data={data}
        layout={isHorizontal ? "vertical" : "horizontal"}
        margin={{ top: 8, right: isHorizontal ? 16 : 4, left: isHorizontal ? 4 : 0, bottom: 0 }}
      >
        <CartesianGrid
          vertical={!isHorizontal}
          horizontal={isHorizontal}
          stroke={colors.grid}
          strokeDasharray="3 6"
        />
        {isHorizontal ? (
          <>
            <YAxis
              type="category"
              dataKey={xKey}
              tick={{ fill: colors.axis, fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              width={88}
            />
            <XAxis type="number" hide />
          </>
        ) : (
          <>
            <XAxis
              dataKey={xKey}
              tick={{ fill: colors.axis, fontSize: 11 }}
              tickFormatter={formatChartAxisLabel}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: colors.axis, fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              width={36}
              tickFormatter={(v) =>
                valueFormat === "currency"
                  ? formatChartCurrency(v, { compact: true, currency })
                  : formatChartCompact(v)
              }
            />
          </>
        )}
        <Tooltip
          content={<SalesChartTooltip valueFormat={valueFormat} currency={currency} />}
        />
        <Bar
          dataKey={dataKey}
          fill={fill}
          radius={isHorizontal ? [0, 4, 4, 0] : [4, 4, 0, 0]}
          maxBarSize={22}
          isAnimationActive={!reducedMotion}
          animationDuration={SALES_CHART.animationMs}
        >
          {perBarColors
            ? data.map((_, i) => (
                <Cell key={i} fill={perBarColors[i % perBarColors.length] ?? fill} />
              ))
            : null}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export type DonutSlice = {
  name: string;
  value: number;
  color?: string;
};

export function SalesDonutChart({
  data,
  centerLabel = "Total",
  centerValue,
  emptyTitle = "No data for this period",
  showLegend = true,
  onSliceClick,
}: {
  data: DonutSlice[];
  centerLabel?: string;
  /** Override center numeric display — e.g. formatted currency. */
  centerValue?: ReactNode;
  emptyTitle?: string;
  showLegend?: boolean;
  onSliceClick?: (slice: DonutSlice) => void;
}) {
  const colors = useSalesChartColors();
  const reducedMotion = usePrefersReducedMotion();
  const total = data.reduce((sum, d) => sum + (Number(d.value) || 0), 0);
  if (total <= 0) return <ChartEmptyState title={emptyTitle} />;

  const slices = data.map((d, i) => ({
    ...d,
    color: d.color ?? colors.series[i % colors.series.length],
  }));

  return (
    <div className="flex h-full w-full flex-col gap-3 layout:flex-row layout:items-center">
      <div className="relative min-h-[140px] flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={slices}
              dataKey="value"
              nameKey="name"
              innerRadius="62%"
              outerRadius="88%"
              paddingAngle={2}
              stroke="none"
              isAnimationActive={!reducedMotion}
              animationDuration={SALES_CHART.animationMs}
            >
            {slices.map((s) => (
              <Cell
                key={s.name}
                fill={s.color}
                className={onSliceClick ? "cursor-pointer" : undefined}
                onClick={() => onSliceClick?.(s)}
              />
            ))}
            </Pie>
            <Tooltip content={<SalesChartTooltip valueFormat="number" />} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <p className="text-[11px] font-medium text-sales-text-muted">{centerLabel}</p>
          <p className="text-[20px] font-semibold tabular-nums text-sales-text-primary">
            {centerValue ?? formatChartNumber(total)}
          </p>
        </div>
      </div>
      {showLegend ? (
        <ul className="flex shrink-0 flex-row flex-wrap gap-x-4 gap-y-2 layout:flex-col layout:gap-y-2">
          {slices.map((s) => {
            const pct = total > 0 ? Math.round((s.value / total) * 100) : 0;
            return (
              <li key={s.name} className="flex items-center gap-2 text-[12px]">
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: s.color }}
                  aria-hidden
                />
                <span className="text-sales-text-secondary">{s.name}</span>
                <span className="ml-auto tabular-nums text-sales-text-primary layout:ml-0">
                  {formatChartNumber(s.value)}
                  <span className="text-sales-text-muted"> · {pct}%</span>
                </span>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}

export type FunnelChartStage = {
  id: string;
  label: string;
  count: number;
  color?: string;
  icon?: LucideIcon;
};

function funnelWidthPercent(count: number, maxCount: number): string {
  if (maxCount <= 0) return "40%";
  const ratio = count / maxCount;
  const pct = Math.max(36, Math.round(ratio * 100));
  return `${pct}%`;
}

export function SalesFunnelChart({
  stages,
  emptyTitle = "No funnel data for this period",
  emptyDescription,
  className,
}: {
  stages: FunnelChartStage[];
  emptyTitle?: string;
  emptyDescription?: string;
  className?: string;
}) {
  const maxCount = Math.max(...stages.map((s) => s.count), 0);
  const hasAny = stages.some((s) => s.count > 0);
  if (!hasAny) {
    return (
      <ChartEmptyState title={emptyTitle} description={emptyDescription} className={className} />
    );
  }

  return (
    <div
      className={cn("flex flex-col items-center", className)}
      role="list"
      aria-label="Process funnel stages"
    >
      {stages.map((stage, idx) => {
        const width = funnelWidthPercent(stage.count, maxCount);
        const isFirst = idx === 0;
        const isLast = idx === stages.length - 1;
        const hasActivity = stage.count > 0;
        const Icon = stage.icon;

        return (
          <div key={stage.id} className="relative flex w-full flex-col items-center" role="listitem">
            <div
              className={cn(
                "dashboard-funnel-step flex min-h-[48px] items-center justify-between gap-2 px-3 py-2.5",
                isFirst && "rounded-t-[12px]",
                isLast && "rounded-b-[12px]",
                !hasActivity && "dashboard-funnel-step--idle"
              )}
              style={{
                width,
                ["--funnel-color" as string]: stage.color ?? "var(--sales-info)",
                clipPath: isLast
                  ? "polygon(0 0, 100% 0, 100% 100%, 0 100%)"
                  : "polygon(0 0, 100% 0, 96.5% 100%, 3.5% 100%)",
              }}
            >
              <div className="flex min-w-0 items-center gap-2">
                {Icon ? (
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-sales-sm bg-sales-neutral-100 text-sales-text-secondary">
                    <Icon size={14} strokeWidth={1.8} aria-hidden />
                  </span>
                ) : null}
                <span className="truncate text-[12px] font-medium text-sales-text-secondary">
                  {stage.label}
                </span>
              </div>
              <span
                className={cn(
                  "shrink-0 text-[17px] font-semibold tabular-nums tracking-[-0.02em]",
                  hasActivity ? "text-sales-text-primary" : "text-sales-text-muted"
                )}
              >
                {formatChartNumber(stage.count)}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export type HeatmapCell = {
  date: string;
  value: number;
};

function heatmapIntensity(value: number, max: number): number {
  if (max <= 0 || value <= 0) return 0;
  return Math.min(1, value / max);
}

export function SalesHeatmap({
  cells,
  emptyTitle = "No activity for this period",
  emptyDescription,
  className,
}: {
  cells: HeatmapCell[];
  emptyTitle?: string;
  emptyDescription?: string;
  className?: string;
}) {
  const colors = useSalesChartColors();
  const brandRgb = useMemo(() => {
    if (colors.brand.startsWith("#") && colors.brand.length >= 7) {
      const r = parseInt(colors.brand.slice(1, 3), 16);
      const g = parseInt(colors.brand.slice(3, 5), 16);
      const b = parseInt(colors.brand.slice(5, 7), 16);
      return { r, g, b };
    }
    return { r: 212, g: 255, b: 79 };
  }, [colors.brand]);
  const max = Math.max(...cells.map((c) => c.value), 0);
  const hasAny = cells.some((c) => c.value > 0);
  if (!cells.length || !hasAny) {
    return (
      <ChartEmptyState title={emptyTitle} description={emptyDescription} className={className} />
    );
  }

  return (
    <div className={cn("w-full", className)}>
      <div
        className="flex flex-wrap gap-1 overflow-x-auto pb-1"
        role="img"
        aria-label="Activity density heatmap"
      >
        {cells.map((cell) => {
          const t = heatmapIntensity(cell.value, max);
          const bg =
            t <= 0
              ? colors.donutTrack
              : `rgba(${brandRgb.r}, ${brandRgb.g}, ${brandRgb.b}, ${0.12 + t * 0.55})`;
          return (
            <button
              key={cell.date}
              type="button"
              className="h-3 w-3 shrink-0 rounded-[3px] border border-transparent transition-colors hover:border-sales-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sales-brand"
              style={{ backgroundColor: bg }}
              title={`${formatChartTooltipDate(cell.date)} · ${formatChartNumber(cell.value)} activities`}
              aria-label={`${formatChartTooltipDate(cell.date)}, ${cell.value} activities`}
            />
          );
        })}
      </div>
      <div className="mt-2 flex items-center gap-2 text-[10px] text-sales-text-muted">
        <span>Less</span>
        <div className="flex gap-0.5">
          {[0, 0.25, 0.5, 0.75, 1].map((t) => (
            <span
              key={t}
              className="h-2.5 w-2.5 rounded-[2px]"
              style={{
                backgroundColor:
                  t <= 0
                    ? colors.donutTrack
                    : `rgba(${brandRgb.r}, ${brandRgb.g}, ${brandRgb.b}, ${0.12 + t * 0.55})`,
              }}
              aria-hidden
            />
          ))}
        </div>
        <span>More</span>
      </div>
    </div>
  );
}

export type LineSeriesConfig = {
  dataKey: string;
  name: string;
  color: string;
  strokeWidth?: number;
};

export function SalesMultiLineChart({
  data,
  xKey = "label",
  series,
  emptyTitle = "No data for this period",
  emptyDescription,
  valueFormat = "number",
  currency,
  showLegend = true,
  labelFormatter,
}: {
  data: Array<Record<string, string | number>>;
  xKey?: string;
  series: LineSeriesConfig[];
  emptyTitle?: string;
  emptyDescription?: string;
  valueFormat?: ChartTooltipFormat;
  currency?: string;
  showLegend?: boolean;
  labelFormatter?: (label: string) => string;
}) {
  const colors = useSalesChartColors();
  const reducedMotion = usePrefersReducedMotion();
  const has = series.some((s) => data.some((d) => Number(d[s.dataKey] ?? 0) !== 0));
  if (!has) {
    return <ChartEmptyState title={emptyTitle} description={emptyDescription} />;
  }

  const max = Math.max(
    ...data.flatMap((d) => series.map((s) => Number(d[s.dataKey] ?? 0))),
    0
  );

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: showLegend ? 28 : 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke={colors.grid} strokeDasharray="3 6" />
        <XAxis
          dataKey={xKey}
          tick={{ fill: colors.axis, fontSize: 11 }}
          tickFormatter={formatChartAxisLabel}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          allowDecimals={false}
          domain={[0, Math.ceil(max * 1.1) || 10]}
          tick={{ fill: colors.axis, fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          width={28}
          tickFormatter={(v) => formatChartCompact(v)}
        />
        <Tooltip
          content={
            <SalesChartTooltip
              valueFormat={valueFormat}
              currency={currency}
              labelFormatter={labelFormatter}
            />
          }
        />
        {showLegend ? (
          <Legend
            verticalAlign="top"
            height={28}
            iconType="circle"
            iconSize={8}
            wrapperStyle={{ fontSize: 12, color: colors.textSecondary }}
          />
        ) : null}
        {series.map((s) => (
          <Line
            key={s.dataKey}
            type="monotone"
            dataKey={s.dataKey}
            name={s.name}
            stroke={s.color}
            strokeWidth={s.strokeWidth ?? 2}
            dot={false}
            activeDot={{ r: 3, fill: s.color, strokeWidth: 0 }}
            connectNulls={false}
            isAnimationActive={!reducedMotion}
            animationDuration={SALES_CHART.animationMs}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

export function SalesComparisonBarChart({
  data,
  primaryKey = "primary",
  comparisonKey = "comparison",
  xKey = "label",
  primaryName = "This period",
  comparisonName = "Previous period",
  emptyTitle = "No data for this period",
  emptyDescription,
  valueFormat = "currency",
  currency,
}: {
  data: Array<Record<string, string | number>>;
  primaryKey?: string;
  comparisonKey?: string;
  xKey?: string;
  primaryName?: string;
  comparisonName?: string;
  emptyTitle?: string;
  emptyDescription?: string;
  valueFormat?: ChartTooltipFormat;
  currency?: string;
}) {
  const colors = useSalesChartColors();
  const reducedMotion = usePrefersReducedMotion();
  const has = data.some(
    (d) => Number(d[primaryKey] ?? 0) > 0 || Number(d[comparisonKey] ?? 0) > 0
  );
  if (!has) {
    return <ChartEmptyState title={emptyTitle} description={emptyDescription} />;
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }} barGap={4}>
        <CartesianGrid vertical={false} stroke={colors.grid} strokeDasharray="3 6" />
        <XAxis
          dataKey={xKey}
          tick={{ fill: colors.axis, fontSize: 11 }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis hide />
        <Tooltip
          content={<SalesChartTooltip valueFormat={valueFormat} currency={currency} />}
        />
        <Bar
          dataKey={primaryKey}
          name={primaryName}
          fill={colors.brand}
          radius={[4, 4, 0, 0]}
          maxBarSize={18}
          isAnimationActive={!reducedMotion}
          animationDuration={SALES_CHART.animationMs}
        />
        <Bar
          dataKey={comparisonKey}
          name={comparisonName}
          fill={colors.neutral}
          radius={[4, 4, 0, 0]}
          maxBarSize={18}
          isAnimationActive={!reducedMotion}
          animationDuration={SALES_CHART.animationMs}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function SalesPerformanceTrendChart({
  data,
  currency = "USD",
}: {
  data: Array<{ label: string; leadsCreated: number; dealsWon: number; revenue: number }>;
  currency?: string;
}) {
  const colors = useSalesChartColors();
  const reducedMotion = usePrefersReducedMotion();
  const has = data.some((d) => d.leadsCreated > 0 || d.dealsWon > 0 || d.revenue > 0);
  if (!has) {
    return (
      <ChartEmptyState
        title="No performance data for this period"
        description="Try a wider date range."
      />
    );
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke={colors.grid} strokeDasharray="3 6" />
        <XAxis
          dataKey="label"
          tick={{ fill: colors.axis, fontSize: 11 }}
          tickFormatter={formatChartAxisLabel}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          yAxisId="left"
          tick={{ fill: colors.axis, fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          width={32}
          allowDecimals={false}
        />
        <YAxis
          yAxisId="right"
          orientation="right"
          tick={{ fill: colors.axis, fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          width={44}
          tickFormatter={(v) => formatChartCurrency(v, { currency, compact: true })}
        />
        <Tooltip
          content={({ active, payload, label }) => (
            <SalesChartTooltip
              active={active}
              label={String(label ?? "")}
              payload={payload?.map((p) => ({
                name: String(p.name ?? ""),
                value: p.value as number | string | undefined,
                color: String(p.color ?? colors.brand),
              }))}
              formatValue={(value, name) => {
                const n = typeof value === "number" ? value : Number(value);
                if (name === "Revenue") {
                  return formatChartCurrency(Number.isFinite(n) ? n : 0, { currency });
                }
                return formatChartNumber(Number.isFinite(n) ? n : 0);
              }}
            />
          )}
        />
        <Bar
          yAxisId="left"
          dataKey="leadsCreated"
          name="Leads created"
          fill={colors.brand}
          radius={[4, 4, 0, 0]}
          maxBarSize={22}
          isAnimationActive={!reducedMotion}
          animationDuration={SALES_CHART.animationMs}
        />
        <Line
          yAxisId="left"
          type="monotone"
          dataKey="dealsWon"
          name="Deals won"
          stroke={colors.info}
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 3, fill: colors.info, strokeWidth: 0 }}
          isAnimationActive={!reducedMotion}
          animationDuration={SALES_CHART.animationMs}
        />
        <Line
          yAxisId="right"
          type="monotone"
          dataKey="revenue"
          name="Revenue"
          stroke={colors.purple}
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 3, fill: colors.purple, strokeWidth: 0 }}
          isAnimationActive={!reducedMotion}
          animationDuration={SALES_CHART.animationMs}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

/** Agency / client portal volume trend — contacted area + leads/won lines. */
export function SalesActivityVolumeChart({
  data,
  xKey = "date",
  contactedKey = "contacted",
  leadsKey = "leads",
  wonKey = "won",
  emptyTitle = "No activity for this period",
  labelFormatter,
}: {
  data: Array<Record<string, string | number>>;
  xKey?: string;
  contactedKey?: string;
  leadsKey?: string;
  wonKey?: string;
  emptyTitle?: string;
  labelFormatter?: (label: string) => string;
}) {
  const colors = useSalesChartColors();
  const reducedMotion = usePrefersReducedMotion();
  const fillId = useId().replace(/:/g, "");
  const has = data.some(
    (d) =>
      Number(d[contactedKey] ?? 0) > 0 ||
      Number(d[leadsKey] ?? 0) > 0 ||
      Number(d[wonKey] ?? 0) > 0
  );
  if (!has) {
    return <ChartEmptyState title={emptyTitle} className="min-h-[160px]" />;
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={colors.brand} stopOpacity={0.22} />
            <stop offset="100%" stopColor={colors.brand} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke={colors.grid} strokeDasharray="3 6" />
        <XAxis
          dataKey={xKey}
          tick={{ fill: colors.axis, fontSize: 11 }}
          tickFormatter={labelFormatter ?? formatChartAxisLabel}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          width={32}
          allowDecimals={false}
          tick={{ fill: colors.axis, fontSize: 11 }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          content={
            <SalesChartTooltip
              valueFormat="number"
              labelFormatter={labelFormatter}
            />
          }
        />
        <Area
          type="monotone"
          dataKey={contactedKey}
          name="Contacted"
          stroke="none"
          fill={`url(#${fillId})`}
          isAnimationActive={!reducedMotion}
          animationDuration={SALES_CHART.animationMs}
        />
        <Line
          type="monotone"
          dataKey={leadsKey}
          name="Leads"
          stroke={colors.textMuted}
          strokeWidth={2}
          dot={false}
          isAnimationActive={!reducedMotion}
          animationDuration={SALES_CHART.animationMs}
        />
        <Line
          type="monotone"
          dataKey={wonKey}
          name="Won"
          stroke={colors.brand}
          strokeWidth={2}
          dot={false}
          isAnimationActive={!reducedMotion}
          animationDuration={SALES_CHART.animationMs}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
