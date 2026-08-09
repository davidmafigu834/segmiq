"use client";

import Link from "next/link";
import { Activity, Eye, Phone, Trophy } from "lucide-react";
import { SiWhatsapp } from "react-icons/si";
import type { SalesActivityItem } from "./types";
import { CardShell } from "./KpiCard";

function ActivityIcon({ kind }: { kind: SalesActivityItem["kind"] }) {
  if (kind === "whatsapp") return <SiWhatsapp size={15} color="#25D366" aria-hidden />;
  if (kind === "quote") {
    return <Eye size={15} strokeWidth={1.8} className="text-[#2684FF]" aria-hidden />;
  }
  if (kind === "call") {
    return <Phone size={15} strokeWidth={1.8} className="text-[#667085]" aria-hidden />;
  }
  if (kind === "won") {
    return <Trophy size={15} strokeWidth={1.8} className="text-[#16A34A]" aria-hidden />;
  }
  return <Activity size={15} strokeWidth={1.8} className="text-[#98A2B3]" aria-hidden />;
}

export function RecentActivityCard({ items }: { items: SalesActivityItem[] }) {
  return (
    <CardShell
      title="Recent activity"
      action={
        <Link
          href="/sales/leads"
          className="text-[12px] font-medium text-[#667085] transition-colors hover:text-[#101828]"
        >
          View pipeline
        </Link>
      }
    >
      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center px-5 py-10 text-center">
          <span className="mb-3 flex h-9 w-9 items-center justify-center rounded-[8px] bg-[#F2F4F7] text-[#98A2B3]">
            <Activity size={18} strokeWidth={1.8} aria-hidden />
          </span>
          <p className="text-[13px] font-medium text-[#101828]">No recent activity yet</p>
          <p className="mt-1 max-w-[240px] text-[12px] text-[#98A2B3]">
            Calls, WhatsApp replies and deal updates will appear here.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-[#E5E7EB]">
          {items.map((item) => {
            const body = (
              <div className="flex items-start gap-3 px-5 py-3 transition-colors duration-150 hover:bg-[#F9FAFB]">
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] bg-[#F2F4F7]">
                  <ActivityIcon kind={item.kind} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-medium text-[#101828]">{item.title}</p>
                  {item.detail ? (
                    <p className="mt-0.5 truncate text-[12px] text-[#667085]">{item.detail}</p>
                  ) : null}
                  <p className="mt-1 text-[11px] text-[#98A2B3]">{item.timeLabel}</p>
                </div>
              </div>
            );
            return (
              <li key={item.id}>
                {item.href ? (
                  <Link
                    href={item.href}
                    className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#D4FF4F]"
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
