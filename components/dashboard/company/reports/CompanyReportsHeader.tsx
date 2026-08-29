"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { addDays, format, startOfDay, subDays } from "date-fns";
import { CalendarDays, Download, Filter } from "lucide-react";
import { CompanyDashboardHeader } from "../CompanyDashboardHeader";
import { Button } from "@/components/sales/ui";
import {
  COMPANY_REPORT_PRESETS,
  formatRangeLabel,
  rangeForCompanyPreset,
  type CompanyReportPresetId,
} from "@/lib/sales/company-reports/range";
import type { UserRole } from "@/types";
import { cn } from "@/lib/ui/cn";

export function CompanyReportsHeader({
  unreadNotifications,
  notificationRole,
  userName,
  avatarUrl,
  from,
  to,
  preset,
  ownerId,
  owners,
  onRange,
  onOwner,
  onExport,
}: {
  unreadNotifications: number;
  notificationRole: UserRole;
  userName: string;
  avatarUrl?: string | null;
  from: Date;
  to: Date;
  preset: CompanyReportPresetId;
  ownerId: string | null;
  owners: Array<{ id: string; name: string }>;
  onRange: (from: Date, to: Date, preset: CompanyReportPresetId) => void;
  onOwner: (ownerId: string | null) => void;
  onExport: () => void;
}) {
  return (
    <CompanyDashboardHeader
      unreadNotifications={unreadNotifications}
      notificationRole={notificationRole}
      userName={userName}
      avatarUrl={avatarUrl}
      canAddLead={false}
      breadcrumb="Company / Reports"
      title="Reports"
      description="Track performance, measure results and make data-driven decisions."
      primaryAction={
        <Button variant="primary" size="md" leftIcon={<Download size={15} />} onClick={onExport}>
          Export
        </Button>
      }
    />
  );
}

export function DateRangeControl({
  from,
  to,
  preset,
  onRange,
}: {
  from: Date;
  to: Date;
  preset: CompanyReportPresetId;
  onRange: (from: Date, to: Date, preset: CompanyReportPresetId) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const lastInclusive = subDays(to, 1);
  const [customFrom, setCustomFrom] = useState(format(from, "yyyy-MM-dd"));
  const [customTo, setCustomTo] = useState(format(lastInclusive, "yyyy-MM-dd"));

  useEffect(() => {
    setCustomFrom(format(from, "yyyy-MM-dd"));
    setCustomTo(format(subDays(to, 1), "yyyy-MM-dd"));
  }, [from, to]);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <Button
        variant="secondary"
        size="sm"
        leftIcon={<CalendarDays size={14} strokeWidth={1.8} />}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        {formatRangeLabel(from, to)}
      </Button>
      {open ? (
        <div
          role="dialog"
          aria-label="Select date range"
          className="absolute right-0 z-30 mt-2 w-[280px] rounded-[12px] border border-sales-border bg-sales-surface p-3 shadow-sales-popover"
        >
          <div className="grid gap-1">
            {COMPANY_REPORT_PRESETS.filter((p) => p.id !== "custom").map((p) => (
              <button
                key={p.id}
                type="button"
                className={cn(
                  "rounded-[8px] px-2.5 py-2 text-left text-[13px] text-sales-text-primary hover:bg-sales-surface-hover",
                  preset === p.id && "bg-sales-brand-soft-solid font-medium"
                )}
                onClick={() => {
                  const r = rangeForCompanyPreset(p.id as Exclude<CompanyReportPresetId, "custom">);
                  onRange(r.from, r.to, r.preset);
                  setOpen(false);
                }}
              >
                {p.label}
              </button>
            ))}
          </div>
          <div className="mt-3 border-t border-sales-border-subtle pt-3">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.04em] text-sales-text-muted">
              Custom
            </p>
            <label className="mb-2 block text-[11px] text-sales-text-muted">
              From
              <input
                type="date"
                className="mt-1 h-9 w-full rounded-[8px] border border-sales-border-strong bg-sales-surface px-2 text-[13px] text-sales-text-primary"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
              />
            </label>
            <label className="mb-2 block text-[11px] text-sales-text-muted">
              To
              <input
                type="date"
                className="mt-1 h-9 w-full rounded-[8px] border border-sales-border-strong bg-sales-surface px-2 text-[13px] text-sales-text-primary"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
              />
            </label>
            <Button
              variant="primary"
              size="sm"
              className="w-full"
              onClick={() => {
                if (!customFrom || !customTo) return;
                const nextFrom = startOfDay(new Date(`${customFrom}T12:00:00`));
                const nextTo = startOfDay(addDays(new Date(`${customTo}T12:00:00`), 1));
                if (nextFrom >= nextTo) return;
                onRange(nextFrom, nextTo, "custom");
                setOpen(false);
              }}
            >
              Apply
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function FiltersControl({
  ownerId,
  owners,
  onOwner,
}: {
  ownerId: string | null;
  owners: Array<{ id: string; name: string }>;
  onOwner: (ownerId: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const active = Boolean(ownerId);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const options = useMemo(() => owners, [owners]);

  return (
    <div className="relative" ref={ref}>
      <Button
        variant="secondary"
        size="sm"
        leftIcon={<Filter size={14} strokeWidth={1.8} />}
        className={active ? "border-sales-brand-border" : undefined}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        Filters
      </Button>
      {open ? (
        <div className="absolute right-0 z-30 mt-2 w-[260px] rounded-[12px] border border-sales-border bg-sales-surface p-3 shadow-sales-popover">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.04em] text-sales-text-muted">
            Salesperson
          </p>
          <select
            className="h-9 w-full rounded-[8px] border border-sales-border-strong bg-sales-surface px-2 text-[13px] text-sales-text-primary"
            value={ownerId ?? ""}
            onChange={(e) => onOwner(e.target.value || null)}
          >
            <option value="">All salespeople</option>
            {options.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
          <p className="mt-2 text-[11px] leading-relaxed text-sales-text-muted">
            Applies to Leads (assignee) and Deals (owner). Branch is not a company dimension yet.
          </p>
          {active ? (
            <button
              type="button"
              className="mt-2 text-[12px] font-medium text-sales-brand-fg hover:underline"
              onClick={() => onOwner(null)}
            >
              Clear filters
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
