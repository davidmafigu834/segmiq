"use client";

import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { isLeadSlow } from "@/lib/leadStatus";
import type { ActivePipelineLead } from "@/lib/client-active-pipeline";
import type { LeadStatus, LeadSource } from "@/types";
import { ClientAvatar } from "@/components/ClientAvatar";
import { useMediaQuery } from "@/lib/hooks/useMediaQuery";

const COLS = ["NEW", "CONTACTED", "NEGOTIATING", "PROPOSAL_SENT"] as const satisfies readonly LeadStatus[];
type KanbanCol = (typeof COLS)[number];

const COL_LABEL: Record<KanbanCol, string> = {
  NEW: "New",
  CONTACTED: "Contacted",
  NEGOTIATING: "Negotiating",
  PROPOSAL_SENT: "Proposal",
};

const COL_DOT: Record<KanbanCol, string> = {
  NEW: "var(--info)",
  CONTACTED: "var(--success)",
  NEGOTIATING: "var(--warning)",
  PROPOSAL_SENT: "#8b5cf6",
};

const COL_ACCENT: Record<string, string> = {
  NEW: "border-t-[var(--info)]",
  CONTACTED: "border-t-[var(--success)]",
  NEGOTIATING: "border-t-[var(--warning)]",
  PROPOSAL_SENT: "border-t-violet-500",
};

function SourceDot({ source }: { source: LeadSource }) {
  if (source === "FACEBOOK") return <span className="h-2 w-2 shrink-0 rounded-full bg-[var(--info)]" />;
  if (source === "LANDING_PAGE") return <span className="h-2 w-2 shrink-0 rounded-full bg-[var(--accent)]" />;
  return <span className="h-2 w-2 shrink-0 rounded-full bg-ink-tertiary" />;
}

