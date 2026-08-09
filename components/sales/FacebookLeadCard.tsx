"use client";

import {
  ArrowUpRight,
  ClipboardList,
  Mail,
  Phone,
  Send,
} from "lucide-react";
import { BrandIcon } from "@/components/sales/ui/BrandIcon";
import type { LeadLane } from "@/lib/lead-lanes";
import { classifyLeadLane, matchesQualifiers } from "@/lib/lead-lanes";
import { openWhatsAppAndLog } from "@/lib/whatsapp-opener";
import {
  facebookLeadDisplayName,
  facebookLeadEmail,
  facebookLeadFormHighlights,
  facebookLeadPhone,
  facebookLeadPreviewLine,
} from "@/lib/leads/facebook-lead-display";
import {
  type SalesLeadCardLead,
  budgetDisplayText,
  formatCardTimestamp,
  resolveFreshnessState,
  serviceDisplayText,
  timeAgo,
} from "@/lib/sales-priority-lead";
import { WhatsAppAvatar } from "@/components/inbox/WhatsAppAvatar";
import { LeadIntentBadge } from "@/components/inbox/LeadIntentBadge";
import { scoreLabel } from "@/lib/inbox/scoring";
import {
  facebookQualReasonsFromFormData,
  facebookQualScoreFromFormData,
  facebookQualTierFromFormData,
} from "@/lib/facebook/qualification";
import { LeadCardFreshnessPill, LeadCardIconAction, LeadCardSlaCountdown } from "@/components/sales/lead-card-ui";

function FacebookMark({ size = 10 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden className="shrink-0">
      <path
        fill="currentColor"
        d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047V9.845c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.253h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073z"
      />
    </svg>
  );
}

