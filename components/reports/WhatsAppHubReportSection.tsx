"use client";

import Link from "next/link";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Flame,
  MessageCircle,
} from "lucide-react";
import type { WhatsAppHubReport } from "@/lib/whatsapp-hub-report";

function Stat({
  label,
  value,
  hint,
  href,
}: {
  label: string;
  value: number | string;
  hint?: string;
  href?: string;
}) {
  const body = (
    <div className="rounded-xl border border-[#00A884]/20 bg-[#0a1612] p-3.5 sm:p-4">
      <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#6EE7B7]">
        {label}
      </p>
      <p className="mt-2 font-display text-[22px] leading-none text-[var(--text-primary)] sm:text-[28px]">
        {value}
      </p>
      {hint ? <p className="mt-1.5 text-[10px] text-[var(--text-tertiary)] sm:text-[11px]">{hint}</p> : null}
    </div>
  );

  if (!href) return body;
  return (
    <Link href={href} className="block transition-opacity hover:opacity-90">
      {body}
    </Link>
  );
}

function formatResponseMinutes(mins: number | null): string {
  if (mins == null) return "—";
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

export function WhatsAppHubReportSection({
  report,
  showTeamTable = true,
  inboxHref = "/sales/inbox",
}: {
  report: WhatsAppHubReport;
  showTeamTable?: boolean;
  inboxHref?: string;
}) {
  const { summary, byRep, dailyVolume, period } = report;
  const maxDaily = Math.max(1, ...dailyVolume.map((d) => d.inbound + d.outbound));

  return (
    <div className="space-y-4 sm:space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
        <div className="min-w-0">
          <div className="mb-1 flex items-center gap-2 text-[#6EE7B7]">
            <MessageCircle size={16} />
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em]">
              WhatsApp Sales Hub
            </p>
          </div>
          <h2 className="text-[16px] font-semibold text-[var(--text-primary)] sm:text-[18px]">
            Chat activity · {period.label}
          </h2>
        </div>
        <Link
          href={inboxHref}
          className="inline-flex w-full items-center justify-center gap-1.5 rounded-full border border-[#00A884]/30 px-3 py-2 text-[12px] font-medium text-[#6EE7B7] transition-colors hover:bg-[#00A884]/10 sm:w-auto sm:py-1.5"
        >
          Open inbox
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-4">
        <Stat
          label="Active chats"
          value={summary.activeChats}
          hint={`${summary.newChats} new this period`}
          href={inboxHref}
        />
        <Stat
          label="Awaiting reply"
          value={summary.awaitingReply}
          hint="Last message was from the customer"
          href={inboxHref}
        />
        <Stat
          label="Messages in / out"
          value={`${summary.inboundMessages} / ${summary.outboundMessages}`}
          hint="Customer vs team messages"
        />
        <Stat
          label="Avg first reply"
          value={formatResponseMinutes(summary.avgFirstResponseMinutes)}
          hint="Time to first outbound reply"
        />
      </div>

      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3 sm:gap-3">
        <Stat label="Hot chats" value={summary.hotChats} hint="Intent score 70+" />
        <Stat label="Unassigned" value={summary.unassignedChats} hint="Need a rep owner" />
        <Stat label="Contacted" value={summary.contactedChats} hint="Moved past New in pipeline" />
      </div>

      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-card)] p-3 sm:p-4">
        <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-tertiary)]">
          Message volume
        </p>
        <div className="-mx-1 overflow-x-auto px-1 pb-1">
          <div
            className="flex h-28 min-w-full items-end gap-1.5"
            style={{ minWidth: dailyVolume.length > 7 ? `${dailyVolume.length * 28}px` : undefined }}
          >
          {dailyVolume.map((day) => (
            <div key={day.date} className="flex min-w-[24px] flex-1 flex-col items-center gap-1 sm:min-w-0">
              <div className="flex h-24 w-full min-w-[20px] items-end justify-center gap-0.5">
                <div
                  className="w-[42%] rounded-t bg-[#00A884]/70"
                  style={{ height: `${Math.max(4, Math.round((day.outbound / maxDaily) * 100))}%` }}
                  title={`${day.outbound} sent`}
                />
                <div
                  className="w-[42%] rounded-t bg-[#53BDEB]/80"
                  style={{ height: `${Math.max(4, Math.round((day.inbound / maxDaily) * 100))}%` }}
                  title={`${day.inbound} received`}
                />
              </div>
              <span className="max-w-full truncate text-[8px] text-[var(--text-tertiary)] sm:text-[9px]">{day.label}</span>
            </div>
          ))}
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-4 text-[11px] text-[var(--text-tertiary)]">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-sm bg-[#00A884]/70" />
            Sent
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-sm bg-[#53BDEB]/80" />
            Received
          </span>
        </div>
      </div>

      {showTeamTable && byRep.length > 0 ? (
        <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface-card)]">
          <div className="border-b border-[var(--border)] px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-tertiary)]">
              Team activity
            </p>
          </div>
          <div className="divide-y divide-[var(--border)]">
            {byRep.map((rep) => (
              <div key={rep.userId} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                <div className="min-w-0">
                  <p className="truncate text-[14px] font-medium text-[var(--text-primary)]">
                    {rep.name}
                  </p>
                  <p className="text-[11px] text-[var(--text-tertiary)]">
                    {rep.assignedChats} chats · {rep.contactedChats} contacted
                  </p>
                </div>
                <div className="shrink-0 sm:text-right">
                  <p className="inline-flex items-center gap-1 text-[13px] font-semibold text-[#6EE7B7]">
                    <ArrowUpRight size={14} />
                    {rep.outboundMessages}
                  </p>
                  <p className="text-[10px] text-[var(--text-tertiary)]">messages sent</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="hidden grid-cols-1 gap-2.5 lg:grid lg:grid-cols-3 lg:gap-3">
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-card)] px-4 py-3">
          <div className="flex items-center gap-2 text-[var(--text-tertiary)]">
            <ArrowDownLeft size={14} className="text-[#53BDEB]" />
            <span className="text-[11px] uppercase tracking-wide">Inbound</span>
          </div>
          <p className="mt-1 text-[22px] font-semibold text-[var(--text-primary)]">
            {summary.inboundMessages}
          </p>
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-card)] px-4 py-3">
          <div className="flex items-center gap-2 text-[var(--text-tertiary)]">
            <ArrowUpRight size={14} className="text-[#6EE7B7]" />
            <span className="text-[11px] uppercase tracking-wide">Outbound</span>
          </div>
          <p className="mt-1 text-[22px] font-semibold text-[var(--text-primary)]">
            {summary.outboundMessages}
          </p>
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-card)] px-4 py-3">
          <div className="flex items-center gap-2 text-[var(--text-tertiary)]">
            <Flame size={14} className="text-[var(--warning)]" />
            <span className="text-[11px] uppercase tracking-wide">Hot / warm / cold</span>
          </div>
          <p className="mt-1 text-[22px] font-semibold text-[var(--text-primary)]">
            {summary.hotChats} / {summary.warmChats} / {summary.coldChats}
          </p>
        </div>
      </div>
    </div>
  );
}
