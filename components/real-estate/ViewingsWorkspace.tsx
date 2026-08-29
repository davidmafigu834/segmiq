"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Calendar, Check, ExternalLink, MessageSquare } from "lucide-react";
import { listingLabel } from "@/lib/real-estate/helpers";
import {
  VIEWING_WORKSPACE_TABS,
  viewingMatchesTab,
  viewingStatusLabel,
  type ViewingWorkspaceTab,
} from "@/lib/real-estate/viewings";
import { cn } from "@/lib/ui/cn";

export type ViewingWorkspaceRow = {
  id: string;
  scheduled_at: string;
  status: string;
  feedback_text: string | null;
  feedback_sentiment: string | null;
  agent_id: string | null;
  agent_name: string | null;
  contact_id: string;
  contact_name: string | null;
  listing_id: string;
  listing_address: string | null;
  listing_suburb: string | null;
};

function formatWhen(iso: string): { date: string; time: string } {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { date: "—", time: "—" };
  return {
    date: d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" }),
    time: d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }),
  };
}

export function ViewingsWorkspace({
  clientId,
  viewings,
}: {
  clientId: string;
  viewings: ViewingWorkspaceRow[];
}) {
  const [tab, setTab] = useState<ViewingWorkspaceTab>("upcoming");
  const [rows, setRows] = useState(viewings);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [openFeedbackId, setOpenFeedbackId] = useState<string | null>(null);

  const filtered = useMemo(
    () =>
      rows
        .filter((v) => viewingMatchesTab(v.status, tab))
        .sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at)),
    [rows, tab]
  );

  const counts = useMemo(() => {
    const next: Record<ViewingWorkspaceTab, number> = {
      upcoming: 0,
      completed: 0,
      cancelled: 0,
      all: rows.length,
    };
    for (const v of rows) {
      if (viewingMatchesTab(v.status, "upcoming")) next.upcoming += 1;
      if (viewingMatchesTab(v.status, "completed")) next.completed += 1;
      if (viewingMatchesTab(v.status, "cancelled")) next.cancelled += 1;
    }
    return next;
  }, [rows]);

  async function completeViewing(id: string) {
    setBusyId(id);
    try {
      const res = await fetch(`/api/clients/${clientId}/viewings?id=${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "completed" }),
      });
      if (!res.ok) return;
      setRows((prev) => prev.map((v) => (v.id === id ? { ...v, status: "completed" } : v)));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="overflow-hidden workspace-card rounded-[14px] border border-sales-border bg-sales-surface">
      <div
        className="scrollbar-hide flex gap-4 overflow-x-auto border-b border-sales-border-subtle px-4 sm:px-5"
        role="tablist"
      >
        {VIEWING_WORKSPACE_TABS.map((item) => {
          const active = item.id === tab;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setTab(item.id)}
              className={cn(
                "relative h-11 shrink-0 whitespace-nowrap text-[13px] transition-colors duration-150",
                active
                  ? "font-semibold text-sales-text-primary"
                  : "font-medium text-sales-text-secondary hover:text-sales-text-primary"
              )}
            >
              {item.label}
              <span className="ml-1.5 tabular-nums text-sales-text-muted">{counts[item.id]}</span>
              {active ? (
                <span className="absolute inset-x-0 -bottom-px h-[3px] bg-sales-brand" aria-hidden />
              ) : null}
            </button>
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <div className="px-5 py-14 text-center">
          <Calendar className="mx-auto h-5 w-5 text-sales-text-muted" strokeWidth={1.6} />
          <p className="mt-3 text-sm font-medium text-sales-text-primary">No viewings in this list</p>
          <p className="mt-1 text-[13px] text-sales-text-secondary">
            Schedule a viewing from a contact or inquiry. Upcoming appointments will appear here.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-sales-border-subtle">
          {filtered.map((v) => {
            const when = formatWhen(v.scheduled_at);
            const property = listingLabel({
              address: v.listing_address,
              suburb: v.listing_suburb,
            });
            const overdue =
              v.status === "scheduled" && new Date(v.scheduled_at).getTime() < Date.now();
            return (
              <li key={v.id} className="px-4 py-4 sm:px-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-[13px] font-semibold text-sales-text-primary">{property}</p>
                      <span className="rounded-[6px] border border-sales-border-subtle px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-sales-text-muted">
                        {viewingStatusLabel(v.status)}
                      </span>
                      {overdue ? (
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-sales-danger">
                          Overdue
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 text-[13px] text-sales-text-secondary">
                      {when.date} · {when.time}
                      {v.contact_name ? ` · ${v.contact_name}` : ""}
                      {v.agent_name ? ` · ${v.agent_name}` : ""}
                    </p>
                    {v.feedback_text ? (
                      <p className="mt-2 max-w-xl text-[12px] leading-relaxed text-sales-text-muted">
                        Feedback: {v.feedback_text}
                        {v.feedback_sentiment ? ` (${v.feedback_sentiment})` : ""}
                      </p>
                    ) : null}
                    {openFeedbackId === v.id && v.feedback_text ? (
                      <p className="mt-2 max-w-xl text-[13px] text-sales-text-secondary">{v.feedback_text}</p>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {v.contact_id ? (
                      <Link
                        href={`/client/contacts/${v.contact_id}`}
                        className="inline-flex h-8 items-center gap-1 rounded-[8px] border border-sales-border px-2.5 text-[12px] font-medium text-sales-text-primary hover:bg-sales-surface-hover"
                      >
                        Open client
                        <ExternalLink size={12} strokeWidth={1.8} />
                      </Link>
                    ) : null}
                    <Link
                      href={`/client/listings/${v.listing_id}`}
                      className="inline-flex h-8 items-center gap-1 rounded-[8px] border border-sales-border px-2.5 text-[12px] font-medium text-sales-text-primary hover:bg-sales-surface-hover"
                    >
                      Open listing
                      <ExternalLink size={12} strokeWidth={1.8} />
                    </Link>
                    {v.status === "scheduled" ? (
                      <button
                        type="button"
                        disabled={busyId === v.id}
                        onClick={() => void completeViewing(v.id)}
                        className="inline-flex h-8 items-center gap-1 rounded-[8px] bg-sales-brand px-2.5 text-[12px] font-semibold text-sales-brand-text disabled:opacity-60"
                      >
                        <Check size={13} strokeWidth={2} />
                        Complete
                      </button>
                    ) : null}
                    {v.feedback_text ? (
                      <button
                        type="button"
                        onClick={() =>
                          setOpenFeedbackId((cur) => (cur === v.id ? null : v.id))
                        }
                        className="inline-flex h-8 items-center gap-1 rounded-[8px] border border-sales-border px-2.5 text-[12px] font-medium text-sales-text-primary hover:bg-sales-surface-hover"
                      >
                        <MessageSquare size={13} strokeWidth={1.8} />
                        View feedback
                      </button>
                    ) : null}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
