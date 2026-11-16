"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CreateQuoteDialog } from "@/components/sales/quotes/CreateQuoteDialog";
import type { SolarSalesStage } from "@/lib/sales/solar-workflow";
import { Bones, EmptyNote, Head, inkBtn, lineBtn, Panel } from "./desk";

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
  customerName: string;
  service: string | null;
  location: string | null;
  nextAction: string;
  reminderAt: string | null;
  quote: Quote | null;
};

type Pile = "prepare" | "draft" | "sent" | "accepted";

const FILTERS: Array<{ id: Pile; label: string }> = [
  { id: "prepare", label: "To prepare" },
  { id: "draft", label: "Draft" },
  { id: "sent", label: "Sent" },
  { id: "accepted", label: "Accepted" },
];

const PRE_SEND = new Set(["draft", "pending_approval", "approved"]);
const SENT = new Set(["sent", "viewed", "rejected", "expired"]);

function money(currency: string, total: number | null) {
  if (total == null || Number.isNaN(Number(total))) return "No price yet";
  const amount = Number(total).toLocaleString("en-US", { maximumFractionDigits: 0 });
  return currency === "USD" ? `US$${amount}` : `${currency} ${amount}`;
}

function pileOf(card: Card): Pile | null {
  const status = card.quote?.status ?? "";
  if (status === "accepted" || (card.stage === "WON" && card.quote)) return "accepted";
  if (SENT.has(status) || card.stage === "QUOTE_SENT" || card.stage === "NEGOTIATION") return "sent";
  if (PRE_SEND.has(status) || card.stage === "PROPOSAL_PREPARED") return "draft";
  if (card.stage === "SITE_VISIT_COMPLETED" && !card.quote) return "prepare";
  return null;
}

function statusLabel(card: Card, pile: Pile) {
  if (pile === "prepare") return "Assessment done";
  if (pile === "accepted") return "Accepted";
  if (pile === "sent") return "Sent";
  return "Draft";
}

function dueToday(iso: string | null) {
  if (!iso) return false;
  const time = new Date(iso).getTime();
  if (Number.isNaN(time)) return false;
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return time >= start.getTime() && time < end.getTime();
}

export function SolarQuotesDesk() {
  const router = useRouter();
  const [cards, setCards] = useState<Card[]>([]);
  const [pile, setPile] = useState<Pile | "all">("all");
  const [adding, setAdding] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const rows = cards
    .map((card) => ({ card, pile: pileOf(card) }))
    .filter((row): row is { card: Card; pile: Pile } => row.pile != null && (pile === "all" || row.pile === pile));

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/sales/solar-workflow")
      .then((res) => res.json())
      .then((json: { cards?: Card[]; error?: string }) => {
        if (cancelled) return;
        if (!json.cards) setError(json.error || "Could not load quotations.");
        else setCards(json.cards);
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) {
          setError("Could not load quotations.");
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
        title="Quotations"
        detail="A draft sets Proposal Prepared. Sending it sets Quote Sent. Open a card to send, follow up, or open the project."
        action={adding ? undefined : "New quotation"}
        onAction={() => setAdding(true)}
      />
      <div className="so-filters" role="tablist" aria-label="Quotation status">
        <button type="button" className={pile === "all" ? inkBtn : lineBtn} aria-pressed={pile === "all"} onClick={() => setPile("all")}>All</button>
        {FILTERS.map((item) => (
          <button key={item.id} type="button" className={pile === item.id ? inkBtn : lineBtn} aria-pressed={pile === item.id} onClick={() => setPile(item.id)}>
            {item.label}
          </button>
        ))}
      </div>
      {error ? <p className="text-[14px] text-sales-danger-fg" role="alert">{error}</p> : null}
      <Panel title="Register" count={loading ? undefined : rows.length}>
        {loading ? <Bones /> : rows.length === 0 ? (
          <EmptyNote title="Nothing in this view" detail="Drafts, sent quotations, and accepted jobs show here." />
        ) : (
          <ul className="so-col-list">
            {rows.map(({ card, pile: rowPile }) => {
              const due = dueToday(card.reminderAt);
              const amount = card.quote ? money(card.quote.currency, card.quote.total) : "No price yet";
              return (
                <li key={card.leadId}>
                  <button
                    type="button"
                    className={`so-card ${due ? "is-today" : ""}`}
                    onClick={() => router.push(card.quote ? `/sales/quotes/${card.quote.id}` : `/sales/leads?lead=${card.leadId}`)}
                  >
                    <span className="so-card-top">
                      <span className="so-card-name">{card.customerName}</span>
                      <span className="so-card-stage">{statusLabel(card, rowPile)}</span>
                    </span>
                    <span className="so-card-place">{[card.location, card.service].filter(Boolean).join(" · ") || "No site yet"}</span>
                    <span className="so-card-fact">{rowPile === "prepare" ? amount : `${card.quote?.number || "Quotation"} · ${amount}`}</span>
                    <span className="so-card-next">{card.nextAction}</span>
                    {due ? <span className="so-card-due">Due today</span> : null}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>
      <CreateQuoteDialog
        open={adding}
        hasTemplates
        onClose={() => setAdding(false)}
        onCreated={(quotation) => {
          setAdding(false);
          router.push(`/sales/quotes/${quotation.id}`);
        }}
      />
    </div>
  );
}
