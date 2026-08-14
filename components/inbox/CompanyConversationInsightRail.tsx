"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  BriefcaseBusiness,
  CalendarDays,
  ChevronRight,
  FileText,
  Mail,
  MapPin,
  MoreHorizontal,
  Phone,
  UserRound,
} from "lucide-react";
import type { CompanyConversationContext, InboxConversation } from "@/lib/inbox/types";
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
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
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

function RailSection({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="border-b border-sales-border-subtle px-4 py-3.5 last:border-b-0">
      <div className="mb-2.5 flex items-center justify-between gap-3">
        <h3 className="text-[11px] font-semibold text-sales-text-primary">{title}</h3>
        {action}
      </div>
      {children}
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
  const firstContact = formatDateTime(context?.insights.firstContactAt ?? conversation.firstContactAt);
  const status = context?.insights.status ??
    (conversation.conversationStatus === "RESOLVED"
      ? "RESOLVED"
      : conversation.lastMessageDirection === "inbound"
        ? "WAITING_ON_TEAM"
        : "WAITING_ON_CUSTOMER");

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
        <h2 className="min-w-0 flex-1 text-[13px] font-semibold text-sales-text-primary">Customer Overview</h2>
        {onCollapse ? (
          <button
            type="button"
            onClick={onCollapse}
            className="wa-icon-btn-muted max-[1099px]:hidden"
            aria-label="Collapse customer context"
            title="Collapse customer context"
          >
            <ChevronRight size={17} strokeWidth={1.8} />
          </button>
        ) : null}
      </div>

      <div className="inbox-scroll min-h-0 flex-1 overflow-y-auto">
        <section className="border-b border-sales-border-subtle px-4 py-3.5">
          <div className="flex items-start gap-3">
            <WhatsAppAvatar name={name} phone={phone} size="md" />
            <div className="min-w-0 flex-1">
              <div className="truncate text-[14px] font-semibold text-sales-text-primary">{name}</div>
              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                <span className="rounded-[5px] bg-[rgba(37,211,102,0.1)] px-1.5 py-0.5 text-[9px] font-semibold text-[#168A42]">Lead</span>
                <span className="text-[10px] text-sales-text-muted">
                  {context?.contact.lifecycle
                    ? context.contact.lifecycle.replace(/_/g, " ")
                    : conversation.stageLabel}
                </span>
              </div>
              <div className="mt-2 space-y-1.5 text-[10.5px] text-sales-text-secondary">
                {phone ? (
                  <div className="flex items-center gap-2"><Phone size={12} /><span className="truncate tabular-nums">{phone}</span></div>
                ) : null}
                {context?.contact.email ? (
                  <div className="flex items-center gap-2"><Mail size={12} /><span className="truncate">{context.contact.email}</span></div>
                ) : null}
                {(context?.contact.location ?? conversation.location) ? (
                  <div className="flex items-center gap-2"><MapPin size={12} /><span className="truncate">{context?.contact.location ?? conversation.location}</span></div>
                ) : null}
              </div>
            </div>
          </div>
        </section>

        <RailSection title="Conversation Insights">
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: "First Contact", value: firstContact.date, helper: firstContact.time },
              { label: "Messages", value: String(context?.insights.messageCount ?? conversation.messageCount), helper: "Inbound + outbound" },
              { label: "Response Time", value: duration(context?.insights.firstResponseSeconds ?? conversation.firstResponseSeconds), helper: "First response" },
              { label: "Status", value: statusLabel(status), helper: status === "WAITING_ON_TEAM" ? "Response required" : "Conversation workflow" },
            ].map((metric) => (
              <div key={metric.label} className="min-w-0 rounded-[8px] bg-sales-surface-subtle p-2.5">
                <div className="text-[9px] font-medium text-sales-text-muted">{metric.label}</div>
                <div className={`mt-1 truncate text-[12px] font-semibold ${status === "WAITING_ON_TEAM" && metric.label === "Status" ? "text-[#D97706]" : "text-sales-text-primary"}`}>
                  {metric.value}
                </div>
                <div className="mt-0.5 truncate text-[8.5px] text-sales-text-muted">{metric.helper}</div>
              </div>
            ))}
          </div>
        </RailSection>

        <RailSection title="Related Records">
          <div className="space-y-0.5">
            <Link href={`/client/leads?lead=${conversation.id}`} className="flex min-h-8 items-center gap-2 rounded-[7px] px-1.5 text-[10.5px] text-sales-text-secondary hover:bg-sales-surface-hover">
              <UserRound size={13} className="shrink-0" />
              <span className="font-medium text-sales-text-primary">Lead</span>
              <span className="min-w-0 flex-1 truncate">{name}</span>
              <span className="font-medium text-sales-link">View</span>
            </Link>
            {context?.deal ? (
              <Link href={`/client/deals/${context.deal.id}`} className="flex min-h-8 items-center gap-2 rounded-[7px] px-1.5 text-[10.5px] text-sales-text-secondary hover:bg-sales-surface-hover">
                <BriefcaseBusiness size={13} className="shrink-0" />
                <span className="font-medium text-sales-text-primary">Active Deal</span>
                <span className="min-w-0 flex-1 truncate">{context.deal.name}</span>
                <span className="font-medium text-sales-link">View</span>
              </Link>
            ) : (
              <div className="flex min-h-8 items-center gap-2 px-1.5 text-[10.5px] text-sales-text-muted">
                <BriefcaseBusiness size={13} /><span className="font-medium">No Deal yet</span>
              </div>
            )}
            {(context?.quoteCount ?? 0) > 0 ? (
              <Link href={`/client/leads?lead=${conversation.id}`} className="flex min-h-8 items-center gap-2 rounded-[7px] px-1.5 text-[10.5px] text-sales-text-secondary hover:bg-sales-surface-hover">
                <FileText size={13} />
                <span className="font-medium text-sales-text-primary">Quotes Sent</span>
                <span className="flex-1">{context?.quoteCount}</span>
                <span className="font-medium text-sales-link">View</span>
              </Link>
            ) : null}
          </div>
        </RailSection>

        <RailSection title="Team Activity">
          {loading ? (
            <div className="space-y-2">
              {[0, 1, 2].map((item) => <div key={item} className="h-9 animate-pulse rounded-[7px] bg-sales-surface-hover" />)}
            </div>
          ) : context?.activity.length ? (
            <div className="space-y-2.5">
              {context.activity.map((item) => (
                <div key={item.id} className="flex items-start gap-2.5">
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-sales-surface-hover text-[9px] font-semibold text-sales-text-primary">
                    {item.actorName.split(/\s+/).slice(0, 2).map((part) => part[0]).join("")}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[10px] font-semibold text-sales-text-primary">{item.actorName}</div>
                    <div className="text-[9.5px] text-sales-text-secondary">{item.label}</div>
                  </div>
                  <span className="shrink-0 text-[8.5px] text-sales-text-muted">{relativeDate(item.createdAt)}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[10.5px] text-sales-text-muted">No team activity recorded yet.</p>
          )}
        </RailSection>

        <RailSection title="Quick Actions">
          <div className="grid grid-cols-3 gap-2">
            <a href={phone ? `tel:${phone}` : undefined} aria-disabled={!phone} className="inline-flex h-9 items-center justify-center gap-1.5 rounded-[8px] border border-sales-border bg-sales-surface text-[10px] font-medium text-sales-text-primary hover:bg-sales-surface-hover aria-disabled:pointer-events-none aria-disabled:opacity-45">
              <Phone size={13} /> Call
            </a>
            <Link href={`/client/calendar?lead=${conversation.id}`} className="inline-flex h-9 items-center justify-center gap-1.5 rounded-[8px] border border-sales-border bg-sales-surface text-[10px] font-medium text-sales-text-primary hover:bg-sales-surface-hover">
              <CalendarDays size={13} /> Schedule
            </Link>
            <Link href={`/client/leads?lead=${conversation.id}`} className="inline-flex h-9 items-center justify-center gap-1.5 rounded-[8px] border border-sales-border bg-sales-surface text-[10px] font-medium text-sales-text-primary hover:bg-sales-surface-hover">
              <MoreHorizontal size={13} /> More
            </Link>
          </div>
        </RailSection>
      </div>
    </aside>
  );
}
