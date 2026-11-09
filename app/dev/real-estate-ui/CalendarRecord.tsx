"use client";

import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { ViewingRecord, type ViewingStatus } from "./ViewingRecord";

type Kind = "viewing" | "follow-up" | "call";
type View = "week" | "month";

type Appt = {
  id: string;
  date: string;
  time: string;
  name: string;
  kind: Kind;
  place: string;
  overdue?: boolean;
  phone?: string;
  status?: ViewingStatus;
  note?: string;
};

const TODAY = "2026-11-09";
const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const KIND_LABEL: Record<Kind, string> = { viewing: "Viewing", "follow-up": "Follow-up", call: "Call" };

const SEED: Appt[] = [
  { id: "overdue-tendai", date: "2026-11-08", time: "16:00", name: "Tendai Moyo", kind: "follow-up", place: "Borrowdale search", overdue: true, phone: "+263 77 200 1144" },
  { id: "view-rudo", date: "2026-11-09", time: "09:30", name: "Rudo Ncube", kind: "viewing", place: "4 Borrowdale Brooke" },
  { id: "follow-farai", date: "2026-11-09", time: "14:00", name: "Farai Dube", kind: "follow-up", place: "Mount Pleasant search", phone: "+263 77 555 0190" },
  { id: "view-tawonga", date: "2026-11-10", time: "10:00", name: "Tawonga Creig", kind: "viewing", place: "2 Baines Avenue" },
  { id: "view-chipo", date: "2026-11-11", time: "15:30", name: "Chipo Ndlovu", kind: "viewing", place: "8 Stonechat Lane", phone: "+263 77 418 2201" },
  { id: "view-farai", date: "2026-11-12", time: "16:00", name: "Farai Dube", kind: "viewing", place: "Flat 4B, Kensington", phone: "+263 77 555 0190" },
  { id: "call-david", date: "2026-11-13", time: "11:00", name: "David Mafigu", kind: "call", place: "2 Baines Avenue", phone: "+263 77 412 8806" },
];

