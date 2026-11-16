"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Bones, EmptyNote, Head, inkBtn, lineBtn, Panel } from "./desk";

export type SolarCalendarVisit = {
  id: string;
  title: string | null;
  visitType: string;
  status: string;
  startAt: string;
  place: string | null;
  projectId: string;
};

type Kind = "visit" | "follow" | "install";

type Slot = {
  id: string;
  kind: Kind;
  startAt: string;
  name: string;
  place: string | null;
  waiting: string;
  href: string;
};

const KINDS: Array<{ id: Kind | "all"; label: string }> = [
  { id: "all", label: "All" },
  { id: "visit", label: "Visits" },
  { id: "follow", label: "Follow-ups" },
  { id: "install", label: "Installations" },
];

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function dayKey(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function startOfWeek(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  const day = next.getDay();
  next.setDate(next.getDate() + (day === 0 ? -6 : 1 - day));
  return next;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function clock(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

function dueMark(iso: string): "today" | "overdue" | null {
  const time = new Date(iso).getTime();
  if (Number.isNaN(time)) return null;
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  if (time < start.getTime()) return "overdue";
  if (time < end.getTime()) return "today";
  return null;
}

export function SolarCalendarDesk({ visits }: { visits: SolarCalendarVisit[] }) {
  const router = useRouter();
  const [kind, setKind] = useState<Kind | "all">("all");
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [selected, setSelected] = useState(() => dayKey(new Date()));
  const [follows, setFollows] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/sales/solar-workflow")
      .then((res) => res.json())
      .then((json: { cards?: Array<{ leadId: string; customerName: string; location: string | null; nextAction: string; reminderAt: string | null }> }) => {
        if (cancelled) return;
        setFollows(
          (json.cards ?? [])
            .filter((card) => card.reminderAt)
            .map((card) => ({
              id: `follow-${card.leadId}`,
              kind: "follow" as const,
              startAt: card.reminderAt as string,
              name: card.customerName,
              place: card.location,
              waiting: card.nextAction,
              href: `/sales/leads?lead=${card.leadId}`,
            }))
        );
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const days = useMemo(() => Array.from({ length: 7 }, (_, index) => addDays(weekStart, index)), [weekStart]);
  const slots = useMemo(() => {
    const fromVisits: Slot[] = visits
      .filter((visit) => visit.status !== "CANCELLED" && visit.startAt)
      .map((visit) => {
        const install = /install/i.test(visit.visitType);
        return {
          id: visit.id,
          kind: install ? "install" as const : "visit" as const,
          startAt: visit.startAt,
          name: visit.title || (install ? "Installation" : "Site visit"),
          place: visit.place,
          waiting: visit.status.replaceAll("_", " ").toLowerCase(),
          href: `/sales/projects/${visit.projectId}`,
        };
      });
    return [...fromVisits, ...follows].sort((a, b) => a.startAt.localeCompare(b.startAt));
  }, [visits, follows]);

  const visible = slots.filter((slot) => dayKey(new Date(slot.startAt)) === selected && (kind === "all" || slot.kind === kind));
  const selectedDate = new Date(`${selected}T12:00:00`);
  const weekday = selectedDate.toLocaleDateString("en-GB", { weekday: "long" });
  const dateLabel = selectedDate.toLocaleDateString("en-GB", { day: "numeric", month: "long" });

  return (
    <div className="space-y-8">
      <Head
        kicker="Field & delivery"
        title="Calendar"
        detail="Site visits, follow-ups, and installations for the week. Open a card to go to the visit, the lead, or the project."
      />
      <div className="so-filters is-four" role="tablist" aria-label="Calendar kinds">
        {KINDS.map((item) => (
          <button key={item.id} type="button" className={kind === item.id ? inkBtn : lineBtn} aria-pressed={kind === item.id} onClick={() => setKind(item.id)}>
            {item.label}
          </button>
        ))}
      </div>
      <div className="flex items-center justify-between gap-3">
        <button type="button" className={lineBtn} onClick={() => setWeekStart((current) => addDays(current, -7))}>Previous week</button>
        <button type="button" className={lineBtn} onClick={() => { const today = new Date(); setWeekStart(startOfWeek(today)); setSelected(dayKey(today)); }}>This week</button>
        <button type="button" className={lineBtn} onClick={() => setWeekStart((current) => addDays(current, 7))}>Next week</button>
      </div>
      <div className="so-week" role="tablist" aria-label="Week">
        {days.map((day, index) => {
          const key = dayKey(day);
          const count = slots.filter((slot) => dayKey(new Date(slot.startAt)) === key && (kind === "all" || slot.kind === kind)).length;
          const today = key === dayKey(new Date());
          return (
            <button
              key={key}
              type="button"
              className={`so-day ${today ? "is-today" : ""}`}
              aria-pressed={selected === key}
              onClick={() => setSelected(key)}
            >
              <span className="so-day-week">{WEEKDAYS[index]}</span>
              <span className="so-day-date">{day.getDate()}</span>
              <span className="so-day-count">{count === 0 ? "Clear" : `${count} job${count === 1 ? "" : "s"}`}</span>
            </button>
          );
        })}
      </div>
      <Panel title={`${weekday} ${dateLabel}`} count={loading ? undefined : visible.length}>
        {loading ? <Bones /> : visible.length === 0 ? (
          <EmptyNote title="Nothing booked" detail="Visits, follow-ups, and installations for this day show here." />
        ) : (
          <ul className="so-agenda">
            {visible.map((slot) => {
              const due = dueMark(slot.startAt);
              const kindLabel = slot.kind === "install" ? "Installation" : slot.kind === "visit" ? "Site visit" : "Follow-up";
              return (
                <li key={slot.id} className="so-slot">
                  <span className="so-slot-time">{clock(slot.startAt) || "Day"}</span>
                  <button type="button" className={`so-card ${due ? `is-${due}` : ""}`} onClick={() => router.push(slot.href)}>
                    <span className="so-card-top">
                      <span className="so-card-name">{slot.name}</span>
                      <span className="so-card-stage">{kindLabel}</span>
                    </span>
                    {slot.place ? <span className="so-card-place">{slot.place}</span> : null}
                    <span className="so-card-next">{slot.waiting}</span>
                    {due ? <span className="so-card-due">{due === "overdue" ? "Overdue" : "Due today"}</span> : null}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>
    </div>
  );
}
