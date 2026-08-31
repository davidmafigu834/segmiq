"use client";

import { useMemo } from "react";
import { format, parseISO, startOfWeek } from "date-fns";
import { SalesActivityVolumeChart } from "@/components/sales/ui/Charts";
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
      <SalesActivityVolumeChart
        data={data}
        xKey="date"
        labelFormatter={tickFmt}
        emptyTitle="No volume data for this period"
      />
    </div>
  );
}
