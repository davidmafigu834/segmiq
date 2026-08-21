"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  Mail,
  MapPin,
  MoreHorizontal,
  Phone,
} from "lucide-react";
import type { CompanyConversationContext, InboxConversation } from "@/lib/inbox/types";
import { supportStageLabel } from "@/lib/inbox/conversation-type";
import { displayContactName, WhatsAppAvatar } from "./WhatsAppAvatar";

function formatDateTime(value: string): { date: string; time: string } {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return { date: "Not available", time: "" };
  return {
    date: new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(date),
    time: new Intl.DateTimeFormat("en", { hour: "numeric", minute: "2-digit" }).format(date),
  };
}

function relativeDate(value: string): string {
  const date = new Date(value);
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();
  const time = new Intl.DateTimeFormat("en", { hour: "numeric", minute: "2-digit" }).format(date);
  if (sameDay) return `Today, ${time}`;
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (24 * 60 * 60 * 1000));
  if (diffDays === 1) return `Yesterday, ${time}`;
  if (diffDays > 1 && diffDays < 7) return `${diffDays} days ago`;
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function relativeFirstContact(value: string): string {
  const date = new Date(value);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (24 * 60 * 60 * 1000));
  if (diffDays <= 0) return "Today";
  if (diffDays === 1) return "1 day ago";
  return `${diffDays} days ago`;
}

