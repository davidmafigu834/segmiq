"use client";

import Link from "next/link";
import { Activity, BriefcaseBusiness, Eye, Inbox, Phone, Trophy } from "lucide-react";
import { SiWhatsapp } from "react-icons/si";
import type { SalesActivityItem } from "./types";
import { CardShell } from "./KpiCard";

function ActivityIcon({ kind }: { kind: SalesActivityItem["kind"] }) {
  if (kind === "whatsapp") {
    return <SiWhatsapp size={16} className="text-sales-whatsapp" aria-hidden />;
  }
  if (kind === "quote") {
    return <Eye size={16} strokeWidth={2} className="text-[#60A5FA]" aria-hidden />;
  }
  if (kind === "call") {
    return <Phone size={16} strokeWidth={2} className="text-sales-text-primary" aria-hidden />;
  }
  if (kind === "won") {
    return <Trophy size={16} strokeWidth={2} className="text-sales-success" aria-hidden />;
  }
  if (kind === "deal") {
    return <BriefcaseBusiness size={16} strokeWidth={2} className="text-sales-teal-fg" aria-hidden />;
  }
  if (kind === "lead") {
    return <Inbox size={16} strokeWidth={2} className="text-sales-info-fg" aria-hidden />;
  }
  return <Activity size={16} strokeWidth={2} className="text-sales-text-secondary" aria-hidden />;
}

export function RecentActivityCard({ items }: { items: SalesActivityItem[] }) {
  return (
    <CardShell
      title="Recent activity"
      className="dashboard-panel--feed"
      action={
        <Link
          href="/sales/pipeline"
          className="text-[12px] font-medium text-sales-text-secondary transition-colors hover:text-sales-text-primary"
        >
          View pipeline
        </Link>
      }
    >
      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center px-5 py-6 text-center">
          <span className="mb-3 flex h-9 w-9 items-center justify-center rounded-[8px] bg-[var(--sales-neutral-100)] text-sales-text-muted">
            <Activity size={18} strokeWidth={1.8} aria-hidden />
          </span>
          <p className="text-[13px] font-medium text-sales-text-primary">No recent activity yet</p>
          <p className="mt-1 max-w-[240px] text-[12px] text-sales-text-muted">
            Calls, WhatsApp replies and deal updates will appear here.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-[rgba(128,151,200,0.07)]">
          {items.map((item) => {
            const body = (
              <div className="dashboard-list-row flex items-center gap-3 px-4 py-3">
                <span className="dashboard-activity-icon">
                  <ActivityIcon kind={item.kind} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="dashboard-activity-title text-[13px]">{item.title}</p>
                  {item.detail ? (
                    <p className="dashboard-activity-detail mt-0.5 truncate text-[12px]">{item.detail}</p>
                  ) : null}
                </div>
                <p className="dashboard-activity-time shrink-0 text-[11px]">{item.timeLabel}</p>
              </div>
            );
            return (
              <li key={item.id}>
                {item.href ? (
                  <Link
                    href={item.href}
                    className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-sales-brand"
                  >
                    {body}
                  </Link>
                ) : (
                  body
                )}
              </li>
            );
          })}
        </ul>
      )}
    </CardShell>
  );
}
