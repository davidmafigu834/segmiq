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
    <CompanyDashCard title="Recent team activity">
      {display.length === 0 ? (
        <CompanyDashEmpty
          title="No recent team activity yet"
          description="Quotes sent, Deals Won and follow-ups completed will appear here."
        />
      ) : (
        <ul className="px-5 py-3">
          {display.map((item, idx) => {
            const body = (
              <div className="flex gap-3 py-2.5">
                <div className="relative flex w-8 shrink-0 flex-col items-center">
                  <span className="z-[1] flex h-8 w-8 items-center justify-center rounded-full bg-sales-neutral-100 ring-4 ring-sales-surface">
                    <ActivityIcon kind={item.kind} />
                  </span>
                  {idx < display.length - 1 ? (
                    <span className="absolute top-8 bottom-[-14px] w-px bg-sales-border-subtle" aria-hidden />
                  ) : null}
                </div>
                <div className="min-w-0 flex-1 pt-0.5">
                  <p className="text-[13px] font-medium text-sales-text-primary">{item.title}</p>
                  {item.detail ? (
                    <p className="mt-0.5 truncate text-[12px] text-sales-text-secondary">{item.detail}</p>
                  ) : null}
                  <p className={cn("mt-1 text-[11px] text-sales-text-muted")}>
                    {item.actorName ? `${item.actorName} · ` : ""}
                    {item.timeLabel}
                  </p>
                </div>
              </div>
            );
            return (
              <li key={item.id}>
                {item.href ? (
                  <Link
                    href={item.href}
                    className="-mx-2 block rounded-[10px] px-2 transition-colors hover:bg-sales-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sales-brand"
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
