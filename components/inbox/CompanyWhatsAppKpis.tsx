"use client";

import { CheckCircle2, Clock3, MessageSquareText, UserRoundX, UsersRound } from "lucide-react";
import { SiWhatsapp } from "react-icons/si";
import type { CompanyWhatsAppSummary, InboxFilter } from "@/lib/inbox/types";

function formatDuration(seconds: number | null): string {
  if (seconds == null) return "—";
  if (seconds < 60) return `${Math.max(1, Math.round(seconds))}s`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours}h ${rest}m` : `${hours}h`;
}

export function CompanyWhatsAppKpis({
  summary,
  onFilter,
}: {
  summary: CompanyWhatsAppSummary;
  onFilter: (filter: InboxFilter) => void;
}) {
  const cards: Array<{
    id: string;
    label: string;
    value: string | number;
    helper: string;
    icon: React.ReactNode;
    filter?: InboxFilter;
    tone?: "green" | "amber";
  }> = [
    {
      id: "active",
      label: "Active Conversations",
      value: summary.active,
      helper: "Open company conversations",
      icon: <SiWhatsapp size={16} aria-hidden />,
      filter: "open",
      tone: "green",
    },
    {
      id: "new",
      label: "New Conversations",
      value: summary.newConversations,
      helper: `First contact in ${summary.periodDays} days`,
      icon: <MessageSquareText size={16} strokeWidth={1.8} aria-hidden />,
      filter: "new",
    },
    {
      id: "first-response",
      label: "Avg. First Response",
      value: formatDuration(summary.avgFirstResponseSeconds),
      helper: "First inbound → first reply",
      icon: <Clock3 size={16} strokeWidth={1.8} aria-hidden />,
    },
    {
      id: "resolved",
      label: "Resolved",
      value: summary.resolved,
      helper: `Resolved in ${summary.periodDays} days`,
      icon: <CheckCircle2 size={16} strokeWidth={1.8} aria-hidden />,
      filter: "resolved",
      tone: "green",
    },
    {
      id: "unassigned",
      label: "Unassigned",
      value: summary.unassigned,
      helper: "Needs an owner",
      icon: <UserRoundX size={16} strokeWidth={1.8} aria-hidden />,
      filter: "unassigned",
    },
    {
      id: "waiting",
      label: "Waiting on Team",
      value: summary.waitingOnTeam,
      helper: "Customer replied last",
      icon: <UsersRound size={16} strokeWidth={1.8} aria-hidden />,
      filter: "awaiting_reply",
      tone: "amber",
    },
  ];

  return (
    <section
      className="grid shrink-0 grid-cols-2 gap-2.5 px-4 pb-4 sm:grid-cols-3 sm:px-6 layout:grid-cols-6 layout:px-7"
      aria-label="WhatsApp conversation summary"
    >
      {cards.map((card) => {
        const content = (
          <>
            <div className="flex min-w-0 items-center gap-2 text-sales-text-secondary">
              <span
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-[8px] border border-sales-border bg-sales-surface-subtle ${
                  card.tone === "green"
                    ? "text-[#1E9D4F]"
                    : card.tone === "amber"
                      ? "text-[#F97316]"
                      : "text-sales-text-secondary"
                }`}
              >
                {card.icon}
              </span>
              <span className="truncate text-[11px] font-medium">{card.label}</span>
            </div>
            <div className="mt-2 text-[24px] font-semibold leading-none tracking-[-0.035em] tabular-nums text-sales-text-primary">
              {card.value}
            </div>
            <p className="mt-2 truncate text-[10px] text-sales-text-muted">{card.helper}</p>
          </>
        );
        const className = `company-wa-kpi min-w-0 rounded-[12px] border border-sales-border bg-sales-surface px-3.5 py-3 text-left shadow-none ${
          card.filter
            ? "cursor-pointer transition-colors hover:border-sales-border-strong hover:bg-sales-surface-hover focus-visible:outline-none focus-visible:shadow-[var(--sales-focus-ring)]"
            : ""
        }`;
        return card.filter ? (
          <button
            key={card.id}
            type="button"
            data-kpi-id={card.id}
            onClick={() => onFilter(card.filter!)}
            className={className}
          >
            {content}
          </button>
        ) : (
          <div key={card.id} data-kpi-id={card.id} className={className}>
            {content}
          </div>
        );
      })}
    </section>
  );
}
