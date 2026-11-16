"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { SolarSalesStage } from "@/lib/sales/solar-workflow";
import { SOLAR_SALES_STAGE_LABEL } from "@/lib/sales/solar-workflow";
import { Bones, EmptyNote, Head, Panel, WorkRow } from "./desk";

type Card = {
  leadId: string;
  customerName: string;
  stage: SolarSalesStage;
  location: string | null;
  nextAction: string;
  reminderAt: string | null;
  visit: { scheduledStartAt: string | null } | null;
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
  const router = useRouter();
  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/sales/solar-workflow")
      .then((res) => res.json())
      .then((json: { cards?: Card[]; error?: string }) => {
        if (cancelled) return;
        if (!json.cards) setError(json.error || "Could not load the desk.");
        else setCards(json.cards);
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) {
          setError("Could not load the desk.");
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const today = todayKey();
  const attention = cards.flatMap((card) => {
    if (!card.reminderAt) return [];
    const key = dueKey(card.reminderAt);
    if (!key || key > today) return [];
    return [{ card, overdue: key < today }];
  });
  const overdue = attention.filter((row) => row.overdue);
  const due = attention.filter((row) => !row.overdue);
  const open = cards.filter((card) => card.stage !== "WON" && card.stage !== "LOST").length;
  const visits = cards.filter((card) => card.visit?.scheduledStartAt && dueKey(card.visit.scheduledStartAt) === today).length;
  const won = cards.filter((card) => card.stage === "WON").length;

  function openLead(id: string) {
    router.push(`/sales/leads?lead=${id}`);
  }

  return (
    <div className="space-y-8">
      <Head
        kicker="Solar installation"
        title="Dashboard"
        detail="Reminders that are overdue, then reminders due today. Open the lead to write a note or move the sale."
        action={onAddLead ? "New lead" : undefined}
        onAction={onAddLead}
      />
      {error ? <p className="text-[14px] text-sales-danger-fg" role="alert">{error}</p> : null}
      <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1.5fr)_minmax(260px,0.85fr)]">
        <Panel title="Needs you" count={loading ? undefined : attention.length}>
          {loading ? <Bones /> : attention.length === 0 ? (
            <EmptyNote title="Nothing waiting" detail="Set a reminder on a lead and it will wait here." />
          ) : (
            <ul>
              {overdue.map(({ card }) => (
                <WorkRow
                  key={card.leadId}
                  name={card.customerName}
                  meta={`${SOLAR_SALES_STAGE_LABEL[card.stage]}${card.location ? ` · ${card.location}` : ""}`}
                  detail={card.nextAction}
                  mark="overdue"
                  action="Open"
                  onAction={() => openLead(card.leadId)}
                />
              ))}
              {due.map(({ card }) => (
                <WorkRow
                  key={card.leadId}
                  name={card.customerName}
                  meta={`${SOLAR_SALES_STAGE_LABEL[card.stage]}${card.location ? ` · ${card.location}` : ""}`}
                  detail={card.nextAction}
                  mark="today"
                  action="Open"
                  onAction={() => openLead(card.leadId)}
                />
              ))}
            </ul>
          )}
        </Panel>
        <Panel title="Today" count={loading ? undefined : due.length}>
          {loading ? <Bones /> : due.length === 0 ? (
            <EmptyNote title="Nothing due today" detail="Overdue reminders stay in Needs you." />
          ) : (
            <ul>
              {due.map(({ card }) => (
                <WorkRow
                  key={card.leadId}
                  name={card.customerName}
                  meta={SOLAR_SALES_STAGE_LABEL[card.stage]}
                  detail={card.nextAction}
                  mark="today"
                  action="Open"
                  onAction={() => openLead(card.leadId)}
                />
              ))}
            </ul>
          )}
        </Panel>
      </div>
      <div className="grid grid-cols-2 overflow-hidden rounded-[12px] border border-sales-border bg-sales-surface sm:grid-cols-4">
        <Metric label="Open leads" value={loading ? "–" : String(open)} />
        <Metric label="Visits today" value={loading ? "–" : String(visits)} />
        <Metric label="Overdue" value={loading ? "–" : String(overdue.length)} attention={overdue.length > 0} />
        <Metric label="Won" value={loading ? "–" : String(won)} />
      </div>
    </div>
  );
}

function Metric({ label, value, attention }: { label: string; value: string; attention?: boolean }) {
  return (
    <div className="border-b border-r border-sales-border-subtle px-4 py-4">
      <p className="text-[12px] text-sales-text-muted">{label}</p>
      <p className={`mt-1 font-display text-[24px] font-semibold leading-none ${attention ? "text-sales-danger-fg" : "text-sales-text-primary"}`}>{value}</p>
    </div>
  );
}
