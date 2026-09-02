"use client";

import Link from "next/link";
import { ArrowUpRight, Footprints, Phone, UserRoundPlus, Users } from "lucide-react";
import { SiFacebook, SiWhatsapp } from "react-icons/si";
import type { SalesEnquiryPriorityItem } from "./types";
import { CardShell } from "./KpiCard";
import { cn } from "@/lib/ui/cn";

function SourceIcon({ source }: { source: string | null }) {
  const s = (source ?? "").toUpperCase();
  if (s.includes("WHATSAPP") || s === "WA") {
    return <SiWhatsapp size={14} className="shrink-0 text-[#25D366]" aria-hidden />;
  }
  if (s.includes("FACEBOOK") || s.includes("META") || s === "FB") {
    return <SiFacebook size={14} className="shrink-0 text-[#1877F2]" aria-hidden />;
  }
  if (s.includes("WALK") || s.includes("WALK_IN") || s.includes("WALKIN")) {
    return <Footprints size={14} strokeWidth={2} className="shrink-0 text-sales-text-primary" aria-hidden />;
  }
  if (s.includes("REFER")) {
    return <UserRoundPlus size={14} strokeWidth={2} className="shrink-0 text-sales-text-primary" aria-hidden />;
  }
  return <Users size={14} strokeWidth={2} className="shrink-0 text-sales-text-secondary" aria-hidden />;
}

function sourceLabel(source: string | null): string {
  const s = (source ?? "").toUpperCase();
  if (s.includes("WHATSAPP")) return "WhatsApp";
  if (s.includes("FACEBOOK") || s.includes("META")) return "Facebook";
  if (s.includes("WALK")) return "Walk-in";
  if (s.includes("REFER")) return "Referral";
  if (s.includes("WEB") || s.includes("LANDING") || s.includes("SITE")) return "Website";
  if (s.includes("PHONE") || s.includes("CALL")) return "Phone";
  if (s.includes("OUTBOUND") || s === "MANUAL") return "Outbound";
  if (!source) return "Other";
  return source.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

const STATUS_LIKE = /^(waiting for reply|contacted|new|qualified|needs attention)$/i;

function enquirySubtitle(item: SalesEnquiryPriorityItem): string | null {
  const project = item.projectType?.trim();
  if (project && !STATUS_LIKE.test(project)) return project;
  const reason = item.reason?.trim();
  if (!reason || STATUS_LIKE.test(reason)) return null;
  if (reason.length > 72) return null;
  // Don't repeat the Received column (waiting / overdue copy).
  if (/is waiting for your response/i.test(reason)) return null;
  if (/overdue by/i.test(reason) && /overdue/i.test(item.receivedLabel ?? "")) return null;
  if (/planned follow-up is overdue/i.test(reason) && /overdue/i.test(item.receivedLabel ?? "")) {
    return null;
  }
  return reason;
}

function IntentBadge({ intent }: { intent: SalesEnquiryPriorityItem["intent"] }) {
  if (!intent) return <span className="text-[12px] text-sales-text-muted">—</span>;
  const tone =
    intent === "Hot"
      ? "bg-sales-danger-soft text-sales-danger-fg"
      : intent === "Warm"
        ? "bg-sales-warning-soft text-sales-warning-fg"
        : "bg-sales-neutral-100 text-sales-text-secondary";
  return (
    <span className={cn("inline-flex rounded-sales-sm px-1.5 py-0.5 text-[11px] font-semibold", tone)}>
      {intent}
    </span>
  );
}

function EnquiryActions({
  item,
  variant = "default",
}: {
  item: SalesEnquiryPriorityItem;
  variant?: "compact" | "default";
}) {
  const canCall = item.availableActions.includes("call") && Boolean(item.phone);
  const canWa =
    item.availableActions.includes("whatsapp") &&
    (Boolean(item.phone) || String(item.source ?? "").toUpperCase().includes("WHATSAPP"));

  const compact = variant === "compact";
  const btnClass = compact
    ? "dashboard-action-btn inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-sales-md transition-colors hover:bg-sales-surface-hover"
    : "dashboard-action-btn inline-flex min-h-10 items-center justify-center gap-1.5 rounded-sales-md px-3 text-[12px] font-semibold text-sales-text-primary transition-colors hover:bg-sales-surface-hover";

  return (
    <div
      className={cn(
        "flex items-center",
        compact ? "w-max flex-nowrap gap-1" : "flex-wrap gap-2"
      )}
      role="group"
      aria-label={`Actions for ${item.name}`}
    >
      {canCall ? (
        <a
          href={`tel:${item.phone}`}
          aria-label={`Call ${item.name}`}
          title="Call"
          className={cn(btnClass, compact && "dashboard-action-btn--next")}
        >
          <Phone size={14} aria-hidden />
          {!compact ? <span>Call</span> : null}
        </a>
      ) : null}
      {canWa && item.phone ? (
        <a
          href={`https://wa.me/${item.phone.replace(/\D/g, "")}`}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`WhatsApp ${item.name}`}
          title="WhatsApp"
          className={cn(btnClass, compact && "dashboard-action-btn--wa")}
        >
          <SiWhatsapp size={14} className={compact ? "text-[#25D366]" : "text-[#25D366]"} aria-hidden />
          {!compact ? <span>WhatsApp</span> : null}
        </a>
      ) : null}
      <Link
        href={item.href}
        aria-label={`Open lead ${item.name}`}
        title="Open lead"
        className={cn(btnClass, !compact && "dashboard-action-btn--next")}
      >
        {compact ? <ArrowUpRight size={14} aria-hidden /> : <span>Open lead</span>}
      </Link>
    </div>
  );
}

