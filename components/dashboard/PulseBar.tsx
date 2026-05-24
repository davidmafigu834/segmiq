"use client";

import { Info } from "lucide-react";
import type { PulseBarMetric } from "@/components/dashboard/pulse-metrics";
import { EmptyValue } from "@/components/EmptyValue";

export type { PulseBarMetric } from "@/components/dashboard/pulse-metrics";

/** @deprecated Prefer PulseBarMetric — kept for client manager + client detail pages. */
export type LegacyPulseMetric = {
  eyebrow: string;
  value: string;
  delta: string;
  deltaPositive?: boolean;
  anchor?: boolean;
};

function normalizeMetric(m: PulseBarMetric | LegacyPulseMetric): PulseBarMetric {
  if ("variant" in m) return m;
  if (m.anchor) {
    return { eyebrow: m.eyebrow, value: m.value, variant: "dark", deltaLine: m.delta };
  }
  return {
    eyebrow: m.eyebrow,
    value: m.value,
    variant: "light",
    deltaLine: m.delta,
    deltaKind: m.deltaPositive === false ? "negative" : m.deltaPositive === true ? "positive" : "neutral",
  };
}

export function PulseBar({ metrics }: { metrics: (PulseBarMetric | LegacyPulseMetric)[] }) {
  const list = metrics.map(normalizeMetric);
  return (
    <div className="mb-8 w-full rounded-xl border border-[var(--border)] bg-[var(--surface-card)] p-5">
      <div className="grid grid-cols-2 gap-6 layout:grid-cols-4">
        {list.map((m, i) => (
          <div key={`${m.eyebrow}-${i}`} className="flex flex-col gap-1">
            <div className="flex items-center gap-1">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-[var(--text-tertiary)]">
                {m.eyebrow}
              </p>
              {"eyebrowTooltip" in m && m.eyebrowTooltip ? (
                <span title={m.eyebrowTooltip} className="inline-flex cursor-help" aria-label={m.eyebrowTooltip}>
                  <Info className="h-3 w-3 shrink-0 opacity-70 text-[var(--text-tertiary)]" strokeWidth={1.5} />
                </span>
              ) : null}
            </div>

            <p className="font-display text-[36px] font-semibold leading-none text-[var(--text-primary)]">
              {m.emptyLabel ? <EmptyValue label={m.emptyLabel} /> : m.value}
            </p>

            {m.deltaHidden ? (
              <p className="text-[11px] text-[var(--text-tertiary)]">No comparison data yet</p>
            ) : (
              <p className={`text-[12px] font-medium ${
                m.deltaKind === "positive"
                  ? "text-[var(--success)]"
                  : m.deltaKind === "negative"
                  ? "text-[var(--error)]"
                  : "text-[var(--text-tertiary)]"
              }`}>
                {m.deltaLine}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
