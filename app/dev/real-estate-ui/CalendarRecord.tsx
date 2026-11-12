"use client";

import { useEffect, useState, type FormEvent } from "react";
import { ViewingRecord, type ViewingStatus } from "./ViewingRecord";
import { RealEstateCalendar, realEstateLongDate, type RealEstateAppointment } from "@/components/real-estate/calendar/RealEstateCalendar";

type Kind = "viewing" | "follow-up" | "call";

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

function toItem(item: Appt): RealEstateAppointment {
  const digits = item.phone?.replace(/\D/g, "") ?? "";
  return {
    id: item.id,
    date: item.date,
    time: item.time,
    name: item.name,
    kind: item.kind,
    kindLabel: KIND_LABEL[item.kind],
    place: item.place,
    overdue: item.overdue,
    phone: item.phone,
    state: item.status === "cancelled" ? "cancelled" : item.status === "recorded" ? "recorded" : null,
    note: item.note,
    callHref: item.phone ? `tel:${item.phone}` : null,
    whatsappHref: digits.length >= 8 ? `https://wa.me/${digits}` : null,
  };
}

export function CalendarRecord({ loading }: { loading: boolean }) {
  const [events, setEvents] = useState<Appt[]>(SEED);
  const [pinnedId, setPinnedId] = useState<string | null>(null);
  const [booking, setBooking] = useState(false);
  const [draft, setDraft] = useState({ name: "", place: "", date: TODAY, time: "10:00" });
  const [openId, setOpenId] = useState<string | null>(null);

  const openItem = events.find((item) => item.id === openId && item.kind === "viewing") ?? null;

  useEffect(() => {
    if (!openId) return;
    document.querySelector(".re-scroll")?.scrollTo({ top: 0 });
  }, [openId]);

  function book(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = draft.name.trim();
    const place = draft.place.trim();
    if (!name || !place || !draft.date || !draft.time) return;
    const id = `booked-${draft.date}-${draft.time}`;
    const next: Appt = { id, date: draft.date, time: draft.time, name, kind: "viewing", place };
    setEvents((current) => [...current.filter((item) => item.id !== id), next]);
    setPinnedId(id);
    setBooking(false);
    setDraft({ name: "", place: "", date: draft.date, time: "10:00" });
  }

  function patchViewing(id: string, patch: Partial<Appt>) {
    setEvents((current) => current.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }

  return (
    <>
    {openItem ? (
      <ViewingRecord
        name={openItem.name}
        place={openItem.place}
        when={`${realEstateLongDate(openItem.date)} · ${openItem.time}`}
        phone={openItem.phone}
        status={openItem.status ?? "scheduled"}
        note={openItem.note ?? ""}
        onClose={() => setOpenId(null)}
        onSave={(note) => patchViewing(openItem.id, { status: "recorded", note })}
        onCancel={() => patchViewing(openItem.id, { status: "cancelled" })}
      />
    ) : null}
    <div hidden={openItem != null}>
    <RealEstateCalendar
      items={events.map(toItem)}
      todayKey={TODAY}
      loading={loading}
      initialSelectedId="view-rudo"
      pinnedId={pinnedId}
      onOpen={(id) => setOpenId(id)}
      onBook={(date) => {
        setBooking(true);
        setDraft((current) => ({ ...current, date }));
      }}
      onSelectDate={(key) => {
        setBooking(false);
        setDraft((current) => ({ ...current, date: key }));
      }}
      booking={booking ? (
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
      ) : undefined}
    />
    </div>
    </>
  );
}
