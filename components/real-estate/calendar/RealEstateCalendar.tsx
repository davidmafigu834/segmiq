"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";

export type RealEstateAppointmentKind = "viewing" | "follow-up" | "call";

export type RealEstateAppointment = {
  id: string;
  date: string;
  time: string;
  name: string;
  kind: RealEstateAppointmentKind;
  kindLabel: string;
  place: string;
  overdue?: boolean;
  phone?: string | null;
  owner?: string | null;
  state?: "cancelled" | "recorded" | null;
  note?: string | null;
  openHref?: string | null;
  callHref?: string | null;
  whatsappHref?: string | null;
};

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

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

export function realEstateLongDate(key: string) {
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

function sortTime(time: string) {
  return /^\d{2}:\d{2}/.test(time) ? time : "00:00";
}

function sentenceFor(item: RealEstateAppointment) {
  if (item.state === "cancelled") {
    return item.kind === "viewing"
      ? `The viewing with ${item.name} is cancelled.`
      : `This ${item.kindLabel.toLowerCase()} with ${item.name} is cancelled.`;
  }
  if (item.state === "recorded") {
    if (item.kind === "viewing") return item.note?.trim() || (item.place ? `${item.name} has seen ${item.place}.` : `${item.name} has been to the viewing.`);
    return `This ${item.kindLabel.toLowerCase()} with ${item.name} is done.`;
  }
  if (item.kind === "viewing") {
    if (item.overdue) {
      return item.place
        ? `The viewing with ${item.name} at ${item.place} is still open.`
        : `The viewing with ${item.name} is still open.`;
    }
    return item.place ? `${item.name} is booked to see ${item.place}.` : `A viewing with ${item.name} is booked.`;
  }
  if (item.overdue) {
    const label = item.kind === "call" ? "call" : "follow-up";
    return `This ${label} with ${item.name} was due on ${realEstateLongDate(item.date)}.`;
  }
  if (item.kind === "call") return `A call with ${item.name} is set for this time.`;
  return `A follow-up with ${item.name} is set for this time.`;
}

export function RealEstateCalendar({
  items,
  todayKey,
  bookHref,
  onBook,
  booking,
  onOpen,
  onSelectDate,
  initialSelectedId = null,
  pinnedId = null,
  loading = false,
}: {
  items: RealEstateAppointment[];
  todayKey: string;
  bookHref?: string;
  onBook?: (dateKey: string) => void;
  booking?: ReactNode;
  onOpen?: (id: string) => void;
  onSelectDate?: (key: string) => void;
  initialSelectedId?: string | null;
  pinnedId?: string | null;
  loading?: boolean;
}) {
  const [view, setView] = useState<"week" | "month">("week");
  const [cursor, setCursor] = useState(todayKey);
  const [selected, setSelected] = useState(todayKey);
  const [selectedId, setSelectedId] = useState<string | null>(initialSelectedId);

  useEffect(() => {
    if (!pinnedId) return;
    const item = items.find((entry) => entry.id === pinnedId);
    if (!item) return;
    setSelected(item.date);
    setCursor(item.date);
    setSelectedId(item.id);
    onSelectDate?.(item.date);
    // Pin only when a new appointment is created. Later day clicks stay put.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pinnedId]);

  const week = weekKeys(cursor);
  const month = monthKeys(cursor);
  const selectedEvent = items.find((item) => item.id === selectedId) ?? null;
  const dayEvents = items.filter((item) => item.date === selected).sort((a, b) => sortTime(a.time).localeCompare(sortTime(b.time)));
  const stillOpen = items.filter((item) => item.overdue && item.date !== selected).sort((a, b) => a.date.localeCompare(b.date) || sortTime(a.time).localeCompare(sortTime(b.time)));
  const viewingsThisWeek = items.filter((item) => item.kind === "viewing" && week.includes(item.date)).length;
  const overdueCount = items.filter((item) => item.overdue).length;
  const monthDate = parseKey(cursor);
  const monthCount = items.filter((item) => sameMonth(item.date, cursor)).length;

  function commit(key: string) {
    setSelected(key);
    setCursor(key);
    onSelectDate?.(key);
  }

  function pickDay(key: string) {
    commit(key);
    setSelectedId((current) => (items.some((item) => item.id === current && item.date === key) ? current : null));
  }

  function shift(direction: -1 | 1) {
    setSelectedId(null);
    if (view === "week") {
      commit(addDays(selected, direction * 7));
      return;
    }
    const nextMonth = new Date(monthDate.getFullYear(), monthDate.getMonth() + direction, 1);
    commit(keyOf(nextMonth));
  }

  function goToday() {
    commit(todayKey);
    const first = items
      .filter((item) => item.date === todayKey)
      .sort((a, b) => sortTime(a.time).localeCompare(sortTime(b.time)))[0];
    setSelectedId(first?.id ?? null);
  }

  function choose(item: RealEstateAppointment) {
    commit(item.date);
    setSelectedId(item.id);
  }

  const summary = view === "week"
    ? `${viewingsThisWeek === 1 ? "1 viewing" : `${viewingsThisWeek} viewings`} this week.${overdueCount ? ` ${overdueCount === 1 ? "1 follow-up is still open." : `${overdueCount} follow-ups are still open.`}` : ""}`
    : `${monthCount === 1 ? "1 appointment" : `${monthCount} appointments`} in ${MONTHS[monthDate.getMonth()]}.${overdueCount ? ` ${overdueCount === 1 ? "1 follow-up is still open." : `${overdueCount} follow-ups are still open.`}` : ""}`;

  const bookClass = "re-fill inline-flex h-11 items-center justify-center gap-2 rounded-[10px] bg-sales-brand px-4 text-[14px] font-semibold text-sales-brand-text";

  return (
    <div className="space-y-5">
      <div className="re-head flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[13px] font-medium text-sales-text-muted">Schedule</p>
          <h1 className="mt-1 font-display text-[32px] font-semibold leading-none tracking-[-0.03em]">Calendar</h1>
          <p className="mt-2 text-[14px] text-sales-text-secondary">{loading ? "Loading the schedule." : summary}</p>
        </div>
        {bookHref ? (
          <Link href={bookHref} className={bookClass}>
            <Plus size={16} strokeWidth={1.75} aria-hidden />
            Book a viewing
          </Link>
        ) : onBook ? (
          <button type="button" onClick={() => onBook(selected)} className={bookClass}>
            <Plus size={16} strokeWidth={1.75} aria-hidden />
            Book a viewing
          </button>
        ) : null}
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
        <WeekStrip days={week} todayKey={todayKey} selected={selected} items={items} onPick={pickDay} />
      ) : (
        <MonthGrid days={month} monthKey={cursor} todayKey={todayKey} selected={selected} items={items} onPick={pickDay} />
      )}

      <div className="grid items-start gap-4 md:grid-cols-[minmax(0,1.45fr)_minmax(260px,0.85fr)]">
        <section className="overflow-hidden rounded-[12px] border border-sales-border bg-sales-surface">
          <div className="flex items-baseline justify-between px-4 pb-2 pt-4">
            <h2 className="text-[15px] font-semibold tracking-[-0.01em]">{realEstateLongDate(selected)}</h2>
            <span className="text-[13px] tabular-nums text-sales-text-muted">{loading ? "" : dayEvents.length}</span>
          </div>
          {loading ? <ListBones /> : (
            <ul>
              {stillOpen.length ? <GroupLabel>Still open</GroupLabel> : null}
              {stillOpen.map((item) => (
                <ApptRow key={item.id} item={item} active={item.id === selectedId} onChoose={() => choose(item)} onOpen={onOpen} />
              ))}
              {stillOpen.length ? <GroupLabel>This day</GroupLabel> : null}
              {dayEvents.map((item) => (
                <ApptRow key={item.id} item={item} active={item.id === selectedId} onChoose={() => choose(item)} onOpen={onOpen} />
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

        {booking ?? <AppointmentDetail item={loading ? null : selectedEvent} onOpen={onOpen} />}
      </div>
    </div>
  );
}

function WeekStrip({ days, todayKey, selected, items, onPick }: { days: string[]; todayKey: string; selected: string; items: RealEstateAppointment[]; onPick: (key: string) => void }) {
  return (
    <section className="overflow-hidden rounded-[12px] border border-sales-border bg-sales-border-subtle" aria-label="Week">
      <div className="grid grid-cols-7 gap-px">
        {days.map((key) => {
          const date = parseKey(key);
          const count = items.filter((item) => item.date === key).length;
          const active = key === selected;
          const today = key === todayKey;
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
                {items.filter((item) => item.date === key).slice(0, 3).map((item) => (
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

function MonthGrid({ days, monthKey, todayKey, selected, items, onPick }: { days: string[]; monthKey: string; todayKey: string; selected: string; items: RealEstateAppointment[]; onPick: (key: string) => void }) {
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
          const today = key === todayKey;
          const marks = items.filter((item) => item.date === key).slice(0, 3);
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

function ApptRow({ item, active, onChoose, onOpen }: { item: RealEstateAppointment; active: boolean; onChoose: () => void; onOpen?: (id: string) => void }) {
  const rule = item.state === "cancelled" ? "bg-sales-border" : item.overdue ? "bg-sales-danger" : item.kind === "viewing" ? "bg-sales-text-primary" : "bg-sales-border";
  const action = item.kind === "viewing" ? "Open" : "Call";
  const detail = [
    item.state === "cancelled" ? "Cancelled" : item.state === "recorded" ? (item.kind === "viewing" ? "Outcome recorded" : "Completed") : null,
    item.kindLabel,
    item.place || null,
    item.owner || null,
  ].filter(Boolean).join(" · ");
  return (
    <li className={`re-in flex items-center gap-3 border-t border-sales-border-subtle px-4 py-3 ${active ? "bg-sales-bg" : ""}`}>
      <span className={`h-8 w-[3px] shrink-0 rounded-full ${rule}`} aria-hidden />
      <button type="button" onClick={onChoose} className="flex min-w-0 flex-1 items-center gap-3 text-left">
        <span className="w-12 shrink-0 text-[13px] font-semibold tabular-nums text-sales-text-secondary">{item.time}</span>
        <span className="min-w-0">
          <span className="block truncate text-[14px] font-semibold">{item.name}</span>
          <span className="block truncate text-[12px] text-sales-text-muted">
            {item.overdue ? <span className="text-sales-danger-fg">Overdue · </span> : null}
            {detail}
          </span>
        </span>
      </button>
      <RowAction item={item} label={action} onChoose={onChoose} onOpen={onOpen} />
    </li>
  );
}

function RowAction({ item, label, onChoose, onOpen }: { item: RealEstateAppointment; label: string; onChoose: () => void; onOpen?: (id: string) => void }) {
  const className = "h-9 shrink-0 rounded-[8px] border border-sales-border bg-sales-bg px-3 text-[13px] font-semibold transition-colors hover:bg-sales-surface-hover";
  if (item.kind === "viewing" && onOpen) {
    return <button type="button" onClick={() => onOpen(item.id)} className={className}>{label}</button>;
  }
  if (item.kind === "viewing" && item.openHref) {
    return <Link href={item.openHref} className={`inline-flex items-center ${className}`}>{label}</Link>;
  }
  return <button type="button" onClick={onChoose} className={className}>{label}</button>;
}

function AppointmentDetail({ item, onOpen }: { item: RealEstateAppointment | null; onOpen?: (id: string) => void }) {
  if (!item) {
    return (
      <section className="rounded-[12px] border border-sales-border bg-sales-surface px-4 py-4">
        <h2 className="text-[15px] font-semibold tracking-[-0.01em]">Appointment</h2>
        <p className="mt-2 text-[14px] text-sales-text-secondary">Select a time. The buyer, the property, and the next action show here.</p>
      </section>
    );
  }

  const primary = "h-11 rounded-[10px] bg-sales-text-primary px-4 text-[14px] font-semibold text-sales-surface";
  const secondary = "h-11 rounded-[10px] border border-sales-border bg-sales-bg px-4 text-[14px] font-semibold transition-colors hover:bg-sales-surface-hover";

  return (
    <section className="rounded-[12px] border border-sales-border bg-sales-surface px-4 py-4">
      <p className="text-[12px] font-medium uppercase tracking-[0.12em] text-sales-text-muted">{item.kindLabel}</p>
      <h2 className="mt-1 text-[20px] font-semibold tracking-[-0.02em]">{item.name}</h2>
      {item.place ? <p className="mt-1 text-[14px] text-sales-text-secondary">{item.place}</p> : null}
      {item.owner ? <p className="mt-1 text-[13px] text-sales-text-secondary">{item.owner}</p> : null}
      <p className="mt-3 text-[13px] text-sales-text-muted">{realEstateLongDate(item.date)} · {item.time}</p>
      {item.phone ? <p className="mt-1 text-[13px] text-sales-text-secondary">{item.phone}</p> : null}
      <p className="mt-3 text-[14px] text-sales-text-secondary">{sentenceFor(item)}</p>
      <div className="re-actions re-stack mt-4 flex flex-wrap gap-2">
        {item.kind === "viewing" ? (
          item.openHref && !onOpen ? (
            <Link href={item.openHref} className={`inline-flex items-center ${primary}`}>Open</Link>
          ) : (
            <button type="button" onClick={() => onOpen?.(item.id)} className={primary}>Open</button>
          )
        ) : item.callHref ? (
          <a href={item.callHref} className={`inline-flex items-center ${primary}`}>Call</a>
        ) : item.openHref ? (
          <Link href={item.openHref} className={`inline-flex items-center ${primary}`}>Open</Link>
        ) : (
          <button type="button" className={primary}>Call</button>
        )}
        {item.kind === "viewing" && item.callHref ? (
          <a href={item.callHref} className={`inline-flex items-center ${secondary}`}>Call</a>
        ) : null}
        {item.whatsappHref ? (
          <a href={item.whatsappHref} className={`inline-flex items-center ${secondary}`}>WhatsApp</a>
        ) : (
          <button type="button" className={secondary}>WhatsApp</button>
        )}
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

function CalendarBones({ view }: { view: "week" | "month" }) {
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
