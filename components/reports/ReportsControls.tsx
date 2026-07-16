"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { subDays } from "date-fns";
import { ExportCsvButton } from "@/components/reports/ExportCsvButton";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import {
  buildReportSearchParams,
  hasReportRange,
  rangeForPreset,
  REPORT_PRESETS,
  type ReportPresetId,
} from "@/lib/reports/report-range";

export type ClientOption = { id: string; name: string };

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
      const p = buildReportSearchParams(from, to, label, selectedClients, sourceFilter);
      router.push(`/dashboard/reports?${p.toString()}`, { scroll: false });
    },
    [router, selectedClients, sourceFilter]
  );

  useEffect(() => {
    if (hasReportRange(searchParams)) return;
    const { from, to, label } = rangeForPreset("this_month");
    const p = buildReportSearchParams(from, to, label, [], "ALL");
    router.replace(`/dashboard/reports?${p.toString()}`, { scroll: false });
  }, [searchParams, router]);

  const onPreset = (id: ReportPresetId) => {
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
    const from = new Date(customFrom + "T12:00:00");
    from.setHours(0, 0, 0, 0);
    const toDay = new Date(customTo + "T12:00:00");
    toDay.setHours(0, 0, 0, 0);
    const to = new Date(toDay);
    to.setDate(to.getDate() + 1);
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
    const p = buildReportSearchParams(new Date(from), new Date(to), label, Array.from(set), sourceFilter);
    router.push(`/dashboard/reports?${p.toString()}`, { scroll: false });
  };

  const clearClients = () => {
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const label = searchParams.get("label") ?? "Report";
    if (!from || !to) return;
    const p = buildReportSearchParams(new Date(from), new Date(to), label, [], sourceFilter);
    router.push(`/dashboard/reports?${p.toString()}`, { scroll: false });
  };

  const setSource = (src: string) => {
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const label = searchParams.get("label") ?? "Report";
    if (!from || !to) return;
    const p = buildReportSearchParams(new Date(from), new Date(to), label, selectedClients, src);
    router.push(`/dashboard/reports?${p.toString()}`, { scroll: false });
  };

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="-mx-1 flex items-center gap-2 overflow-x-auto px-1 pb-1 scrollbar-hide layout:mx-0 layout:flex-wrap layout:justify-end layout:overflow-visible layout:px-0">
        {REPORT_PRESETS.map((p) => {
          const active =
            p.id === "custom" ? customOpen || urlLabel === "Custom" : urlLabel === p.label;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => onPreset(p.id)}
              className={`shrink-0 rounded-md px-3 py-2.5 text-sm font-medium transition-colors sm:py-2 ${
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

      {customOpen ? (
        <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface-card-alt p-4 sm:flex-row sm:flex-wrap sm:items-end">
          <label className="min-w-0 flex-1 font-mono text-[11px] text-ink-secondary">
            From
            <Input
              type="date"
              className="mt-1 block h-11 sm:h-9"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
            />
          </label>
          <label className="min-w-0 flex-1 font-mono text-[11px] text-ink-secondary">
            To
            <Input
              type="date"
              className="mt-1 block h-11 sm:h-9"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
            />
          </label>
          <Button size="lg" className="w-full sm:w-auto" onClick={() => void applyCustom()}>
            Apply
          </Button>
        </div>
      ) : null}

      <div className="space-y-2">
        <span className="font-mono text-[11px] uppercase text-ink-tertiary">Clients</span>
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 scrollbar-hide layout:mx-0 layout:flex-wrap layout:overflow-visible layout:px-0">
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

      <div className="space-y-2">
        <span className="font-mono text-[11px] uppercase text-ink-tertiary">Source</span>
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 scrollbar-hide layout:mx-0 layout:flex-wrap layout:overflow-visible layout:px-0">
          {(["ALL", "FACEBOOK", "LANDING_PAGE", "MANUAL", "REFERRAL", "WHATSAPP_INBOUND"] as const).map((s) => {
            const label =
              s === "ALL"
                ? "All"
                : s === "LANDING_PAGE"
                  ? "Landing page"
                  : s === "FACEBOOK"
                    ? "Facebook"
                    : s === "REFERRAL"
                      ? "Referral"
                      : s === "WHATSAPP_INBOUND"
                        ? "WhatsApp"
                        : "Manual";
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
      </div>

      <div className="flex justify-stretch layout:justify-end">
        <ExportCsvButton />
      </div>
    </div>
  );
}
