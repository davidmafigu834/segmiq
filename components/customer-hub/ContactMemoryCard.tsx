"use client";

import Link from "next/link";
import {
  ArrowUpRight,
  Briefcase,
  Footprints,
  Globe,
  Mail,
  MessageCircle,
  Phone,
  Upload,
  UserRoundPlus,
} from "lucide-react";
import { WhatsAppAvatar } from "@/components/inbox/WhatsAppAvatar";
import { LeadCardIconAction } from "@/components/sales/lead-card-ui";
import { contactSourceMeta, type ContactSourceKind } from "@/lib/customer-hub/contact-source-meta";
import {
  CONTACT_LIFECYCLE_DESCRIPTIONS,
  CONTACT_LIFECYCLE_LABELS,
  lifecycleBadgeClass,
  normalizeLegacyLifecycle,
  type ContactLifecycle,
} from "@/lib/customer-hub/lifecycle";
import { formatTimeAgo } from "@/lib/format";
import { buildWhatsAppUrl, normalizePhoneForWhatsApp } from "@/lib/whatsapp-opener";
import type {
  AttentionStatus,
  ContactListActiveLead,
  ContactListItem,
} from "@/lib/customer-hub/contact-list-types";
import {
  recentStatusClass,
  recentStatusLabel,
} from "@/lib/customer-hub/source-labels";

export type { ContactListActiveLead, ContactListItem };

function SourceBadgeIcon({ kind }: { kind: ContactSourceKind }) {
  const size = 10;
  if (kind === "walk_in") return <Footprints size={size} />;
  if (kind === "referral") return <UserRoundPlus size={size} />;
  if (kind === "facebook") return <Globe size={size} />;
  if (kind === "whatsapp_inbound" || kind === "whatsapp_saved") {
    return <MessageCircle size={size} />;
  }
  if (kind === "import") return <Upload size={size} />;
  return <Globe size={size} />;
}

function humanStatus(status: string): string {
  const words = status.replace(/_/g, " ").toLowerCase().split(" ");
  return words.map((w, i) => (i === 0 ? w.charAt(0).toUpperCase() + w.slice(1) : w)).join(" ");
}

function contextLine(contact: ContactListItem, stage: ContactLifecycle): string {
  const active = contact.activeLead;
  if (active) {
    const parts = [humanStatus(active.status)];
    if (active.project_type) parts.push(active.project_type);
    if (active.assigneeName) parts.push(`with ${active.assigneeName}`);
    return parts.join(" · ");
  }
  return CONTACT_LIFECYCLE_DESCRIPTIONS[stage];
}

function attentionStripeColor(status: AttentionStatus | null | undefined): string | null {
  if (status === "follow_up_due") return "var(--warning)";
  if (status === "no_contact") return "var(--error)";
  return null;
}

