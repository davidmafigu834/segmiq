"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Check, RotateCcw, X } from "lucide-react";

const EVENT_NAME_KEY = "segmiq:event-capture:eventName";
const RECENT_EVENTS_KEY = "segmiq:event-capture:recentEvents";
const KEEP_ALIVE_MS = 10 * 60 * 1000;

type RecentCapture = {
  id: string;
  name: string;
  createdAt: string;
};

type CaptureResponse = {
  ok?: boolean;
  returning?: boolean;
  contactId?: string;
  contactName?: string;
  message?: string;
  error?: string;
  field?: string;
  capturedToday?: number;
  recent?: RecentCapture[];
};

function loadStoredEventName(clientId: string): string {
  if (typeof window === "undefined") return "";
  try {
    return localStorage.getItem(`${EVENT_NAME_KEY}:${clientId}`) ?? "";
  } catch {
    return "";
  }
}

function storeEventName(clientId: string, name: string) {
  try {
    localStorage.setItem(`${EVENT_NAME_KEY}:${clientId}`, name);
    const raw = localStorage.getItem(RECENT_EVENTS_KEY);
    const list: string[] = raw ? (JSON.parse(raw) as string[]) : [];
    const next = [name, ...list.filter((e) => e.toLowerCase() !== name.toLowerCase())].slice(
      0,
      8
    );
    localStorage.setItem(RECENT_EVENTS_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
}

function loadRecentEvents(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(RECENT_EVENTS_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function formatCaptureTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

const fieldClass =
  "w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-input)]/80 px-5 text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] backdrop-blur-sm transition-[border-color,box-shadow,background-color] focus:border-[var(--accent-border)] focus:bg-[var(--surface-input)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/25";

export function EventCaptureClient({
  clientId,
  dialCode,
  clientName,
  homeHref,
}: {
  clientId: string;
  dialCode: string;
  clientName: string;
  homeHref: string;
}) {
  const nameRef = useRef<HTMLInputElement>(null);
  const eventInputRef = useRef<HTMLInputElement>(null);
  const [eventName, setEventName] = useState("");
  const [editingEvent, setEditingEvent] = useState(false);
  const [recentEvents, setRecentEvents] = useState<string[]>([]);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [company, setCompany] = useState("");
  const [interest, setInterest] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [flash, setFlash] = useState<{ tone: "ok" | "info"; text: string } | null>(null);
  const [capturedToday, setCapturedToday] = useState(0);
  const [recent, setRecent] = useState<RecentCapture[]>([]);
  const [counterBump, setCounterBump] = useState(0);
  const [clock, setClock] = useState("");

  const dial = dialCode.replace(/^\+/, "");

  const refreshStats = useCallback(
    async (event: string) => {
      if (!event.trim()) {
        setCapturedToday(0);
        setRecent([]);
        return;
      }
      try {
        const res = await fetch(
          `/api/events/capture?eventName=${encodeURIComponent(event.trim())}&clientId=${encodeURIComponent(clientId)}`
        );
        const data = (await res.json()) as CaptureResponse;
        if (res.ok && data.ok) {
          setCapturedToday(data.capturedToday ?? 0);
          setRecent(data.recent ?? []);
        }
      } catch {
        /* ignore */
      }
    },
    [clientId]
  );

  useEffect(() => {
    const stored = loadStoredEventName(clientId);
    setEventName(stored);
    setRecentEvents(loadRecentEvents());
    setEditingEvent(!stored);
    if (stored) void refreshStats(stored);
    const t = window.setTimeout(() => {
      if (stored) nameRef.current?.focus();
      else eventInputRef.current?.focus();
    }, 80);
    return () => window.clearTimeout(t);
  }, [clientId, refreshStats]);

  useEffect(() => {
    const tick = () => {
      void fetch("/api/auth/session").catch(() => {});
    };
    tick();
    const id = window.setInterval(tick, KEEP_ALIVE_MS);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    const update = () =>
      setClock(
        new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      );
    update();
    const id = window.setInterval(update, 30_000);
    return () => window.clearInterval(id);
  }, []);

  const commitEventName = useCallback(
    (value: string) => {
      const trimmed = value.trim();
      if (!trimmed) return;
      storeEventName(clientId, trimmed);
      setEventName(trimmed);
      setRecentEvents(loadRecentEvents());
      setEditingEvent(false);
      void refreshStats(trimmed);
      requestAnimationFrame(() => nameRef.current?.focus());
    },
    [clientId, refreshStats]
  );

  useEffect(() => {
    if (!flash) return;
    const id = window.setTimeout(() => setFlash(null), 3200);
    return () => window.clearTimeout(id);
  }, [flash]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setFlash(null);

    const event = eventName.trim();
    if (!event) {
      setError("Set the event name first — once for the day.");
      setEditingEvent(true);
      eventInputRef.current?.focus();
      return;
    }
    if (!name.trim()) {
      setError("Name is required.");
      nameRef.current?.focus();
      return;
    }
    if (!phone.trim()) {
      setError("Phone number is required.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/events/capture", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventName: event,
          name: name.trim(),
          phone: phone.trim(),
          company: company.trim() || undefined,
          interest: interest.trim() || undefined,
          clientId,
        }),
      });
      const data = (await res.json()) as CaptureResponse;
      if (!res.ok || !data.ok) {
        setError(data.error || "Could not capture contact.");
        return;
      }

      storeEventName(clientId, event);
      if (!data.returning) {
        setCounterBump((n) => n + 1);
      }
      setCapturedToday(data.capturedToday ?? capturedToday + (data.returning ? 0 : 1));
      setRecent(data.recent ?? recent);
      setFlash({
        tone: data.returning ? "info" : "ok",
        text:
          data.message ||
          (data.returning ? "Returning contact — touch logged." : `Got ${data.contactName ?? "them"}. Next!`),
      });

      setName("");
      setPhone("");
      setCompany("");
      setInterest("");
      requestAnimationFrame(() => nameRef.current?.focus());
    } catch {
      setError("Network error — try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="event-capture-kiosk relative flex h-full min-h-0 w-full flex-col overflow-y-auto overflow-x-hidden bg-[var(--bg-primary)] text-[var(--text-primary)]">
      {/* Atmosphere */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        <div className="event-capture-glow absolute -left-[20%] top-[-10%] h-[55vh] w-[55vw] rounded-full bg-[var(--accent)]/[0.09] blur-[100px]" />
        <div className="event-capture-glow-delayed absolute -right-[15%] bottom-[-5%] h-[50vh] w-[45vw] rounded-full bg-[var(--accent)]/[0.06] blur-[120px]" />
        <div className="event-capture-dots absolute inset-0 opacity-[0.35]" />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[var(--accent-border)] to-transparent" />
      </div>

      {/* Top bar */}
      <header className="relative z-10 flex items-center justify-between gap-4 px-5 py-4 md:px-8 md:py-5">
        <div className="min-w-0">
          <p className="truncate text-[11px] font-medium uppercase tracking-[0.22em] text-[var(--accent)]">
            Event Capture
          </p>
          <p className="mt-0.5 truncate text-sm text-[var(--text-secondary)]">{clientName}</p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          {clock ? (
            <span className="hidden tabular-nums text-sm text-[var(--text-tertiary)] sm:inline">
              {clock}
            </span>
          ) : null}
          <Link
            href={homeHref}
            className="inline-flex h-10 items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface-card)]/60 px-4 text-sm text-[var(--text-secondary)] backdrop-blur-md transition-colors hover:border-[var(--border-hover)] hover:text-[var(--text-primary)]"
          >
            <X className="h-4 w-4" strokeWidth={1.5} aria-hidden />
            Exit
          </Link>
        </div>
      </header>

      <div className="relative z-10 mx-auto grid w-full max-w-6xl flex-1 grid-cols-1 gap-8 px-5 pb-8 pt-2 md:px-8 lg:grid-cols-[minmax(0,1fr)_minmax(240px,280px)] lg:items-start lg:gap-10 lg:pb-10">
        {/* Main capture column */}
        <div className="flex min-w-0 flex-col">
          {/* Event identity + counter */}
          <div className="mb-8 md:mb-10">
            {editingEvent || !eventName.trim() ? (
              <div className="event-capture-enter space-y-3">
                <label
                  htmlFor="event-name"
                  className="block text-xs font-medium uppercase tracking-[0.18em] text-[var(--text-tertiary)]"
                >
                  What’s the event?
                </label>
                <input
                  ref={eventInputRef}
                  id="event-name"
                  value={eventName}
                  onChange={(e) => setEventName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      commitEventName(eventName);
                    }
                  }}
                  onBlur={() => {
                    if (eventName.trim()) commitEventName(eventName);
                  }}
                  placeholder="Mine Entra 2026"
                  list="recent-events"
                  autoComplete="off"
                  className={`${fieldClass} h-16 font-display text-2xl md:h-[4.5rem] md:text-4xl`}
                />
                <datalist id="recent-events">
                  {recentEvents.map((ev) => (
                    <option key={ev} value={ev} />
                  ))}
                </datalist>
                <p className="text-sm text-[var(--text-tertiary)]">
                  Set once — stays for the rest of the day on this device.
                </p>
                {eventName.trim() ? (
                  <button
                    type="button"
                    onClick={() => commitEventName(eventName)}
                    className="inline-flex h-11 items-center rounded-full bg-[var(--accent)] px-5 text-sm font-semibold text-[var(--accent-foreground)] transition-colors hover:bg-[var(--accent-hover)]"
                  >
                    Lock in event
                  </button>
                ) : null}
              </div>
            ) : (
              <div className="event-capture-enter flex flex-wrap items-end justify-between gap-6">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium uppercase tracking-[0.18em] text-[var(--text-tertiary)]">
                    Live at
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingEvent(true);
                      requestAnimationFrame(() => eventInputRef.current?.focus());
                    }}
                    className="group mt-1 max-w-full text-left"
                    title="Tap to change event name"
                  >
                    <h1 className="font-display text-[clamp(2rem,6vw,3.75rem)] leading-[1.05] tracking-tight text-[var(--text-primary)] transition-colors group-hover:text-[var(--accent)]">
                      {eventName}
                    </h1>
                    <span className="mt-1 inline-block text-xs text-[var(--text-tertiary)] opacity-0 transition-opacity group-hover:opacity-100">
                      Tap to rename
                    </span>
                  </button>
                </div>

                <div
                  key={counterBump}
                  className="event-capture-counter-bump shrink-0 text-right"
                >
                  <p
                    className="font-display text-[clamp(3.5rem,12vw,6.5rem)] leading-none tabular-nums tracking-tight text-[var(--accent)]"
                    aria-live="polite"
                  >
                    {capturedToday}
                  </p>
                  <p className="mt-1 text-xs font-medium uppercase tracking-[0.2em] text-[var(--text-secondary)]">
                    captured today
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Capture form — only prominent once event is set */}
          <form
            onSubmit={handleSubmit}
            className={`event-capture-enter space-y-4 transition-opacity duration-300 ${
              eventName.trim() && !editingEvent ? "opacity-100" : "pointer-events-none opacity-40"
            }`}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label
                  htmlFor="capture-name"
                  className="mb-2 block text-xs font-medium uppercase tracking-[0.16em] text-[var(--text-tertiary)]"
                >
                  Name
                </label>
                <input
                  ref={nameRef}
                  id="capture-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Visitor’s name"
                  autoComplete="name"
                  className={`${fieldClass} h-16 text-xl md:h-[4.25rem] md:text-2xl`}
                  required
                />
              </div>

              <div className="sm:col-span-2">
                <label
                  htmlFor="capture-phone"
                  className="mb-2 block text-xs font-medium uppercase tracking-[0.16em] text-[var(--text-tertiary)]"
                >
                  Phone
                </label>
                <div className="flex w-full items-stretch">
                  <span className="inline-flex h-16 shrink-0 items-center rounded-l-2xl border border-r-0 border-[var(--border)] bg-[var(--bg-quaternary)]/80 px-4 text-lg tabular-nums text-[var(--text-secondary)] backdrop-blur-sm md:h-[4.25rem] md:px-5 md:text-xl">
                    +{dial}
                  </span>
                  <input
                    id="capture-phone"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="77 123 4567"
                    inputMode="tel"
                    autoComplete="tel"
                    className={`${fieldClass} h-16 rounded-l-none text-xl md:h-[4.25rem] md:text-2xl`}
                    required
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="capture-company"
                  className="mb-2 block text-xs font-medium uppercase tracking-[0.16em] text-[var(--text-tertiary)]"
                >
                  Company <span className="normal-case tracking-normal text-[var(--text-disabled)]">optional</span>
                </label>
                <input
                  id="capture-company"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  placeholder="Company"
                  autoComplete="organization"
                  className={`${fieldClass} h-14 text-lg`}
                />
              </div>

              <div>
                <label
                  htmlFor="capture-interest"
                  className="mb-2 block text-xs font-medium uppercase tracking-[0.16em] text-[var(--text-tertiary)]"
                >
                  Interest <span className="normal-case tracking-normal text-[var(--text-disabled)]">optional</span>
                </label>
                <input
                  id="capture-interest"
                  value={interest}
                  onChange={(e) => setInterest(e.target.value)}
                  placeholder="What they asked about"
                  className={`${fieldClass} h-14 text-lg`}
                />
              </div>
            </div>

            {error ? (
              <p
                role="alert"
                className="rounded-xl border border-[var(--error-border)] bg-[var(--error-muted)] px-4 py-3 text-sm text-[var(--error)]"
              >
                {error}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={submitting || !eventName.trim() || editingEvent}
              className="event-capture-cta group relative flex h-[4.5rem] w-full items-center justify-center overflow-hidden rounded-2xl bg-[var(--accent)] text-xl font-semibold text-[var(--accent-foreground)] transition-[transform,background-color,opacity] hover:bg-[var(--accent-hover)] active:scale-[0.985] disabled:cursor-not-allowed disabled:opacity-50 md:h-20 md:text-2xl"
            >
              <span className="absolute inset-0 bg-gradient-to-t from-black/10 to-transparent opacity-60" aria-hidden />
              <span className="relative">{submitting ? "Saving…" : "Capture contact"}</span>
            </button>
          </form>
        </div>

        {/* Live feed rail */}
        <aside className="event-capture-enter relative flex min-h-0 flex-col rounded-3xl border border-[var(--border)] bg-[var(--surface-card)]/50 p-5 backdrop-blur-md lg:sticky lg:top-6 lg:max-h-[calc(100dvh-5rem)]">
          <div className="mb-4 flex items-center justify-between gap-2">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-[var(--text-tertiary)]">
              Just in
            </p>
            {recent.length > 0 ? (
              <span className="inline-flex items-center gap-1.5 text-[11px] text-[var(--success)]">
                <span className="event-capture-live-dot h-1.5 w-1.5 rounded-full bg-[var(--success)]" />
                Live
              </span>
            ) : null}
          </div>

          {recent.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center py-10 text-center">
              <p className="font-display text-2xl text-[var(--text-secondary)]">Ready</p>
              <p className="mt-2 max-w-[14rem] text-sm leading-relaxed text-[var(--text-tertiary)]">
                Captures appear here so you can confirm each one went through.
              </p>
            </div>
          ) : (
            <ul className="flex flex-col gap-1 overflow-y-auto">
              {recent.map((r) => (
                <li
                  key={r.id}
                  className="flex items-center justify-between gap-3 rounded-xl px-3 py-3 transition-colors hover:bg-white/[0.03]"
                >
                  <span className="truncate font-medium text-[var(--text-primary)]">{r.name}</span>
                  <span className="shrink-0 tabular-nums text-sm text-[var(--text-tertiary)]">
                    {formatCaptureTime(r.createdAt)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </aside>
      </div>

      {/* Success / returning flash */}
      {flash ? (
        <div
          role="status"
          className="event-capture-flash pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center px-4 md:bottom-10"
        >
          <div
            className={
              flash.tone === "info"
                ? "flex max-w-lg items-start gap-3 rounded-2xl border border-[var(--info-border)] bg-[var(--bg-tertiary)]/95 px-5 py-4 shadow-[var(--shadow-lg)] backdrop-blur-md"
                : "flex max-w-lg items-start gap-3 rounded-2xl border border-[var(--accent-border)] bg-[var(--bg-tertiary)]/95 px-5 py-4 shadow-[var(--shadow-lg)] backdrop-blur-md"
            }
          >
            {flash.tone === "info" ? (
              <RotateCcw className="mt-0.5 h-5 w-5 shrink-0 text-[var(--info)]" strokeWidth={1.75} />
            ) : (
              <Check className="mt-0.5 h-5 w-5 shrink-0 text-[var(--accent)]" strokeWidth={2} />
            )}
            <p className="text-base font-medium leading-snug text-[var(--text-primary)]">{flash.text}</p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
