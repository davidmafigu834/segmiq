"use client";

import Link from "next/link";
import { StatusPill } from "@/components/StatusPill";
import { ClientAvatar } from "@/components/ClientAvatar";
import type { LeadSource, LeadStatus } from "@/types";
import { formatDistanceToNow } from "date-fns";

export type LeadTableRow = {
  id: string;
  name: string | null;
  phone: string | null;
  clientName: string;
  budget: string | null;
  source: LeadSource;
  status: LeadStatus;
  assigned: string | null;
  createdAt?: string;
};

export function LeadTable({
  rows,
  variant = "card",
  showFooter = true,
}: {
  rows: LeadTableRow[];
  variant?: "card" | "minimal";
  showFooter?: boolean;
}) {
  const wrap = variant === "minimal" ? "" : "overflow-hidden rounded-lg border border-border bg-surface-card";
  return (
    <div className={wrap}>
      <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] text-left text-sm">
        <thead className={variant === "minimal" ? "border-b border-border" : "bg-surface-card-alt text-ink-secondary"}>
          <tr>
            <th className="px-4 py-3 font-mono text-[11px] font-normal uppercase tracking-wide text-ink-tertiary">
              Lead
            </th>
            <th className="px-4 py-3 font-mono text-[11px] font-normal uppercase tracking-wide text-ink-tertiary">
              Client
            </th>
            <th className="px-4 py-3 font-mono text-[11px] font-normal uppercase tracking-wide text-ink-tertiary">
              Budget
            </th>
            <th className="px-4 py-3 font-mono text-[11px] font-normal uppercase tracking-wide text-ink-tertiary">
              Source
            </th>
            <th className="px-4 py-3 font-mono text-[11px] font-normal uppercase tracking-wide text-ink-tertiary">
              Status
            </th>
            <th className="px-4 py-3 font-mono text-[11px] font-normal uppercase tracking-wide text-ink-tertiary">
              Assigned
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr
              key={r.id}
              className="border-t border-border transition-colors first:border-t-0 hover:bg-surface-card-alt"
            >
              <td className="px-4 py-3">
                <div className="font-medium text-ink-primary">{r.name ?? "—"}</div>
                <div className="font-mono text-[11px] text-ink-tertiary">{r.phone ?? ""}</div>
              </td>
              <td className="px-4 py-3">
                <span className="inline-flex items-center gap-2">
                  <ClientAvatar name={r.clientName} size="sm" />
                  <span className="text-[11px] text-ink-secondary">{r.clientName}</span>
                </span>
              </td>
              <td className="px-4 py-3 font-mono tabular-nums text-ink-primary">{r.budget ?? "—"}</td>
              <td className="px-4 py-3">
                <SourceDot source={r.source} />
              </td>
              <td className="px-4 py-3">
                <StatusPill status={r.status} />
              </td>
              <td className="px-4 py-3">
                <span className="inline-flex items-center gap-2 text-ink-secondary">
                  {r.assigned ? <ClientAvatar name={r.assigned} size="sm" /> : null}
                  <span>{r.assigned?.split(" ")[0] ?? "—"}</span>
                </span>
                {r.createdAt ? (
                  <div className="mt-0.5 font-mono text-[10px] text-ink-tertiary">
                    {formatDistanceToNow(new Date(r.createdAt), { addSuffix: true })}
                  </div>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
      {showFooter ? (
        <div className="border-t border-border px-4 py-2 text-right font-mono text-[11px] text-ink-tertiary">
          <Link href="/dashboard/leads" className="text-ink-primary underline-offset-2 hover:underline">
            View all
          </Link>
        </div>
      ) : null}
    </div>
  );
}

function SourceDot({ source }: { source: LeadSource }) {
  if (source === "FACEBOOK") {
    return (
      <span className="inline-flex items-center gap-2 text-[11px] text-ink-secondary">
        <span className="h-1.5 w-1.5 rounded-full bg-[var(--info)]" /> Facebook
      </span>
    );
  }
  if (source === "LANDING_PAGE") {
    return (
      <span className="inline-flex items-center gap-2 text-[11px] text-ink-secondary">
        <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent)]" /> Landing
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-2 text-[11px] text-ink-secondary">
      <span className="h-1.5 w-1.5 rounded-full bg-ink-tertiary" /> Manual
    </span>
  );
}
