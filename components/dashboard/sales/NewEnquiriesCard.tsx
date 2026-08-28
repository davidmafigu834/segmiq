"use client";

import Link from "next/link";
import { Footprints, Phone, UserRoundPlus, Users } from "lucide-react";
import { SiFacebook, SiWhatsapp } from "react-icons/si";
import type { SalesEnquiryPriorityItem } from "./types";
import { CardShell } from "./KpiCard";
import { cn } from "@/lib/ui/cn";

function SourceIcon({ source }: { source: string | null }) {
  const s = (source ?? "").toUpperCase();
  if (s.includes("WHATSAPP") || s === "WA") {
    return <SiWhatsapp size={14} className="text-[#25D366]" aria-hidden />;
  }
  if (s.includes("FACEBOOK") || s.includes("META") || s === "FB") {
    return <SiFacebook size={14} className="text-[#1877F2]" aria-hidden />;
  }
  if (s.includes("WALK") || s.includes("WALK_IN") || s.includes("WALKIN")) {
    return <Footprints size={14} strokeWidth={2} className="text-sales-text-primary" aria-hidden />;
  }
  if (s.includes("REFER")) {
    return <UserRoundPlus size={14} strokeWidth={2} className="text-sales-text-primary" aria-hidden />;
  }
  return <Users size={14} strokeWidth={2} className="text-sales-text-secondary" aria-hidden />;
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

function EnquiryActions({ item }: { item: SalesEnquiryPriorityItem }) {
  const canCall = item.availableActions.includes("call") && Boolean(item.phone);
  const canWa =
    item.availableActions.includes("whatsapp") &&
    (Boolean(item.phone) || String(item.source ?? "").toUpperCase().includes("WHATSAPP"));

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {canCall ? (
        <a
          href={`tel:${item.phone}`}
          aria-label={`Call ${item.name}`}
          className="dashboard-action-btn dashboard-action-btn--next inline-flex min-h-11 min-w-11 items-center justify-center gap-1 rounded-sales-md px-2.5 text-[12px] font-semibold text-sales-text-primary hover:bg-sales-surface-hover sm:min-h-9 sm:min-w-0"
        >
          <Phone size={14} aria-hidden />
          <span className="hidden sm:inline">Call</span>
        </a>
      ) : null}
      {canWa && item.phone ? (
        <a
          href={`https://wa.me/${item.phone.replace(/\D/g, "")}`}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`WhatsApp ${item.name}`}
          className="dashboard-action-btn dashboard-action-btn--next dashboard-action-btn--wa inline-flex min-h-11 min-w-11 items-center justify-center gap-1 rounded-sales-md px-2.5 text-[12px] font-semibold hover:bg-sales-surface-hover sm:min-h-9 sm:min-w-0"
        >
          <SiWhatsapp size={14} className="text-[#25D366]" aria-hidden />
          <span className="hidden sm:inline">WhatsApp</span>
        </a>
      ) : null}
      <Link
        href={item.href}
        aria-label={`Open lead ${item.name}`}
        className="dashboard-action-btn inline-flex min-h-11 items-center justify-center rounded-sales-md px-2.5 text-[12px] font-semibold text-sales-text-primary hover:bg-sales-surface-hover sm:min-h-9"
      >
        Open lead
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
          {/* Desktop table — full width */}
          <div className="hidden w-full md:block">
            <table className="dashboard-table w-full table-fixed text-left">
              <colgroup>
                <col className="w-[34%]" />
                <col className="w-[16%]" />
                <col className="w-[12%]" />
                <col className="w-[14%]" />
                <col className="w-[24%]" />
              </colgroup>
              <thead>
                <tr className="border-b border-sales-border-subtle bg-sales-surface-subtle text-[10px] font-semibold uppercase tracking-[0.08em] text-sales-text-muted">
                  <th className="px-5 py-2.5 font-semibold">Name</th>
                  <th className="px-3 py-2.5 font-semibold">Source</th>
                  <th className="px-3 py-2.5 font-semibold">Intent</th>
                  <th className="px-3 py-2.5 font-semibold">Received</th>
                  <th className="px-5 py-2.5 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[rgba(125,148,194,0.07)]">
                {items.map((item) => (
                  <tr
                    key={item.id}
                    className="dashboard-list-row h-[54px]"
                  >
                    <td className="px-5 py-2">
                      <Link href={item.href} className="block min-w-0">
                        <p className="truncate text-[13px] font-semibold text-sales-text-primary">
                          {item.name}
                        </p>
                        {item.projectType ? (
                          <p className="truncate text-[11px] text-sales-text-muted">
                            {item.projectType}
                          </p>
                        ) : null}
                      </Link>
                    </td>
                    <td className="px-3 py-2">
                      <span className="inline-flex min-w-0 items-center gap-1.5 text-[12px] text-sales-text-secondary">
                        <SourceIcon source={item.source} />
                        <span className="truncate">{sourceLabel(item.source)}</span>
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <IntentBadge intent={item.intent} />
                    </td>
                    <td className="px-3 py-2 text-[12px] tabular-nums text-sales-text-muted">
                      {item.receivedLabel}
                    </td>
                    <td className="px-5 py-2">
                      <EnquiryActions item={item} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <ul className="divide-y divide-sales-border-subtle md:hidden">
            {items.map((item) => (
              <li key={item.id} className="px-4 py-3.5">
                <Link href={item.href} className="block">
                  <p className="text-[14px] font-semibold text-sales-text-primary">{item.name}</p>
                  {item.projectType ? (
                    <p className="mt-0.5 text-[12px] text-sales-text-secondary">{item.projectType}</p>
                  ) : null}
                </Link>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-[12px] text-sales-text-muted">
                  <span className="inline-flex items-center gap-1">
                    <SourceIcon source={item.source} />
                    {sourceLabel(item.source)}
                  </span>
                  <span aria-hidden>·</span>
                  <IntentBadge intent={item.intent} />
                  <span aria-hidden>·</span>
                  <span>Received {item.receivedLabel}</span>
                </div>
                <div className="mt-3">
                  <EnquiryActions item={item} />
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </CardShell>
  );
}
