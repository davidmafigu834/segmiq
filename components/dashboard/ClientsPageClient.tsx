"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Building2, MoreHorizontal, Search } from "lucide-react";
import { ClientAvatar } from "@/components/ClientAvatar";
import { PlatformStatusBadge } from "@/components/platform/PlatformStatusBadge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/Table";

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

  return (
    <>
      <p className="mb-5 max-w-2xl text-[13px] text-[var(--text-secondary)]">
        Manage every organisation using SegmiQ.
      </p>

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

      {filtered.length === 0 ? (
        <div className="rounded-lg border border-[var(--border)]">
          <EmptyState
            icon={Building2}
            title={query ? `No results for “${query}”` : "No organisations found"}
            description={
              query
                ? "Try another organisation name, ID or industry."
                : "No organisations match your current filters."
            }
            action={
              query || filter !== "all" ? (
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
              ) : null
            }
          />
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
          <Table>
            <TableHeader>
              <TableRow isHeader>
                <TableHead>Organisation</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Industry</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((c) => (
                <TableRow key={c.id} className="group">
                  <TableCell>
                    <Link href={`/dashboard/clients/${c.id}`} className="flex items-center gap-3">
                      <ClientAvatar name={c.name} size="sm" />
                      <span className="min-w-0">
                        <span className="block truncate font-medium text-[var(--text-primary)]">{c.name}</span>
                        <span className="block truncate font-mono text-[11px] text-[var(--text-tertiary)]">
                          {c.id.slice(0, 8)}
                        </span>
                      </span>
                    </Link>
                  </TableCell>
                  <TableCell>
                    <PlatformStatusBadge
                      kind={c.is_active === false ? "suspended" : "active"}
                      label={c.is_active === false ? "Inactive" : "Active"}
                    />
                  </TableCell>
                  <TableCell className="text-[13px] text-[var(--text-secondary)]">
                    {c.agency_managed ? "Managed" : "Self-serve"}
                  </TableCell>
                  <TableCell className="text-[13px] text-[var(--text-secondary)]">
                    {c.industry || "—"}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-[13px] text-[var(--text-secondary)]">
                    {formatDate(c.created_at)}
                  </TableCell>
                  <TableCell>
                    <RowMenu
                      row={c}
                      open={menuId === c.id}
                      onToggle={() => setMenuId(menuId === c.id ? null : c.id)}
                      onClose={() => setMenuId(null)}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </>
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
