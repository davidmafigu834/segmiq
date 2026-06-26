"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

type Row = {
  id: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  source: string | null;
  lifecycle: "lead" | "customer";
  lead_origin: "segmiq" | "client";
  owner: string | null;
  lastTouchedAt: string | null;
};

function initials(n: string | null) {
  return n
    ? n
        .split(" ")
        .map((w) => w[0])
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : "?";
}

function timeAgo(iso: string | null) {
  if (!iso) return "—";
  const day = 86400000;
  const d = Date.now() - new Date(iso).getTime();
  if (d < day) return "today";
  const days = Math.floor(d / day);
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

export function ClientContactsTable({
  defaultLifecycle,
  showLifecycleFilter = false,
  heading,
  subheading,
  hubFilter,
  onClearHubFilter,
}: {
  defaultLifecycle?: "customer";
  showLifecycleFilter?: boolean;
  heading: string;
  subheading: string;
  hubFilter?: string | null;
  onClearHubFilter?: () => void;
}) {
  const [rows, setRows] = useState<Row[]>([]);
  const [q, setQ] = useState("");
  const [lifecycle, setLifecycle] = useState<"all" | "lead" | "customer">(defaultLifecycle ?? "all");
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const fetchPage = useCallback(
    async (p: number, replace: boolean, query: string, life: string, filter: string | null) => {
    const params = new URLSearchParams({ page: String(p), limit: "50" });
    if (life !== "all") params.set("lifecycle", life);
    if (query.trim()) params.set("q", query.trim());
    if (filter) params.set("hubFilter", filter);
    const res = await fetch(`/api/contacts/list?${params}`);
    const data = (await res.json().catch(() => ({}))) as {
      contacts?: Row[];
      total?: number;
      hasMore?: boolean;
    };
    setRows((prev) => (replace ? (data.contacts ?? []) : [...prev, ...(data.contacts ?? [])]));
    setTotal(data.total ?? 0);
    setHasMore(!!data.hasMore);
  },
    []
  );

  useEffect(() => {
    setLoading(true);
    const t = setTimeout(async () => {
      setPage(1);
      await fetchPage(1, true, q, lifecycle, hubFilter ?? null);
      setLoading(false);
    }, 250);
    return () => clearTimeout(t);
  }, [q, lifecycle, hubFilter, fetchPage]);

  async function loadMore() {
    setLoadingMore(true);
    const next = page + 1;
    await fetchPage(next, false, q, lifecycle, hubFilter ?? null);
    setPage(next);
    setLoadingMore(false);
  }

  return (
    <div>
      <div className="mb-4 flex items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl" style={{ fontFamily: "var(--font-instrument-serif)" }}>
            {heading}
          </h1>
          <p className="mt-1 text-[12.5px] text-[var(--text-tertiary)]">
            {loading ? subheading : `${total} ${total === 1 ? "contact" : "contacts"} · ${subheading}`}
          </p>
        </div>
      </div>

      {hubFilter && (
        <div className="mb-3 flex items-center gap-2 rounded-lg border border-[var(--accent)] bg-[rgba(212,255,79,0.06)] px-3 py-2">
          <span className="text-[12.5px] text-[var(--text-secondary)]">
            Filtered by intelligence observation
          </span>
          {onClearHubFilter && (
            <button
              type="button"
              onClick={onClearHubFilter}
              className="ml-auto text-[12px] font-medium text-[var(--accent)] hover:underline"
            >
              Clear
            </button>
          )}
        </div>
      )}

      <div className="mb-3.5 flex flex-wrap gap-2.5">
        <input
          className="input-base min-w-[220px] flex-1"
          placeholder="Search by name or number"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        {showLifecycleFilter && (
          <div className="flex gap-1.5">
            {(["all", "customer", "lead"] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setLifecycle(f)}
                className={`rounded-lg border px-3 py-2 text-[12.5px] font-medium transition ${
                  lifecycle === f
                    ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-foreground)]"
                    : "border-[var(--border)] bg-[var(--bg-quaternary)] text-[var(--text-secondary)]"
                }`}
              >
                {f === "all" ? "All" : f === "customer" ? "Customers" : "Leads"}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface-card)]">
        {loading ? (
          <div className="p-8 text-center text-[13px] text-[var(--text-tertiary)]">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="p-8 text-center text-[13px] text-[var(--text-tertiary)]">
            No contacts yet. They&apos;ll appear here as leads come in.
          </div>
        ) : (
          rows.map((c) => (
            <Link
              key={c.id}
              href={`/client/contacts/${c.id}`}
              className="flex items-center gap-3 border-b border-[var(--border)] px-4 py-3 last:border-b-0 transition hover:bg-[var(--bg-tertiary)]"
            >
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-[var(--border)] bg-[var(--bg-tertiary)] text-[13px] font-semibold text-[var(--text-secondary)]">
                {initials(c.name)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-semibold text-[var(--text-primary)]">
                    {c.name || "Unnamed"}
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10.5px] font-semibold uppercase ${
                      c.lifecycle === "customer"
                        ? "bg-[rgba(212,255,79,0.12)] text-[var(--accent)]"
                        : "bg-white/[0.07] text-[var(--text-secondary)]"
                    }`}
                  >
                    {c.lifecycle === "customer" ? "Customer" : "Lead"}
                  </span>
                </div>
                <div className="truncate text-[12.5px] text-[var(--text-tertiary)]">
                  {c.phone || "no number"}
                </div>
              </div>
              <div className="hidden shrink-0 text-right sm:block">
                <div className="text-[12px] text-[var(--text-secondary)]">{c.source || "—"}</div>
                <div className="mt-0.5 text-[11px] text-[var(--text-tertiary)]">
                  {c.owner || "Unassigned"} · {timeAgo(c.lastTouchedAt)}
                </div>
              </div>
            </Link>
          ))
        )}
      </div>

      {hasMore && !loading && (
        <div className="mt-4 flex justify-center">
          <button
            type="button"
            onClick={loadMore}
            disabled={loadingMore}
            className="btn-ghost px-4 py-2 text-[13px] disabled:opacity-50"
          >
            {loadingMore ? "Loading…" : "Load more"}
          </button>
        </div>
      )}
    </div>
  );
}
