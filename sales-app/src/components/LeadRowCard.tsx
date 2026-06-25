import { useEffect, useState } from "react";
import { ClipboardList, MessageCircle, Phone } from "lucide-react";
import { CrmCard } from "./crm";
import { leadDisplayName } from "../lib/format";
import { classifyLeadLane, HIGH_SCORE_THRESHOLD } from "../lib/lead-lanes";
import {
  budgetDisplayText,
  buildReasonContextLine,
  formatCardTimestamp,
  freshnessDotClass,
  isHotSlaBreached,
  leadFit,
  leadIntentScore,
  resolveFreshnessState,
  serviceDisplayText,
  sourceLabel,
  timeAgo,
} from "../lib/lead-display";
import type { LeadRow } from "../lib/types";
import { buildOpenerMessage, dialPhone, openWhatsApp } from "../lib/whatsapp";

const SLA_TARGET_MS = 5 * 60 * 1000;

function SlaCountdown({ createdAt }: { createdAt: string }) {
  const [remainingMs, setRemainingMs] = useState(
    () => SLA_TARGET_MS - (Date.now() - new Date(createdAt).getTime())
  );

  useEffect(() => {
    const tick = () =>
      setRemainingMs(SLA_TARGET_MS - (Date.now() - new Date(createdAt).getTime()));
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [createdAt]);

  if (remainingMs <= 0) {
    const lateMins = Math.max(1, Math.ceil(Math.abs(remainingMs) / 60_000));
    return <span className="text-[var(--warning)]">SLA {lateMins}m late</span>;
  }

  const totalSeconds = Math.floor(remainingMs / 1000);
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return (
    <span className="text-accent">
      SLA {mins}:{secs.toString().padStart(2, "0")} left
    </span>
  );
}

type Props = {
  lead: LeadRow;
  repName: string;
  companyName?: string;
  now?: Date;
  onOpen: (lead: LeadRow) => void;
  onLogCall: (lead: LeadRow, channel?: "call" | "whatsapp") => void;
};

export function LeadRowCard({
  lead,
  repName,
  companyName,
  now = new Date(),
  onOpen,
  onLogCall,
}: Props) {
  const name = leadDisplayName(lead.name);
  const firstName = name.split(/\s+/)[0] ?? name;
  const { lane, tier } = classifyLeadLane(lead, now);

  const score = leadIntentScore(lead);
  const showScore = score !== null;
  const highScore = (score ?? 0) >= HIGH_SCORE_THRESHOLD;
  const fit = leadFit(lead);

  const serviceChip = serviceDisplayText(lead);
  const budgetChip = budgetDisplayText(lead);
  const hasChips = !!(serviceChip || budgetChip);
  const contextLine = buildReasonContextLine(lead, lane);

  const freshness = resolveFreshnessState({ lead, lane, now });
  const freshnessTitle =
    freshness === "fresh" ? "Fresh" : freshness === "slipping" ? "Needs attention" : "Overdue";

  const isHotCallNow = lane === "call_now" && tier === "hot";

  return (
    <CrmCard className="w-full p-4" onClick={() => onOpen(lead)}>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5">
          <span className="truncate font-mono text-[10px] uppercase tracking-wide text-ink-tertiary">
            {sourceLabel(lead.source)}
          </span>
          {fit ? (
            <span className="inline-flex h-4 shrink-0 items-center rounded-md bg-accent px-1.5 text-[9px] font-semibold uppercase tracking-wide text-accent-foreground">
              Fit
            </span>
          ) : null}
        </div>
        {showScore ? (
          <span
            className={`inline-flex h-7 min-w-[28px] shrink-0 items-center justify-center rounded-lg px-2 font-display text-[15px] leading-none ${
              highScore
                ? "bg-accent text-accent-foreground"
                : "border border-border bg-bg-tertiary text-ink-secondary"
            }`}
            aria-label={`Intent score ${score}`}
          >
            {score}
          </span>
        ) : null}
      </div>

      <p className="mb-1.5 truncate text-[16px] font-semibold text-ink-primary">{name}</p>

      {hasChips ? (
        <div className="mb-1.5 flex flex-wrap gap-1.5">
          {serviceChip ? (
            <span className="inline-flex max-w-full items-center truncate rounded-md border border-border bg-bg-tertiary px-2 py-0.5 text-[11px] text-ink-secondary">
              {serviceChip}
            </span>
          ) : null}
          {budgetChip ? (
            <span className="inline-flex items-center rounded-md border border-border bg-bg-tertiary px-2 py-0.5 font-mono text-[11px] text-ink-secondary">
              {budgetChip}
            </span>
          ) : null}
        </div>
      ) : null}

      {contextLine ? (
        <p className="mb-2 text-[13px] leading-snug text-ink-secondary">{contextLine}</p>
      ) : null}

      <p className="mb-3 font-mono text-[11px] text-ink-tertiary">
        <span className="inline-flex min-w-0 flex-wrap items-center gap-x-1">
          <span
            className={`h-2 w-2 shrink-0 rounded-full ${freshnessDotClass(freshness)}`}
            title={freshnessTitle}
            aria-label={freshnessTitle}
          />
          {isHotCallNow && !isHotSlaBreached(lead.created_at, now) ? (
            <>
              <span className="truncate">{timeAgo(lead.created_at)}</span>
              <span aria-hidden>·</span>
              <SlaCountdown createdAt={lead.created_at} />
            </>
          ) : (
            <span className="truncate">{formatCardTimestamp(lead, lane, now)}</span>
          )}
        </span>
      </p>

      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          aria-label={`WhatsApp ${name}`}
          onClick={(e) => {
            e.stopPropagation();
            const msg = buildOpenerMessage({
              leadFirstName: firstName,
              repName,
              companyName,
            });
            if (openWhatsApp(lead.phone, msg)) onLogCall(lead, "whatsapp");
          }}
          className="flex h-11 w-11 items-center justify-center rounded-full bg-[#25D366]/15 text-[#25D366]"
        >
          <MessageCircle size={20} />
        </button>
        <button
          type="button"
          aria-label={`Call ${name}`}
          onClick={(e) => {
            e.stopPropagation();
            if (dialPhone(lead.phone)) onLogCall(lead, "call");
          }}
          className="flex h-11 w-11 items-center justify-center rounded-full border border-border bg-bg-tertiary text-accent"
        >
          <Phone size={18} />
        </button>
        <button
          type="button"
          aria-label={`Log call for ${name}`}
          onClick={(e) => {
            e.stopPropagation();
            onLogCall(lead);
          }}
          className="flex h-11 w-11 items-center justify-center rounded-full border border-border bg-bg-tertiary text-ink-secondary"
        >
          <ClipboardList size={18} />
        </button>
      </div>
    </CrmCard>
  );
}