export function ContactMemoryCard({
  contact,
  compact = false,
  clientDialCode,
  attentionStatus,
}: {
  contact: ContactListItem;
  compact?: boolean;
  clientDialCode?: string;
  attentionStatus?: AttentionStatus | null;
}) {
  const stage = normalizeLegacyLifecycle(contact.lifecycle);
  const meta = contactSourceMeta(contact.source);
  const displayName = contact.name?.trim() || "Unnamed";
  const waDigits = contact.phone
    ? normalizePhoneForWhatsApp(contact.phone, clientDialCode)
    : null;
  const whatsappUrl = waDigits ? buildWhatsAppUrl(waDigits, "") : null;
  const activeLead = contact.activeLead;
  const lastTouch = contact.lastTouchedAt;
  const stripeColor = attentionStripeColor(attentionStatus) ?? meta.accent;
  const showAttention =
    attentionStatus === "follow_up_due" || attentionStatus === "no_contact";

  return (
    <article
      className={`group relative min-w-0 overflow-hidden rounded-xl border bg-[var(--surface-card)] transition-[border-color,box-shadow] duration-150 hover:border-[var(--border-hover)] hover:shadow-[var(--shadow-sm)] ${
        showAttention
          ? attentionStatus === "follow_up_due"
            ? "border-[var(--warning-border)]"
            : "border-[rgba(255,68,68,0.35)]"
          : "border-[var(--border)]"
      } ${compact ? "p-3" : "p-4 sm:p-[18px]"}`}
    >
      <div
        className="pointer-events-none absolute inset-y-3 left-0 w-[3px] rounded-r-full opacity-90"
        style={{ background: stripeColor }}
        aria-hidden
      />

      <div className={`flex items-start gap-3 ${compact ? "pl-1.5" : "pl-2"}`}>
        <WhatsAppAvatar
          name={displayName}
          phone={contact.phone}
          size={compact ? "sm" : "md"}
          className="shrink-0 ring-1 ring-[var(--border)]"
        />

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <Link
              href={`/client/contacts/${contact.id}`}
              className="min-w-0 flex-1 transition-opacity hover:opacity-85"
            >
              <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                <h3
                  className={`truncate font-semibold tracking-[-0.02em] text-[var(--text-primary)] ${
                    compact ? "text-[14px]" : "text-[15px] sm:text-[16px]"
                  }`}
                >
                  {displayName}
                </h3>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${lifecycleBadgeClass(stage)}`}
                >
                  {CONTACT_LIFECYCLE_LABELS[stage]}
                </span>
                {attentionStatus ? (
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${recentStatusClass(attentionStatus)}`}
                  >
                    {recentStatusLabel(attentionStatus)}
                  </span>
                ) : null}
              </div>
              <div className="mt-1 space-y-0.5">
                {contact.phone ? (
                  <p className="truncate font-mono text-[11px] text-[var(--text-tertiary)] sm:text-[12px]">
                    {contact.phone}
                  </p>
                ) : null}
                {contact.email ? (
                  <p className="flex min-w-0 items-center gap-1 truncate text-[11px] text-[var(--text-tertiary)] sm:text-[12px]">
                    <Mail size={11} className="shrink-0 opacity-70" />
                    <span className="truncate">{contact.email}</span>
                  </p>
                ) : null}
              </div>
            </Link>

            {lastTouch ? (
              <time
                className={`max-w-[7rem] shrink-0 text-right font-medium leading-snug text-[var(--text-tertiary)] ${
                  compact ? "text-[10px]" : "text-[11px]"
                }`}
              >
                {formatTimeAgo(lastTouch)}
              </time>
            ) : null}
          </div>

          <div
            className="relative mt-2.5 border-l-2 pl-3"
            style={{ borderColor: `${meta.accent}59` }}
          >
            <p
              className={`leading-snug text-[var(--text-secondary)] ${
                compact ? "line-clamp-1 text-[12px]" : "line-clamp-2 text-[13px] sm:text-[14px]"
              }`}
            >
              {contextLine(contact, stage)}
            </p>
          </div>

          <div className={`flex flex-wrap items-center gap-1.5 ${compact ? "mt-2" : "mt-2.5"}`}>
            <span
              className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium ${meta.badgeBgClass} ${meta.badgeBorderClass} ${meta.badgeTextClass}`}
            >
              <SourceBadgeIcon kind={meta.kind} />
              {meta.badgeLabel}
            </span>
            {contact.owner ? (
              <span className="inline-flex max-w-full items-center truncate rounded-full border border-[var(--border)] bg-[var(--bg-tertiary)] px-2 py-0.5 text-[10px] font-medium text-[var(--text-secondary)]">
                {activeLead ? `${contact.owner} · active deal` : contact.owner}
              </span>
            ) : (
              <span className="inline-flex items-center rounded-full border border-[var(--border)] bg-[var(--bg-tertiary)] px-2 py-0.5 text-[10px] font-medium text-[var(--text-tertiary)]">
                Unassigned
              </span>
            )}
            {activeLead?.project_type && !compact ? (
              <span className="inline-flex max-w-full items-center truncate rounded-full border border-[var(--border)] bg-[var(--bg-tertiary)] px-2 py-0.5 text-[10px] font-medium text-[var(--text-secondary)]">
                {activeLead.project_type}
              </span>
            ) : null}
          </div>
        </div>
      </div>

      <div
        className={`mt-3 flex min-w-0 items-center gap-2 border-t border-[var(--border)] pt-3 ${
          compact ? "mt-2.5 pt-2.5" : ""
        }`}
      >
        <Link
          href={`/client/contacts/${contact.id}`}
          className={`inline-flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-lg bg-[var(--text-primary)] font-semibold text-[var(--bg-primary)] transition-opacity hover:opacity-90 ${
            compact ? "h-8 px-3 text-[11px]" : "h-9 px-3.5 text-[12px] sm:text-[13px]"
          }`}
        >
          <ArrowUpRight size={compact ? 13 : 14} strokeWidth={2.25} />
          <span className="truncate">View contact</span>
        </Link>

        {whatsappUrl ? (
          <LeadCardIconAction href={whatsappUrl} label="WhatsApp contact" compact={compact}>
            <MessageCircle size={compact ? 14 : 15} className="text-[var(--channel-whatsapp)]" />
          </LeadCardIconAction>
        ) : null}

        {activeLead ? (
          <LeadCardIconAction
            href={`/client/leads/pipeline?lead=${activeLead.id}`}
            label="Open active deal"
            compact={compact}
          >
            <Briefcase size={compact ? 13 : 14} />
          </LeadCardIconAction>
        ) : null}

        {contact.phone ? (
          <LeadCardIconAction href={`tel:${contact.phone}`} label="Call contact" compact={compact}>
            <Phone size={compact ? 14 : 15} />
          </LeadCardIconAction>
        ) : null}
      </div>
    </article>
  );
}

export function ContactMemoryCardSkeleton({ compact = false }: { compact?: boolean }) {
  return (
    <div
      className={`shimmer rounded-xl border border-[var(--border)] bg-[var(--surface-card)] ${
        compact ? "h-[168px]" : "h-[220px]"
      }`}
    />
  );
}
