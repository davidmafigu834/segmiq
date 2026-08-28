"use client";

import Link from "next/link";
import { Activity, BriefcaseBusiness, Inbox, Phone, Trophy } from "lucide-react";
import { SiWhatsapp } from "react-icons/si";
import { cn } from "@/lib/ui/cn";
import { CompanyDashCard, CompanyDashEmpty } from "./CompanyDashCard";
import type { CompanyActivityItem } from "./types";

function ActivityIcon({ kind }: { kind: CompanyActivityItem["kind"] }) {
  if (kind === "whatsapp") return <SiWhatsapp size={14} className="text-sales-whatsapp" aria-hidden />;
  if (kind === "quote") return <BriefcaseBusiness size={14} strokeWidth={2} className="text-sales-info-fg" aria-hidden />;
  if (kind === "call") return <Phone size={14} strokeWidth={2} aria-hidden />;
  if (kind === "won") return <Trophy size={14} strokeWidth={2} className="text-sales-success-fg" aria-hidden />;
  if (kind === "deal") return <BriefcaseBusiness size={14} strokeWidth={2} className="text-sales-teal-fg" aria-hidden />;
  if (kind === "lead") return <Inbox size={14} strokeWidth={2} className="text-sales-info-fg" aria-hidden />;
  return <Activity size={14} strokeWidth={2} className="text-sales-text-secondary" aria-hidden />;
}

export function CompanyRecentActivityCard({ items }: { items: CompanyActivityItem[] }) {
  const display = items.slice(0, 6);

  return (
    <CompanyDashCard title="Recent team activity" className="dashboard-panel--feed">
      {display.length === 0 ? (
        <CompanyDashEmpty
          title="No recent team activity yet"
          description="Quotes sent, Deals Won and follow-ups completed will appear here."
        />
      ) : (
        <ul className="divide-y divide-[rgba(128,151,200,0.07)] px-2 py-1">
          {display.map((item) => {
            const body = (
              <div className="dashboard-list-row flex items-center gap-3 px-3 py-2">
                <span className="dashboard-activity-icon">
                  <ActivityIcon kind={item.kind} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="dashboard-activity-title truncate text-[13px]">{item.title}</p>
                  {item.detail ? (
                    <p className="dashboard-activity-detail truncate text-[12px]">{item.detail}</p>
                  ) : null}
                </div>
                <p className={cn("dashboard-activity-time shrink-0 text-[11px]")}>
                  {item.actorName ? `${item.actorName} · ` : ""}
                  {item.timeLabel}
                </p>
              </div>
            );
            return (
              <li key={item.id}>
                {item.href ? (
                  <Link
                    href={item.href}
                    className="block rounded-[8px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sales-brand"
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
    </CompanyDashCard>
  );
}
