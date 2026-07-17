"use client";

import { useState, useEffect, useCallback } from "react";
import {
  ContactMemoryCard,
  ContactMemoryCardSkeleton,
  type ContactListItem,
} from "@/components/customer-hub/ContactMemoryCard";
import {
  CONTACT_LIFECYCLE_LABELS,
  type ContactLifecycle,
} from "@/lib/customer-hub/lifecycle";

type LifecycleFilter = "all" | ContactLifecycle;

const FILTER_OPTIONS: LifecycleFilter[] = ["all", "cold", "aware", "pipeline", "customer"];

export function ClientContactsTable({
  defaultLifecycle,
  initialLifecycle,
  showLifecycleFilter = false,
  heading,
  subheading,
  hubFilter,
  onClearHubFilter,
  onClearLifecycleFilter,
  hideHeading = false,
  compactCards = false,
  clientDialCode,
}: {
  defaultLifecycle?: ContactLifecycle;
  initialLifecycle?: ContactLifecycle | null;
  showLifecycleFilter?: boolean;
  heading?: string;
  subheading?: string;
  hubFilter?: string | null;
  onClearHubFilter?: () => void;
  onClearLifecycleFilter?: () => void;
  hideHeading?: boolean;
  compactCards?: boolean;
  clientDialCode?: string;
}) {
  const [rows, setRows] = useState<ContactListItem[]>([]);
  const [q, setQ] = useState("");
  const [lifecycle, setLifecycle] = useState<LifecycleFilter>(
    initialLifecycle ?? defaultLifecycle ?? "all"
  );
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    if (initialLifecycle) setLifecycle(initialLifecycle);
  }, [initialLifecycle]);

  const fetchPage = useCallback(
    async (p: number, replace: boolean, query: string, life: LifecycleFilter, filter: string | null) => {
      const params = new URLSearchParams({ page: String(p), limit: "50" });
      if (life !== "all") params.set("lifecycle", life);
      if (query.trim()) params.set("q", query.trim());
      if (filter) params.set("hubFilter", filter);
      const res = await fetch(`/api/contacts/list?${params}`);
      const data = (await res.json().catch(() => ({}))) as {
        contacts?: ContactListItem[];
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

  const activeStageFilter = lifecycle !== "all" ? lifecycle : null;

  return (
    <div>
      {!hideHeading && heading ? (
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
      ) : (
        <p className="mb-4 text-[13px] text-[var(--text-secondary)]">
          {loading ? "Loading contacts…" : `${total} ${total === 1 ? "contact" : "contacts"}`}
        </p>
      )}

      {activeStageFilter && onClearLifecycleFilter && (
        <div className="mb-3 flex items-center gap-2 rounded-lg border border-[var(--accent)] bg-[rgba(212,255,79,0.06)] px-3 py-2">
          <span className="text-[12.5px] text-[var(--text-secondary)]">
            Showing {CONTACT_LIFECYCLE_LABELS[activeStageFilter].toLowerCase()} contacts only
          </span>
          <button
            type="button"
            onClick={onClearLifecycleFilter}
            className="ml-auto text-[12px] font-medium text-[var(--accent)] hover:underline"
          >
            Clear
          </button>
        </div>
      )}

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
          <div className="flex flex-wrap gap-1.5">
            {FILTER_OPTIONS.map((f) => (
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
                {f === "all" ? "All" : CONTACT_LIFECYCLE_LABELS[f]}
              </button>
            ))}
          </div>
        )}
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <ContactMemoryCardSkeleton key={i} compact={compactCards} />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-card)] p-8 text-center text-[13px] text-[var(--text-tertiary)]">
          No contacts yet. They&apos;ll appear here as leads come in.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {rows.map((c) => (
            <ContactMemoryCard
              key={c.id}
              contact={c}
              compact={compactCards}
              clientDialCode={clientDialCode}
            />
          ))}
        </div>
      )}

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
