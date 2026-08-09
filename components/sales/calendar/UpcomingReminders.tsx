"use client";

import Link from "next/link";
import { AlarmClock } from "lucide-react";
import { parseISO, startOfDay } from "date-fns";
import { formatRelativeEventDate } from "@/lib/sales/calendar/format";
import { getEventTypeLabel } from "@/lib/sales/calendar/adapters";
import type { CalendarEvent } from "@/lib/sales/calendar/types";

export function UpcomingReminders({ events }: { events: CalendarEvent[] }) {
  const now = new Date();
  const startToday = startOfDay(now);

  const reminders = events
    .filter((e) => {
      try {
        const start = parseISO(e.startAt);
        return start >= startToday && !e.overdue;
      } catch {
        return false;
      }
    })
    .filter((e) => {
      try {
        return parseISO(e.startAt) > now || !e.hasTimedCallback;
      } catch {
        return true;
      }
    })
    .slice(0, 4);

  return (
    <div className="cal-card p-3">
      <h2 className="mb-2 text-[14px] font-semibold text-[#101828]">Upcoming reminders</h2>

      {!reminders.length ? (
        <div className="rounded-[10px] bg-[#F9FAFB] px-3 py-4 text-center">
          <p className="text-[13px] font-semibold text-[#101828]">No upcoming reminders</p>
          <p className="mt-0.5 text-[12px] text-[#667085]">
            Scheduled follow-ups and callbacks will appear here.
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {reminders.map((event) => (
            <li key={event.id} className="flex items-start gap-2">
              <AlarmClock
                size={14}
                strokeWidth={1.8}
                className="mt-0.5 shrink-0 text-[#667085]"
                aria-hidden
              />
              <div className="min-w-0">
                <p className="truncate text-[13px] font-medium text-[#101828]">
                  {event.kind === "CALL"
                    ? `Call back ${event.customerName ?? "lead"}`
                    : event.kind === "QUOTE_REVIEW"
                      ? `Review quote with ${event.customerName ?? "lead"}`
                      : `Follow up with ${event.customerName ?? "lead"}`}
                </p>
                <p className="text-[12px] text-[#667085]">
                  {formatRelativeEventDate(event.startAt)}
                  {!event.hasTimedCallback ? " · All day" : ""}
                </p>
                <p className="sr-only">{getEventTypeLabel(event.kind)}</p>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Link
        href="/sales/followups"
        className="mt-2.5 inline-flex text-[12px] font-semibold text-[#101828] underline-offset-2 hover:underline"
      >
        View all reminders →
      </Link>
    </div>
  );
}
