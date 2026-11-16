"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { SOLAR_SALES_STAGE_LABEL, type SolarSalesStage } from "@/lib/sales/solar-workflow";
import { Bones, EmptyNote, Head, inkBtn, lineBtn } from "./desk";

type Quote = {
  id: string;
  number: string | null;
  total: number | null;
  currency: string;
  status: string;
};

type Card = {
  leadId: string;
  stage: SolarSalesStage;
  stageLabel?: string;
  customerName: string;
  service: string | null;
  location: string | null;
  nextAction: string;
  reminderAt: string | null;
  quote: Quote | null;
  visit: { status: string; scheduledStartAt: string | null } | null;
};

const PILES: Array<{ id: string; label: string; hint: string; stages: SolarSalesStage[] }> = [
  { id: "new", label: "New", hint: "Not contacted yet", stages: ["NEW_LEAD"] },
  { id: "talking", label: "Talking", hint: "Contacted or qualified", stages: ["CONTACTED", "QUALIFIED"] },
  { id: "visit", label: "Visit", hint: "Booked, or the assessment is done", stages: ["SITE_VISIT_REQUIRED", "SITE_VISIT_COMPLETED"] },
  { id: "quote", label: "Quotation", hint: "Draft, sent, or negotiating", stages: ["PROPOSAL_PREPARED", "QUOTE_SENT", "NEGOTIATION"] },
  { id: "won", label: "Won", hint: "Ready for the project", stages: ["WON"] },
];

function money(currency: string, total: number | null) {
  if (total == null || Number.isNaN(Number(total))) return null;
  const amount = Number(total).toLocaleString("en-US", { maximumFractionDigits: 0 });
  return currency === "USD" ? `US$${amount}` : `${currency} ${amount}`;
}

function dueMark(iso: string | null): "today" | "overdue" | null {
  if (!iso) return null;
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

function fact(card: Card) {
  if (card.quote) {
    const price = money(card.quote.currency, card.quote.total);
    return [card.quote.number, price, card.quote.status].filter(Boolean).join(" · ");
  }
  if (card.visit) return card.visit.status.replaceAll("_", " ").toLowerCase();
  return card.service;
}

export function SolarPipelineDesk() {
  const router = useRouter();
  const [cards, setCards] = useState<Card[]>([]);
  const [pile, setPile] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const piles = pile === "lost"
    ? [{ id: "lost", label: "Lost", hint: "Closed without a sale", stages: ["LOST" as SolarSalesStage] }]
    : pile === "all"
      ? PILES
      : PILES.filter((item) => item.id === pile);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/sales/solar-workflow")
      .then((res) => res.json())
      .then((json: { cards?: Card[]; error?: string }) => {
        if (cancelled) return;
        if (!json.cards) setError(json.error || "Could not load the pipeline.");
        else setCards(json.cards);
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) {
          setError("Could not load the pipeline.");
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="space-y-8">
      <Head
        kicker="Sales"
        title="Solar Pipeline"
        detail="Five piles. The exact stage stays on the card. Open a card to move the lead, set the reminder, or start the quotation."
      />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7" role="tablist" aria-label="Pipeline piles">
        <button type="button" className={`${pile === "all" ? inkBtn : lineBtn} w-full`} aria-pressed={pile === "all"} onClick={() => setPile("all")}>All</button>
        {PILES.map((item) => (
          <button key={item.id} type="button" className={`${pile === item.id ? inkBtn : lineBtn} w-full`} aria-pressed={pile === item.id} onClick={() => setPile(item.id)}>
            {item.label}
          </button>
        ))}
        <button type="button" className={`${pile === "lost" ? inkBtn : lineBtn} w-full`} aria-pressed={pile === "lost"} onClick={() => setPile("lost")}>Lost</button>
      </div>
      {error ? <p className="text-[14px] text-sales-danger-fg" role="alert">{error}</p> : null}
      {loading ? (
        <section className="overflow-hidden rounded-[6px] border border-sales-border bg-sales-surface">
          <Bones />
        </section>
      ) : (
        <div className={`so-board ${piles.length === 1 ? "is-one" : ""}`}>
          {piles.map((item) => {
            const column = cards.filter((card) => item.stages.includes(card.stage));
            return (
              <section key={item.id} className="so-col" aria-label={item.label}>
                <header className="so-col-head">
                  <h2 className="text-[13px] font-semibold text-sales-text-primary">{item.label}</h2>
                  <span className="text-[12px] tabular-nums text-sales-text-muted">{column.length}</span>
                </header>
                <p className="so-col-hint">{item.hint}</p>
                {column.length === 0 ? (
                  <p className="px-3.5 py-4 text-[13px] text-sales-text-secondary">No opportunities.</p>
                ) : (
                  <ul className="so-col-list">
                    {column.map((card) => {
                      const due = dueMark(card.reminderAt);
                      return (
                        <li key={card.leadId}>
                          <button
                            type="button"
                            className={`so-card ${due ? `is-${due}` : ""}`}
                            onClick={() => router.push(`/sales/leads?lead=${card.leadId}`)}
                          >
                            <span className="so-card-top">
                              <span className="so-card-name">{card.customerName}</span>
                              <span className="so-card-stage">{card.stageLabel || SOLAR_SALES_STAGE_LABEL[card.stage]}</span>
                            </span>
                            {card.location ? <span className="so-card-place">{card.location}</span> : null}
                            {fact(card) ? <span className="so-card-fact">{fact(card)}</span> : null}
                            <span className="so-card-next">{card.nextAction}</span>
                            {due ? <span className="so-card-due">{due === "overdue" ? "Overdue" : "Due today"}</span> : null}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>
            );
          })}
        </div>
      )}
      {!loading && cards.length === 0 && !error ? (
        <EmptyNote title="No leads yet" detail="Add a lead and it will take its stage from the visit, the quotation, and the deal." />
      ) : null}
    </div>
  );
}
