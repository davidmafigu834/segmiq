"use client";

import type { SalesActivityTodayMetric } from "./types";
import { CardShell } from "./KpiCard";
import { Progress } from "@/components/sales/ui";

export function ActivityTodayCard({ metrics }: { metrics: SalesActivityTodayMetric[] }) {
  return (
    <CardShell title="My activity today">
      <ul className="divide-y divide-sales-border-subtle px-1">
        {metrics.length === 0 ? (
          <li className="px-4 py-6 text-center text-[13px] text-sales-text-muted">
            No activity logged yet today.
          </li>
        ) : (
          metrics.map((m) => {
            const hasTarget = m.target != null && m.target > 0;
            const pct = hasTarget
              ? Math.min(100, Math.round((m.completed / m.target!) * 100))
              : null;
            return (
              <li key={m.id} className="px-4 py-3">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="text-[13px] font-medium text-sales-text-primary">{m.label}</p>
                  <p className="text-[13px] font-semibold tabular-nums text-sales-text-primary">
                    {hasTarget ? (
                      <>
                        {m.completed} / {m.target}
                      </>
                    ) : (
                      m.completed
                    )}
                  </p>
                </div>
                {pct != null ? (
                  <div className="mt-2">
                    <Progress value={pct} />
                  </div>
                ) : null}
              </li>
            );
          })
        )}
      </ul>
    </CardShell>
  );
}
