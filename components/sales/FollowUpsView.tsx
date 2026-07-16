"use client";

import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { format, parseISO, startOfMonth } from "date-fns";
import { CalendarClock } from "lucide-react";
import { FollowUpsCalendar, isDateKeyToday } from "@/components/sales/FollowUpsCalendar";
import { EmptyState } from "@/components/ui";
import {
  type FollowUpGroupKey,
  type FollowUpLead,
  filterLeadsByDateKey,
  getFollowUpDateTime,
  groupFollowUps,
  buildFollowUpCountByDateKey,
} from "@/lib/follow-ups-view";

type FollowUpsViewProps = {
  leads: FollowUpLead[];
  callbackAtByLeadId: Record<string, string>;
  sourceByLeadId?: Record<string, string | null>;
};

function FollowUpRow({
  lead,
  callbackAtByLeadId,
  overdue,
  source,
}: {
  lead: FollowUpLead;
  callbackAtByLeadId: Record<string, string>;
  overdue?: boolean;
  source?: string | null;
}) {
  const at = getFollowUpDateTime(lead, callbackAtByLeadId);
  const href =
    source === "WHATSAPP_INBOUND"
      ? `/sales/inbox?lead=${lead.id}`
      : `/sales/leads?lead=${lead.id}`;

  return (
    <li className="border-b border-border last:border-b-0">
      <Link
        href={href}
        prefetch={false}
        className={[
          "flex items-center justify-between gap-3 px-4 py-3 hover:bg-surface-card-alt",
          overdue ? "border-l-2 border-l-[var(--danger)]" : "",
        ].join(" ")}
      >
        <div className="min-w-0 flex-1">
          <div className="truncate font-medium text-ink-primary">{lead.name ?? "—"}</div>
          <div className="font-mono text-xs text-ink-tertiary">{lead.phone ?? "—"}</div>
          <div className="mt-1 text-[11px] text-ink-secondary">{lead.clientName}</div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="font-mono text-xs text-ink-secondary">
            {at ? format(at, "HH:mm") : ""}
          </span>
          {overdue ? (
            <span className="rounded-md bg-[var(--danger)] px-2 py-0.5 font-mono text-[10px] uppercase text-white">
              Overdue
            </span>
          ) : null}
          <span className="text-xs font-medium text-ink-secondary">Open →</span>
        </div>
      </Link>
    </li>
  );
}

function FollowUpList({
  items,
  callbackAtByLeadId,
  overdue,
  emptyMessage,
  sourceByLeadId = {},
}: {
  items: FollowUpLead[];
  callbackAtByLeadId: Record<string, string>;
  overdue?: boolean;
  emptyMessage?: string;
  sourceByLeadId?: Record<string, string | null>;
}) {
  if (!items.length) {
    return emptyMessage ? (
      <p className="border border-border border-t-0 bg-surface-card px-4 py-6 text-sm text-ink-tertiary">
        {emptyMessage}
      </p>
    ) : null;
  }

  return (
    <ul className="divide-y divide-border border border-border border-t-0 bg-surface-card">
      {items.map((lead) => (
        <FollowUpRow
          key={lead.id}
          lead={lead}
          callbackAtByLeadId={callbackAtByLeadId}
          overdue={overdue}
          source={sourceByLeadId[lead.id] ?? null}
        />
      ))}
    </ul>
  );
}

