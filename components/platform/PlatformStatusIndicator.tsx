"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

type Session = {
  id: string;
  organisation: string | null;
  remainingMs: number;
};

export function PlatformStatusIndicator() {
  const [open, setOpen] = useState(false);
  const [sessions, setSessions] = useState<Session[]>([]);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/admin/support-access/active")
      .then((r) => (r.ok ? r.json() : { sessions: [] }))
      .then((payload: { sessions?: Session[] }) => {
        if (!cancelled) setSessions(payload.sessions ?? []);
      })
      .catch(() => {
        if (!cancelled) setSessions([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const supportActive = sessions.length > 0;
  const label = supportActive ? `${sessions.length} support session${sessions.length === 1 ? "" : "s"}` : "Operational";

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex h-8 items-center gap-1.5 rounded-md px-2 text-[12px] text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        <span
          className={`h-1.5 w-1.5 rounded-full ${supportActive ? "bg-[var(--accent)]" : "bg-[var(--success)]"}`}
          aria-hidden
        />
        <span className="hidden sm:inline">{label}</span>
      </button>
      {open ? (
        <div
          role="dialog"
          aria-label="Platform status"
          className="absolute right-0 top-full z-50 mt-1.5 w-[280px] rounded-lg border border-[var(--border)] bg-[var(--surface-dropdown)] p-3 shadow-[var(--shadow-md)]"
        >
          <p className="text-[12px] font-medium text-[var(--text-primary)]">Platform status</p>
          <ul className="mt-2 space-y-1.5 text-[12px] text-[var(--text-secondary)]">
            <li className="flex items-center justify-between gap-3">
              <span>Incidents</span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-[var(--success)]" aria-hidden />
                See health
              </span>
            </li>
            <li className="flex items-center justify-between gap-3">
              <span>Support access</span>
              <span className="inline-flex items-center gap-1.5">
                <span
                  className={`h-1.5 w-1.5 rounded-full ${supportActive ? "bg-[var(--accent)]" : "bg-[var(--success)]"}`}
                  aria-hidden
                />
                {supportActive ? `${sessions.length} active` : "None"}
              </span>
            </li>
          </ul>
          {supportActive ? (
            <ul className="mt-2 space-y-1 border-t border-[var(--border)] pt-2">
              {sessions.slice(0, 4).map((s) => (
                <li key={s.id} className="truncate text-[12px] text-[var(--text-secondary)]">
                  {s.organisation ?? "Organisation"}
                </li>
              ))}
            </ul>
          ) : null}
          <Link
            href="/dashboard/status-incidents"
            onClick={() => setOpen(false)}
            className="mt-3 block text-[12px] font-medium text-[var(--text-primary)] hover:text-[var(--accent-fg)]"
          >
            View platform health →
          </Link>
        </div>
      ) : null}
    </div>
  );
}
