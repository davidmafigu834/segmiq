"use client";

import Link from "next/link";
import { Activity, BriefcaseBusiness, Inbox, Phone, Trophy } from "lucide-react";
import { SiWhatsapp } from "react-icons/si";
import { CardShell } from "@/components/dashboard/sales/KpiCard";
import type { CompanyActivityItem } from "./types";

function ActivityIcon({ kind }: { kind: CompanyActivityItem["kind"] }) {
  if (kind === "whatsapp") {
    return <SiWhatsapp size={16} className="text-sales-whatsapp" aria-hidden />;
  }
  if (kind === "quote") {
    return <BriefcaseBusiness size={16} strokeWidth={2} className="text-[#60A5FA]" aria-hidden />;
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

export function CompanyRecentActivityCard({ items }: { items: CompanyActivityItem[] }) {
  const display = items.slice(0, 5);

  return (
    <CardShell title="Recent team activity">
      {display.length === 0 ? (
        <div className="flex flex-col items-center justify-center px-5 py-10 text-center">
          <span className="mb-3 flex h-9 w-9 items-center justify-center rounded-[8px] bg-[var(--sales-neutral-100)] text-sales-text-muted">
            <Activity size={18} strokeWidth={1.8} aria-hidden />
          </span>
          <p className="text-[13px] font-medium text-sales-text-primary">No recent team activity yet</p>
          <p className="mt-1 max-w-[240px] text-[12px] text-sales-text-muted">
            Quotes sent, Deals Won and follow-ups completed will appear here.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-sales-border-subtle">
          {display.map((item) => {
            const body = (
              <div className="flex items-start gap-3 px-5 py-3 transition-colors duration-150 hover:bg-sales-surface-hover">
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] bg-[var(--sales-neutral-100)]">
                  <ActivityIcon kind={item.kind} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-medium text-sales-text-primary">{item.title}</p>
                  {item.detail ? (
                    <p className="mt-0.5 truncate text-[12px] text-sales-text-secondary">
                      {item.detail}
                    </p>
                  ) : null}
                  <p className="mt-1 text-[11px] text-sales-text-muted">{item.timeLabel}</p>
                </div>
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
