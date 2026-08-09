"use client";

import { useRouter } from "next/navigation";
import {
  ArrowUpRight,
  ClipboardList,
  Phone,
} from "lucide-react";
import { BrandIcon } from "@/components/sales/ui/BrandIcon";
import type { LeadLane } from "@/lib/lead-lanes";
import {
  whatsappInboxHref,
  whatsappLeadDisplayName,
  whatsappLeadSecondaryLine,
} from "@/lib/leads/whatsapp-lead-display";
import {
  type SalesLeadCardLead,
  formatCardTimestamp,
  resolveFreshnessState,
  timeAgo,
} from "@/lib/sales-priority-lead";
import { WhatsAppAvatar } from "@/components/inbox/WhatsAppAvatar";
import { LeadIntentBadge } from "@/components/inbox/LeadIntentBadge";
import { scoreLabel } from "@/lib/inbox/scoring";

import { LeadCardFreshnessPill, LeadCardIconAction } from "@/components/sales/lead-card-ui";

export function WhatsAppLeadCard({
  lead,
  lane,
  now = new Date(),
  intentScore,
  clientSlaHours,
  onOpenLogSheet,
  onOpenLead,
  compact = false,
  className = "",
}: {
  lead: SalesLeadCardLead;
  lane?: LeadLane;
  now?: Date;
  intentScore?: number | null;
  clientSlaHours?: number | null;
  onOpenLogSheet: (leadId: string, channel?: "call" | "whatsapp") => void;
  onOpenLead: (leadId: string) => void;
  compact?: boolean;
  className?: string;
}) {
  const router = useRouter();
  const score = intentScore ?? lead.aiScore ?? 0;
  const showIntentScore = intentScore != null || lead.aiScore != null;
  const label = scoreLabel(score);
  const displayName = whatsappLeadDisplayName(lead);
  const preview = whatsappLeadSecondaryLine(lead);
  const freshness = resolveFreshnessState({ lead, lane, now, clientSlaHours });
  const timestamp = lane ? formatCardTimestamp(lead, lane, now) : timeAgo(lead.created_at);
  const phone = lead.phone?.trim() ?? "";
  const hasSavedName = Boolean(lead.name?.trim());

  return (
    <article
      className={`group wa-lead-card relative min-w-0 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface-card)] transition-[border-color,box-shadow,transform] duration-150 hover:border-[var(--border-hover)] hover:shadow-[var(--shadow-sm)] ${
        compact ? "p-3" : "p-4 sm:p-[18px]"
      } ${className}`}
    >
      <div
        className="pointer-events-none absolute inset-y-3 left-0 w-[3px] rounded-r-full bg-[var(--channel-whatsapp)] opacity-80"
        aria-hidden
      />

      <div className={`flex items-start gap-3 ${compact ? "pl-1.5" : "pl-2"}`}>
        <div className="relative shrink-0">
          <WhatsAppAvatar
            name={displayName}
            phone={lead.phone}
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
              {hasSavedName && phone ? (
                <p className="mt-0.5 truncate font-mono text-[11px] text-[var(--text-tertiary)] sm:text-[12px]">
                  {phone}
                </p>
              ) : null}
            </button>
            <div className="flex shrink-0 flex-col items-end gap-1">
              <time
                className={`whitespace-nowrap font-medium text-[var(--text-tertiary)] ${
                  compact ? "text-[10px]" : "text-[11px]"
                }`}
              >
                {timestamp}
              </time>
              <LeadCardFreshnessPill state={freshness} compact={compact} />
            </div>
          </div>

          <div
            className={`wa-lead-card-preview relative mt-2.5 border-l-2 border-[var(--channel-whatsapp)]/35 pl-3 ${
              compact ? "mt-2" : ""
            }`}
          >
            <p
              className={`leading-snug text-[var(--text-secondary)] ${
                compact ? "line-clamp-1 text-[12px]" : "line-clamp-2 text-[13px] sm:text-[14px]"
              }`}
            >
              {preview}
            </p>
          </div>

          {showIntentScore ? (
            <div className={`flex flex-wrap items-center gap-1.5 ${compact ? "mt-2" : "mt-2.5"}`}>
              <LeadIntentBadge score={score} label={label} variant="default" showScore />
              <span className="inline-flex items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--bg-tertiary)] px-2 py-0.5 text-[10px] font-medium text-[var(--text-tertiary)]">
                <BrandIcon brand="whatsapp" size={10} />
                WhatsApp
              </span>
            </div>
          ) : (
            <div className={`${compact ? "mt-2" : "mt-2.5"}`}>
              <span className="inline-flex items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--bg-tertiary)] px-2 py-0.5 text-[10px] font-medium text-[var(--text-tertiary)]">
                <BrandIcon brand="whatsapp" size={10} />
                WhatsApp
              </span>
            </div>
          )}
        </div>
      </div>

      <div
        className={`mt-3 flex min-w-0 items-center gap-2 border-t border-[var(--border)] pt-3 ${
          compact ? "mt-2.5 pt-2.5" : ""
        }`}
      >
        <button
          type="button"
          onClick={() => router.push(whatsappInboxHref(lead.id))}
          className={`inline-flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-lg bg-[var(--channel-whatsapp)] font-semibold text-black transition-opacity hover:opacity-90 ${
            compact ? "h-8 px-3 text-[11px]" : "h-9 px-3.5 text-[12px] sm:text-[13px]"
          }`}
        >
          <BrandIcon brand="whatsapp" size={compact ? 13 : 14} />
          <span className="truncate">Open conversation</span>
          <ArrowUpRight size={compact ? 12 : 13} className="shrink-0 opacity-70" />
        </button>

        <LeadCardIconAction
          href={phone ? `tel:${phone}` : undefined}
          disabled={!phone}
          label="Call contact"
          compact={compact}
        >
          <Phone size={compact ? 14 : 15} className="text-[var(--channel-whatsapp)]" />
        </LeadCardIconAction>

        <LeadCardIconAction label="Log call" compact={compact} onClick={() => onOpenLogSheet(lead.id)}>
          <ClipboardList size={compact ? 13 : 14} />
        </LeadCardIconAction>
      </div>
    </article>
  );
}
