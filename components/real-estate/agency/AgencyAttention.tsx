"use client";

/* Hallmark · genre: modern-minimal · macrostructure: Workbench · design-system: design.md · designed-as-app */

import { useMemo, useState } from "react";
import { FileWarning, Handshake, KeyRound, Landmark, UserRoundCog, Wallet } from "lucide-react";
import {
  ReEmptyState,
  ReErrorState,
  ReList,
  ReRowAction,
  ReSection,
  ReSkeletonRows,
  ReStatusBadge,
  ReWorkItem,
  useReFetch,
  type ReFetchState,
} from "@/components/real-estate/ui";
import { cn } from "@/lib/ui/cn";

export type AgencyAttentionItem = { id: string; title: string; reason: string; href: string };
export type AgencyAttentionPayload = { items?: AgencyAttentionItem[] };

type Category = "approvals" | "deals" | "finance" | "team";

const CATEGORY_LABEL: Record<Category, string> = {
  approvals: "Approvals",
  deals: "Deals & documents",
  finance: "Finance",
  team: "Team",
};

/** Per-type cap applied by the attention feed. */
const FEED_TYPE_LIMIT = 20;
const PREVIEW = 6;

const GENERIC_TITLES = new Set(["Mandate", "Commission", "Commission receipt", "Handover", "Transaction", "Listing"]);

type Kind = "mandate" | "listing" | "expiry" | "offer" | "doc" | "pay" | "comm" | "hand" | "txn" | "intro";

function kindOf(id: string): Kind | null {
  const prefix = id.split("-", 1)[0] as Kind;
  return ["mandate", "listing", "expiry", "offer", "doc", "pay", "comm", "hand", "txn", "intro"].includes(prefix) ? prefix : null;
}

function describe(item: AgencyAttentionItem) {
  const kind = kindOf(item.id);
  const recordId = kind ? item.id.slice(kind.length + 1) : "";
  switch (kind) {
    case "mandate":
      return { category: "approvals" as const, icon: <KeyRound />, action: "Review mandate", href: item.href };
    case "listing":
      return { category: "approvals" as const, icon: <KeyRound />, action: "Review listing", href: recordId ? `/client/listings/${recordId}` : item.href };
    case "expiry":
      return { category: "approvals" as const, icon: <KeyRound />, action: "Open mandates", href: item.href };
    case "offer":
      return { category: "deals" as const, icon: <Handshake />, action: "Open offers", href: item.href };
    case "txn":
      return { category: "deals" as const, icon: <Landmark />, action: "Open transaction", href: recordId ? `/client/transactions?open=${recordId}` : item.href };
    case "doc":
      return { category: "deals" as const, icon: <FileWarning />, action: "Review documents", href: item.href };
    case "pay":
      return { category: "finance" as const, icon: <Wallet />, action: "Verify payment", href: item.href };
    case "comm":
      return { category: "finance" as const, icon: <Wallet />, action: "Review commission", href: item.href };
    case "hand":
      return { category: "team" as const, icon: <UserRoundCog />, action: "Open handover", href: item.href };
    case "intro":
      return { category: "approvals" as const, icon: <Handshake />, action: "Review introduction", href: item.href };
    default:
      return { category: "deals" as const, icon: <FileWarning />, action: "Open", href: item.href };
  }
}

export function useAgencyAttention(clientId: string, enabled = true) {
  return useReFetch<AgencyAttentionPayload>(enabled ? `/api/clients/${clientId}/agency?view=attention` : null);
}

