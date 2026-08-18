"use client";

import { useMemo, useState } from "react";
import { addDays, format, parseISO } from "date-fns";
import { CalendarDays, Check } from "lucide-react";
import { adaptDealToCalendarEvent, adaptLeadToCalendarEvent, getEventTypeLabel, nextActionAtFromDateKey } from "@/lib/sales/calendar/adapters";
import type { CalendarEvent } from "@/lib/sales/calendar/types";
import { toDateKey } from "@/lib/sales/calendar/format";
import { PremiumSheet } from "@/components/sales/PremiumSheet";
import { Button } from "@/components/sales/ui/Button";

const fieldClass =
  "h-11 w-full rounded-sales-md border border-sales-border bg-sales-surface px-3 text-[13px] text-sales-text-primary outline-none transition-colors focus:border-sales-brand focus:shadow-[var(--sales-focus-ring)]";

export function EditEventSheet({
  event,
  saveDate,
  onClose,
  onUpdated,
}: {
  event: CalendarEvent;
  saveDate?: (date: string) => Promise<void>;
  onClose: () => void;
  onUpdated: (event: CalendarEvent) => void;
}) {
  const [date, setDate] = useState(() => {
    try {
      return toDateKey(parseISO(event.startAt));
    } catch {
      return format(new Date(), "yyyy-MM-dd");
    }
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const quickDates = useMemo(() => {
    const today = new Date();
    return [
      { label: "Today", value: toDateKey(today) },
      { label: "Tomorrow", value: toDateKey(addDays(today, 1)) },
      { label: "In 3 days", value: toDateKey(addDays(today, 3)) },
      { label: "Next week", value: toDateKey(addDays(today, 7)) },
    ];
  }, []);

  async function handleSave() {
    if (!date) {
      setError("Choose a date.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (saveDate) {
        await saveDate(date);
      } else if (event.dealId) {
        const nextAt = nextActionAtFromDateKey(date);
        const res = await fetch(`/api/deals/${event.dealId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ next_action_at: nextAt }),
        });
        const json = (await res.json().catch(() => ({}))) as { error?: string };
        if (!res.ok) {
          setError(json.error ?? "Could not reschedule");
          return;
        }
        const updated = adaptDealToCalendarEvent({
          id: event.dealId,
          name: event.customerName ?? "Deal",
          originatingLeadId: event.leadId,
          phone: event.phone,
          nextActionAt: nextAt,
          nextActionLabel: event.title,
          stage: event.status,
        });
        if (updated) onUpdated({ ...updated, kind: event.kind, notes: event.notes });
        else onClose();
        return;
      } else {
        const res = await fetch(`/api/leads/${event.leadId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ follow_up_date: date }),
        });
        const json = (await res.json().catch(() => ({}))) as { error?: string };
        if (!res.ok) {
          setError(json.error ?? "Could not reschedule");
          return;
        }
      }
      const sameDay =
        event.hasTimedCallback && toDateKey(parseISO(event.startAt)) === date;
      const updated = adaptLeadToCalendarEvent(
        {
          id: event.leadId,
          name: event.customerName,
          phone: event.phone,
          location: event.location,
          follow_up_date: date,
          status: event.status,
          source: event.source,
          project_type: event.projectType,
          score: event.leadScore,
          latestQuoteNumber: event.quoteNumber,
          latestQuoteStatus: event.quoteStatus,
          latestQuoteTotal: event.quoteTotal,
        },
        sameDay ? event.startAt : undefined
      );
      if (updated) onUpdated(updated);
      else onClose();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not reschedule");
    } finally {
      setSaving(false);
    }
  }

  return (
    <PremiumSheet
      eyebrow="Calendar"
      title="Reschedule"
      description={`${getEventTypeLabel(event.kind)} · ${event.customerName || "Lead"}`}
      onClose={onClose}
      labelledBy="cal-reschedule-title"
      size="sm"
      footer={
        <div className="flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            className="flex-1"
            disabled={saving || !date}
            loading={saving}
            onClick={handleSave}
          >
            {saving ? "Saving…" : "Save date"}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <div>
          <p className="mb-1.5 text-[12px] font-medium text-sales-text-secondary">Date</p>
          <div className="relative">
            <CalendarDays
              size={16}
              strokeWidth={1.8}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sales-text-muted"
            />
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className={`${fieldClass} pl-9`}
            />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {quickDates.map((q) => {
            const active = q.value === date;
            return (
              <button
                key={q.label}
                type="button"
                onClick={() => setDate(q.value)}
                className={[
                  "inline-flex items-center gap-1 rounded-sales-sm border px-2.5 py-1.5 text-[12px] font-medium transition-colors",
                  active
                    ? "border-sales-brand-border bg-sales-brand-soft text-sales-text-primary"
                    : "border-sales-border text-sales-text-secondary hover:bg-sales-surface-hover",
                ].join(" ")}
              >
                {active ? <Check size={12} strokeWidth={2} aria-hidden /> : null}
                {q.label}
              </button>
            );
          })}
        </div>
        {error ? (
          <div className="rounded-sales-md border border-sales-danger/25 bg-sales-danger-soft px-3 py-2.5 text-[13px] text-sales-danger">
            {error}
          </div>
        ) : null}
      </div>
    </PremiumSheet>
  );
}
