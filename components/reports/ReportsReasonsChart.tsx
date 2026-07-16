"use client";

import { useMemo } from "react";
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const GRAY = "#e8e6df";
const BAR_FILLS = ["#d4ff4f", "#c8e085", "#b8c49a", "#a8a894", "#989888"];

function truncateReason(value: string, max = 28): string {
  if (value.length <= max) return value;
  return `${value.slice(0, max - 1)}…`;
}

export function ReportsReasonsChart({ rows }: { rows: Array<{ reason: string; count: number }> }) {
  const top = useMemo(
    () => rows.slice(0, 5).map((row) => ({ ...row, shortReason: truncateReason(row.reason) })),
    [rows]
  );

  return (
    <div className="h-[200px] w-full min-w-0 sm:h-[220px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={top} layout="vertical" margin={{ left: 0, right: 8, top: 4, bottom: 4 }}>
          <XAxis type="number" hide />
          <YAxis
            type="category"
            dataKey="shortReason"
            width={88}
            tick={{ fill: "var(--text-secondary)", fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            className="sm:[&_text]:text-[11px]"
          />
          <Tooltip
            cursor={{ fill: "transparent" }}
            contentStyle={{
              backgroundColor: "var(--surface-sidebar)",
              border: "1px solid var(--surface-sidebar-border)",
              color: "var(--text-on-dark)",
              fontSize: 12,
              fontFamily: "var(--font-mono)",
            }}
            labelFormatter={(_, payload) => {
              const row = payload?.[0]?.payload as { reason?: string } | undefined;
              return row?.reason ?? "";
            }}
          />
          <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={16}>
            {top.map((_, i) => (
              <Cell key={i} fill={BAR_FILLS[i] ?? GRAY} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
