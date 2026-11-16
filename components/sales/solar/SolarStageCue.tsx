"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { SOLAR_PROGRESS_STEPS, solarProgressIndex, type SolarSalesStage } from "@/lib/sales/solar-workflow";
import { resolveSolarEngagement } from "@/lib/sales/solar-workflow/engagement";
import type { SolarPanelActionKind } from "@/lib/sales/solar-workflow/opportunity";
import "./solar-desk.css";

type Snapshot = {
  stage: SolarSalesStage;
  stageLabel: string;
  nextAction: string;
  nextActionKind?: SolarPanelActionKind;
  reminderAt?: string | null;
  dealId: string | null;
  visitId: string | null;
  projectId?: string | null;
  quoteAccepted: boolean;
  requirement?: {
    service: string | null;
    location: string | null;
    timeline: string | null;
    budget: string | null;
  };
  visit?: { status: string; scheduledAt: string | null } | null;
  quotation?: {
    number: string | null;
    statusLabel: string | null;
    total: number | null;
    currency: string;
    sentAt: string | null;
    viewedAt: string | null;
    acceptedAt: string | null;
  } | null;
  assessment?: { completedAt: string | null } | null;
  project?: { id: string } | null;
};

type ThreadFacts = {
  lastMessageDirection: "inbound" | "outbound" | null;
  lastMessageAt: string | null;
};

export function SolarStageCue({
  leadId,
  visitBase,
  quotesBase,
  compact = false,
  refreshKey = 0,
  thread = null,
}: {
  leadId: string;
  visitBase: string;
  quotesBase: string;
  compact?: boolean;
  refreshKey?: number;
  thread?: ThreadFacts | null;
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
  }, [leadId, refreshKey]);

  if (!card) return null;
  const current = solarProgressIndex(card.stage);
  const actionHref =
    (card.nextAction === "Open visit" || card.nextAction === "Continue assessment") && card.visitId
      ? `${visitBase}/${card.visitId}`
      : card.nextAction === "Prepare proposal" || card.nextAction === "Send quote"
        ? card.dealId
          ? `${quotesBase}?dealId=${card.dealId}`
          : quotesBase
        : card.nextAction === "Open project" && card.projectId
          ? `/sales/projects/${card.projectId}`
          : null;

  const visitScheduled = Boolean(card.visit && ["SCHEDULED", "ON_SITE", "RESCHEDULED"].includes(card.visit.status));
  const threadPlan = compact && thread && card.nextActionKind
    ? resolveSolarEngagement({
        stage: card.stage,
        now: new Date(),
        lastMessageDirection: thread.lastMessageDirection,
        lastMessageAt: thread.lastMessageAt,
        followUpAt: card.reminderAt ?? null,
        service: card.requirement?.service ?? null,
        location: card.requirement?.location ?? null,
        timeline: card.requirement?.timeline ?? null,
        budget: card.requirement?.budget ?? null,
        visitScheduled,
        visitAt: card.visit?.scheduledAt ?? null,
        assessmentCompletedAt: card.assessment?.completedAt ?? null,
        quote: card.quotation
          ? {
              number: card.quotation.number,
              total: card.quotation.total,
              currency: card.quotation.currency,
              sentAt: card.quotation.sentAt,
              viewedAt: card.quotation.viewedAt,
              acceptedAt: card.quotation.acceptedAt,
              status: card.quotation.statusLabel,
            }
          : null,
        workflowKind: card.nextActionKind,
        workflowLabel: card.nextAction,
        hasProject: Boolean(card.project || card.projectId),
      })
    : null;
  const compactNext = threadPlan?.primary.title || threadPlan?.engagementLabel || (card.nextAction === "Contact lead" ? "Reply to this customer" : card.nextAction);
  if (compact) {
    return (
      <div className="flex min-w-0 flex-wrap items-center gap-2 text-[12px]">
        <span className="font-semibold text-sales-text-primary">{card.stageLabel}</span>
        {compactNext ? <span className="text-sales-text-secondary">{threadPlan ? compactNext : `Next · ${compactNext}`}</span> : null}
        {actionHref && !threadPlan ? (
          <Link href={actionHref} className="inline-flex min-h-11 items-center font-semibold text-sales-text-primary">{card.nextAction}</Link>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <ol className="so-steps" aria-label="Solar journey">
        {SOLAR_PROGRESS_STEPS.map((step, index) => {
          const done = card.stage === "WON" ? true : index < current;
          const active = index === current && card.stage !== "LOST" && card.stage !== "WON";
          return (
            <li key={step.id} className="so-step" aria-current={active ? "step" : undefined}>
              <p className="text-[12px] text-sales-text-muted">{done ? "Done" : active ? "Now" : "Later"}</p>
              <p className="mt-1 text-[13px] font-semibold text-sales-text-primary">{step.label}</p>
            </li>
          );
        })}
      </ol>
      {card.stage === "LOST" ? <p className="text-[14px] text-sales-text-secondary">Lost</p> : null}
      {card.quoteAccepted ? <p className="text-[13px] text-sales-text-primary">Customer accepted quotation</p> : null}
      {card.nextAction ? (
        actionHref ? (
          <Link href={actionHref} className="inline-flex min-h-11 items-center text-[14px] font-semibold text-sales-text-primary">{card.nextAction}</Link>
        ) : (
          <p className="text-[14px] font-semibold text-sales-text-primary">Next · {card.nextAction}</p>
        )
      ) : null}
    </div>
  );
}
