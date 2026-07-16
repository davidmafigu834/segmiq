"use client";

import { useMemo } from "react";
import { format, parseISO, startOfWeek } from "date-fns";
import {
  Area,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { AgencyReport } from "@/lib/agency-report";

function rollupWeeks(byDay: AgencyReport["byDay"]): AgencyReport["byDay"] {
  if (byDay.length <= 31) return byDay;
  const map = new Map<string, { leads: number; contacted: number; won: number }>();
  for (const d of byDay) {
    const wk = format(startOfWeek(parseISO(d.date), { weekStartsOn: 1 }), "yyyy-MM-dd");
    const cur = map.get(wk) ?? { leads: 0, contacted: 0, won: 0 };
    cur.leads += d.leads;
    cur.contacted += d.contacted;
    cur.won += d.won;
    map.set(wk, cur);
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, v]) => ({ date, ...v }));
}

export function ReportsVolumeChart({ byDay }: { byDay: AgencyReport["byDay"] }) {
  const data = useMemo(() => rollupWeeks(byDay), [byDay]);

  const tickFmt = (d: string) => format(parseISO(d), "MMM d");

  return (
    <div className="h-[240px] w-full min-w-0 sm:h-[320px]">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
          <XAxis
            dataKey="date"
            tickFormatter={tickFmt}
            tick={{ fill: "var(--text-tertiary)", fontSize: 11 }}
            axisLine={{ stroke: "var(--border)" }}
            tickLine={false}
          />
          <YAxis
            width={32}
            tick={{ fill: "var(--text-tertiary)", fontSize: 11, fontFamily: "var(--font-mono)" }}
            axisLine={false}
            tickLine={false}
            allowDecimals={false}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "var(--surface-sidebar)",
              border: "1px solid var(--surface-sidebar-border)",
              borderRadius: 6,
              color: "var(--text-on-dark)",
              fontSize: 12,
              fontFamily: "var(--font-mono)",
            }}
            labelFormatter={(l) => tickFmt(String(l))}
            formatter={(value, name) => [Number(value ?? 0), String(name ?? "")]}
          />
          <Area
            type="monotone"
            dataKey="contacted"
            stroke="none"
            fill="var(--accent)"
            fillOpacity={0.35}
            name="Contacted"
          />
          <Line
            type="monotone"
            dataKey="leads"
            stroke="#9498A1"
            strokeWidth={2}
            dot={false}
            name="Leads"
          />
          <Line
            type="monotone"
            dataKey="won"
            stroke="#0a0b0d"
            strokeWidth={2}
            dot={false}
            name="Won"
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
