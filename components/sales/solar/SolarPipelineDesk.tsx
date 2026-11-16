"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { SOLAR_SALES_STAGE_LABEL, SOLAR_SALES_STAGES, type SolarSalesStage } from "@/lib/sales/solar-workflow";
import { Bones, EmptyNote, Head, inkBtn, lineBtn } from "./desk";

type Card = {
  leadId: string;
  stage: SolarSalesStage;
  customerName: string;
  location: string | null;
  nextAction: string;
};

export function SolarPipelineDesk() {
  const router = useRouter();
  const [cards, setCards] = useState<Card[]>([]);
  const [stage, setStage] = useState<SolarSalesStage | "all">("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const visible = stage === "all" ? SOLAR_SALES_STAGES : SOLAR_SALES_STAGES.filter((id) => id === stage);

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
        detail="Stage is derived from the lead, the visit, the quotation, and the deal. Dragging is not how a stage becomes true."
      />
      <div className="flex gap-2 overflow-x-auto" role="tablist" aria-label="Stages">
        <button type="button" className={stage === "all" ? inkBtn : lineBtn} aria-pressed={stage === "all"} onClick={() => setStage("all")}>All</button>
        {SOLAR_SALES_STAGES.map((id) => (
          <button key={id} type="button" className={stage === id ? inkBtn : lineBtn} aria-pressed={stage === id} onClick={() => setStage(id)}>
            {SOLAR_SALES_STAGE_LABEL[id]}
          </button>
        ))}
      </div>
      {error ? <p className="text-[14px] text-sales-danger-fg" role="alert">{error}</p> : null}
      {loading ? (
        <section className="overflow-hidden rounded-[6px] border border-sales-border bg-sales-surface">
          <Bones />
        </section>
      ) : (
        <div className="so-board">
          {visible.map((id) => {
            const column = cards.filter((card) => card.stage === id);
            return (
              <section key={id} className="so-col" aria-label={SOLAR_SALES_STAGE_LABEL[id]}>
                <header className="flex items-center justify-between gap-2 border-b border-sales-border-subtle px-3 py-3">
                  <h2 className="text-[13px] font-semibold text-sales-text-primary">{SOLAR_SALES_STAGE_LABEL[id]}</h2>
                  <span className="text-[12px] tabular-nums text-sales-text-muted">{column.length}</span>
                </header>
                {column.length === 0 ? (
                  <p className="px-3 py-4 text-[13px] text-sales-text-secondary">No opportunities.</p>
                ) : (
                  <ul>
                    {column.map((card) => (
                      <li key={card.leadId} className="border-t border-sales-border-subtle px-3 py-3">
                        <p className="text-[14px] font-semibold text-sales-text-primary">{card.customerName}</p>
                        {card.location ? <p className="text-[12px] text-sales-text-muted">{card.location}</p> : null}
                        <p className="mt-1 text-[13px] text-sales-text-secondary">{card.nextAction}</p>
                        <button type="button" className={`${lineBtn} mt-3`} onClick={() => router.push(`/sales/leads?lead=${card.leadId}`)}>
                          Open
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            );
          })}
        </div>
      )}
      {!loading && cards.length === 0 && !error ? <EmptyNote title="No leads yet" detail="Add a lead and it will take its stage from the visit, the quotation, and the deal." /> : null}
    </div>
  );
}
