"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { SOLAR_PROGRESS_STEPS, solarProgressIndex, type SolarSalesStage } from "@/lib/sales/solar-workflow";

type Snapshot = {
  stage: SolarSalesStage;
  stageLabel: string;
  nextAction: string;
  dealId: string | null;
  visitId: string | null;
  quoteAccepted: boolean;
};

export function SolarStageCue({
  leadId,
  visitBase,
  quotesBase,
  compact = false,
}: {
  leadId: string;
  visitBase: string;
  quotesBase: string;
  compact?: boolean;
}) {
  const [card, setCard] = useState<Snapshot | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetch(`/api/sales/solar-workflow/lead?leadId=${encodeURIComponent(leadId)}`)
      .then((res) => res.json())
      .then((json: { card?: Snapshot | null }) => {
        if (!cancelled) setCard(json.card ?? null);
      })
      .catch(() => {
        if (!cancelled) setCard(null);
      });
    return () => {
      cancelled = true;
    };
  }, [leadId]);

  if (!card) return null;
  const current = solarProgressIndex(card.stage);
  const actionHref =
    card.nextAction === "Open visit" && card.visitId
      ? `${visitBase}/${card.visitId}`
      : card.nextAction === "Prepare proposal" || card.nextAction === "Send quote"
        ? card.dealId
          ? `${quotesBase}?dealId=${card.dealId}`
          : quotesBase
        : null;

  if (compact) {
    return (
      <div className="flex min-w-0 flex-wrap items-center gap-2 text-[12px]">
        <span className="font-semibold text-sales-text-primary">{card.stageLabel}</span>
        {card.nextAction ? <span className="text-sales-text-secondary">Next · {card.nextAction}</span> : null}
        {actionHref ? (
          <Link href={actionHref} className="inline-flex min-h-11 items-center font-semibold text-sales-text-primary">{card.nextAction}</Link>
        ) : null}
      </div>
    );
  }

  return (
    <section className="rounded-[12px] border border-sales-border bg-sales-surface p-4">
      <h2 className="text-[13px] font-medium text-sales-text-secondary">Solar sales progress</h2>
      <ol className="mt-3 space-y-1.5">
        {SOLAR_PROGRESS_STEPS.map((step, index) => {
          const done = card.stage === "WON" ? true : index < current;
          const active = index === current && card.stage !== "LOST" && card.stage !== "WON";
          return (
            <li key={step.id} className="flex min-h-8 items-center gap-2 text-[14px]">
              <span aria-hidden className="w-4 text-sales-text-muted">{done ? "✓" : active ? "●" : "○"}</span>
              <span className={active ? "font-semibold text-sales-text-primary" : "text-sales-text-secondary"}>{step.label}</span>
            </li>
          );
        })}
        {card.stage === "LOST" ? <li className="text-[14px] text-sales-text-secondary">Lost</li> : null}
      </ol>
      {card.quoteAccepted ? <p className="mt-3 text-[13px] text-sales-text-primary">Customer accepted quotation</p> : null}
      {card.nextAction ? (
        actionHref ? (
          <Link href={actionHref} className="mt-3 inline-flex min-h-11 items-center text-[14px] font-semibold">{card.nextAction}</Link>
        ) : (
          <p className="mt-3 text-[14px] font-semibold text-sales-text-primary">Next · {card.nextAction}</p>
        )
      ) : null}
    </section>
  );
}
