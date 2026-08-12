"use client";

import Link from "next/link";
import { CalendarDays, Phone, Handshake, FileText } from "lucide-react";
import { CardShell } from "@/components/dashboard/sales/KpiCard";
import { cn } from "@/lib/ui/cn";
import type { CompanyCalendarItem } from "./types";

function KindIcon({ kind }: { kind: CompanyCalendarItem["kind"] }) {
  if (kind === "call") return <Phone size={13} strokeWidth={1.8} aria-hidden />;
  if (kind === "deal_action") return <Handshake size={13} strokeWidth={1.8} aria-hidden />;
  if (kind === "quote_review") return <FileText size={13} strokeWidth={1.8} aria-hidden />;
  return <CalendarDays size={13} strokeWidth={1.8} aria-hidden />;
}

function kindTint(kind: CompanyCalendarItem["kind"]): string {
  if (kind === "call") return "bg-sales-info-soft text-sales-info-fg";
  if (kind === "deal_action") return "bg-sales-teal-soft text-sales-teal-fg";
  if (kind === "quote_review") return "bg-sales-warning-soft text-sales-warning-fg";
  return "bg-sales-brand-soft-solid text-sales-brand-fg";
}

function groupByDay(items: CompanyCalendarItem[]): Array<{ key: string; label: string; items: CompanyCalendarItem[] }> {
  const map = new Map<string, CompanyCalendarItem[]>();
  for (const item of items) {
    const list = map.get(item.dayKey) ?? [];
    list.push(item);
    map.set(item.dayKey, list);
  }
  return [...map.entries()].map(([key, group]) => ({
    key,
    label: group[0]?.dayLabel ?? key,
    items: group,
  }));
}

export function CompanyTeamCalendarCard({
  items,
  overdueCount,
}: {
  items: CompanyCalendarItem[];
  overdueCount: number;
}) {
  const upcoming = items.filter((i) => !i.overdue).slice(0, 8);
  const overdue = items.filter((i) => i.overdue).slice(0, 3);
  const groups = groupByDay(upcoming);

  return (
    <CardShell
      title="Team calendar"
      action={<span className="text-[12px] font-medium text-sales-text-muted">Next 7 days</span>}
    >
      <div className="px-4 py-3 sm:px-5">
        {overdue.length > 0 ? (
          <div className="mb-3 rounded-[10px] border border-sales-danger/20 bg-sales-danger-soft px-3 py-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.04em] text-sales-danger-fg">
              Overdue · {overdueCount}
            </p>
            <ul className="mt-1.5 space-y-1.5">
              {overdue.map((item) => (
                <li key={item.id}>
                  <Link
                    href={item.href}
                    className="flex min-h-9 items-start justify-between gap-2 rounded-[8px] px-1 py-0.5 hover:bg-white/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sales-brand"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-[12px] font-medium text-sales-text-primary">
                        {item.title}
                      </p>
                      <p className="truncate text-[11px] text-sales-text-muted">
                        {item.ownerName ?? "Unassigned"}
                        {item.customerName ? ` · ${item.customerName}` : ""}
                      </p>
                    </div>
                    <span className="shrink-0 text-[11px] font-medium text-sales-danger-fg">
                      {item.timeLabel}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {groups.length === 0 && overdue.length === 0 ? (
          <div className="flex min-h-[140px] flex-col items-center justify-center px-2 py-6 text-center">
            <span className="mb-2 flex h-8 w-8 items-center justify-center rounded-[8px] bg-[var(--sales-neutral-100)] text-sales-text-muted">
              <CalendarDays size={16} strokeWidth={1.8} aria-hidden />
            </span>
            <p className="text-[13px] font-medium text-sales-text-primary">No team agenda this week</p>
            <p className="mt-1 max-w-[220px] text-[12px] text-sales-text-muted">
              Follow-ups and Deal next actions across the team will appear here.
            </p>
          </div>
        ) : groups.length === 0 ? (
          <p className="py-4 text-center text-[12px] text-sales-text-muted">
            No upcoming items in the next 7 days.
          </p>
        ) : (
          <div className="max-h-[280px] space-y-3 overflow-y-auto overscroll-contain pr-0.5">
            {groups.map((group) => (
              <div key={group.key}>
                <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.04em] text-sales-text-muted">
                  {group.label}
                </p>
                <ul className="space-y-1">
                  {group.items.map((item) => (
                    <li key={item.id}>
                      <Link
                        href={item.href}
                        className="flex min-h-10 items-center gap-2.5 rounded-[8px] px-1.5 py-1.5 transition-colors hover:bg-sales-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sales-brand"
                      >
                        <span
                          className={cn(
                            "flex h-7 w-7 shrink-0 items-center justify-center rounded-[7px]",
                            kindTint(item.kind)
                          )}
                        >
                          <KindIcon kind={item.kind} />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[12px] font-medium text-sales-text-primary">
                            {item.title}
                          </p>
                          <p className="truncate text-[11px] text-sales-text-muted">
                            {item.ownerName ?? "Unassigned"}
                            {item.customerName ? ` · ${item.customerName}` : ""}
                          </p>
                        </div>
                        <span className="shrink-0 text-[11px] tabular-nums text-sales-text-secondary">
                          {item.timeLabel}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </div>
    </CardShell>
  );
}
