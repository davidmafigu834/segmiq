"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ExportCsvButton } from "@/components/reports/ExportCsvButton";
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

export type ClientOption = { id: string; name: string };

type PresetId = "this_week" | "this_month" | "last_month" | "last_90" | "custom";

const PRESETS: { id: PresetId; label: string }[] = [
  { id: "this_week", label: "This Week" },
  { id: "this_month", label: "This Month" },
  { id: "last_month", label: "Last Month" },
  { id: "last_90", label: "Last 90 Days" },
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

function buildParams(
  from: Date,
  to: Date,
  label: string,
  clientIds: string[],
  source: string
): URLSearchParams {
  const p = new URLSearchParams();
  p.set("from", from.toISOString());
  p.set("to", to.toISOString());
  p.set("label", label);
  for (const id of clientIds) {
    p.append("clientId", id);
  }
  if (source && source !== "ALL") {
    p.set("source", source);
  }
  return p;
}

export function ReportsControls({ clients }: { clients: ClientOption[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [customOpen, setCustomOpen] = useState(false);
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  const selectedClients = useMemo(() => searchParams.getAll("clientId"), [searchParams]);
  const sourceFilter = searchParams.get("source") ?? "ALL";
  const urlLabel = searchParams.get("label") ?? "";

  const pushParams = useCallback(
    (from: Date, to: Date, label: string) => {
      const p = buildParams(from, to, label, selectedClients, sourceFilter);
      router.push(`/dashboard/reports?${p.toString()}`, { scroll: false });
    },
    [router, selectedClients, sourceFilter]
  );

  useEffect(() => {
    if (searchParams.get("from") && searchParams.get("to")) return;
    const { from, to, label } = rangeForPreset("this_month");
    const p = buildParams(from, to, label, [], "ALL");
    router.replace(`/dashboard/reports?${p.toString()}`, { scroll: false });
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

  const toggleClient = (id: string) => {
    const set = new Set(selectedClients);
    if (set.has(id)) set.delete(id);
    else set.add(id);
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const label = searchParams.get("label") ?? "Report";
    if (!from || !to) return;
    const p = buildParams(new Date(from), new Date(to), label, Array.from(set), sourceFilter);
    router.push(`/dashboard/reports?${p.toString()}`, { scroll: false });
  };

  const clearClients = () => {
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const label = searchParams.get("label") ?? "Report";
    if (!from || !to) return;
    const p = buildParams(new Date(from), new Date(to), label, [], sourceFilter);
    router.push(`/dashboard/reports?${p.toString()}`, { scroll: false });
  };

  const setSource = (src: string) => {
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const label = searchParams.get("label") ?? "Report";
    if (!from || !to) return;
    const p = buildParams(new Date(from), new Date(to), label, selectedClients, src);
    router.push(`/dashboard/reports?${p.toString()}`, { scroll: false });
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="-mx-1 flex items-center justify-start gap-2 overflow-x-auto px-1 pb-1 scrollbar-hide md:mx-0 md:flex-wrap md:justify-end md:overflow-visible md:px-0">
        {PRESETS.map((p) => {
          const active =
            p.id === "custom"
              ? customOpen || urlLabel === "Custom"
              : urlLabel === p.label;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => onPreset(p.id)}
              className={`shrink-0 rounded-md px-3 py-2.5 text-sm font-medium transition-colors md:py-1.5 ${
                active
                  ? "bg-[var(--accent)] text-accent-ink"
                  : "border border-border bg-surface-card text-ink-secondary hover:border-border-strong"
              }`}
            >
              {p.id === "last_90" ? "90 Days" : p.label}
            </button>
          );
        })}
      </div>
      {customOpen && (
        <div className="flex flex-wrap items-end gap-3 rounded-md border border-border bg-surface-card-alt p-4">
          <label className="font-mono text-[11px] text-ink-secondary">
            From
            <input
              type="date"
              className="input-base mt-1 block h-11 text-base md:h-9 md:text-sm"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
            />
          </label>
          <label className="font-mono text-[11px] text-ink-secondary">
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
            className="h-11 rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-accent-ink md:h-9"
          >
            Apply
          </button>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-[11px] uppercase text-ink-tertiary">Clients</span>
        <button
          type="button"
          onClick={() => clearClients()}
          className={`shrink-0 rounded-full border px-3 py-1.5 text-xs ${
            selectedClients.length === 0
              ? "border-border-strong bg-surface-card-alt text-ink-primary"
              : "border-border text-ink-secondary hover:border-border-strong"
          }`}
        >
          All clients
        </button>
        <div className="-mx-1 flex min-w-full gap-2 overflow-x-auto px-1 pb-1 scrollbar-hide md:contents">
        {clients.map((c) => {
          const on = selectedClients.includes(c.id);
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => toggleClient(c.id)}
              className={`shrink-0 rounded-full border px-3 py-1.5 text-xs ${
                on
                  ? "border-border-strong bg-surface-card-alt text-ink-primary"
                  : "border-border text-ink-secondary hover:border-border-strong"
              }`}
            >
              {c.name}
            </button>
          );
        })}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="-mx-1 flex min-w-full items-center gap-2 overflow-x-auto px-1 pb-1 scrollbar-hide md:mx-0 md:min-w-0 md:flex-wrap md:overflow-visible md:px-0">
          <span className="font-mono text-[11px] uppercase text-ink-tertiary">Source</span>
          {(["ALL", "FACEBOOK", "LANDING_PAGE", "MANUAL", "REFERRAL"] as const).map((s) => {
            const label =
              s === "ALL" ? "All" : s === "LANDING_PAGE" ? "Landing page" : s === "FACEBOOK" ? "Facebook" : s === "REFERRAL" ? "Referral" : "Manual";
            const active = (s === "ALL" && sourceFilter === "ALL") || sourceFilter === s;
            return (
              <button
                key={s}
                type="button"
                onClick={() => setSource(s === "ALL" ? "ALL" : s)}
                className={`shrink-0 rounded-full border px-3 py-1.5 text-xs ${
                  active
                    ? "border-border-strong bg-surface-card-alt text-ink-primary"
                    : "border-border text-ink-secondary hover:border-border-strong"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
        <ExportCsvButton />
      </div>
    </div>
  );
}
