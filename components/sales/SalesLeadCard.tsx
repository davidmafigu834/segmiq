"use client";

import { useEffect, useState } from "react";
import {
  Phone,
  Send,
  ClipboardList,
  MessageCircle,
} from "lucide-react";
import { openWhatsAppAndLog } from "@/lib/whatsapp-opener";
import {
  classifyLeadLane,
  matchesQualifiers,
  HIGH_SCORE_THRESHOLD,
  type LeadLane,
} from "@/lib/lead-lanes";
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
}: {
  children: React.ReactNode;
  onClick?: () => void;
  href?: string;
  disabled?: boolean;
  label: string;
}) {
  const className =
    "flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--bg-tertiary)] transition-colors hover:border-[var(--border-hover)]";

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
  const contextLine = buildReasonContextLine(lead, lane, now);
  const showContextLine = contextLine.length > 0;

  const isHotCallNow = lane === "call_now" && tier === "hot";

  const freshnessTitle =
    freshness === "fresh"
      ? "Fresh"
      : freshness === "slipping"
        ? "Needs attention"
        : "Overdue";

  return (
    <article
      className={`rounded-xl border border-[var(--border)] bg-[var(--surface-card)] p-4 sm:p-5 ${className}`}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate font-mono text-[10px] uppercase tracking-wide text-[var(--text-tertiary)]">
            {sourceLabel(lead.source)}
          </span>
          {fit.matched ? (
            <span className="inline-flex h-5 shrink-0 items-center rounded-md bg-[var(--accent)] px-1.5 text-[9px] font-semibold uppercase tracking-wide text-[var(--accent-foreground)]">
              Fit
            </span>
          ) : null}
        </div>
        {showIntentScore ? (
          <span
            className={`inline-flex h-7 min-w-[28px] shrink-0 items-center justify-center rounded-lg px-2 text-[15px] leading-none ${
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
        className="mb-2 block w-full text-left"
      >
        <p className="truncate text-[15px] font-medium text-[var(--text-primary)]">
          {lead.name ?? "Unknown"}
        </p>
      </button>

      {hasChips ? (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {serviceChip ? (
            <span className="inline-flex max-w-full items-center rounded-md border border-[var(--border)] bg-[var(--bg-tertiary)] px-2 py-0.5 text-[11px] text-[var(--text-secondary)] truncate">
              {serviceChip}
            </span>
          ) : null}
          {budgetChip ? (
            <span className="inline-flex items-center rounded-md border border-[var(--border)] bg-[var(--bg-tertiary)] px-2 py-0.5 font-mono text-[11px] text-[var(--text-secondary)]">
              {budgetChip}
            </span>
          ) : null}
        </div>
      ) : null}

      {showContextLine ? (
        <p className="mb-2 text-[13px] leading-snug text-[var(--text-secondary)]">
          {contextLine}
        </p>
      ) : null}

      <p className="mb-3 font-mono text-[11px] text-[var(--text-tertiary)]">
        <span className="inline-flex flex-wrap items-center gap-x-1.5">
          <span
            className={`h-2 w-2 shrink-0 rounded-full ${freshnessDotClass(freshness)}`}
            title={freshnessTitle}
            aria-label={freshnessTitle}
          />
          {isHotCallNow ? (
            <>
              <span>{timeAgo(lead.created_at)}</span>
              <span aria-hidden>·</span>
              <SlaCountdown createdAt={lead.created_at} />
            </>
          ) : (
            <span>{formatCardTimestamp(lead, lane, now)}</span>
          )}
        </span>
      </p>

      <div className="flex items-center justify-end gap-1.5 sm:gap-2">
        <ActionButton
          href={lead.phone ? `tel:${lead.phone}` : undefined}
          disabled={!lead.phone}
          label="Call"
        >
          <Phone size={15} className="text-[var(--success)]" />
        </ActionButton>

        <ActionButton
          disabled={!lead.phone}
          label="WhatsApp"
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
          <MessageCircle size={15} className="text-[var(--success)]" />
        </ActionButton>

        <ActionButton
          label="Send asset"
          onClick={() => onOpenSend(lead.id)}
        >
          <Send size={14} className="text-[var(--text-secondary)]" />
        </ActionButton>

        <ActionButton
          label="Log call"
          onClick={() => onOpenLogSheet(lead.id)}
        >
          <ClipboardList size={14} className="text-[var(--text-secondary)]" />
        </ActionButton>
      </div>
    </article>
  );
}
