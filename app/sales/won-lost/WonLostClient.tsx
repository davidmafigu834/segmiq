"use client";

import { useEffect, useMemo, useState } from "react";
import { format, formatDistanceToNow } from "date-fns";
import { Archive } from "lucide-react";
import type { LeadWithClientResponseLimit } from "@/lib/leadStatus";
import type { LeadRow } from "@/types";
import { StatusPill } from "@/components/StatusPill";
import { openLeadPanel } from "@/store/uiStore";
import { LeadDetailPanel } from "../leads/LeadDetailPanel";
import { ResponsiveTable, type ResponsiveTableColumn } from "@/components/ui/ResponsiveTable";

type TabFilter = "all" | "won" | "lost";

function formatDealValue(v: number | null | undefined): string {
  if (v == null) return "—";
  return `$${Number(v).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

function closedWhenLabel(iso: string): string {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  if (diff < 7 * 86400000) return formatDistanceToNow(d, { addSuffix: true });
  return format(d, "MMM d, yyyy");
}

export function WonLostClient({ initialLeads }: { initialLeads: LeadWithClientResponseLimit[] }) {
  const [leads, setLeads] = useState<LeadWithClientResponseLimit[]>(initialLeads);
  const [tab, setTab] = useState<TabFilter>("all");

  useEffect(() => {
    setLeads(initialLeads);
  }, [initialLeads]);

  const closedLeads = useMemo(
    () =>
      leads
        .filter((l) => l.status === "WON" || l.status === "LOST")
        .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()),
    [leads]
  );

  const filtered = useMemo(() => {
    if (tab === "won") return closedLeads.filter((l) => l.status === "WON");
    if (tab === "lost") return closedLeads.filter((l) => l.status === "LOST");
    return closedLeads;
  }, [closedLeads, tab]);

  const columns: ResponsiveTableColumn<LeadWithClientResponseLimit>[] = [
    {
      key: "name",
      label: "Name",
      mobilePrimary: true,
      render: (l) => (
        <div>
          <div className="font-medium text-ink-primary">{l.name}</div>
          <div className="font-mono text-xs text-ink-tertiary">{l.phone ?? "—"}</div>
        </div>
      ),
    },
    {
      key: "project",
      label: "Project type",
      render: (l) => <span className="text-sm text-ink-primary">{l.project_type ?? "—"}</span>,
    },
    {
      key: "value",
      label: "Deal value",
      align: "right",
      render: (l) => (
        <span className="font-mono text-sm tabular-nums text-ink-primary">
          {l.status === "WON" ? formatDealValue(l.deal_value) : "—"}
        </span>
      ),
    },
    {
      key: "status",
      label: "Outcome",
      render: (l) => <StatusPill status={l.status} />,
    },
    {
      key: "closed",
      label: "Closed",
      render: (l) => <span className="text-sm text-ink-secondary">{closedWhenLabel(l.updated_at)}</span>,
    },
    {
      key: "reason",
      label: "Reason",
      mobileHidden: true,
      render: (l) => {
        const lostReason = (l.lost_reason as string | null)?.trim() ?? "";
        const reasonDisplay =
          l.status === "LOST" && lostReason
            ? lostReason.length > 40
              ? `${lostReason.slice(0, 40)}…`
              : lostReason
            : "—";
        return (
          <span className="max-w-[200px] truncate text-xs text-ink-tertiary" title={lostReason}>
            {reasonDisplay}
          </span>
        );
      },
    },
  ];

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center gap-4 border-b border-border">
        {(["all", "won", "lost"] as const).map((t) => (
          <button
            key={t}
            type="button"
            className={`relative pb-3 text-sm font-medium capitalize ${
              tab === t ? "text-ink-primary" : "text-ink-secondary hover:text-ink-primary"
            }`}
            onClick={() => setTab(t)}
          >
            {t === "all" ? "All" : t === "won" ? "Won" : "Lost"}
            {tab === t ? <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--accent)]" /> : null}
          </button>
        ))}
      </div>

      {closedLeads.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16 text-center">
          <Archive className="mb-4 h-10 w-10 text-ink-tertiary" strokeWidth={1.5} />
          <h2 className="font-display text-2xl text-ink-primary">No closed deals yet</h2>
          <p className="mt-2 max-w-sm text-sm text-ink-secondary">Leads you win or lose will appear here.</p>
        </div>
      ) : filtered.length === 0 ? (
        <p className="rounded-xl border border-border bg-surface-card py-10 text-center text-sm text-ink-tertiary">
          No leads in this tab.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-surface-card p-2 md:p-0">
          <ResponsiveTable
            columns={columns}
            rows={filtered}
            rowKey={(l) => l.id}
            onRowClick={(l) => openLeadPanel(l.id)}
          />
        </div>
      )}

      <LeadDetailPanel leads={leads as LeadRow[]} />
    </div>
  );
}
