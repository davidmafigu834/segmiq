"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MoreHorizontal, Search } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { EmptyNote, Fact, Panel, WorkRow } from "@/components/platform/workbench";

export type ClientsPageListRow = {
  id: string;
  name: string;
  industry: string;
  agency_managed: boolean;
  is_active?: boolean;
  created_at?: string | null;
};

type Filter = "all" | "managed" | "self_serve";

function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

export function ClientsPageClient({
  clients,
  loadError = null,
}: {
  clients: ClientsPageListRow[];
  loadError?: string | null;
}) {
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [menuId, setMenuId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return clients.filter((c) => {
      if (filter === "managed" && !c.agency_managed) return false;
      if (filter === "self_serve" && c.agency_managed) return false;
      if (!q) return true;
      return (
        c.name.toLowerCase().includes(q) ||
        c.industry.toLowerCase().includes(q) ||
        c.id.toLowerCase().includes(q)
      );
    });
  }, [clients, filter, query]);

  const managedCount = clients.filter((c) => c.agency_managed).length;
  const selfServeCount = clients.length - managedCount;

  const waiting = clients.find((c) => c.is_active === false) ?? clients.find((c) => c.name.trim().toLowerCase() === "pending setup");

  return (
    <div className="space-y-8">
      <p className="max-w-[62ch] text-[14px] text-[var(--text-secondary)]">
        Open an organisation, then work through its record. Plan and billing stay on that record.
      </p>
      {waiting ? (
        <Fact
          name={waiting.is_active === false ? `${waiting.name} is inactive.` : `${waiting.name} is still pending setup.`}
          detail={waiting.is_active === false ? "Reactivate it from the row menu, or open the record and finish settings." : "The organisation exists. Finish setup from its record."}
          action="Open organisation"
          href={`/dashboard/clients/${waiting.id}`}
        />
      ) : null}

      <div className="mb-4 flex flex-wrap items-center gap-2">
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
              "h-8 rounded-md border px-2.5 text-[12px] font-medium transition-colors",
              filter === f.id
                ? "border-[var(--border-strong)] bg-[var(--bg-tertiary)] text-[var(--text-primary)]"
                : "border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]",
            ].join(" ")}
          >
            {f.label}
          </button>
        ))}
        <div className="relative ml-auto">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--text-tertiary)]" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search organisations..."
            className="h-8 w-52 rounded-md border border-[var(--border)] bg-transparent pl-8 pr-3 text-[12px] text-[var(--text-primary)] outline-none placeholder:text-[var(--text-tertiary)] focus:border-[var(--accent)] sm:w-64"
          />
        </div>
      </div>

      {loadError ? (
        <div className="mb-4 rounded-lg border border-[var(--error-border)] bg-[var(--error-muted)] px-4 py-3 text-[13px] text-[var(--error)]">
          Unable to load organisations. Try again.
          <span className="mt-1 block font-mono text-[11px] opacity-80">{loadError}</span>
        </div>
      ) : null}

      <Panel title="Organisations" count={filtered.length}>
        {filtered.length === 0 ? (
          <EmptyNote
            title={query ? `No results for “${query}”` : "No organisations"}
            detail={query || filter !== "all" ? "Clear the search or the filter." : "Create an organisation from the top bar."}
          />
        ) : (
          <ul>
            {filtered.map((c) => (
              <WorkRow
                key={c.id}
                name={c.name}
                meta={[c.industry || "No industry", c.agency_managed ? "Managed" : "Self-serve"].join(" · ")}
                detail={`${c.is_active === false ? "Inactive" : "Active"} · created ${formatDate(c.created_at)}`}
                mark={c.is_active === false ? "overdue" : c.name.trim().toLowerCase() === "pending setup" ? "today" : "waiting"}
                action="Open"
                href={`/dashboard/clients/${c.id}`}
                extra={
                  <RowMenu
                    row={c}
                    open={menuId === c.id}
                    onToggle={() => setMenuId(menuId === c.id ? null : c.id)}
                    onClose={() => setMenuId(null)}
                  />
                }
              />
            ))}
          </ul>
        )}
      </Panel>
      {query || filter !== "all" ? (
        <Button
          variant="secondary"
          size="sm"
          onClick={() => {
            setQuery("");
            setFilter("all");
          }}
        >
          Clear filters
        </Button>
      ) : null}
    </div>
  );
}

function RowMenu({
  row,
  open,
  onToggle,
  onClose,
}: {
  row: ClientsPageListRow;
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
}) {
  const router = useRouter();
  const ref = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) onClose();
    }
    if (open) document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open, onClose]);

  async function toggleActive() {
    setBusy(true);
    try {
      await fetch(`/api/clients/${row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !(row.is_active !== false) }),
      });
      onClose();
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        className="flex h-8 w-8 items-center justify-center rounded-md text-[var(--text-tertiary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]"
        aria-label={`Actions for ${row.name}`}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onToggle();
        }}
      >
        <MoreHorizontal className="h-4 w-4" strokeWidth={1.5} />
      </button>
      {open ? (
        <div className="absolute right-0 z-20 mt-1 w-48 rounded-md border border-[var(--border)] bg-[var(--surface-dropdown)] py-1 shadow-[var(--shadow-md)]">
          <Link
            href={`/dashboard/clients/${row.id}`}
            className="block px-3 py-1.5 text-[13px] text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]"
            onClick={onClose}
          >
            Open organisation
          </Link>
          <Link
            href={`/dashboard/clients/${row.id}/team`}
            className="block px-3 py-1.5 text-[13px] text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]"
            onClick={onClose}
          >
            Manage users
          </Link>
          <Link
            href={`/dashboard/clients/${row.id}/settings`}
            className="block px-3 py-1.5 text-[13px] text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]"
            onClick={onClose}
          >
            Settings
          </Link>
          <div className="my-1 h-px bg-[var(--border)]" />
          <button
            type="button"
            disabled={busy}
            onClick={() => void toggleActive()}
            className="block w-full px-3 py-1.5 text-left text-[13px] text-[var(--error)] hover:bg-[var(--bg-tertiary)] disabled:opacity-50"
          >
            {row.is_active === false ? "Reactivate organisation" : "Suspend organisation"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
