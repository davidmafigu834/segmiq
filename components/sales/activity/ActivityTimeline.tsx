"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityItem } from "@/components/sales/activity/ActivityItem";
import {
  ActivityComposer,
  ActivityTimelineEmpty,
  ActivityTimelineFilters,
} from "@/components/sales/activity/ActivityComposer";
import { PinnedActivitySection } from "@/components/sales/activity/PinnedActivitySection";
import { groupActivitiesByDay } from "@/lib/activity/date-groups";
import type { ActivityFilterCategory, ActivityTimelineItem, LeadTimelineQueryResult } from "@/lib/activity/types";
import { Button, ErrorState, InlineLoading } from "@/components/sales/ui";
import { cn } from "@/lib/ui/cn";

function useDebounced<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

export function ActivityTimeline({
  leadId,
  canCompose = true,
  canPin = true,
  className,
}: {
  leadId: string;
  canCompose?: boolean;
  canPin?: boolean;
  className?: string;
}) {
  const [filter, setFilter] = useState<ActivityFilterCategory>("all");
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounced(search, 300);
  const [items, setItems] = useState<ActivityTimelineItem[]>([]);
  const [pinned, setPinned] = useState<ActivityTimelineItem[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const load = useCallback(
    async (opts?: { append?: boolean; nextCursor?: string | null }) => {
      const append = opts?.append ?? false;
      if (append) setLoadingMore(true);
      else setLoading(true);
      setError(false);

      const params = new URLSearchParams();
      params.set("limit", "30");
      if (filter !== "all") params.set("filter", filter);
      if (debouncedSearch.trim()) params.set("search", debouncedSearch.trim());
      if (append && opts?.nextCursor) params.set("cursor", opts.nextCursor);

      try {
        const res = await fetch(`/api/leads/${leadId}/timeline?${params.toString()}`);
        if (!res.ok) throw new Error("fetch failed");
        const data = (await res.json()) as LeadTimelineQueryResult;
        setPinned(data.pinned ?? []);
        setItems((prev) => (append ? [...prev, ...data.items] : data.items));
        setCursor(data.nextCursor);
        setHasMore(data.hasMore);
      } catch {
        setError(true);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [leadId, filter, debouncedSearch]
  );

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  const groups = useMemo(() => groupActivitiesByDay(items), [items]);

  async function pinItem(item: ActivityTimelineItem) {
    if (item.sourceType !== "LEAD_EVENT") return;
    const res = await fetch(`/api/leads/${leadId}/timeline/${item.sourceId}/pin`, { method: "POST" });
    if (res.ok) setRefreshKey((k) => k + 1);
  }

  async function unpinItem(item: ActivityTimelineItem) {
    if (item.sourceType !== "LEAD_EVENT") return;
    const res = await fetch(`/api/leads/${leadId}/timeline/${item.sourceId}/pin`, { method: "DELETE" });
    if (res.ok) setRefreshKey((k) => k + 1);
  }

  function refresh() {
    setRefreshKey((k) => k + 1);
  }

  const filtered = filter !== "all" || debouncedSearch.trim().length > 0;

  return (
    <div className={cn("flex flex-col gap-4 px-3 py-3 sm:px-4", className)}>
      {canCompose ? <ActivityComposer leadId={leadId} onSaved={refresh} /> : null}

      <ActivityTimelineFilters
        filter={filter}
        onFilterChange={setFilter}
        search={search}
        onSearchChange={setSearch}
        onClearFilters={() => {
          setFilter("all");
          setSearch("");
        }}
      />

      {loading ? (
        <InlineLoading label="Loading timeline…" className="py-8" />
      ) : error ? (
        <ErrorState
          title="Unable to load timeline"
          description="We couldn't retrieve activity for this lead."
          onRetry={refresh}
          size="compact"
        />
      ) : (
        <>
          <PinnedActivitySection
            items={pinned}
            onPin={pinItem}
            onUnpin={unpinItem}
            canPin={canPin}
          />

          {items.length === 0 ? (
            <ActivityTimelineEmpty
              filtered={filtered}
              onClearFilters={() => {
                setFilter("all");
                setSearch("");
              }}
            />
          ) : (
            <ol className="relative list-none space-y-0 p-0">
              {groups.map((group) => (
                <li key={group.key} className="mb-4 last:mb-0">
                  <h2 className="sticky top-0 z-[1] mb-2 bg-sales-surface/95 py-1 text-[11px] font-semibold uppercase tracking-wide text-sales-text-muted backdrop-blur-sm">
                    {group.label}
                    {group.count > 1 ? (
                      <span className="ml-1.5 tabular-nums text-sales-text-muted">· {group.count}</span>
                    ) : null}
                  </h2>
                  <div className="relative pl-1">
                    <span
                      className="absolute bottom-2 left-[15px] top-2 w-px bg-sales-border-subtle"
                      aria-hidden
                    />
                    <ul className="list-none space-y-0 p-0">
                      {group.items.map((item) => (
                        <li key={item.id} className="relative pl-9">
                          <ActivityItem
                            item={item}
                            onPin={pinItem}
                            onUnpin={unpinItem}
                            canPin={canPin}
                          />
                        </li>
                      ))}
                    </ul>
                  </div>
                </li>
              ))}
            </ol>
          )}

          {hasMore ? (
            <div className="flex justify-center pt-2">
              <Button
                variant="secondary"
                size="sm"
                disabled={loadingMore}
                onClick={() => void load({ append: true, nextCursor: cursor })}
              >
                {loadingMore ? "Loading…" : "Load earlier activity"}
              </Button>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