export function FacebookLeadCard({
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
  const fbQualScore = facebookQualScoreFromFormData(lead.form_data);
  const fbQualTier = facebookQualTierFromFormData(lead.form_data);
  const fbReasons = facebookQualReasonsFromFormData(lead.form_data);
  const score = fbQualScore ?? intentScore ?? lead.aiScore ?? 0;
  const showIntentScore =
    fbQualScore != null || intentScore != null || lead.aiScore != null;
  const label =
    fbQualTier === "hot"
      ? "Hot"
      : fbQualTier === "warm"
        ? "Warm"
        : fbQualTier === "cold"
          ? "Cold"
          : scoreLabel(score);
  const displayName = facebookLeadDisplayName(lead);
  const phone = facebookLeadPhone(lead);
  const email = facebookLeadEmail(lead);
  const highlights = facebookLeadFormHighlights(lead);
  const preview = facebookLeadPreviewLine(lead);
  const freshness = resolveFreshnessState({ lead, lane, now, clientSlaHours });
  const fit = matchesQualifiers(lead, lead.qualifiers ?? null);
  const serviceChip = serviceDisplayText(lead);
  const budgetChip = budgetDisplayText(lead);
  const { tier } = classifyLeadLane(lead, now);
  const isHotCallNow = lane === "call_now" && tier === "hot";

  const timestamp = isHotCallNow ? (
    <span className="inline-flex flex-wrap items-center justify-end gap-x-1">
      <span>{timeAgo(lead.created_at)}</span>
      <span aria-hidden>·</span>
      <LeadCardSlaCountdown createdAt={lead.created_at} />
    </span>
  ) : (
    lane ? formatCardTimestamp(lead, lane, now) : timeAgo(lead.created_at)
  );

  return (
    <article
      className={`group fb-lead-card relative min-w-0 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface-card)] transition-[border-color,box-shadow] duration-150 hover:border-[var(--border-hover)] hover:shadow-[var(--shadow-sm)] ${
        compact ? "p-3" : "p-4 sm:p-[18px]"
      } ${className}`}
    >
      <div
        className="pointer-events-none absolute inset-y-3 left-0 w-[3px] rounded-r-full bg-[#1877F2] opacity-90"
        aria-hidden
      />

      <div className={`flex items-start gap-3 ${compact ? "pl-1.5" : "pl-2"}`}>
        <div className="relative shrink-0">
          <WhatsAppAvatar
            name={displayName}
            phone={phone}
            size={compact ? "sm" : "md"}
            className="ring-1 ring-[var(--border)]"
          />
          {showIntentScore ? (
            <LeadIntentBadge score={score} label={label} variant="dot" />
          ) : null}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <button
              type="button"
              onClick={() => onOpenLead(lead.id)}
              className="min-w-0 flex-1 text-left transition-opacity hover:opacity-85"
            >
              <h3
                className={`truncate font-semibold tracking-[-0.02em] text-[var(--text-primary)] ${
                  compact ? "text-[14px]" : "text-[15px] sm:text-[16px]"
                }`}
              >
                {displayName}
              </h3>
              <div className="mt-1 space-y-0.5">
                {phone ? (
                  <p className="truncate font-mono text-[11px] text-[var(--text-tertiary)] sm:text-[12px]">
                    {phone}
                  </p>
                ) : null}
                {email ? (
                  <p className="flex min-w-0 items-center gap-1 truncate text-[11px] text-[var(--text-tertiary)] sm:text-[12px]">
                    <Mail size={11} className="shrink-0 opacity-70" />
                    <span className="truncate">{email}</span>
                  </p>
                ) : null}
              </div>
            </button>

            <div className="flex shrink-0 flex-col items-end gap-1">
              <time
                className={`max-w-[9rem] text-right font-medium leading-snug text-[var(--text-tertiary)] ${
                  compact ? "text-[10px]" : "text-[11px]"
                }`}
              >
                {timestamp}
              </time>
              <LeadCardFreshnessPill state={freshness} compact={compact} />
            </div>
          </div>

          {highlights.length > 0 && !compact ? (
            <dl className={`mt-2.5 grid gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg-tertiary)]/60 px-3 py-2.5`}>
              {highlights.map((item) => (
                <div key={item.label} className="grid grid-cols-[minmax(0,38%)_1fr] gap-2 text-[12px]">
                  <dt className="truncate font-medium text-[var(--text-tertiary)]">{item.label}</dt>
                  <dd className="truncate font-medium text-[var(--text-secondary)]">{item.value}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <div
              className={`relative mt-2.5 border-l-2 border-[#1877F2]/35 pl-3 ${compact ? "mt-2" : ""}`}
            >
              <p
                className={`leading-snug text-[var(--text-secondary)] ${
                  compact ? "line-clamp-1 text-[12px]" : "line-clamp-2 text-[13px] sm:text-[14px]"
                }`}
              >
                {preview}
              </p>
            </div>
          )}

          {fbReasons.length > 0 && !compact ? (
            <p className="mt-2 line-clamp-2 text-[11px] leading-snug text-[var(--text-tertiary)]">
              {fbReasons.slice(0, 2).join(" · ")}
            </p>
          ) : null}

          <div className={`flex flex-wrap items-center gap-1.5 ${compact ? "mt-2" : "mt-2.5"}`}>
            {showIntentScore ? (
              <LeadIntentBadge score={score} label={label} variant="default" showScore />
            ) : null}
            {fbQualTier ? (
              <span className="inline-flex items-center rounded-full border border-[#1877F2]/35 bg-[#1877F2]/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#1877F2]">
                Form · {fbQualTier}
              </span>
            ) : null}
            {fit.matched ? (
              <span className="inline-flex items-center rounded-full bg-[var(--accent)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--accent-foreground)]">
                Fit
              </span>
            ) : null}
            {serviceChip ? (
              <span className="inline-flex max-w-full items-center truncate rounded-full border border-[var(--border)] bg-[var(--bg-tertiary)] px-2 py-0.5 text-[10px] font-medium text-[var(--text-secondary)]">
                {serviceChip}
              </span>
            ) : null}
            {budgetChip ? (
              <span className="inline-flex items-center rounded-full border border-[var(--border)] bg-[var(--bg-tertiary)] px-2 py-0.5 font-mono text-[10px] font-medium text-[var(--text-secondary)]">
                {budgetChip}
              </span>
            ) : null}
            <span className="inline-flex items-center gap-1 rounded-full border border-[var(--info-border)] bg-[var(--info-muted)] px-2 py-0.5 text-[10px] font-medium text-[var(--info)]">
              <FacebookMark size={10} />
              Instant Form
            </span>
          </div>
        </div>
      </div>

      <div
        className={`mt-3 flex min-w-0 items-center gap-2 border-t border-[var(--border)] pt-3 ${
          compact ? "mt-2.5 pt-2.5" : ""
        }`}
      >
        {phone ? (
          <a
            href={`tel:${phone}`}
            onClick={(e) => e.stopPropagation()}
            className={`inline-flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-lg bg-[#1877F2] font-semibold text-white transition-opacity hover:opacity-90 ${
              compact ? "h-8 px-3 text-[11px]" : "h-9 px-3.5 text-[12px] sm:text-[13px]"
            }`}
          >
            <Phone size={compact ? 13 : 14} strokeWidth={2.25} />
            <span className="truncate">Call now</span>
          </a>
        ) : (
          <button
            type="button"
            disabled
            className={`inline-flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-lg bg-[#1877F2]/40 font-semibold text-white/70 ${
              compact ? "h-8 px-3 text-[11px]" : "h-9 px-3.5 text-[12px]"
            }`}
          >
            <Phone size={compact ? 13 : 14} />
            <span>No phone</span>
          </button>
        )}

        <LeadCardIconAction
          disabled={!phone}
          label="WhatsApp contact"
          compact={compact}
          onClick={() => {
            if (!phone) return;
            openWhatsAppAndLog({
              leadId: lead.id,
              clientId: lead.client_id,
              leadName: lead.name,
              leadPhone: phone,
              repName,
              formData: lead.form_data ?? undefined,
              tier: "neutral",
            });
            onOpenLogSheet(lead.id, "whatsapp");
          }}
        >
          <BrandIcon brand="whatsapp" size={compact ? 14 : 15} />
        </LeadCardIconAction>

        <LeadCardIconAction label="View lead" compact={compact} onClick={() => onOpenLead(lead.id)}>
          <ArrowUpRight size={compact ? 13 : 14} />
        </LeadCardIconAction>

        <LeadCardIconAction label="Send asset" compact={compact} onClick={() => onOpenSend(lead.id)}>
          <Send size={compact ? 12 : 14} />
        </LeadCardIconAction>

        <LeadCardIconAction label="Log call" compact={compact} onClick={() => onOpenLogSheet(lead.id)}>
          <ClipboardList size={compact ? 13 : 14} />
        </LeadCardIconAction>
      </div>
    </article>
  );
}