export function ClientReadOnlyKanban({
  leads,
  onOpenLead,
}: {
  leads: ActivePipelineLead[];
  onOpenLead: (leadId: string) => void;
}) {
  const isMobile = useMediaQuery("(max-width: 1023px)");
  const [activeCol, setActiveCol] = useState<KanbanCol>("NEW");
  const [touchStartX, setTouchStartX] = useState<number | null>(null);

  const grouped = COLS.map((col) => ({
    col,
    items: leads.filter((l) => l.status === col),
  }));

  function handleTouchStart(e: React.TouchEvent) {
    setTouchStartX(e.touches[0].clientX);
  }

  function handleTouchEnd(e: React.TouchEvent) {
    if (touchStartX === null) return;
    const deltaX = e.changedTouches[0].clientX - touchStartX;
    const threshold = 60;
    if (Math.abs(deltaX) < threshold) {
      setTouchStartX(null);
      return;
    }
    const idx = COLS.indexOf(activeCol);
    if (deltaX < 0 && idx < COLS.length - 1) setActiveCol(COLS[idx + 1]);
    if (deltaX > 0 && idx > 0) setActiveCol(COLS[idx - 1]);
    setTouchStartX(null);
  }

  if (isMobile) {
    const active = grouped.find((g) => g.col === activeCol);
    return (
      <div>
        <div className="flex gap-1 overflow-x-auto border-b border-border pb-3 scrollbar-hide">
          {grouped.map(({ col, items }) => {
            const on = activeCol === col;
            return (
              <button
                key={col}
                type="button"
                onClick={() => setActiveCol(col)}
                className={[
                  "flex h-8 shrink-0 items-center gap-2 whitespace-nowrap rounded-md px-3 text-xs",
                  on ? "bg-surface-sidebar text-[var(--text-on-dark)]" : "bg-surface-card-alt text-ink-secondary",
                ].join(" ")}
              >
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: COL_DOT[col] }} />
                <span className="uppercase tracking-wide">{COL_LABEL[col]}</span>
                <span className="font-mono tabular-nums opacity-70">{items.length}</span>
              </button>
            );
          })}
        </div>
        <div className="pt-4" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
          {active && active.items.length > 0 ? (
            <div className="space-y-3">
              {active.items.map((l) => {
                const slow = l.clients != null && isLeadSlow(l.status, l.created_at, l.clients.response_time_limit_hours);
                return (
                  <button
                    key={l.id}
                    type="button"
                    className={`w-full border border-border bg-surface-card p-3.5 text-left active:scale-[0.98] ${
                      slow ? "border-l-[3px] border-l-[var(--danger)]" : ""
                    }`}
                    onClick={() => onOpenLead(l.id)}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <SourceDot source={l.source} />
                      {l.assigneeName ? (
                        <div className="flex shrink-0 items-center gap-1.5">
                          <ClientAvatar name={l.assigneeName} size="sm" />
                          <span className="max-w-[120px] truncate text-[11px] text-ink-tertiary sm:max-w-[100px]">{l.assigneeName}</span>
                        </div>
                      ) : (
                        <span className="text-[11px] text-ink-tertiary">—</span>
                      )}
                    </div>
                    <div className="mt-2 text-sm font-medium leading-snug text-ink-primary">{l.name}</div>
                    <div className="mt-1 font-mono text-xs text-ink-tertiary">{l.phone}</div>
                    <div className="my-3 h-px bg-border" />
                    <div className="text-sm text-ink-secondary">
                      {l.budget ?? "—"} · {l.project_type ?? "Project"}
                    </div>
                    <div className="mt-3">
                      <span className="rounded-sm bg-surface-card-alt px-2 py-0.5 font-mono text-[10px] text-ink-tertiary">
                        {formatDistanceToNow(new Date(l.created_at), { addSuffix: true })}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="rounded-md border border-dashed border-border bg-surface-card-alt px-4 py-8 text-center text-sm text-ink-tertiary">
              No leads in {COL_LABEL[activeCol]}.
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex snap-x snap-mandatory gap-5 overflow-x-auto pb-4">
      {grouped.map(({ col, items }) => (
        <div key={col} className="w-[280px] shrink-0 snap-start rounded-sm border border-border bg-transparent sm:w-[320px]">
          <div className={`border-t-2 ${COL_ACCENT[col] ?? "border-t-border"} px-1 pb-2 pt-3`}>
            <div className="flex items-center justify-between px-2">
              <span className="font-mono text-[11px] uppercase tracking-wide text-ink-tertiary">
                {col.replace("_", " ")}
              </span>
              <span className="rounded-sm bg-surface-card-alt px-2 py-0.5 font-mono text-[11px] text-ink-secondary">
                {items.length}
              </span>
            </div>
          </div>
          <div className="space-y-3 px-2 pb-3">
            {items.map((l) => {
              const slow = l.clients != null && isLeadSlow(l.status, l.created_at, l.clients.response_time_limit_hours);
              return (
                <button
                  key={l.id}
                  type="button"
                  className={`w-full cursor-pointer border border-border bg-surface-card p-4 text-left transition-colors hover:bg-surface-card-alt ${
                    slow ? "border-l-[3px] border-l-[var(--danger)]" : ""
                  }`}
                  onClick={() => onOpenLead(l.id)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <SourceDot source={l.source} />
                    {l.assigneeName ? (
                      <div className="flex shrink-0 items-center gap-1.5">
                        <ClientAvatar name={l.assigneeName} size="sm" />
                        <span className="max-w-[120px] truncate text-[11px] text-ink-tertiary sm:max-w-[100px]">{l.assigneeName}</span>
                      </div>
                    ) : (
                      <span className="text-[11px] text-ink-tertiary">—</span>
                    )}
                  </div>
                  <div className="mt-2 text-sm font-medium leading-snug text-ink-primary">{l.name}</div>
                  <div className="mt-1 font-mono text-xs text-ink-tertiary">{l.phone}</div>
                  <div className="my-3 h-px bg-border" />
                  <div className="text-sm text-ink-secondary">
                    {l.budget ?? "—"} · {l.project_type ?? "Project"}
                  </div>
                  <div className="mt-3">
                    <span className="rounded-sm bg-surface-card-alt px-2 py-0.5 font-mono text-[10px] text-ink-tertiary">
                      {formatDistanceToNow(new Date(l.created_at), { addSuffix: true })}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