export function FollowUpsView({ leads, callbackAtByLeadId, sourceByLeadId = {} }: FollowUpsViewProps) {
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(null);

  const groups = useMemo(
    () => groupFollowUps(leads, callbackAtByLeadId),
    [leads, callbackAtByLeadId]
  );

  const countByDateKey = useMemo(
    () => buildFollowUpCountByDateKey(leads, callbackAtByLeadId),
    [leads, callbackAtByLeadId]
  );

  const weekScheduledCount =
    groups.OVERDUE.length +
    groups.TODAY.length +
    groups.TOMORROW.length +
    groups.THIS_WEEK.length;

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfTomorrow = new Date(startOfToday.getTime() + 86400000);

  const selectedDayLeads = useMemo(() => {
    if (!selectedDateKey) return [];
    return filterLeadsByDateKey(leads, callbackAtByLeadId, selectedDateKey);
  }, [leads, callbackAtByLeadId, selectedDateKey]);

  const selectedDayOverdue = selectedDateKey
    ? parseISO(`${selectedDateKey}T12:00:00`) < startOfToday
    : false;

  const sections: { key: FollowUpGroupKey; label: ReactNode }[] = [
    {
      key: "OVERDUE",
      label: (
        <span className="flex items-center gap-2 text-[var(--danger-fg)]">
          <span className="h-1.5 w-1.5 rounded-full bg-[var(--danger)]" aria-hidden />
          OVERDUE
        </span>
      ),
    },
    {
      key: "TODAY",
      label: <span>TODAY · {format(startOfToday, "EEEE d MMMM")}</span>,
    },
    {
      key: "TOMORROW",
      label: <span>TOMORROW · {format(startOfTomorrow, "EEEE d MMMM")}</span>,
    },
    { key: "THIS_WEEK", label: <span>THIS WEEK</span> },
    { key: "LATER", label: <span>LATER</span> },
  ];

  return (
    <div className="space-y-6 sm:space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <p className="text-sm text-ink-secondary">
          {weekScheduledCount > 0
            ? `You have ${weekScheduledCount} call${weekScheduledCount === 1 ? "" : "s"} scheduled this week.`
            : "No follow-ups scheduled this week."}
        </p>
        <div className="flex flex-wrap gap-2">
          {groups.OVERDUE.length > 0 ? (
            <span className="rounded-md border border-[var(--danger-border)] bg-[var(--danger-bg)] px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--danger-fg)]">
              {groups.OVERDUE.length} overdue
            </span>
          ) : null}
          {groups.TODAY.length > 0 ? (
            <span className="rounded-md border border-[var(--accent-border)] bg-[var(--accent-muted)] px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--accent-fg)]">
              {groups.TODAY.length} today
            </span>
          ) : null}
        </div>
      </div>

      <FollowUpsCalendar
        month={month}
        onMonthChange={setMonth}
        countByDateKey={countByDateKey}
        selectedDateKey={selectedDateKey}
        onSelectDate={setSelectedDateKey}
      />

      {selectedDateKey ? (
        <section>
          <div className="sticky top-0 z-10 border-b border-border bg-surface-canvas px-4 py-2 font-mono text-[11px] uppercase tracking-[0.1em] text-ink-secondary">
            {isDateKeyToday(selectedDateKey) ? (
              <span>TODAY · {format(parseISO(`${selectedDateKey}T12:00:00`), "EEEE d MMMM")}</span>
            ) : (
              <span>{format(parseISO(`${selectedDateKey}T12:00:00`), "EEEE d MMMM")}</span>
            )}
          </div>
          <FollowUpList
            items={selectedDayLeads}
            callbackAtByLeadId={callbackAtByLeadId}
            overdue={selectedDayOverdue}
            emptyMessage="No follow-ups on this day."
          />
        </section>
      ) : (
        <div className="space-y-8 sm:space-y-10">
          {sections.map(({ key, label }) => {
            const items = groups[key];
            if (!items.length) return null;
            const overdueSection = key === "OVERDUE";
            return (
              <section key={key}>
                <div className="sticky top-0 z-10 border-b border-border bg-surface-canvas px-4 py-2 font-mono text-[11px] uppercase tracking-[0.1em] text-ink-secondary">
                  {label}
                </div>
                <FollowUpList
                  items={items}
                  callbackAtByLeadId={callbackAtByLeadId}
                  overdue={overdueSection}
                  sourceByLeadId={sourceByLeadId}
                />
              </section>
            );
          })}
          {!leads.length ? (
            <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-card)]">
              <EmptyState
                icon={CalendarClock}
                title="No follow-ups scheduled"
                description="Follow-ups you schedule on a lead will appear here."
              />
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