function duration(seconds: number | null): string {
  if (seconds == null) return "Not available";
  if (seconds < 60) return `${Math.max(1, Math.round(seconds))}s`;
  const mins = Math.round(seconds / 60);
  if (mins < 60) return `${mins}m`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

function statusLabel(value: CompanyConversationContext["insights"]["status"]): string {
  return value
    .split("_")
    .map((part) => part[0] + part.slice(1).toLowerCase())
    .join(" ");
}

function AccordionSection({
  index,
  title,
  defaultOpen = true,
  children,
}: {
  index: number;
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="border-b border-sales-border-subtle">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center gap-2 px-4 py-2.5 text-left hover:bg-sales-surface-hover"
        aria-expanded={open}
      >
        <span className="text-[10px] font-semibold tabular-nums text-sales-text-muted">{index}.</span>
        <span className="min-w-0 flex-1 text-[12px] font-semibold text-sales-text-primary">{title}</span>
        <ChevronDown
          size={14}
          className={`shrink-0 text-sales-text-muted transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open ? <div className="px-4 pb-3.5">{children}</div> : null}
    </section>
  );
}

export function CompanyConversationInsightRail({
  conversation,
  open,
  refreshKey = 0,
  onMobileBack,
  onCollapse,
  panelWidth,
}: {
  conversation: InboxConversation | null;
  open: boolean;
  refreshKey?: number;
  onMobileBack?: () => void;
  onCollapse?: () => void;
  panelWidth?: number;
}) {
  const [context, setContext] = useState<CompanyConversationContext | null>(null);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<"context" | "activity">("context");

  useEffect(() => {
    if (!conversation?.id) {
      setContext(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetch(`/api/inbox/conversations/${conversation.id}/company-context`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("Failed"))))
      .then((data: { context?: CompanyConversationContext }) => {
        if (!cancelled) setContext(data.context ?? null);
      })
      .catch(() => {
        if (!cancelled) setContext(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [
    conversation?.id,
    conversation?.lastMessageAt,
    conversation?.activeDealId,
    conversation?.assignedToId,
    conversation?.conversationStatus,
    conversation?.latestQuoteStatus,
    refreshKey,
  ]);

  const responsiveClass = open
    ? "max-[1099px]:fixed max-[1099px]:inset-0 max-[1099px]:z-50 max-[1099px]:flex max-[1099px]:w-full max-[1279px]:flex"
    : "max-[1279px]:hidden";

  if (!conversation) return null;

  const name = context?.contact.name ?? displayContactName(conversation);
  const phone = context?.contact.phone ?? conversation.phone;
  const firstContactAt = context?.insights.firstContactAt ?? conversation.firstContactAt;
  const status =
    context?.insights.status ??
    (conversation.conversationStatus === "RESOLVED"
      ? "RESOLVED"
      : conversation.lastMessageDirection === "inbound"
        ? "WAITING_ON_TEAM"
        : "WAITING_ON_CUSTOMER");
  const isSupport = conversation.conversationType === "SUPPORT";
  const quoteCount = context?.quoteCount ?? 0;
  const quoteTotal = conversation.latestQuoteTotal;

  return (
    <aside
      style={panelWidth != null ? { width: panelWidth } : undefined}
      className={`company-wa-context-pane inbox-panel-animated wa-panel flex h-full min-h-0 min-w-0 shrink-0 flex-col bg-sales-surface ${responsiveClass}`}
    >
      <div className="flex min-h-12 shrink-0 items-center gap-2 border-b border-sales-border px-3.5 py-2 max-[1099px]:pt-[max(0.75rem,env(safe-area-inset-top))]">
        {onMobileBack ? (
          <button type="button" onClick={onMobileBack} className="wa-icon-btn-muted" aria-label="Back to conversation">
            <ArrowLeft size={19} strokeWidth={1.8} />
          </button>
        ) : null}
        <div className="flex min-w-0 flex-1 border-b border-transparent">
          {(["context", "activity"] as const).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={`relative flex-1 px-2 py-1.5 text-[12px] font-medium capitalize ${
                tab === key ? "text-sales-text-primary" : "text-sales-text-secondary"
              }`}
            >
              {key}
              {tab === key ? <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-sales-brand" /> : null}
            </button>
          ))}
        </div>
        {onCollapse ? (
          <button
            type="button"
            onClick={onCollapse}
            className="wa-icon-btn-muted max-[1099px]:hidden"
            aria-label="Collapse customer context"
          >
            <ChevronRight size={17} strokeWidth={1.8} />
          </button>
        ) : null}
      </div>

      <div className="inbox-scroll min-h-0 flex-1 overflow-y-auto">
        {tab === "activity" ? (
          <div className="px-4 py-3.5">
            {loading ? (
              <div className="space-y-2">
                {[0, 1, 2, 3].map((item) => (
                  <div key={item} className="h-10 animate-pulse rounded-[7px] bg-sales-surface-hover" />
                ))}
              </div>
            ) : context?.activity.length ? (
              <div className="space-y-3">
                {context.activity.map((item) => (
                  <div key={item.id} className="border-b border-sales-border-subtle pb-2.5 last:border-0">
                    <div className="text-[11px] font-semibold text-sales-text-primary">{item.label}</div>
                    <div className="mt-0.5 text-[10px] text-sales-text-muted">{relativeDate(item.createdAt)}</div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[11px] text-sales-text-muted">No activity recorded yet.</p>
            )}
          </div>
        ) : (
          <>
            <AccordionSection index={1} title="Customer Overview">
              <div className="flex items-start gap-3">
                <WhatsAppAvatar name={name} phone={phone} size="md" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="truncate text-[14px] font-semibold text-sales-text-primary">{name}</span>
                    {!isSupport ? (
                      <span className="rounded-[5px] bg-[rgba(37,211,102,0.1)] px-1.5 py-0.5 text-[9px] font-semibold text-[#168A42]">
                        Lead
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-2 space-y-1.5 text-[11px] text-sales-text-secondary">
                    {phone ? (
                      <div className="flex items-center gap-2">
                        <Phone size={12} />
                        <span className="truncate tabular-nums">{phone}</span>
                      </div>
                    ) : null}
                    {(context?.contact.location ?? conversation.location) ? (
                      <div className="flex items-center gap-2">
                        <MapPin size={12} />
                        <span className="truncate">{context?.contact.location ?? conversation.location}</span>
                      </div>
                    ) : null}
                    {context?.contact.email ? (
                      <div className="flex items-center gap-2">
                        <Mail size={12} />
                        <span className="truncate">{context.contact.email}</span>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            </AccordionSection>

            {isSupport && conversation.supportCase ? (
              <AccordionSection index={2} title="Support Case">
                <div className="space-y-1.5 text-[11px]">
                  <div className="font-semibold text-sales-text-primary">
                    {conversation.supportCase.reason || conversation.supportCase.reasonCategory?.replace(/_/g, " ") || "Support request"}
                  </div>
                  <div className="text-sales-text-secondary">
                    Status: {supportStageLabel(conversation.supportCase.status)}
                  </div>
                </div>
              </AccordionSection>
            ) : null}

            <AccordionSection index={isSupport && conversation.supportCase ? 3 : 2} title="Conversation Insights">
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: "First contact", value: relativeFirstContact(firstContactAt) },
                  { label: "Messages", value: String(context?.insights.messageCount ?? conversation.messageCount) },
                  {
                    label: "First response",
                    value: duration(context?.insights.firstResponseSeconds ?? conversation.firstResponseSeconds),
                  },
                  {
                    label: "Status",
                    value: statusLabel(status),
                    tone: status === "WAITING_ON_TEAM" ? "text-[#D97706]" : undefined,
                  },
                ].map((metric) => (
                  <div key={metric.label} className="min-w-0 rounded-[8px] border border-sales-border-subtle bg-sales-surface-subtle p-2.5">
                    <div className="text-[9px] font-medium uppercase tracking-[0.04em] text-sales-text-muted">
                      {metric.label}
                    </div>
                    <div className={`mt-1 truncate text-[12px] font-semibold ${metric.tone ?? "text-sales-text-primary"}`}>
                      {metric.value}
                    </div>
                  </div>
                ))}
              </div>
            </AccordionSection>

            <AccordionSection index={isSupport && conversation.supportCase ? 4 : 3} title="Related Records">
              <div className="space-y-1">
                {!isSupport ? (
                  <Link
                    href={`/client/leads?lead=${conversation.id}`}
                    className="flex min-h-9 items-center gap-2 rounded-[7px] px-1 text-[11px] hover:bg-sales-surface-hover"
                  >
                    <span className="w-12 font-medium text-sales-text-muted">Lead</span>
                    <span className="min-w-0 flex-1 truncate text-sales-text-primary">{name}</span>
                  </Link>
                ) : null}
                {context?.deal ? (
                  <Link
                    href={`/client/deals/${context.deal.id}`}
                    className="flex min-h-9 items-center gap-2 rounded-[7px] px-1 text-[11px] hover:bg-sales-surface-hover"
                  >
                    <span className="w-12 font-medium text-sales-text-muted">Deal</span>
                    <span className="min-w-0 flex-1 truncate text-sales-text-primary">{context.deal.name}</span>
                  </Link>
                ) : !isSupport ? (
                  <div className="flex min-h-9 items-center gap-2 px-1 text-[11px] text-sales-text-muted">
                    <span className="w-12 font-medium">Deal</span>
                    <span>No active deal</span>
                  </div>
                ) : null}
                {quoteCount > 0 ? (
                  <Link
                    href={`/client/leads?lead=${conversation.id}`}
                    className="flex min-h-9 items-center gap-2 rounded-[7px] px-1 text-[11px] hover:bg-sales-surface-hover"
                  >
                    <span className="w-12 font-medium text-sales-text-muted">Quotes</span>
                    <span className="min-w-0 flex-1 truncate text-sales-text-primary">
                      {quoteCount} sent
                      {quoteTotal != null ? ` · ${new Intl.NumberFormat("en", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(quoteTotal)}` : ""}
                    </span>
                  </Link>
                ) : null}
                {isSupport ? (
                  <Link
                    href={`/client/leads?lead=${conversation.id}`}
                    className="flex min-h-9 items-center gap-2 rounded-[7px] px-1 text-[11px] hover:bg-sales-surface-hover"
                  >
                    <span className="w-12 font-medium text-sales-text-muted">Customer</span>
                    <span className="min-w-0 flex-1 truncate text-sales-text-primary">{name}</span>
                  </Link>
                ) : null}
              </div>
            </AccordionSection>

            <AccordionSection index={isSupport && conversation.supportCase ? 5 : 4} title="Team Activity">
              {loading ? (
                <div className="space-y-2">
                  {[0, 1, 2].map((item) => (
                    <div key={item} className="h-9 animate-pulse rounded-[7px] bg-sales-surface-hover" />
                  ))}
                </div>
              ) : context?.activity.length ? (
                <div className="space-y-2.5">
                  {context.activity.slice(0, 5).map((item) => (
                    <div key={item.id}>
                      <div className="text-[11px] font-medium text-sales-text-primary">{item.label}</div>
                      <div className="text-[10px] text-sales-text-muted">{relativeDate(item.createdAt)}</div>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => setTab("activity")}
                    className="text-[10px] font-semibold text-sales-link hover:underline"
                  >
                    View all activity
                  </button>
                </div>
              ) : (
                <p className="text-[11px] text-sales-text-muted">No team activity recorded yet.</p>
              )}
            </AccordionSection>

            <AccordionSection index={isSupport && conversation.supportCase ? 6 : 5} title="Quick Actions" defaultOpen={false}>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <a
                  href={phone ? `tel:${phone}` : undefined}
                  aria-disabled={!phone}
                  className="inline-flex h-9 items-center justify-center gap-1.5 rounded-[8px] border border-sales-border bg-sales-surface text-[10px] font-medium text-sales-text-primary hover:bg-sales-surface-hover aria-disabled:pointer-events-none aria-disabled:opacity-45"
                >
                  <Phone size={13} /> Call customer
                </a>
                <Link
                  href={`/client/calendar?lead=${conversation.id}`}
                  className="inline-flex h-9 items-center justify-center gap-1.5 rounded-[8px] border border-sales-border bg-sales-surface text-[10px] font-medium text-sales-text-primary hover:bg-sales-surface-hover"
                >
                  <CalendarDays size={13} /> Schedule follow-up
                </Link>
                <Link
                  href={`/client/leads?lead=${conversation.id}`}
                  className="inline-flex h-9 items-center justify-center gap-1.5 rounded-[8px] border border-sales-border bg-sales-surface text-[10px] font-medium text-sales-text-primary hover:bg-sales-surface-hover"
                >
                  <MoreHorizontal size={13} /> More actions
                </Link>
              </div>
            </AccordionSection>
          </>
        )}
      </div>
    </aside>
  );
}
