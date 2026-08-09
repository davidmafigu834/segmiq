"use client";

import { useEffect, useMemo, useState } from "react";
import { addDays, format, parseISO } from "date-fns";
import {
  CalendarDays,
  Check,
  MapPin,
  Phone,
  Search,
  UserRound,
} from "lucide-react";
import { STAGE_LABELS } from "@/lib/inbox/scoring";
import { leadCardDisplayName } from "@/lib/leads/whatsapp-lead-display";
import {
  adaptLeadToCalendarEvent,
  getEventTypeColor,
  getEventTypeLabel,
  getEventTypeTint,
} from "@/lib/sales/calendar/adapters";
import type { CalendarEvent, CalendarEventKind } from "@/lib/sales/calendar/types";
import { SUPPORTED_EVENT_KINDS } from "@/lib/sales/calendar/types";
import { toDateKey } from "@/lib/sales/calendar/format";
import type { PriorityLead } from "@/lib/sales-priority-lead";
import { PremiumSheet } from "@/components/sales/PremiumSheet";
import { Button } from "@/components/sales/ui/Button";

const fieldClass =
  "h-11 w-full rounded-[10px] border border-sales-border bg-sales-surface px-3 text-[13px] text-sales-text-primary outline-none transition-colors placeholder:text-sales-text-muted focus:border-sales-brand focus:ring-2 focus:ring-[rgba(212,255,79,0.35)]";

