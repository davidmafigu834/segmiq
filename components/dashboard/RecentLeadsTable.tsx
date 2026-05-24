"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Users } from "lucide-react";
import { ClientAvatar } from "@/components/ClientAvatar";
import type { RecentLeadRow } from "@/lib/dashboard-data";
import { StatusPill } from "@/components/StatusPill";
import type { LeadSource } from "@/types";
import { formatTimeAgo } from "@/lib/format";
import { ResponsiveTable, type ResponsiveTableColumn } from "@/components/ui/ResponsiveTable";

type Filter = "all" | "facebook" | "landing";

function SourceCell({ source }: { source: LeadSource }) {
  if (source === "FACEBOOK") {
    return (
      <span className="inline-flex items-center gap-1.5 text-[12px] text-[var(--text-secondary)]">
        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--activity-new)]" />
        Facebook
      </span>
    );
  }
  if (source === "LANDING_PAGE") {
    return (
      <span className="inline-flex items-center gap-1.5 text-[12px] text-[var(--text-secondary)]">
        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
        Landing
      </span>
    );
  }
  if (source === "REFERRAL") {
    return (
      <span className="inline-flex items-center gap-1.5 text-[12px] text-[var(--text-secondary)]">
        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-purple-400" />
        Referral
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-[12px] text-[var(--text-secondary)]">
      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--text-tertiary)]" />
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
            <div className="truncate text-[13px] font-medium text-[var(--text-primary)]">{r.name ?? "—"}</div>
            <div className="text-[11px] text-[var(--text-tertiary)]">{r.phone ?? "—"}</div>
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
            <span className="text-[12px] text-[var(--text-primary)]">{r.clientName}</span>
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
              <span className="text-[11px] text-[var(--text-tertiary)]">{r.budget}</span>
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
            <span className="text-[12px] text-[var(--text-primary)]">{r.assigneeFullName ?? "—"}</span>
          </div>
        ),
      },
      {
        key: "time",
        label: "Time",
        width: "80px",
        render: (r) => <span className="text-[11px] text-[var(--text-tertiary)]">{formatTimeAgo(r.createdAt)}</span>,
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
          <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--text-tertiary)]">{eyebrow}</p>
          <h2 className="mt-1 text-[18px] font-semibold text-[var(--text-primary)]">{title}</h2>
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
                  className={`h-7 shrink-0 rounded-md px-3 text-[12px] font-medium transition-colors ${
                    active
                      ? "bg-[var(--bg-quaternary)] text-[var(--text-primary)] border border-[var(--border-strong)]"
                      : "border border-[var(--border)] bg-transparent text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]"
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
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Users className="mb-3 h-8 w-8 text-[var(--text-disabled)]" />
          <p className="mb-1 text-[14px] font-semibold text-[var(--text-secondary)]">No leads yet</p>
          <p className="text-[12px] text-[var(--text-tertiary)]">Leads will appear here when they come in through Facebook, your profile page, or manual entry.</p>
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
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-[var(--border)] pt-4">
          <span className="text-[12px] text-[var(--text-tertiary)]">Showing latest 10 leads</span>
          <Link
            href="/dashboard/leads"
            className="text-[12px] text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
          >
            View all leads →
          </Link>
        </div>
      ) : null}
    </div>
  );
}