function parseKey(key: string) {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function keyOf(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function addDays(key: string, amount: number) {
  const date = parseKey(key);
  date.setDate(date.getDate() + amount);
  return keyOf(date);
}

function startOfWeek(key: string) {
  const day = parseKey(key).getDay();
  return addDays(key, day === 0 ? -6 : 1 - day);
}

function weekKeys(key: string) {
  const start = startOfWeek(key);
  return Array.from({ length: 7 }, (_, index) => addDays(start, index));
}

function monthKeys(key: string) {
  const date = parseKey(key);
  const first = new Date(date.getFullYear(), date.getMonth(), 1);
  const start = new Date(first);
  start.setDate(1 - ((first.getDay() + 6) % 7));
  return Array.from({ length: 42 }, (_, index) => {
    const day = new Date(start);
    day.setDate(start.getDate() + index);
    return keyOf(day);
  });
}

function longDate(key: string) {
  const date = parseKey(key);
  return `${WEEKDAYS[date.getDay()]} ${date.getDate()} ${MONTHS[date.getMonth()]}`;
}

function rangeLabel(start: string) {
  const endKey = addDays(start, 6);
  const end = parseKey(endKey);
  const from = parseKey(start);
  if (from.getMonth() === end.getMonth()) return `${from.getDate()}–${end.getDate()} ${MONTHS[from.getMonth()]}`;
  return `${from.getDate()} ${MONTHS[from.getMonth()].slice(0, 3)} – ${end.getDate()} ${MONTHS[end.getMonth()].slice(0, 3)}`;
}

function sameMonth(key: string, monthKey: string) {
  const day = parseKey(key);
  const month = parseKey(monthKey);
  return day.getFullYear() === month.getFullYear() && day.getMonth() === month.getMonth();
}

export function CalendarRecord({ loading }: { loading: boolean }) {
  const [view, setView] = useState<View>("week");
  const [cursor, setCursor] = useState(TODAY);
  const [selected, setSelected] = useState(TODAY);
  const [events, setEvents] = useState<Appt[]>(SEED);
  const [selectedId, setSelectedId] = useState<string | null>("view-rudo");
  const [booking, setBooking] = useState(false);
  const [draft, setDraft] = useState({ name: "", place: "", date: TODAY, time: "10:00" });
  const [openId, setOpenId] = useState<string | null>(null);

  const week = weekKeys(cursor);
  const month = monthKeys(cursor);
  const selectedEvent = events.find((item) => item.id === selectedId) ?? null;
  const dayEvents = events.filter((item) => item.date === selected).sort((a, b) => a.time.localeCompare(b.time));
  const stillOpen = events.filter((item) => item.overdue && item.date !== selected).sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));
  const viewingsThisWeek = events.filter((item) => item.kind === "viewing" && week.includes(item.date)).length;
  const overdueCount = events.filter((item) => item.overdue).length;
  const monthDate = parseKey(cursor);
  const monthCount = events.filter((item) => sameMonth(item.date, cursor)).length;
  const openItem = events.find((item) => item.id === openId && item.kind === "viewing") ?? null;

  useEffect(() => {
    if (!openId) return;
    document.querySelector(".re-mock")?.scrollTo({ top: 0 });
  }, [openId]);

  function pickDay(key: string) {
    setSelected(key);
    setCursor(key);
    setBooking(false);
    setDraft((current) => ({ ...current, date: key }));
    setSelectedId((current) => (events.some((item) => item.id === current && item.date === key) ? current : null));
  }

  function shift(direction: -1 | 1) {
    setBooking(false);
    setSelectedId(null);
    if (view === "week") {
      const next = addDays(selected, direction * 7);
      setSelected(next);
      setCursor(next);
      setDraft((current) => ({ ...current, date: next }));
      return;
    }
    const nextMonth = new Date(monthDate.getFullYear(), monthDate.getMonth() + direction, 1);
    const key = keyOf(nextMonth);
    setSelected(key);
    setCursor(key);
    setDraft((current) => ({ ...current, date: key }));
  }

  function goToday() {
    setSelected(TODAY);
    setCursor(TODAY);
    setBooking(false);
    setSelectedId("view-rudo");
    setDraft((current) => ({ ...current, date: TODAY }));
  }

  function choose(item: Appt) {
    setSelected(item.date);
    setCursor(item.date);
    setSelectedId(item.id);
    setBooking(false);
  }

  function book(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = draft.name.trim();
    const place = draft.place.trim();
    if (!name || !place || !draft.date || !draft.time) return;
    const id = `booked-${draft.date}-${draft.time}`;
    const next: Appt = { id, date: draft.date, time: draft.time, name, kind: "viewing", place };
    setEvents((current) => [...current.filter((item) => item.id !== id), next]);
    setSelected(draft.date);
    setCursor(draft.date);
    setSelectedId(id);
    setBooking(false);
    setDraft({ name: "", place: "", date: draft.date, time: "10:00" });
  }

  function patchViewing(id: string, patch: Partial<Appt>) {
    setEvents((current) => current.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }

  if (openItem) {
    return (
      <ViewingRecord
        name={openItem.name}
        place={openItem.place}
        when={`${longDate(openItem.date)} · ${openItem.time}`}
        phone={openItem.phone}
        status={openItem.status ?? "scheduled"}
        note={openItem.note ?? ""}
        onClose={() => setOpenId(null)}
        onSave={(note) => patchViewing(openItem.id, { status: "recorded", note })}
        onCancel={() => patchViewing(openItem.id, { status: "cancelled" })}
      />
    );
  }

  const summary = view === "week"
    ? `${viewingsThisWeek === 1 ? "1 viewing" : `${viewingsThisWeek} viewings`} this week.${overdueCount ? ` ${overdueCount === 1 ? "1 follow-up is still open." : `${overdueCount} follow-ups are still open.`}` : ""}`
    : `${monthCount === 1 ? "1 appointment" : `${monthCount} appointments`} in ${MONTHS[monthDate.getMonth()]}.${overdueCount ? ` ${overdueCount === 1 ? "1 follow-up is still open." : `${overdueCount} follow-ups are still open.`}` : ""}`;

  return (
    <div className="space-y-5">
      <div className="re-head flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[13px] font-medium text-sales-text-muted">Schedule</p>
          <h1 className="mt-1 font-display text-[32px] font-semibold leading-none tracking-[-0.03em]">Calendar</h1>
          <p className="mt-2 text-[14px] text-sales-text-secondary">{summary}</p>
        </div>
        <button
          type="button"
          onClick={() => {
            setBooking(true);
            setDraft((current) => ({ ...current, date: selected }));
          }}
          className="re-fill inline-flex h-11 items-center justify-center gap-2 rounded-[10px] bg-sales-brand px-4 text-[14px] font-semibold text-sales-brand-text"
        >
          <Plus size={16} strokeWidth={1.75} aria-hidden />
          Book a viewing
        </button>
      </div>

      <div className="re-bar flex flex-wrap items-center justify-between gap-3">
        <div className="re-toggle flex rounded-[10px] border border-sales-border bg-sales-surface p-1" role="group" aria-label="Calendar view">
          {(["week", "month"] as const).map((item) => (
            <button
              key={item}
              type="button"
              aria-pressed={view === item}
              onClick={() => setView(item)}
              className={`h-9 rounded-[8px] px-3 text-[13px] font-semibold capitalize transition-colors ${view === item ? "bg-sales-text-primary text-sales-surface" : "text-sales-text-secondary hover:bg-sales-surface-hover hover:text-sales-text-primary"}`}
            >
              {item}
            </button>
          ))}
        </div>
        <div className="re-pager flex items-center gap-2">
          <button type="button" onClick={goToday} className="h-11 rounded-[10px] border border-sales-border bg-sales-surface px-3 text-[14px] font-semibold transition-colors hover:bg-sales-surface-hover">
            Today
          </button>
          <button type="button" onClick={() => shift(-1)} aria-label={view === "week" ? "Previous week" : "Previous month"} className="inline-flex h-11 w-11 items-center justify-center rounded-[10px] border border-sales-border bg-sales-surface transition-colors hover:bg-sales-surface-hover">
            <ChevronLeft size={16} strokeWidth={1.75} aria-hidden />
          </button>
          <p className="min-w-0 text-center text-[14px] font-semibold min-[480px]:min-w-[8.5rem]">{view === "week" ? rangeLabel(week[0]) : MONTHS[monthDate.getMonth()]}</p>
          <button type="button" onClick={() => shift(1)} aria-label={view === "week" ? "Next week" : "Next month"} className="inline-flex h-11 w-11 items-center justify-center rounded-[10px] border border-sales-border bg-sales-surface transition-colors hover:bg-sales-surface-hover">
            <ChevronRight size={16} strokeWidth={1.75} aria-hidden />
          </button>
        </div>
      </div>

      {loading ? <CalendarBones view={view} /> : view === "week" ? (
        <WeekStrip days={week} selected={selected} events={events} onPick={pickDay} />
      ) : (
        <MonthGrid days={month} monthKey={cursor} selected={selected} events={events} onPick={pickDay} />
      )}

      <div className="grid items-start gap-4 md:grid-cols-[minmax(0,1.45fr)_minmax(260px,0.85fr)]">
        <section className="overflow-hidden rounded-[12px] border border-sales-border bg-sales-surface">
          <div className="flex items-baseline justify-between px-4 pb-2 pt-4">
            <h2 className="text-[15px] font-semibold tracking-[-0.01em]">{longDate(selected)}</h2>
            <span className="text-[13px] tabular-nums text-sales-text-muted">{loading ? "" : dayEvents.length}</span>
          </div>
          {loading ? <ListBones /> : (
            <ul>
              {stillOpen.length ? <GroupLabel>Still open</GroupLabel> : null}
              {stillOpen.map((item) => (
                <ApptRow key={item.id} item={item} active={item.id === selectedId} onChoose={() => choose(item)} onOpen={() => setOpenId(item.id)} />
              ))}
              {stillOpen.length ? <GroupLabel>This day</GroupLabel> : null}
              {dayEvents.map((item) => (
                <ApptRow key={item.id} item={item} active={item.id === selectedId} onChoose={() => choose(item)} onOpen={() => setOpenId(item.id)} />
              ))}
              {dayEvents.length === 0 ? (
                <li className="border-t border-sales-border-subtle px-4 py-8">
                  <p className="text-[15px] font-semibold">Nothing is booked</p>
                  <p className="mt-1 max-w-[36ch] text-[13px] text-sales-text-secondary">Book a viewing when a buyer is ready to see a property.</p>
                </li>
              ) : null}
            </ul>
          )}
        </section>

        {booking ? (
          <form onSubmit={book} className="rounded-[12px] border border-sales-border bg-sales-surface px-4 py-4">
            <h2 className="text-[15px] font-semibold tracking-[-0.01em]">Book a viewing</h2>
            <p className="mt-1 text-[13px] text-sales-text-secondary">A time is set with the buyer at the property.</p>
            <label className="mt-4 block">
              <span className="text-[13px] font-medium">Buyer</span>
              <input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} required className="mt-1.5 h-11 w-full rounded-[10px] border border-sales-border bg-sales-bg px-3 text-[14px]" />
            </label>
            <label className="mt-3 block">
              <span className="text-[13px] font-medium">Property</span>
              <input value={draft.place} onChange={(event) => setDraft({ ...draft, place: event.target.value })} required className="mt-1.5 h-11 w-full rounded-[10px] border border-sales-border bg-sales-bg px-3 text-[14px]" />
            </label>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <label className="block">
                <span className="text-[13px] font-medium">Date</span>
                <input type="date" value={draft.date} onChange={(event) => setDraft({ ...draft, date: event.target.value })} required className="mt-1.5 h-11 w-full rounded-[10px] border border-sales-border bg-sales-bg px-3 text-[14px]" />
              </label>
              <label className="block">
                <span className="text-[13px] font-medium">Time</span>
                <input type="time" value={draft.time} onChange={(event) => setDraft({ ...draft, time: event.target.value })} required className="mt-1.5 h-11 w-full rounded-[10px] border border-sales-border bg-sales-bg px-3 text-[14px]" />
              </label>
            </div>
            <div className="re-actions mt-4 flex gap-2">
              <button type="submit" className="h-11 rounded-[10px] bg-sales-text-primary px-4 text-[14px] font-semibold text-sales-surface">
                Add to the day
              </button>
              <button type="button" onClick={() => setBooking(false)} className="h-11 rounded-[10px] border border-sales-border bg-sales-bg px-4 text-[14px] font-semibold transition-colors hover:bg-sales-surface-hover">
                Close
              </button>
            </div>
          </form>
        ) : (
          <AppointmentDetail item={loading ? null : selectedEvent} onOpen={selectedEvent ? () => setOpenId(selectedEvent.id) : undefined} />
        )}
      </div>
    </div>
  );
}

