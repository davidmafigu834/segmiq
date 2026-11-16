"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Card = {
  leadId: string;
  customerName: string;
  stageLabel: string;
  nextAction: string;
  reminderAt: string | null;
};

function dueKey(value: string): string | null {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function todayKey() {
  const date = new Date();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

export function SolarToday({ onAddLead }: { onAddLead?: () => void }) {
  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/sales/solar-workflow")
      .then((res) => res.json())
      .then((json: { cards?: Card[]; error?: string }) => {
        if (cancelled) return;
        if (!json.cards) setError(json.error || "Could not load reminders.");
        else setCards(json.cards);
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) {
          setError("Could not load reminders.");
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const today = todayKey();
  const rows = cards.flatMap((card) => {
    if (!card.reminderAt) return [];
    const key = dueKey(card.reminderAt);
    if (!key || key > today) return [];
    return [{ card, overdue: key < today }];
  });
  const overdue = rows.filter((row) => row.overdue);
  const due = rows.filter((row) => !row.overdue);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-[24px] font-semibold tracking-[-0.03em] text-sales-text-primary">Today</h2>
          <p className="mt-1 max-w-[52ch] text-[14px] text-sales-text-secondary">
            Reminders that are overdue, then reminders due today. Open the lead to write a note or move the sale.
          </p>
        </div>
        {onAddLead ? (
          <button
            type="button"
            onClick={onAddLead}
            className="inline-flex h-11 items-center rounded-[10px] bg-sales-brand px-4 text-[14px] font-semibold text-sales-brand-text"
          >
            Add lead
          </button>
        ) : null}
      </div>
      {loading ? <div className="h-40 animate-pulse rounded-[12px] bg-sales-surface-subtle" aria-hidden /> : null}
      {error ? <p className="text-[14px] text-sales-danger-fg" role="alert">{error}</p> : null}
      {!loading && !error && rows.length === 0 ? (
        <div className="rounded-[12px] border border-sales-border bg-sales-surface px-4 py-8">
          <p className="text-[15px] font-semibold text-sales-text-primary">Nothing due</p>
          <p className="mt-1 text-[14px] text-sales-text-secondary">Set a reminder on a lead and it will wait here.</p>
          <Link href="/sales/leads" className="mt-3 inline-flex h-11 items-center text-[14px] font-semibold text-sales-text-primary">
            Open leads
          </Link>
        </div>
      ) : null}
      {!loading && rows.length > 0 ? (
        <div className="overflow-hidden rounded-[12px] border border-sales-border bg-sales-surface">
          {overdue.length > 0 ? <Group label="Overdue" rows={overdue} /> : null}
          {due.length > 0 ? <Group label="Today" rows={due} /> : null}
        </div>
      ) : null}
    </div>
  );
}

function Group({ label, rows }: { label: string; rows: Array<{ card: Card; overdue: boolean }> }) {
  return (
    <section>
      <h3 className="border-b border-sales-border-subtle px-4 py-2 text-[12px] font-semibold text-sales-text-muted">{label}</h3>
      <ul>
        {rows.map(({ card }) => (
          <li key={card.leadId} className="border-b border-sales-border-subtle last:border-b-0">
            <Link href={`/sales/leads?lead=${card.leadId}`} className="flex items-center gap-3 px-4 py-3 hover:bg-sales-surface-hover">
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] font-semibold text-sales-text-primary">{card.customerName}</p>
                <p className="truncate text-[12px] text-sales-text-muted">{card.stageLabel}</p>
                <p className="mt-0.5 text-[13px] text-sales-text-secondary">{card.nextAction}</p>
              </div>
              <span className="text-[13px] font-semibold text-sales-text-primary">Open</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
