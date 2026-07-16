"use client";

import { useRouter } from "next/navigation";
import {
  ClipboardList,
  MessageCircle,
  Phone,
} from "lucide-react";
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
  freshnessDotClass,
  timeAgo,
} from "@/lib/sales-priority-lead";
import { WhatsAppAvatar } from "@/components/inbox/WhatsAppAvatar";
import { LeadIntentBadge } from "@/components/inbox/LeadIntentBadge";
import { scoreLabel } from "@/lib/inbox/scoring";

function ActionButton({
  children,
  onClick,
  href,
  disabled,
  label,
  primary = false,
  compact = false,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  href?: string;
  disabled?: boolean;
  label: string;
  primary?: boolean;
  compact?: boolean;
}) {
  const className = primary
    ? `flex min-w-0 shrink items-center justify-center gap-1.5 rounded-md bg-[var(--channel-whatsapp)] px-3 text-black transition-opacity hover:opacity-90 disabled:opacity-40 max-[359px]:w-9 max-[359px]:px-0 ${
        compact ? "h-8 text-[11px]" : "h-9 text-xs font-medium"
      }`
    : `flex shrink-0 items-center justify-center rounded-md border border-[var(--border)] bg-[var(--bg-tertiary)] transition-colors hover:border-[var(--border-hover)] ${
        compact ? "h-8 w-8" : "h-9 w-9"
      }`;

  if (disabled) {
    return (
      <div className={`${className} opacity-30`} aria-hidden>
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
  const freshnessTitle =
    freshness === "fresh" ? "Fresh" : freshness === "slipping" ? "Needs attention" : "Overdue";

  return (
    <article
      className={`min-w-0 overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface-card)] ${
        compact ? "p-2.5 layout:p-3" : "p-4 sm:p-5"
      } ${className}`}
    >
      <div className="mb-3 h-px w-full bg-gradient-to-r from-[var(--channel-whatsapp)] to-transparent" />

      <div className={`flex items-start gap-3 ${compact ? "mb-2" : "mb-3"}`}>
        <WhatsAppAvatar name={displayName} phone={lead.phone} size={compact ? "sm" : "md"} />
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1 rounded-md bg-[var(--channel-whatsapp-muted)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--channel-whatsapp)]">
              <MessageCircle size={11} />
              WhatsApp chat
            </span>
            {showIntentScore ? (
              <LeadIntentBadge score={score} label={label} variant="default" showScore />
            ) : null}
          </div>
          <button
            type="button"
            onClick={() => onOpenLead(lead.id)}
            className="block w-full min-w-0 text-left"
          >
            <p className={`truncate font-medium text-[var(--text-primary)] ${compact ? "text-[14px]" : "text-[16px]"}`}>
              {displayName}
            </p>
          </button>
          {lead.name?.trim() && lead.phone ? (
            <p className="mt-0.5 truncate font-mono text-[11px] text-[var(--text-tertiary)]">
              {lead.phone}
            </p>
          ) : null}
        </div>
      </div>

      <div
        className={`rounded-lg border border-[var(--border)] bg-[var(--bg-tertiary)] px-3 py-2.5 ${
          compact ? "mb-2" : "mb-3"
        }`}
      >
        <p className={`leading-snug text-[var(--text-secondary)] ${compact ? "text-[12px]" : "text-[13px]"}`}>
          {preview}
        </p>
      </div>

      <p className={`font-mono text-[var(--text-tertiary)] ${compact ? "mb-2 text-[10px]" : "mb-3 text-[11px]"}`}>
        <span className="inline-flex min-w-0 flex-wrap items-center gap-x-1">
          <span
            className={`h-2 w-2 shrink-0 rounded-full ${freshnessDotClass(freshness)}`}
            title={freshnessTitle}
            aria-label={freshnessTitle}
          />
          <span className="truncate">
            {lane ? formatCardTimestamp(lead, lane, now) : timeAgo(lead.created_at)}
          </span>
        </span>
      </p>

      <div className={`flex min-w-0 flex-wrap items-center justify-end ${compact ? "gap-1" : "gap-1.5 sm:gap-2"}`}>
        <ActionButton
          label="Open chat"
          primary
          compact={compact}
          onClick={() => router.push(whatsappInboxHref(lead.id))}
        >
          <MessageCircle size={compact ? 13 : 14} />
          <span className="max-[359px]:hidden">Open chat</span>
        </ActionButton>

        <ActionButton
          href={lead.phone ? `tel:${lead.phone}` : undefined}
          disabled={!lead.phone}
          label="Call"
          compact={compact}
        >
          <Phone size={compact ? 13 : 15} className="text-[var(--channel-whatsapp)]" />
        </ActionButton>

        <ActionButton
          label="Log call"
          compact={compact}
          onClick={() => onOpenLogSheet(lead.id)}
        >
          <ClipboardList size={compact ? 12 : 14} className="text-[var(--text-secondary)]" />
        </ActionButton>
      </div>
    </article>
  );
}
