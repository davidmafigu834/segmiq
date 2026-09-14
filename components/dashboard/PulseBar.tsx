"use client";

import { useState } from "react";
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
  const [openHelp, setOpenHelp] = useState<number | null>(null);
  const layoutColumnClass =
    list.length >= 6
      ? "layout:grid-cols-6"
      : list.length === 5
        ? "layout:grid-cols-5"
        : list.length === 3
          ? "layout:grid-cols-3"
          : list.length === 2
            ? "layout:grid-cols-2"
            : "layout:grid-cols-4";
  const mdColumnClass =
    list.length >= 3 ? "md:grid-cols-3" : list.length === 2 ? "md:grid-cols-2" : "md:grid-cols-1";

  return (
    <section aria-label="Key performance indicators" className="mb-8 w-full border-y border-[var(--border-strong)] py-5 sm:py-6">
      <div className={`grid grid-cols-2 gap-x-5 gap-y-6 sm:gap-x-7 ${mdColumnClass} ${layoutColumnClass}`}>
        {list.map((m, i) => (
          <div key={`${m.eyebrow}-${i}`} className="flex flex-col gap-1">
            <div className="flex items-center gap-1">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-[var(--text-tertiary)]">
                {m.eyebrow}
              </p>
              {"eyebrowTooltip" in m && m.eyebrowTooltip ? (
                <span className="relative inline-flex">
                  <button
                    type="button"
                    aria-label={`About ${m.eyebrow}`}
                    aria-describedby={`pulse-help-${i}`}
                    aria-expanded={openHelp === i}
                    className="relative inline-flex h-5 w-5 items-center justify-center rounded-sm text-[var(--text-tertiary)] before:absolute before:-inset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                    onClick={() => setOpenHelp((current) => (current === i ? null : i))}
                    onFocus={() => setOpenHelp(i)}
                    onBlur={() => setOpenHelp(null)}
                    onKeyDown={(event) => {
                      if (event.key === "Escape") setOpenHelp(null);
                    }}
                  >
                    <Info className="h-3.5 w-3.5 shrink-0" strokeWidth={1.5} aria-hidden />
                  </button>
                  <span
                    id={`pulse-help-${i}`}
                    role="tooltip"
                    className={`absolute left-1/2 top-full z-20 mt-2 w-52 -translate-x-1/2 rounded-md border border-[var(--border)] bg-[var(--surface-dropdown)] px-3 py-2 text-[12px] font-normal normal-case leading-relaxed tracking-normal text-[var(--text-secondary)] shadow-[var(--shadow-md)] transition-opacity duration-150 ease-[var(--ease-out)] ${openHelp === i ? "opacity-100" : "pointer-events-none opacity-0"}`}
                  >
                    {m.eyebrowTooltip}
                  </span>
                </span>
              ) : null}
            </div>

            <p aria-live="polite" className="font-display tabular-nums text-2xl font-semibold leading-none tracking-[-0.035em] text-[var(--text-primary)] sm:text-3xl layout:text-4xl">
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
    </section>
  );
}
