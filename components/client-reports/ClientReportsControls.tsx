"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  addDays,
  addMonths,
  addWeeks,
  startOfDay,
  startOfMonth,
  startOfWeek,
  subDays,
  subMonths,
} from "date-fns";
import { SegmentedTabs } from "@/components/ui";

const BASE = "/client/reports";

type PresetId = "this_week" | "this_month" | "last_month" | "last_90" | "custom";

const PRESETS: { id: PresetId; label: string }[] = [
  { id: "this_week", label: "This week" },
  { id: "this_month", label: "This month" },
  { id: "last_month", label: "Last month" },
  { id: "last_90", label: "90 days" },
  { id: "custom", label: "Custom" },
];

function rangeForPreset(id: Exclude<PresetId, "custom">): { from: Date; to: Date; label: string } {
  const now = new Date();
  switch (id) {
    case "this_week": {
      const from = startOfWeek(now, { weekStartsOn: 1 });
      const to = addWeeks(from, 1);
      return { from, to, label: "This Week" };
    }
    case "this_month": {
      const from = startOfMonth(now);
      const to = addMonths(from, 1);
      return { from, to, label: "This Month" };
    }
    case "last_month": {
      const thisM = startOfMonth(now);
      const from = subMonths(thisM, 1);
      const to = thisM;
      return { from, to, label: "Last Month" };
    }
    case "last_90": {
      const to = addDays(startOfDay(now), 1);
      const from = subDays(to, 90);
      return { from, to, label: "Last 90 Days" };
    }
  }
}

export function ClientReportsControls() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [customOpen, setCustomOpen] = useState(false);
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const urlLabel = searchParams.get("label") ?? "";

  const activePreset: PresetId =
    customOpen || urlLabel === "Custom"
      ? "custom"
      : PRESETS.find((p) => p.id !== "custom" && urlLabel === rangeForPreset(p.id as Exclude<PresetId, "custom">).label)?.id ??
        "this_month";

  const pushParams = useCallback(
    (from: Date, to: Date, label: string) => {
      const p = new URLSearchParams(searchParams.toString());
      p.set("from", from.toISOString());
      p.set("to", to.toISOString());
      p.set("label", label);
      router.push(`${BASE}?${p.toString()}`, { scroll: false });
    },
    [router, searchParams]
  );

  useEffect(() => {
    if (searchParams.get("from") && searchParams.get("to")) return;
    const { from, to, label } = rangeForPreset("this_month");
    const p = new URLSearchParams(searchParams.toString());
    p.set("from", from.toISOString());
    p.set("to", to.toISOString());
    p.set("label", label);
    router.replace(`${BASE}?${p.toString()}`, { scroll: false });
  }, [searchParams, router]);

  const onPreset = (id: PresetId) => {
    if (id === "custom") {
      const from = searchParams.get("from");
      const to = searchParams.get("to");
      if (from) setCustomFrom(from.slice(0, 10));
      if (to) setCustomTo(subDays(new Date(to), 1).toISOString().slice(0, 10));
      setCustomOpen(true);
      return;
    }
    setCustomOpen(false);
    const r = rangeForPreset(id);
    pushParams(r.from, r.to, r.label);
  };

  const applyCustom = () => {
    if (!customFrom || !customTo) return;
    const from = startOfDay(new Date(customFrom + "T12:00:00"));
    const to = startOfDay(addDays(new Date(customTo + "T12:00:00"), 1));
    if (from.getTime() > to.getTime()) return;
    pushParams(from, to, "Custom");
    setCustomOpen(false);
  };

  return (
    <div className="flex flex-col items-start gap-3 md:items-end">
      <SegmentedTabs
        aria-label="Report period"
        tabs={PRESETS.map((p) => ({ value: p.id, label: p.label }))}
        value={activePreset}
        onValueChange={(v) => onPreset(v as PresetId)}
      />
      {customOpen ? (
        <div className="flex w-full flex-wrap items-end gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface-card)] p-4 md:justify-end">
          <label className="font-mono text-[11px] text-[var(--text-secondary)]">
            From
            <input
              type="date"
              className="input-base mt-1 block h-11 text-base md:h-9 md:text-sm"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
            />
          </label>
          <label className="font-mono text-[11px] text-[var(--text-secondary)]">
            To
            <input
              type="date"
              className="input-base mt-1 block h-11 text-base md:h-9 md:text-sm"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
            />
          </label>
          <button
            type="button"
            onClick={() => void applyCustom()}
            className="h-11 rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-[var(--accent-foreground)] md:h-9"
          >
            Apply
          </button>
        </div>
      ) : null}
    </div>
  );
}
