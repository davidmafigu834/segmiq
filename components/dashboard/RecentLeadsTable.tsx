"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Inbox } from "lucide-react";
import { ClientAvatar } from "@/components/ClientAvatar";
import { StatusPill } from "@/components/StatusPill";
import type { RecentLeadRow } from "@/lib/dashboard-data";
import type { LeadSource } from "@/types";
import { formatTimeAgo } from "@/lib/format";
import { ResponsiveTable, type ResponsiveTableColumn } from "@/components/ui/ResponsiveTable";

type Filter = "all" | "facebook" | "landing";

function SourceCell({ source }: { source: LeadSource }) {
  if (source === "FACEBOOK") {
    return (
      <span className="inline-flex items-center gap-1.5 text-[12px] text-ink-secondary">
        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--activity-new)]" />
        Facebook
      </span>
    );
  }
  if (source === "LANDING_PAGE") {
    return (
      <span className="inline-flex items-center gap-1.5 text-[12px] text-ink-secondary">
        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
        Landing
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-[12px] text-ink-secondary">
      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-ink-tertiary" />
      Manual
    </span>
  );
}

export function RecentLeadsTable({
  rows,
  eyebrow = "01 / Activity",
  title = "Recent leads",
  showSourceFilters = true,
  agencyFooter = false,
  leadListPath = "/dashboard/leads",
}: {
  rows: RecentLeadRow[];
  eyebrow?: string;
  title?: string;
  showSourceFilters?: boolean;
  /** Agency dashboard: show “latest 10” + link to all leads instead of a fake pager. */
  agencyFooter?: boolean;
  /** Base path for opening a lead (query `lead` is appended). */
  leadListPath?: string;
}) {
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>("all");

  const filtered = useMemo(() => {
    if (filter === "facebook") return rows.filter((r) => r.source === "FACEBOOK");
    if (filter === "landing") return rows.filter((r) => r.source === "LANDING_PAGE");
    return rows;
  }, [rows, filter]);

  const filters: { id: Filter; label: string }[] = [
    { id: "all", label: "All" },
    { id: "facebook", label: "Facebook" },
    { id: "landing", label: "Landing page" },
  ];

  const columns = useMemo<ResponsiveTableColumn<RecentLeadRow>[]>(
    () => [
      {
        key: "name",
        label: "Name",
        mobilePrimary: true,
        render: (r) => (
          <div className="min-w-0">
            <div className="truncate text-[13px] font-medium text-ink-primary">{r.name ?? "—"}</div>
            <div className="font-mono text-[11px] text-ink-tertiary">{r.phone ?? "—"}</div>
          </div>
        ),
      },
      {
        key: "client",
        label: "Client",
        width: "160px",
        render: (r) => (
          <div className="flex min-w-0 items-center gap-1.5">
            <ClientAvatar name={r.clientName} size={20} />
            <span className="text-[12px] text-ink-primary">{r.clientName}</span>
          </div>
        ),
      },
      {
        key: "source",
        label: "Source",
        width: "140px",
        render: (r) => (
          <div className="flex flex-col gap-0.5">
            <SourceCell source={r.source} />
            {r.budget != null && r.budget !== "" ? (
              <span className="font-mono text-[11px] text-ink-tertiary">{r.budget}</span>
            ) : null}
          </div>
        ),
      },
      {
        key: "status",
        label: "Status",
        width: "110px",
        render: (r) => <StatusPill status={r.status} />,
      },
      {
        key: "assigned",
        label: "Assigned",
        width: "160px",
        render: (r) => (
          <div className="flex min-w-0 items-center gap-2">
            {r.assigneeFullName ? <ClientAvatar name={r.assigneeFullName} size={24} /> : null}
            <span className="text-[12px] text-ink-primary">{r.assigneeFullName ?? "—"}</span>
          </div>
        ),
      },
      {
        key: "time",
        label: "Time",
        width: "80px",
        render: (r) => <span className="font-mono text-[11px] text-ink-tertiary">{formatTimeAgo(r.createdAt)}</span>,
      },
    ],
    []
  );

  function openLead(r: RecentLeadRow) {
    router.push(`${leadListPath}?lead=${r.id}`, { scroll: false });
  }

  return (
    <div>
      <div className="mb-5 flex flex-col gap-4 min-[640px]:flex-row min-[640px]:items-end min-[640px]:justify-between">
        <div>
          <p className="font-mono text-[11px] font-normal uppercase tracking-[0.1em] text-ink-tertiary">{eyebrow}</p>
          <h2 className="mt-1 font-display text-2xl tracking-display text-ink-primary">{title}</h2>
        </div>
        {showSourceFilters ? (
          <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 scrollbar-hide sm:flex-wrap">
            {filters.map((f) => {
              const active = filter === f.id;
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setFilter(f.id)}
                  className={`h-9 shrink-0 rounded-sm px-3 text-[12px] font-medium transition-colors sm:h-8 ${
                    active
                      ? "bg-ink-primary text-white"
                      : "border border-border bg-transparent text-ink-secondary hover:bg-surface-card-alt"
                  }`}
                >
                  {f.label}
                </button>
              );
            })}
          </div>
        ) : null}
      </div>

      {filtered.length === 0 ? (
        <div className="flex h-[200px] flex-col items-center justify-center gap-2 text-center">
          <Inbox className="h-8 w-8 text-ink-tertiary" strokeWidth={1.25} aria-hidden />
          <p className="font-display text-xl tracking-display text-ink-primary">No leads yet</p>
          <p className="text-[14px] text-ink-secondary">New submissions will show up here.</p>
        </div>
      ) : (
        <div className="w-full">
          <ResponsiveTable
            columns={columns}
            rows={filtered}
            rowKey={(r) => r.id}
            onRowClick={openLead}
          />
        </div>
      )}

      {agencyFooter && filtered.length > 0 ? (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-4">
          <span className="text-xs text-ink-tertiary">Showing latest 10 leads</span>
          <Link
            href="/dashboard/leads"
            className="text-sm text-ink-secondary transition-colors hover:text-ink-primary"
          >
            View all leads →
          </Link>
        </div>
      ) : null}
    </div>
  );
}
