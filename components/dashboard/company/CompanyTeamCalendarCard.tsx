"use client";

import Link from "next/link";
import { CalendarDays, Phone, Handshake, FileText } from "lucide-react";
import { cn } from "@/lib/ui/cn";
import { CompanyDashCard, CompanyDashEmpty, PeriodChip } from "./CompanyDashCard";
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

function groupByDay(
  items: CompanyCalendarItem[]
): Array<{ key: string; label: string; items: CompanyCalendarItem[] }> {
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
  const upcoming = items.filter((item) => !item.overdue).slice(0, 8);
  const overdue = items.filter((item) => item.overdue).slice(0, 3);
  const groups = groupByDay(upcoming);

  return (
    <CompanyDashCard
      title="Team calendar"
      className="dashboard-panel--feed h-full"
      action={<PeriodChip>Next 7 days</PeriodChip>}
    >
      <div className="px-4 py-3 sm:px-5">
        {overdue.length > 0 ? (
          <div className="mb-3 rounded-[12px] border border-sales-danger/20 bg-sales-danger-soft px-3 py-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-sales-danger-fg">
              Overdue · {overdueCount}
            </p>
            <ul className="mt-1.5 space-y-1">
              {overdue.map((item) => (
                <li key={item.id}>
                  <Link
                    href={item.href}
                    className="flex min-h-9 items-start justify-between gap-2 rounded-[8px] px-1 py-0.5 hover:bg-white/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sales-brand dark:hover:bg-black/10"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-[12px] font-medium text-sales-text-primary">{item.title}</p>
                      <p className="truncate text-[11px] text-sales-text-muted">
                        {item.ownerName ?? "Unassigned"}
                        {item.customerName ? ` · ${item.customerName}` : ""}
                      </p>
                    </div>
                    <span className="shrink-0 text-[11px] font-medium tabular-nums text-sales-danger-fg">
                      {item.timeLabel}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {groups.length === 0 && overdue.length === 0 ? (
          <CompanyDashEmpty
            title="No team agenda this week"
            description="Follow-ups and Deal next actions across the team will appear here."
          />
        ) : groups.length === 0 ? (
          <p className="py-4 text-center text-[12px] text-sales-text-muted">
            No upcoming items in the next 7 days.
          </p>
        ) : (
          <div className="max-h-[280px] space-y-3 overflow-y-auto overscroll-contain pr-0.5">
            {groups.map((group) => (
              <div key={group.key}>
                <p
                  className={cn(
                    "dashboard-date-chip mb-1.5",
                    group.label === "Today" && "dashboard-date-chip--today"
                  )}
                >
                  {group.label}
                </p>
                <ul className="space-y-0.5">
                  {group.items.map((item) => (
                    <li key={item.id}>
                      <Link
                        href={item.href}
                        className="dashboard-list-row flex items-center gap-2.5 rounded-[10px] px-1.5 py-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sales-brand"
                      >
                        <span
                          className={cn(
                            "flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px]",
                            kindTint(item.kind)
                          )}
                        >
                          <KindIcon kind={item.kind} />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[13px] font-medium text-sales-text-primary">{item.title}</p>
                          <p className="truncate text-[11px] text-sales-text-muted">
                            {item.ownerName ?? "Unassigned"}
                            {item.customerName ? ` · ${item.customerName}` : ""}
                          </p>
                        </div>
                        <span className="w-12 shrink-0 text-right text-[11px] font-medium tabular-nums text-sales-text-muted">
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
    </CompanyDashCard>
  );
}
