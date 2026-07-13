"use client";

import { useEffect, useState } from "react";
import {
  Phone,
  Send,
  ClipboardList,
  MessageCircle,
} from "lucide-react";
import { openWhatsAppAndLog } from "@/lib/whatsapp-opener";
import { HIGH_SCORE_THRESHOLD, classifyLeadLane, matchesQualifiers, type LeadLane } from "@/lib/lead-lanes";
import { isWhatsAppInboundLead, leadCardDisplayName } from "@/lib/leads/whatsapp-lead-display";
import { WhatsAppLeadCard } from "@/components/sales/WhatsAppLeadCard";
import {
  type SalesLeadCardLead,
  budgetDisplayText,
  serviceDisplayText,
  buildReasonContextLine,
  formatCardTimestamp,
  resolveFreshnessState,
  freshnessDotClass,
  timeAgo,
  sourceLabel,
} from "@/lib/sales-priority-lead";

const SLA_TARGET_MS = 5 * 60 * 1000;

function SlaCountdown({ createdAt }: { createdAt: string }) {
  const [remainingMs, setRemainingMs] = useState(
    () => SLA_TARGET_MS - (Date.now() - new Date(createdAt).getTime())
  );

  useEffect(() => {
    const tick = () =>
      setRemainingMs(SLA_TARGET_MS - (Date.now() - new Date(createdAt).getTime()));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [createdAt]);

  const breached = remainingMs <= 0;

  if (breached) {
    const lateMins = Math.max(1, Math.ceil(Math.abs(remainingMs) / 60_000));
    return (
      <span className="text-[var(--warning)]">
        SLA {lateMins}m late
      </span>
    );
  }

  const totalSeconds = Math.floor(remainingMs / 1000);
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;

  return (
    <span className="text-[var(--accent)]">
      SLA {mins}:{secs.toString().padStart(2, "0")} left
    </span>
  );
}

function ActionButton({
  children,
  onClick,
  href,
  disabled,
  label,
  compact = false,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  href?: string;
  disabled?: boolean;
  label: string;
  compact?: boolean;
}) {
  const className = compact
    ? "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--bg-tertiary)] transition-colors hover:border-[var(--border-hover)]"
    : "flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--bg-tertiary)] transition-colors hover:border-[var(--border-hover)]";

  if (disabled) {
    return (
      <div
        className={`${className} opacity-30`}
        aria-hidden
      >
        {children}
      </div>
    );
  }

  if (href) {
    return (
      <a href={href} className={className} aria-label={label} onClick={(e) => e.stopPropagation()}>
        {children}
      </a>
    );
  }

  return (
    <button
      type="button"
      className={className}
      aria-label={label}
      onClick={(e) => {
        e.stopPropagation();
        onClick?.();
      }}
    >
      {children}
    </button>
  );
}

export function SalesLeadCard({
  lead,
  lane,
  now = new Date(),
  repName,
  intentScore,
  clientSlaHours,
  onOpenLogSheet,
  onOpenLead,
  onOpenSend,
  compact = false,
  className = "",
}: {
  lead: SalesLeadCardLead;
  lane?: LeadLane;
  now?: Date;
  repName: string;
  intentScore?: number | null;
  clientSlaHours?: number | null;
  onOpenLogSheet: (leadId: string, channel?: "call" | "whatsapp") => void;
  onOpenLead: (leadId: string) => void;
  onOpenSend: (leadId: string) => void;
  compact?: boolean;
  className?: string;
}) {
  const score =
    intentScore !== undefined ? intentScore : lead.aiScore ?? null;
  const showIntentScore = typeof score === "number";
  const highScore = (score ?? 0) >= HIGH_SCORE_THRESHOLD;

  const { tier } = classifyLeadLane(lead, now);
  const freshness = resolveFreshnessState({ lead, lane, now, clientSlaHours });
  const fit = matchesQualifiers(lead, lead.qualifiers ?? null);

  const serviceChip = serviceDisplayText(lead);
  const budgetChip = budgetDisplayText(lead);
  const hasChips = !!(serviceChip || budgetChip);
  const contextLine = buildReasonContextLine(lead, lane);
  const showContextLine = contextLine.length > 0;

  const isHotCallNow = lane === "call_now" && tier === "hot";

  const freshnessTitle =
    freshness === "fresh"
      ? "Fresh"
      : freshness === "slipping"
        ? "Needs attention"
        : "Overdue";

  const iconSize = compact ? 13 : 15;
  const sendIconSize = compact ? 12 : 14;

  if (isWhatsAppInboundLead(lead.source)) {
    return (
      <WhatsAppLeadCard
        lead={lead}
        lane={lane}
        now={now}
        intentScore={intentScore}
        clientSlaHours={clientSlaHours}
        onOpenLogSheet={onOpenLogSheet}
        onOpenLead={onOpenLead}
        compact={compact}
        className={className}
      />
    );
  }

  return (
    <article
      className={`min-w-0 rounded-xl border border-[var(--border)] bg-[var(--surface-card)] ${
        compact ? "p-2.5 layout:p-3" : "p-4 sm:p-5"
      } ${className}`}
    >
      <div className={`flex items-center justify-between gap-1.5 ${compact ? "mb-1.5" : "mb-2 gap-2"}`}>
        <div className="flex min-w-0 items-center gap-1.5">
          <span className="truncate font-mono text-[9px] uppercase tracking-wide text-[var(--text-tertiary)] layout:text-[10px]">
            {sourceLabel(lead.source)}
          </span>
          {fit.matched ? (
            <span className="inline-flex h-4 shrink-0 items-center rounded-md bg-[var(--accent)] px-1 text-[8px] font-semibold uppercase tracking-wide text-[var(--accent-foreground)] layout:h-5 layout:px-1.5 layout:text-[9px]">
              Fit
            </span>
          ) : null}
        </div>
        {showIntentScore ? (
          <span
            className={`inline-flex shrink-0 items-center justify-center rounded-lg leading-none ${
              compact ? "h-6 min-w-[24px] px-1.5 text-[13px]" : "h-7 min-w-[28px] px-2 text-[15px]"
            } ${
              highScore
                ? "bg-[var(--accent)] text-[var(--accent-foreground)]"
                : "border border-[var(--border)] bg-[var(--bg-tertiary)] text-[var(--text-secondary)]"
            }`}
            style={{ fontFamily: "var(--font-instrument-serif)" }}
            aria-label={`Intent score ${score}`}
          >
            {score}
          </span>
        ) : null}
      </div>

      <button
        type="button"
        onClick={() => onOpenLead(lead.id)}
        className={`block w-full min-w-0 text-left ${compact ? "mb-1.5" : "mb-2"}`}
      >
        <p className={`truncate font-medium text-[var(--text-primary)] ${compact ? "text-[13px] layout:text-[14px]" : "text-[15px]"}`}>
          {leadCardDisplayName(lead)}
        </p>
      </button>

      {hasChips ? (
        <div className={`flex flex-wrap gap-1 ${compact ? "mb-1.5" : "mb-2 gap-1.5"}`}>
          {serviceChip ? (
            <span className="inline-flex max-w-full items-center truncate rounded-md border border-[var(--border)] bg-[var(--bg-tertiary)] px-1.5 py-0.5 text-[10px] text-[var(--text-secondary)] layout:px-2 layout:text-[11px]">
              {serviceChip}
            </span>
          ) : null}
          {budgetChip ? (
            <span className="inline-flex items-center rounded-md border border-[var(--border)] bg-[var(--bg-tertiary)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--text-secondary)] layout:px-2 layout:text-[11px]">
              {budgetChip}
            </span>
          ) : null}
        </div>
      ) : null}

      {showContextLine && !compact ? (
        <p className="mb-2 text-[13px] leading-snug text-[var(--text-secondary)]">
          {contextLine}
        </p>
      ) : null}

      <p className={`font-mono text-[var(--text-tertiary)] ${compact ? "mb-2 text-[10px]" : "mb-3 text-[11px]"}`}>
        <span className="inline-flex min-w-0 flex-wrap items-center gap-x-1">
          <span
            className={`h-2 w-2 shrink-0 rounded-full ${freshnessDotClass(freshness)}`}
            title={freshnessTitle}
            aria-label={freshnessTitle}
          />
          {isHotCallNow ? (
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

      <div className={`flex items-center justify-end ${compact ? "gap-1" : "gap-1.5 sm:gap-2"}`}>
        <ActionButton
          href={lead.phone ? `tel:${lead.phone}` : undefined}
          disabled={!lead.phone}
          label="Call"
          compact={compact}
        >
          <Phone size={iconSize} className="text-[var(--success)]" />
        </ActionButton>

        <ActionButton
          disabled={!lead.phone}
          label="WhatsApp"
          compact={compact}
          onClick={() => {
            openWhatsAppAndLog({
              leadId: lead.id,
              clientId: lead.client_id,
              leadName: lead.name,
              leadPhone: lead.phone,
              repName,
              formData: lead.form_data ?? undefined,
              tier: "neutral",
            });
            onOpenLogSheet(lead.id, "whatsapp");
          }}
        >
          <MessageCircle size={iconSize} className="text-[var(--success)]" />
        </ActionButton>

        <ActionButton
          label="Send asset"
          compact={compact}
          onClick={() => onOpenSend(lead.id)}
        >
          <Send size={sendIconSize} className="text-[var(--text-secondary)]" />
        </ActionButton>

        <ActionButton
          label="Log call"
          compact={compact}
          onClick={() => onOpenLogSheet(lead.id)}
        >
          <ClipboardList size={sendIconSize} className="text-[var(--text-secondary)]" />
        </ActionButton>
      </div>
    </article>
  );
}
