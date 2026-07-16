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
import { EmptyState, SegmentedTabs } from "@/components/ui";

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
      <SegmentedTabs
        className="mb-6"
        aria-label="Filter closed leads"
        value={tab}
        onValueChange={(value) => setTab(value as TabFilter)}
        tabs={[
          { value: "all", label: "All" },
          { value: "won", label: "Won" },
          { value: "lost", label: "Lost" },
        ]}
      />

      {closedLeads.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-surface-card">
          <EmptyState icon={Archive} title="No closed deals yet" description="Leads you win or lose will appear here." />
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-lg border border-border bg-surface-card">
          <EmptyState title="No leads in this view" description="Choose another outcome to see closed leads." />
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border bg-surface-card p-2 md:p-0">
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