export function NewEnquiriesCard({
  items,
  emptyHint,
}: {
  items: SalesEnquiryPriorityItem[];
  emptyHint?: string;
}) {
  return (
    <CardShell
      title="New enquiries needing action"
      className="dashboard-panel--table"
      action={
        <Link
          href="/sales/call-now"
          className="text-[12px] font-medium text-sales-text-secondary transition-colors hover:text-sales-text-primary"
        >
          View all leads
        </Link>
      }
    >
      {items.length === 0 ? (
        <div className="px-5 py-5 text-center">
          <p className="text-[13px] font-medium text-sales-text-primary">
            No new enquiries need attention.
          </p>
          {emptyHint ? (
            <p className="mt-1 text-[12px] text-sales-text-muted">{emptyHint}</p>
          ) : null}
        </div>
      ) : (
        <>
          {/* Desktop table — scroll on narrow widths instead of crushing actions */}
          {/* Desktop — grid keeps Source→Actions packed; Name takes remaining space */}
          <div className="hidden overflow-x-auto md:block">
            <div
              className="grid grid-cols-[minmax(140px,1fr)_auto_auto_auto_auto] items-center gap-x-3 border-b border-sales-border-subtle bg-sales-surface-subtle px-5 py-2.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-sales-text-muted"
              role="row"
            >
              <span role="columnheader">Name</span>
              <span className="whitespace-nowrap" role="columnheader">
                Source
              </span>
              <span className="whitespace-nowrap" role="columnheader">
                Intent
              </span>
              <span className="whitespace-nowrap" role="columnheader">
                Received
              </span>
              <span className="whitespace-nowrap pr-0.5" role="columnheader">
                Actions
              </span>
            </div>
            <div className="divide-y divide-[rgba(125,148,194,0.07)]" role="rowgroup">
              {items.map((item) => {
                const subtitle = enquirySubtitle(item);
                return (
                  <div
                    key={item.id}
                    className="dashboard-list-row grid grid-cols-[minmax(140px,1fr)_auto_auto_auto_auto] items-center gap-x-3 px-5 py-3"
                    role="row"
                  >
                    <div className="min-w-0" role="cell">
                      <Link href={item.href} className="block min-w-0">
                        <p className="truncate text-[13px] font-semibold text-sales-text-primary">
                          {item.name}
                        </p>
                        {subtitle ? (
                          <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-sales-text-muted">
                            {subtitle}
                          </p>
                        ) : null}
                      </Link>
                    </div>
                    <div className="whitespace-nowrap" role="cell">
                      <span className="inline-flex items-center gap-1.5 text-[12px] text-sales-text-secondary">
                        <SourceIcon source={item.source} />
                        <span>{sourceLabel(item.source)}</span>
                      </span>
                    </div>
                    <div className="whitespace-nowrap" role="cell">
                      <IntentBadge intent={item.intent} />
                    </div>
                    <div
                      className="whitespace-nowrap text-[12px] tabular-nums text-sales-text-muted"
                      role="cell"
                    >
                      {item.receivedLabel}
                    </div>
                    <div className="whitespace-nowrap" role="cell">
                      <EnquiryActions item={item} variant="compact" />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Mobile cards */}
          <ul className="divide-y divide-sales-border-subtle md:hidden">
            {items.map((item) => {
              const subtitle = enquirySubtitle(item);
              return (
                <li key={item.id} className="px-4 py-3.5">
                  <div className="flex items-start justify-between gap-3">
                    <Link href={item.href} className="min-w-0 flex-1">
                      <p className="truncate text-[14px] font-semibold text-sales-text-primary">
                        {item.name}
                      </p>
                      {subtitle ? (
                        <p className="mt-0.5 truncate text-[12px] text-sales-text-secondary">
                          {subtitle}
                        </p>
                      ) : null}
                    </Link>
                    <IntentBadge intent={item.intent} />
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-sales-text-muted">
                    <span className="inline-flex items-center gap-1">
                      <SourceIcon source={item.source} />
                      {sourceLabel(item.source)}
                    </span>
                    <span aria-hidden className="text-sales-border-strong">
                      ·
                    </span>
                    <span className="whitespace-nowrap">{item.receivedLabel}</span>
                  </div>
                  <div className="mt-3 border-t border-sales-border-subtle pt-3">
                    <EnquiryActions item={item} />
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </CardShell>
  );
}