function WeekStrip({ days, selected, events, onPick }: { days: string[]; selected: string; events: Appt[]; onPick: (key: string) => void }) {
  return (
    <section className="overflow-hidden rounded-[12px] border border-sales-border bg-sales-border-subtle" aria-label="Week">
      <div className="grid grid-cols-7 gap-px">
        {days.map((key) => {
          const date = parseKey(key);
          const count = events.filter((item) => item.date === key).length;
          const active = key === selected;
          const today = key === TODAY;
          return (
            <button
              key={key}
              type="button"
              aria-pressed={active}
              aria-current={today ? "date" : undefined}
              onClick={() => onPick(key)}
              className={`re-day px-1 py-3 text-center transition-colors ${active ? "bg-sales-bg" : "bg-sales-surface hover:bg-sales-surface-hover"}`}
            >
              <span className="block text-[11px] font-medium uppercase tracking-[0.08em] text-sales-text-muted">{WEEKDAYS[date.getDay()].slice(0, 3)}</span>
              <span className={`mx-auto mt-1.5 flex h-8 w-8 items-center justify-center rounded-full text-[14px] font-semibold ${today ? "bg-sales-text-primary text-sales-surface" : active ? "border border-sales-border" : ""}`}>
                {date.getDate()}
              </span>
              <span className="mt-2 flex h-1.5 items-center justify-center gap-1" aria-hidden>
                {events.filter((item) => item.date === key).slice(0, 3).map((item) => (
                  <span key={item.id} className={`h-1.5 w-1.5 rounded-full ${item.overdue ? "bg-sales-danger" : item.kind === "viewing" ? "bg-sales-text-primary" : "bg-sales-text-muted"}`} />
                ))}
              </span>
              <span className="sr-only">{count === 1 ? "1 appointment" : `${count} appointments`}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function MonthGrid({ days, monthKey, selected, events, onPick }: { days: string[]; monthKey: string; selected: string; events: Appt[]; onPick: (key: string) => void }) {
  return (
    <section className="overflow-hidden rounded-[12px] border border-sales-border bg-sales-border-subtle" aria-label="Month">
      <div className="grid grid-cols-7 gap-px bg-sales-border-subtle">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((label) => (
          <div key={label} className="re-day bg-sales-surface py-2 text-center text-[11px] font-medium uppercase tracking-[0.08em] text-sales-text-muted">{label}</div>
        ))}
        {days.map((key) => {
          const date = parseKey(key);
          const inMonth = sameMonth(key, monthKey);
          const active = key === selected;
          const today = key === TODAY;
          const marks = events.filter((item) => item.date === key).slice(0, 3);
          return (
            <button
              key={key}
              type="button"
              aria-pressed={active}
              aria-current={today ? "date" : undefined}
              onClick={() => onPick(key)}
              className={`min-h-[68px] px-1 py-2 text-center transition-colors ${active ? "bg-sales-bg" : "bg-sales-surface hover:bg-sales-surface-hover"} ${inMonth ? "" : "text-sales-text-muted"}`}
            >
              <span className={`mx-auto flex h-7 w-7 items-center justify-center rounded-full text-[13px] font-semibold ${today ? "bg-sales-text-primary text-sales-surface" : ""}`}>
                {date.getDate()}
              </span>
              <span className="mt-1.5 flex h-1.5 items-center justify-center gap-1" aria-hidden>
                {marks.map((item) => (
                  <span key={item.id} className={`h-1.5 w-1.5 rounded-full ${item.overdue ? "bg-sales-danger" : "bg-sales-text-primary"}`} />
                ))}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function ApptRow({ item, active, onChoose, onOpen }: { item: Appt; active: boolean; onChoose: () => void; onOpen: () => void }) {
  const rule = item.status === "cancelled" ? "bg-sales-border" : item.overdue ? "bg-sales-danger" : item.kind === "viewing" ? "bg-sales-text-primary" : "bg-sales-border";
  const action = item.kind === "viewing" ? "Open" : "Call";
  const state = item.status === "cancelled" ? "Cancelled" : item.status === "recorded" ? "Outcome recorded" : null;
  return (
    <li className={`re-in flex items-center gap-3 border-t border-sales-border-subtle px-4 py-3 ${active ? "bg-sales-bg" : ""}`}>
      <span className={`h-8 w-[3px] shrink-0 rounded-full ${rule}`} aria-hidden />
      <button type="button" onClick={onChoose} className="flex min-w-0 flex-1 items-center gap-3 text-left">
        <span className="w-12 shrink-0 text-[13px] font-semibold tabular-nums text-sales-text-secondary">{item.time}</span>
        <span className="min-w-0">
          <span className="block truncate text-[14px] font-semibold">{item.name}</span>
          <span className="block truncate text-[12px] text-sales-text-muted">
            {item.overdue ? <span className="text-sales-danger-fg">Overdue · </span> : null}
            {state ? <span>{state} · </span> : null}
            {KIND_LABEL[item.kind]} · {item.place}
          </span>
        </span>
      </button>
      <button type="button" onClick={item.kind === "viewing" ? onOpen : onChoose} className="h-9 shrink-0 rounded-[8px] border border-sales-border bg-sales-bg px-3 text-[13px] font-semibold transition-colors hover:bg-sales-surface-hover">
        {action}
      </button>
    </li>
  );
}

function AppointmentDetail({ item, onOpen }: { item: Appt | null; onOpen?: () => void }) {
  if (!item) {
    return (
      <section className="rounded-[12px] border border-sales-border bg-sales-surface px-4 py-4">
        <h2 className="text-[15px] font-semibold tracking-[-0.01em]">Appointment</h2>
        <p className="mt-2 text-[14px] text-sales-text-secondary">Select a time. The buyer, the property, and the next action show here.</p>
      </section>
    );
  }

  const sentence = item.status === "cancelled"
    ? `The viewing with ${item.name} is cancelled.`
    : item.status === "recorded"
      ? (item.note || `${item.name} has seen ${item.place}.`)
      : item.kind === "viewing"
    ? `${item.name} is booked to see ${item.place}.`
    : item.overdue
      ? `This follow-up with ${item.name} was due on ${longDate(item.date)}.`
      : item.kind === "call"
        ? `A call with ${item.name} is set for this time.`
        : `A follow-up with ${item.name} is set for this time.`;

  return (
    <section className="rounded-[12px] border border-sales-border bg-sales-surface px-4 py-4">
      <p className="text-[12px] font-medium uppercase tracking-[0.12em] text-sales-text-muted">{KIND_LABEL[item.kind]}</p>
      <h2 className="mt-1 text-[20px] font-semibold tracking-[-0.02em]">{item.name}</h2>
      <p className="mt-1 text-[14px] text-sales-text-secondary">{item.place}</p>
      <p className="mt-3 text-[13px] text-sales-text-muted">{longDate(item.date)} · {item.time}</p>
      {item.phone ? <p className="mt-1 text-[13px] text-sales-text-secondary">{item.phone}</p> : null}
      <p className="mt-3 text-[14px] text-sales-text-secondary">{sentence}</p>
      <div className="re-actions re-stack mt-4 flex flex-wrap gap-2">
        {item.kind === "viewing" ? (
          <button type="button" onClick={onOpen} className="h-11 rounded-[10px] bg-sales-text-primary px-4 text-[14px] font-semibold text-sales-surface">
            Open
          </button>
        ) : (
          <button type="button" className="h-11 rounded-[10px] bg-sales-text-primary px-4 text-[14px] font-semibold text-sales-surface">
            Call
          </button>
        )}
        {item.kind === "viewing" ? (
          <button type="button" className="h-11 rounded-[10px] border border-sales-border bg-sales-bg px-4 text-[14px] font-semibold transition-colors hover:bg-sales-surface-hover">
            Call
          </button>
        ) : null}
        <button type="button" className="h-11 rounded-[10px] border border-sales-border bg-sales-bg px-4 text-[14px] font-semibold transition-colors hover:bg-sales-surface-hover">
          WhatsApp
        </button>
      </div>
    </section>
  );
}

function GroupLabel({ children }: { children: ReactNode }) {
  return (
    <li className="border-t border-sales-border-subtle bg-sales-bg px-4 py-1.5 text-[11px] font-medium uppercase tracking-[0.12em] text-sales-text-muted">
      {children}
    </li>
  );
}

function CalendarBones({ view }: { view: View }) {
  return (
    <div className="overflow-hidden rounded-[12px] border border-sales-border bg-sales-surface" aria-hidden>
      <div className={`grid grid-cols-7 ${view === "month" ? "min-h-[280px]" : ""}`}>
        {Array.from({ length: 7 }).map((_, index) => (
          <div key={index} className="border-l border-sales-border-subtle px-2 py-4 first:border-l-0">
            <span className="re-bone mx-auto block h-3 w-8 rounded-[4px]" />
            <span className="re-bone mx-auto mt-2 block h-8 w-8 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

function ListBones() {
  return (
    <ul aria-hidden>
      <li className="flex items-center gap-3 border-t border-sales-border-subtle px-4 py-3">
        <span className="re-bone h-8 w-[3px] shrink-0 rounded-full" />
        <span className="re-bone h-3.5 w-12 shrink-0 rounded-[4px]" />
        <span className="min-w-0 flex-1 space-y-1.5">
          <span className="re-bone block h-3.5 w-36 max-w-[46%] rounded-[4px]" />
          <span className="re-bone block h-3 w-48 max-w-[60%] rounded-[4px]" />
        </span>
        <span className="re-bone h-9 w-16 shrink-0 rounded-[8px]" />
      </li>
    </ul>
  );
}
