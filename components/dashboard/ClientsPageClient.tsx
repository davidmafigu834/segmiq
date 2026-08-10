"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ClientAvatar } from "@/components/ClientAvatar";
import { NewClientButton } from "@/components/dashboard/NewClientButton";

export type ClientsPageListRow = {
  id: string;
  name: string;
  industry: string;
  agency_managed: boolean;
};

type Filter = "all" | "managed" | "self_serve";

export function ClientsPageClient({
  clients,
  loadError = null,
}: {
  clients: ClientsPageListRow[];
  loadError?: string | null;
}) {
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return clients.filter((c) => {
      if (filter === "managed" && !c.agency_managed) return false;
      if (filter === "self_serve" && c.agency_managed) return false;
      if (!q) return true;
      return c.name.toLowerCase().includes(q) || c.industry.toLowerCase().includes(q);
    });
  }, [clients, filter, query]);

  const managedCount = clients.filter((c) => c.agency_managed).length;
  const selfServeCount = clients.length - managedCount;

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {(
            [
              { id: "all" as const, label: `All (${clients.length})` },
              { id: "managed" as const, label: `Managed (${managedCount})` },
              { id: "self_serve" as const, label: `Self-serve (${selfServeCount})` },
            ] as const
          ).map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              className={[
                "rounded-md border px-3 py-1.5 text-[12px] font-medium transition-colors",
                filter === f.id
                  ? "border-[var(--accent)] bg-[var(--accent-muted)] text-[var(--ag-text-primary)]"
                  : "border-[var(--ag-border)] bg-[var(--surface-card)] text-[var(--ag-text-secondary)] hover:text-[var(--ag-text-primary)]",
              ].join(" ")}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search clients…"
            className="h-9 w-44 rounded-md border border-[var(--ag-border)] bg-[var(--surface-card)] px-3 text-[12px] text-[var(--ag-text-primary)] outline-none placeholder:text-[var(--ag-text-tertiary)] focus:border-[var(--accent)] sm:w-56"
          />
          <NewClientButton />
        </div>
      </div>
      {loadError ? (
        <p className="mb-4 text-sm text-red-600">Couldn’t load clients: {loadError}</p>
      ) : null}
      <div className="grid gap-4 md:grid-cols-2 layout:grid-cols-3">
        {filtered.map((c) => (
          <Link
            key={c.id}
            href={`/dashboard/clients/${c.id}`}
            className="ag-card-hover group flex items-center gap-4 border border-[var(--ag-border)] bg-surface-card p-5 rounded-lg"
          >
            <ClientAvatar name={c.name} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <div
                  className="truncate text-[13px] font-medium text-[var(--ag-text-primary)]"
                  style={{ fontFamily: "var(--ag-font-body)" }}
                >
                  {c.name}
                </div>
                <span
                  className={[
                    "shrink-0 rounded px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.08em]",
                    c.agency_managed
                      ? "bg-[var(--accent-muted)] text-[var(--ag-text-primary)]"
                      : "bg-[var(--surface-card-alt)] text-[var(--ag-text-tertiary)]",
                  ].join(" ")}
                >
                  {c.agency_managed ? "Managed" : "Self-serve"}
                </span>
              </div>
              <div
                className="truncate text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--ag-text-tertiary)]"
                style={{ fontFamily: "var(--ag-font-body)" }}
              >
                {c.industry}
              </div>
            </div>
          </Link>
        ))}
      </div>
      {filtered.length === 0 ? (
        <p className="mt-8 text-sm text-[var(--ag-text-secondary)]">No clients in this filter.</p>
      ) : null}
    </>
  );
}