export function AddEventSheet({
  leads,
  defaultDateKey,
  onClose,
  onCreated,
}: {
  leads: PriorityLead[];
  defaultDateKey: string;
  onClose: () => void;
  onCreated: (event: CalendarEvent) => void;
}) {
  const [kind, setKind] = useState<CalendarEventKind>("FOLLOW_UP");
  const [query, setQuery] = useState("");
  const [leadId, setLeadId] = useState("");
  const [date, setDate] = useState(defaultDateKey);
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return leads.slice(0, 8);
    return leads
      .filter((l) => {
        const name = leadCardDisplayName(l).toLowerCase();
        const phone = (l.phone || "").toLowerCase();
        return name.includes(q) || phone.includes(q);
      })
      .slice(0, 8);
  }, [leads, query]);

  const selected = leads.find((l) => l.id === leadId) ?? null;
  const selectedName = selected ? leadCardDisplayName(selected) : null;
  const stageLabel = selected?.status
    ? STAGE_LABELS[selected.status] ?? selected.status.replace(/_/g, " ")
    : null;

  useEffect(() => {
    if (!selectedName) return;
    const label =
      kind === "CALL"
        ? "Callback"
        : kind === "QUOTE_REVIEW"
          ? "Quote review"
          : "Follow-up call";
    setTitle(`${label} · ${selectedName}`);
  }, [selectedName, kind]);

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
    if (!leadId || !date) {
      setError("Choose a lead and date.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/leads/${leadId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ follow_up_date: date }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(json.error ?? "Could not schedule follow-up");
        return;
      }
      const event = adaptLeadToCalendarEvent(
        {
          id: leadId,
          name: selected?.name ?? null,
          phone: selected?.phone ?? null,
          location: null,
          follow_up_date: date,
          status: selected?.status ?? null,
          source: selected?.source ?? null,
          form_data: selected?.form_data ?? null,
          project_type: selected?.project_type ?? null,
          score: selected?.score ?? null,
        },
        undefined
      );
      if (event) {
        onCreated({
          ...event,
          kind: SUPPORTED_EVENT_KINDS.includes(kind) ? kind : event.kind,
          title: title.trim() || event.title,
          notes: notes.trim() || null,
        });
      } else {
        onClose();
      }
    } catch {
      setError("Could not schedule follow-up");
    } finally {
      setSaving(false);
    }
  }

  return (
    <PremiumSheet
      eyebrow="Calendar"
      title="Add event"
      description="Schedule a follow-up against a real lead."
      onClose={onClose}
      labelledBy="cal-add-event-title"
      size="md"
      footer={
        <div className="flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            className="flex-1"
            disabled={saving || !leadId || !date}
            loading={saving}
            onClick={handleSave}
          >
            {saving ? "Scheduling…" : "Schedule event"}
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
          <div>
            <p className="mb-2 text-[12px] font-medium text-sales-text-secondary">Event type</p>
            <div className="grid grid-cols-3 gap-2">
              {SUPPORTED_EVENT_KINDS.map((k) => {
                const active = kind === k;
                return (
                  <button
                    key={k}
                    type="button"
                    onClick={() => {
                      setKind(k);
                      setTitle("");
                    }}
                    className={[
                      "flex min-h-[44px] flex-col items-start rounded-[10px] border px-2.5 py-2 text-left transition-colors",
                      active
                        ? "border-[rgba(160,210,30,0.55)] bg-[rgba(212,255,79,0.16)]"
                        : "border-sales-border bg-sales-surface hover:bg-sales-surface-hover",
                    ].join(" ")}
                    aria-pressed={active}
                  >
                    <span className="flex items-center gap-1.5">
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ background: getEventTypeColor(k) }}
                        aria-hidden
                      />
                      <span className="text-[12px] font-semibold text-sales-text-primary">
                        {getEventTypeLabel(k)}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
            <p className="mt-2 text-[11px] leading-relaxed text-sales-text-muted">
              Saves as a lead follow-up date. Timed callbacks are set when logging a call.
            </p>
          </div>

          <div>
            <label className="mb-1.5 block text-[12px] font-medium text-sales-text-secondary" htmlFor="cal-add-title">
              Title
            </label>
            <input
              id="cal-add-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Follow-up call · Samson Kandare"
              className={fieldClass}
            />
          </div>

          <div>
            <label className="mb-1.5 block text-[12px] font-medium text-sales-text-secondary" htmlFor="cal-add-search">
              Lead / customer
            </label>
            <div className="relative">
              <Search
                size={16}
                strokeWidth={1.8}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sales-text-muted"
                aria-hidden
              />
              <input
                id="cal-add-search"
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search lead or customer..."
                className={`${fieldClass} pl-9`}
                autoComplete="off"
              />
            </div>

            {selected ? (
              <div className="mt-2 rounded-[12px] border border-[rgba(160,210,30,0.45)] bg-[rgba(212,255,79,0.08)] p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-semibold text-sales-text-primary">
                      {selectedName}
                    </p>
                    <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[12px] text-sales-text-secondary">
                      {selected.phone ? (
                        <span className="inline-flex items-center gap-1 font-mono">
                          <Phone size={12} strokeWidth={1.8} aria-hidden />
                          {selected.phone}
                        </span>
                      ) : null}
                      {stageLabel ? (
                        <span className="inline-flex items-center gap-1">
                          <UserRound size={12} strokeWidth={1.8} aria-hidden />
                          {stageLabel}
                        </span>
                      ) : null}
                      {selected.project_type ? (
                        <span className="inline-flex items-center gap-1">
                          <MapPin size={12} strokeWidth={1.8} aria-hidden />
                          {selected.project_type}
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setLeadId("");
                      setTitle("");
                    }}
                    className="text-[12px] font-semibold text-sales-text-secondary hover:text-sales-text-primary"
                  >
                    Change
                  </button>
                </div>
              </div>
            ) : (
              <ul className="mt-2 max-h-48 overflow-y-auto rounded-[12px] border border-sales-border bg-sales-surface">
                {filtered.map((lead) => {
                  const name = leadCardDisplayName(lead);
                  const stage = lead.status
                    ? STAGE_LABELS[lead.status] ?? lead.status.replace(/_/g, " ")
                    : null;
                  return (
                    <li key={lead.id} className="border-b border-[var(--sales-neutral-100)] last:border-b-0">
                      <button
                        type="button"
                        onClick={() => {
                          setLeadId(lead.id);
                          setQuery("");
                          setTitle("");
                        }}
                        className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-sales-surface-hover"
                      >
                        <span
                          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold text-sales-text-primary"
                          style={{ background: getEventTypeTint(kind) }}
                        >
                          {name.slice(0, 1).toUpperCase()}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13px] font-semibold text-sales-text-primary">
                            {name}
                          </span>
                          <span className="mt-0.5 block truncate text-[11px] text-sales-text-secondary">
                            {[lead.phone, stage].filter(Boolean).join(" · ")}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
                {!filtered.length ? (
                  <li className="px-3 py-5 text-center text-[12px] text-sales-text-muted">
                    No matching leads
                  </li>
                ) : null}
              </ul>
            )}
          </div>

          <div>
            <label className="mb-1.5 block text-[12px] font-medium text-sales-text-secondary" htmlFor="cal-add-date">
              Date
            </label>
            <div className="relative">
              <CalendarDays
                size={16}
                strokeWidth={1.8}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sales-text-muted"
                aria-hidden
              />
              <input
                id="cal-add-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className={`${fieldClass} pl-9`}
              />
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {quickDates.map((q) => {
                const active = date === q.value;
                return (
                  <button
                    key={q.value}
                    type="button"
                    onClick={() => setDate(q.value)}
                    className={[
                      "inline-flex h-8 items-center rounded-full border px-2.5 text-[11px] font-semibold transition-colors",
                      active
                        ? "border-[rgba(160,210,30,0.55)] bg-[rgba(212,255,79,0.22)] text-sales-text-primary"
                        : "border-sales-border bg-sales-surface text-sales-text-secondary hover:bg-sales-surface-hover",
                    ].join(" ")}
                  >
                    {active ? <Check size={12} strokeWidth={2} className="mr-1" aria-hidden /> : null}
                    {q.label}
                  </button>
                );
              })}
            </div>
            {date ? (
              <p className="mt-2 text-[12px] text-sales-text-secondary">
                Scheduled for{" "}
                <span className="font-semibold text-sales-text-primary">
                  {format(parseISO(`${date}T12:00:00`), "EEE, d MMM yyyy")}
                </span>
              </p>
            ) : null}
          </div>

          <div>
            <label className="mb-1.5 block text-[12px] font-medium text-sales-text-secondary" htmlFor="cal-add-notes">
              Notes <span className="font-normal text-sales-text-muted">(optional, session only)</span>
            </label>
            <textarea
              id="cal-add-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="What should you prepare for this meeting?"
              className="w-full resize-none rounded-[10px] border border-sales-border bg-sales-surface px-3 py-2.5 text-[13px] text-sales-text-primary outline-none placeholder:text-sales-text-muted focus:border-sales-brand focus:ring-2 focus:ring-[rgba(212,255,79,0.35)]"
            />
            <p className="mt-1 text-[11px] text-sales-text-muted">
              Notes stay on this calendar view until refresh. Use Log note on the event for CRM history.
            </p>
          </div>

          {error ? (
            <div className="rounded-[10px] border border-sales-danger/25 bg-sales-danger-soft px-3 py-2.5 text-[13px] text-sales-danger">
              {error}
            </div>
          ) : null}
      </div>
    </PremiumSheet>
  );
}
