import { formatDuration, formatThousandsK } from "@/lib/format";

export const AVG_RESPONSE_TOOLTIP =
  "Average time between lead submission and first call, across leads this month. Only leads that have been contacted are counted.";

/** Pulse bar cell model (shared; safe to import from Server Components). */
export type PulseBarMetric = {
  eyebrow: string;
  value: string;
  /** When set, PulseBar renders EmptyValue instead of raw value (e.g. avg response). */
  emptyLabel?: string;
  variant: "dark" | "light";
  deltaLine: string;
  /** Hide the delta row entirely */
  deltaHidden?: boolean;
  deltaKind?: "positive" | "negative" | "neutral";
  deltaPlain?: boolean;
  /** Dark cell (leads today): use muted text for delta */
  darkDeltaMuted?: boolean;
  eyebrowTooltip?: string;
};

export function buildPulseMetrics(props: {
  leadsToday: number;
  leadsYesterday: number;
  dayDeltaPct: number;
  leadsDeltaNeutral: boolean;
  contactRate: number;
  contactRateDeltaPts: number;
  dealsWonCount: number;
  dealsWonValueSum: number;
  avgResponseMinutes: number | null;
  avgResponseDeltaMinutes: number | null;
}): PulseBarMetric[] {
  let d1: string;
  if (props.leadsDeltaNeutral) {
    d1 = "No leads today";
  } else {
    const delta = props.dayDeltaPct;
    const arrow = delta > 0 ? "↗" : delta < 0 ? "↘" : "·";
    const sign = delta > 0 ? "+" : "";
    d1 = `${arrow} ${sign}${delta}% vs yesterday`;
  }

  const d2 =
    props.contactRateDeltaPts >= 0
      ? `+${props.contactRateDeltaPts}pts vs last week`
      : `${props.contactRateDeltaPts}pts vs last week`;

  const k = formatThousandsK(props.dealsWonValueSum);
  const d3 = k === "—" ? "—" : `${k} value`;

  const avgStr = formatDuration(props.avgResponseMinutes ?? null);
  let d4 = "";
  let d4Kind: "positive" | "negative" | "neutral" = "neutral";
  let d4Plain = false;
  let avgEmpty = false;

  if (props.avgResponseMinutes == null) {
    avgEmpty = true;
    d4 = "";
  } else if (props.avgResponseDeltaMinutes == null) {
    d4 = "First month tracked";
    d4Plain = true;
  } else {
    if (props.avgResponseDeltaMinutes > 0) {
      d4 = `−${props.avgResponseDeltaMinutes}m vs avg`;
      d4Kind = "positive";
    } else if (props.avgResponseDeltaMinutes < 0) {
      d4 = `+${Math.abs(props.avgResponseDeltaMinutes)}m vs avg`;
      d4Kind = "negative";
    } else {
      d4 = "0m vs avg";
      d4Kind = "neutral";
    }
  }

  return [
    {
      eyebrow: "Leads today",
      value: String(props.leadsToday),
      variant: "light",
      deltaLine: d1,
      deltaPlain: props.leadsDeltaNeutral,
      deltaKind: props.leadsDeltaNeutral ? "neutral" : props.dayDeltaPct > 0 ? "positive" : props.dayDeltaPct < 0 ? "negative" : "neutral",
    },
    {
      eyebrow: "Contact rate",
      value: `${props.contactRate}%`,
      variant: "light",
      deltaLine: d2,
      deltaKind:
        props.contactRateDeltaPts > 0 ? "positive" : props.contactRateDeltaPts < 0 ? "negative" : "neutral",
    },
    {
      eyebrow: "Deals won (MTD)",
      value: String(props.dealsWonCount),
      variant: "light",
      deltaLine: d3,
      deltaPlain: true,
    },
    {
      eyebrow: "Avg response",
      value: avgEmpty ? "" : avgStr,
      emptyLabel: avgEmpty ? "No data yet" : undefined,
      variant: "light",
      deltaLine: d4,
      deltaHidden: avgEmpty,
      deltaKind: d4Kind,
      deltaPlain: d4Plain,
      eyebrowTooltip: AVG_RESPONSE_TOOLTIP,
    },
  ];
}

/** Client overview: MTD avg response vs previous month (same formula as agency, scoped to one client). */
export function buildClientAvgResponsePulseMetric(
  avgCurrent: number | null,
  avgPrev: number | null
): PulseBarMetric {
  const value = formatDuration(avgCurrent);
  if (avgCurrent == null) {
    return {
      eyebrow: "Avg response",
      value: "",
      emptyLabel: "No data yet",
      variant: "light",
      deltaLine: "",
      deltaHidden: true,
      deltaPlain: true,
      eyebrowTooltip: AVG_RESPONSE_TOOLTIP,
    };
  }
  if (avgPrev == null) {
    return {
      eyebrow: "Avg response",
      value,
      variant: "light",
      deltaLine: "First month tracked",
      deltaPlain: true,
      eyebrowTooltip: AVG_RESPONSE_TOOLTIP,
    };
  }
  const diffMin = Math.round(avgPrev - avgCurrent);
  let deltaLine: string;
  let deltaKind: "positive" | "negative" | "neutral";
  if (diffMin > 0) {
    deltaLine = `−${diffMin}m vs last month`;
    deltaKind = "positive";
  } else if (diffMin < 0) {
    deltaLine = `+${Math.abs(diffMin)}m vs last month`;
    deltaKind = "negative";
  } else {
    deltaLine = "0m vs last month";
    deltaKind = "neutral";
  }
  return {
    eyebrow: "Avg response",
    value,
    variant: "light",
    deltaLine,
    deltaKind,
    eyebrowTooltip: AVG_RESPONSE_TOOLTIP,
  };
}