export function AgencyAttentionPanel({
  state,
  className,
}: {
  state: ReFetchState<AgencyAttentionPayload>;
  className?: string;
}) {
  const [filter, setFilter] = useState<Category | "all">("all");
  const [showAll, setShowAll] = useState(false);

  const rows = useMemo(() => {
    const items = state.status === "ready" ? state.data.items ?? [] : [];
    return items.map((item) => ({ item, ...describe(item) }));
  }, [state.status, state.data]);

  const counts = useMemo(() => {
    const c: Record<Category, number> = { approvals: 0, deals: 0, finance: 0, team: 0 };
    for (const row of rows) c[row.category] += 1;
    return c;
  }, [rows]);

  const capped = useMemo(() => {
    const byKind = new Map<string, number>();
    for (const row of rows) {
      const kind = kindOf(row.item.id) ?? "other";
      byKind.set(kind, (byKind.get(kind) ?? 0) + 1);
    }
    return [...byKind.values()].some((n) => n >= FEED_TYPE_LIMIT);
  }, [rows]);

  const filtered = filter === "all" ? rows : rows.filter((row) => row.category === filter);
  const shown = showAll ? filtered : filtered.slice(0, PREVIEW);
  const categories = (Object.keys(CATEGORY_LABEL) as Category[]).filter((c) => counts[c] > 0);

  return (
    <ReSection
      id="re-agency-attention"
      title="Management attention"
      description="Approvals, stalled deals and finance items waiting on a manager."
      count={state.status === "ready" ? rows.length : null}
      className={className}
      flush
    >
      {state.status === "loading" ? (
        <ReSkeletonRows rows={3} label="Loading management attention" />
      ) : state.status === "error" ? (
        <ReErrorState onRetry={state.reload} />
      ) : rows.length === 0 ? (
        <ReEmptyState
          title="Nothing is waiting on a manager"
          description="Mandate and listing approvals, unverified payments, stalled transactions and unfinished handovers will appear here."
        />
      ) : (
        <>
          {categories.length > 1 ? (
            <div role="group" aria-label="Filter by type" className="flex gap-1.5 overflow-x-auto px-[var(--re-card-pad,16px)] pb-2">
              {(["all", ...categories] as const).map((c) => {
                const active = filter === c;
                return (
                  <button
                    key={c}
                    type="button"
                    aria-pressed={active}
                    onClick={() => {
                      setFilter(c);
                      setShowAll(false);
                    }}
                    className={cn(
                      "re-focus inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-full border px-3 text-[12px] font-semibold transition-colors",
                      active
                        ? "border-sales-text-primary bg-sales-text-primary text-sales-surface"
                        : "border-sales-border text-sales-text-secondary hover:text-sales-text-primary"
                    )}
                  >
                    {c === "all" ? "All" : CATEGORY_LABEL[c]}
                    <span className="tabular-nums opacity-70">{c === "all" ? rows.length : counts[c]}</span>
                  </button>
                );
              })}
            </div>
          ) : null}
          <ReList label="Items waiting on a manager">
            {shown.map(({ item, category, icon, action, href }) => {
              const record = GENERIC_TITLES.has(item.title) ? null : item.title;
              return (
                <ReWorkItem
                  key={item.id}
                  icon={icon}
                  title={item.reason}
                  reason={record ?? undefined}
                  status={<ReStatusBadge label={CATEGORY_LABEL[category]} tone="neutral" />}
                  action={<ReRowAction label={action} srContext={record ?? item.reason} href={href} />}
                />
              );
            })}
          </ReList>
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-sales-border-subtle px-[var(--re-card-pad,16px)] py-2">
            {filtered.length > PREVIEW ? (
              <button
                type="button"
                aria-expanded={showAll}
                onClick={() => setShowAll((v) => !v)}
                className="re-focus inline-flex min-h-11 items-center rounded-[var(--re-radius-control,8px)] px-2 text-[13px] font-semibold text-sales-text-primary hover:bg-sales-surface-hover sm:min-h-9"
              >
                {showAll ? "Show fewer" : `Show all ${filtered.length}`}
              </button>
            ) : (
              <span />
            )}
            {capped ? (
              <p className="text-[12px] text-sales-text-muted">Up to {FEED_TYPE_LIMIT} items per type are shown here.</p>
            ) : null}
          </div>
        </>
      )}
    </ReSection>
  );
}

/** Self-loading variant kept for existing call sites. */
export function AgencyAttention({ clientId, className }: { clientId: string; className?: string }) {
  const state = useAgencyAttention(clientId);
  return <AgencyAttentionPanel state={state} className={className} />;
}
