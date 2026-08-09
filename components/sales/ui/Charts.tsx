"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useSalesChartColors } from "@/lib/sales/use-sales-chart-colors";
import { cn } from "@/lib/ui/cn";

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
    >
      <p className="text-[13px] font-medium text-sales-text-primary">{title}</p>
      {description ? (
        <p className="mt-1 text-[12px] text-sales-text-muted">{description}</p>
      ) : null}
    </div>
  );
}

function ChartTooltipBox({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ name?: string; value?: number | string; color?: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-sales-lg border border-sales-border bg-[var(--sales-surface-raised,#151815)] px-3 py-2 shadow-sales-popover">
      {label ? <p className="mb-1 text-[11px] text-sales-text-muted">{label}</p> : null}
      {payload.map((p, i) => (
        <p key={i} className="text-[12px] font-medium tabular-nums text-sales-text-primary">
          {p.name ? `${p.name}: ` : ""}
          {typeof p.value === "number" ? `$${p.value.toLocaleString("en-US")}` : p.value}
        </p>
      ))}
    </div>
  );
}

export function SalesAreaChart({
  data,
  dataKey = "value",
  xKey = "label",
  emptyTitle = "No data for this period",
  emptyDescription,
}: {
  data: Array<Record<string, string | number>>;
  dataKey?: string;
  xKey?: string;
  emptyTitle?: string;
  emptyDescription?: string;
}) {
  const colors = useSalesChartColors();
  const has = data.some((d) => Number(d[dataKey] ?? 0) > 0);
  if (!has) {
    return <ChartEmptyState title={emptyTitle} description={emptyDescription} />;
  }
  const max = Math.max(...data.map((d) => Number(d[dataKey] ?? 0)), 0);
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="salesAreaFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={colors.brand} stopOpacity={0.18} />
            <stop offset="100%" stopColor={colors.brand} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke={colors.grid} strokeDasharray="3 6" />
        <XAxis
          dataKey={xKey}
          tick={{ fill: colors.axis, fontSize: 11 }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          domain={[0, Math.ceil(max * 1.1) || 100]}
          tickFormatter={(v) => (v >= 1000 ? `$${Math.round(v / 1000)}k` : `$${v}`)}
          tick={{ fill: colors.axis, fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          width={42}
        />
        <Tooltip content={<ChartTooltipBox />} />
        <Area
          type="monotone"
          dataKey={dataKey}
          stroke={colors.brand}
          strokeWidth={2}
          fill="url(#salesAreaFill)"
          dot={false}
          activeDot={{ r: 4, fill: colors.textPrimary, stroke: colors.brand, strokeWidth: 2 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function SalesBarChart({
  data,
  dataKey = "value",
  xKey = "label",
  emptyTitle = "No data for this period",
}: {
  data: Array<Record<string, string | number>>;
  dataKey?: string;
  xKey?: string;
  emptyTitle?: string;
}) {
  const colors = useSalesChartColors();
  const has = data.some((d) => Number(d[dataKey] ?? 0) > 0);
  if (!has) return <ChartEmptyState title={emptyTitle} />;
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke={colors.grid} strokeDasharray="3 6" />
        <XAxis
          dataKey={xKey}
          tick={{ fill: colors.axis, fontSize: 11 }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fill: colors.axis, fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          width={36}
        />
        <Tooltip content={<ChartTooltipBox />} />
        <Bar dataKey={dataKey} fill={colors.info} radius={[4, 4, 0, 0]} maxBarSize={36} />
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
  emptyTitle = "No data for this period",
}: {
  data: DonutSlice[];
  centerLabel?: string;
  emptyTitle?: string;
}) {
  const colors = useSalesChartColors();
  const total = data.reduce((sum, d) => sum + (Number(d.value) || 0), 0);
  if (total <= 0) return <ChartEmptyState title={emptyTitle} />;

  const slices = data.map((d, i) => ({
    ...d,
    color: d.color ?? colors.series[i % colors.series.length],
  }));

  return (
    <div className="relative h-full w-full">
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
          >
            {slices.map((s) => (
              <Cell key={s.name} fill={s.color} />
            ))}
          </Pie>
          <Tooltip content={<ChartTooltipBox />} />
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <p className="text-[11px] font-medium text-sales-text-muted">{centerLabel}</p>
        <p className="text-[20px] font-semibold tabular-nums text-sales-text-primary">{total}</p>
      </div>
    </div>
  );
}
