"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { RefreshCw } from "lucide-react";
import type {
  AttentionPriorityClass,
  SalesAttentionItem,
  TodaysFocusPayload,
} from "@/lib/sales/attention/types";
import type { NewEnquiryAssist } from "@/lib/sales/attention/new-enquiry-assist";
import { attentionTypeLabel, priorityClassLabel } from "@/lib/sales/attention/priority";
import { cn } from "@/lib/ui/cn";
import { Badge } from "@/components/sales/ui";

type Filter = "ALL" | AttentionPriorityClass;

export function TodaysFocusPanel({
  onDraft,
  onPrepareQuote,
  className,
}: {
  onDraft?: (item: SalesAttentionItem) => void;
  onPrepareQuote?: (item: SalesAttentionItem) => void;
  className?: string;
}) {
  const [data, setData] = useState<TodaysFocusPayload | null>(null);
  const [filter, setFilter] = useState<Filter>("ALL");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enrichmentById, setEnrichmentById] = useState<
    Record<string, { customerPosition?: string | null; whatHappened?: string | null; commitment?: string | null }>
  >({});
  const [assistById, setAssistById] = useState<Record<string, NewEnquiryAssist>>({});
  const [draftEdits, setDraftEdits] = useState<Record<string, string>>({});
  const [sendingId, setSendingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/sales/attention/focus?enrich=1");
      const json = (await res.json()) as TodaysFocusPayload & { error?: string };
      if (!res.ok) throw new Error(json.error || "Failed to load");
      setData(json);
      if (!selectedId && json.items[0]) setSelectedId(json.items[0].id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Today's Focus couldn't be refreshed.");
    } finally {
      setLoading(false);
    }
  }, [selectedId]);

  async function enrichSelected(item: SalesAttentionItem) {
    try {
      const res = await fetch("/api/sales/attention/enrich", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId: item.id, kind: "summary" }),
      });
      const json = (await res.json()) as {
        summary?: {
          customerPosition?: string | null;
          whatHappened?: string | null;
          commitment?: string | null;
        };
      };
      if (json.summary) {
        setEnrichmentById((prev) => ({ ...prev, [item.id]: json.summary! }));
      }
    } catch {
      /* keep deterministic whyNow */
    }
  }

  async function loadEnquiryAssist(item: SalesAttentionItem) {
    setActing(true);
    try {
      const res = await fetch("/api/sales/attention/new-enquiry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId: item.id, action: "draft" }),
      });
      const json = (await res.json()) as { assist?: NewEnquiryAssist; error?: string };
      if (!res.ok) throw new Error(json.error || "Draft failed");
      if (json.assist) {
        setAssistById((prev) => ({ ...prev, [item.id]: json.assist! }));
        setDraftEdits((prev) => ({ ...prev, [item.id]: json.assist!.suggestedDraft }));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not draft reply");
    } finally {
      setActing(false);
    }
  }

  async function sendEnquiryDraft(item: SalesAttentionItem) {
    const text = (draftEdits[item.id] || assistById[item.id]?.suggestedDraft || "").trim();
    if (!text) return;
    setSendingId(item.id);
    setError(null);
    try {
      const res = await fetch("/api/sales/attention/new-enquiry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId: item.id, action: "send", text }),
      });
      const json = (await res.json()) as { focus?: TodaysFocusPayload; error?: string };
      if (!res.ok) throw new Error(json.error || "Send failed");
      if (json.focus) setData(json.focus);
      setAssistById((prev) => {
        const next = { ...prev };
        delete next[item.id];
        return next;
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Send failed");
    } finally {
      setSendingId(null);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- initial load only
  }, []);

  const items = useMemo(() => {
    if (!data) return [];
    if (filter === "ALL") return data.items;
    return data.items.filter((i) => i.priorityClass === filter);
  }, [data, filter]);

  const newEnquiries = data?.newEnquiries ?? [];
  const selected = items.find((i) => i.id === selectedId) ?? items[0] ?? null;

  async function mutate(action: "complete" | "snooze" | "dismiss", item: SalesAttentionItem) {
    setActing(true);
    try {
      const res = await fetch("/api/sales/attention/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itemId: item.id,
          action,
          snoozePreset: action === "snooze" ? "tomorrow" : undefined,
          dismissReason: action === "dismiss" ? "OTHER" : undefined,
        }),
      });
      const json = (await res.json()) as { focus?: TodaysFocusPayload; error?: string };
      if (!res.ok) throw new Error(json.error || "Update failed");
      if (json.focus) {
        setData(json.focus);
        setSelectedId(json.focus.items[0]?.id ?? null);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update failed");
    } finally {
      setActing(false);
    }
  }

  if (loading && !data) {
    return (
      <div className={cn("space-y-3 p-4", className)}>
        <div className="shimmer h-6 w-40 rounded" />
        <div className="shimmer h-24 rounded-[12px]" />
        <div className="shimmer h-24 rounded-[12px]" />
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className={cn("p-4", className)}>
        <p className="text-[14px] font-semibold text-sales-text-primary">Today&apos;s Focus</p>
        <p className="mt-2 text-[13px] text-sales-text-secondary">{error}</p>
        <button
          type="button"
          onClick={() => void load()}
          className="mt-3 text-[13px] font-semibold text-sales-brand-fg hover:underline"
        >
          Try again
        </button>
      </div>
    );
  }

  if (!data || data.empty) {
    return (
      <div className={cn("p-4", className)}>
        <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-sales-text-muted">
          Today&apos;s Focus
        </p>
        <p className="mt-2 text-[16px] font-semibold text-sales-text-primary">You&apos;re clear for now</p>
        <p className="mt-2 max-w-lg text-[13px] leading-relaxed text-sales-text-secondary">
          {data?.emptyMessage ||
            "No follow-ups, commitments, or mid-thread replies due. Unread WhatsApp stays in WhatsApp."}
        </p>
        <Link
          href="/sales/pipeline"
          className="mt-4 inline-flex text-[13px] font-semibold text-sales-brand-fg hover:underline"
        >
          Open my Deals
        </Link>
      </div>
    );
  }

  const { summary } = data;
  const filters: Array<{ id: Filter; label: string; count: number }> = [
    { id: "ALL", label: "All", count: summary.total },
    { id: "IMMEDIATE", label: "Immediate", count: summary.immediate },
    { id: "TODAY", label: "Today", count: summary.today },
    { id: "NEEDS_PROGRESS", label: "Needs progress", count: summary.needsProgress },
    { id: "WATCH", label: "Watch", count: summary.watch },
  ];

  return (
    <div className={cn("flex min-h-0 flex-1 flex-col", className)}>
      <div className="shrink-0 border-b border-sales-border px-4 py-3 sm:px-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-sales-text-muted">
              Today&apos;s Focus
            </p>
            <p className="mt-1 text-[16px] font-semibold text-sales-text-primary">
              {summary.total === 0
                ? "No active sales follow-ups"
                : `${summary.total} priorit${summary.total === 1 ? "y" : "ies"} need attention`}
            </p>
            <p className="mt-0.5 text-[12px] text-sales-text-muted">
              Follow-ups & mid-thread work · Last refreshed {data.lastRefreshedLabel || "just now"}
            </p>
          </div>
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="inline-flex h-9 items-center gap-1.5 rounded-[8px] border border-sales-border px-2.5 text-[12px] font-medium text-sales-text-secondary hover:bg-sales-surface"
            aria-label="Refresh priorities"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : undefined} aria-hidden />
            Refresh
          </button>
        </div>
        {summary.total > 0 ? (
          <div className="mt-3 flex gap-1.5 overflow-x-auto pb-0.5">
            {filters.map((f) =>
              f.count > 0 || f.id === "ALL" ? (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setFilter(f.id)}
                  className={cn(
                    "shrink-0 rounded-[999px] border px-2.5 py-1 text-[11px] font-medium",
                    filter === f.id
                      ? "border-sales-brand bg-sales-brand/15 text-sales-text-primary"
                      : "border-sales-border text-sales-text-secondary hover:bg-sales-surface"
                  )}
                >
                  {f.label} {f.count}
                </button>
              ) : null
            )}
          </div>
        ) : null}
        {error ? <p className="mt-2 text-[12px] text-sales-danger">{error}</p> : null}
      </div>

      {summary.total > 0 ? (
        <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[minmax(0,1fr)_280px]">
          <ol className="min-h-0 list-none space-y-0 overflow-y-auto px-2 py-2 sm:px-3">
            {items.map((item, index) => {
              const active = selected?.id === item.id;
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(item.id)}
                    className={cn(
                      "flex w-full gap-3 rounded-[10px] px-3 py-3 text-left transition-colors",
                      active
                        ? "bg-sales-brand/10 ring-1 ring-sales-brand/40"
                        : "hover:bg-sales-surface"
                    )}
                  >
                    <span className="w-6 shrink-0 pt-0.5 text-[12px] font-semibold tabular-nums text-sales-text-muted">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="text-[10px] font-semibold uppercase tracking-[0.06em] text-sales-text-muted">
                          {attentionTypeLabel(item.type)}
                        </span>
                        <Badge
                          tone={
                            item.priorityClass === "IMMEDIATE"
                              ? "danger"
                              : item.priorityClass === "TODAY"
                                ? "warning"
                                : "neutral"
                          }
                          appearance="soft"
                          size="sm"
                        >
                          {priorityClassLabel(item.priorityClass)}
                        </Badge>
                      </span>
                      <span className="mt-1 block text-[14px] font-semibold text-sales-text-primary">
                        {item.customerName || item.title}
                      </span>
                      {item.projectType || item.dealStage ? (
                        <span className="mt-0.5 block truncate text-[12px] text-sales-text-secondary">
                          {[item.projectType, item.dealStage?.replace(/_/g, " ")].filter(Boolean).join(" · ")}
                        </span>
                      ) : null}
                      <span className="mt-1.5 block text-[12px] text-sales-text-secondary">
                        <span className="font-medium text-sales-text-muted">Why now · </span>
                        {item.whyNow}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>

          <aside className="hidden min-h-0 overflow-y-auto border-l border-sales-border p-4 lg:block">
            {selected ? (
              <FocusDetail
                item={selected}
                acting={acting}
                onDraft={() => onDraft?.(selected)}
                onPrepareQuote={() => onPrepareQuote?.(selected)}
                onDone={() => void mutate("complete", selected)}
                onSnooze={() => void mutate("snooze", selected)}
                onDismiss={() => void mutate("dismiss", selected)}
                onEnrich={() => void enrichSelected(selected)}
                enrichment={enrichmentById[selected.id] ?? null}
              />
            ) : (
              <p className="text-[12px] text-sales-text-muted">Select an item</p>
            )}
          </aside>
        </div>
      ) : (
        <div className="px-4 py-3 text-[13px] text-sales-text-secondary sm:px-5">
          {data.emptyMessage ||
            "No overdue follow-ups or mid-thread replies. New enquiries are listed below when you want a draft."}
        </div>
      )}

      {selected && summary.total > 0 ? (
        <div className="border-t border-sales-border p-3 lg:hidden">
          <FocusDetail
            item={selected}
            acting={acting}
            compact
            onDraft={() => onDraft?.(selected)}
            onPrepareQuote={() => onPrepareQuote?.(selected)}
            onDone={() => void mutate("complete", selected)}
            onSnooze={() => void mutate("snooze", selected)}
            onDismiss={() => void mutate("dismiss", selected)}
            onEnrich={() => void enrichSelected(selected)}
            enrichment={enrichmentById[selected.id] ?? null}
          />
        </div>
      ) : null}

      {newEnquiries.length > 0 ? (
        <div className="shrink-0 border-t border-sales-border px-4 py-4 sm:px-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-sales-text-muted">
            New enquiries
          </p>
          <p className="mt-1 text-[13px] text-sales-text-secondary">
            Uncontacted chats WhatsApp already shows as unread. Summarize, draft, then click Send — AI
            sends only when you confirm.
          </p>
          <ul className="mt-3 space-y-3">
            {newEnquiries.slice(0, 8).map((item) => {
              const assist = assistById[item.id];
              return (
                <li
                  key={item.id}
                  className="rounded-[10px] border border-sales-border bg-sales-surface/40 px-3 py-3"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-[14px] font-semibold text-sales-text-primary">
                        {item.customerName || item.title}
                      </p>
                      <p className="mt-0.5 text-[12px] text-sales-text-secondary">
                        {item.subtitle || item.whyNow}
                      </p>
                    </div>
                    {item.leadId ? (
                      <Link
                        href={`/sales/whatsapp?lead=${item.leadId}`}
                        className="shrink-0 text-[12px] font-medium text-sales-text-muted hover:underline"
                      >
                        Open chat
                      </Link>
                    ) : null}
                  </div>
                  {assist ? (
                    <div className="mt-3 space-y-2">
                      <p className="text-[12px] leading-relaxed text-sales-text-secondary">{assist.summary}</p>
                      {assist.customerSaid ? (
                        <p className="text-[12px] italic text-sales-text-muted">
                          They said: “{assist.customerSaid.slice(0, 200)}
                          {assist.customerSaid.length > 200 ? "…" : ""}”
                        </p>
                      ) : null}
                      <label className="block text-[11px] font-semibold uppercase tracking-[0.06em] text-sales-text-muted">
                        Draft reply
                        <textarea
                          value={draftEdits[item.id] ?? assist.suggestedDraft}
                          onChange={(e) =>
                            setDraftEdits((prev) => ({ ...prev, [item.id]: e.target.value }))
                          }
                          rows={4}
                          className="mt-1 w-full rounded-[8px] border border-sales-border bg-sales-bg px-3 py-2 text-[13px] text-sales-text-primary"
                        />
                      </label>
                      <button
                        type="button"
                        disabled={sendingId === item.id}
                        onClick={() => void sendEnquiryDraft(item)}
                        className="rounded-[8px] bg-sales-brand px-3 py-2 text-[12px] font-semibold text-sales-brand-fg disabled:opacity-60"
                      >
                        {sendingId === item.id ? "Sending…" : "Send via WhatsApp"}
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      disabled={acting}
                      onClick={() => void loadEnquiryAssist(item)}
                      className="mt-3 rounded-[8px] bg-sales-brand px-3 py-2 text-[12px] font-semibold text-sales-brand-fg"
                    >
                      Summarize & draft reply
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function FocusDetail({
  item,
  acting,
  compact,
  onDraft,
  onPrepareQuote,
  onDone,
  onSnooze,
  onDismiss,
  onEnrich,
  enrichment,
}: {
  item: SalesAttentionItem;
  acting: boolean;
  compact?: boolean;
  onDraft: () => void;
  onPrepareQuote: () => void;
  onDone: () => void;
  onSnooze: () => void;
  onDismiss: () => void;
  onEnrich?: () => void;
  enrichment?: {
    customerPosition?: string | null;
    whatHappened?: string | null;
    commitment?: string | null;
  } | null;
}) {
  const lastDiscussion =
    enrichment?.customerPosition ||
    enrichment?.whatHappened ||
    (typeof item.metadata.lastDiscussion === "string" ? item.metadata.lastDiscussion : null);

  return (
    <div className={cn("space-y-3", compact && "space-y-2")}>
      {!compact ? (
        <>
          <p className="text-[10px] font-semibold uppercase tracking-[0.06em] text-sales-text-muted">
            Why now
          </p>
          <p className="text-[13px] leading-relaxed text-sales-text-primary">{item.whyNow}</p>
          {lastDiscussion ? (
            <>
              <p className="text-[10px] font-semibold uppercase tracking-[0.06em] text-sales-text-muted">
                Last discussion
              </p>
              <p className="text-[13px] leading-relaxed text-sales-text-secondary">{lastDiscussion}</p>
            </>
          ) : onEnrich ? (
            <button
              type="button"
              onClick={onEnrich}
              className="text-[12px] font-medium text-sales-text-muted hover:text-sales-text-secondary"
            >
              Load conversation context
            </button>
          ) : null}
          <p className="text-[10px] font-semibold uppercase tracking-[0.06em] text-sales-text-muted">
            Suggested next step
          </p>
          <p className="text-[13px] leading-relaxed text-sales-text-primary">
            {item.suggestedActionSummary}
          </p>
          {item.quotationLabel ? (
            <p className="text-[12px] text-sales-text-secondary">Quotation · {item.quotationLabel}</p>
          ) : null}
        </>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {item.actions
          .filter((a) => !["snooze", "done", "not_relevant"].includes(a.kind))
          .slice(0, 4)
          .map((a) => {
            if (a.kind === "draft_message") {
              return (
                <button
                  key={a.kind}
                  type="button"
                  disabled={acting}
                  onClick={onDraft}
                  className="rounded-[8px] bg-sales-brand px-3 py-2 text-[12px] font-semibold text-sales-brand-fg"
                >
                  {a.label}
                </button>
              );
            }
            if (a.kind === "prepare_quotation" || a.kind === "revise_quotation") {
              return (
                <button
                  key={a.kind}
                  type="button"
                  disabled={acting}
                  onClick={onPrepareQuote}
                  className="rounded-[8px] bg-sales-brand px-3 py-2 text-[12px] font-semibold text-sales-brand-fg"
                >
                  {a.label}
                </button>
              );
            }
            if (a.href) {
              return (
                <Link
                  key={a.kind}
                  href={a.href}
                  className="rounded-[8px] border border-sales-border px-3 py-2 text-[12px] font-medium text-sales-text-secondary hover:bg-sales-surface"
                >
                  {a.label}
                </Link>
              );
            }
            return null;
          })}
      </div>

      <div className="flex flex-wrap gap-3 pt-1 text-[12px]">
        <button
          type="button"
          disabled={acting}
          onClick={onSnooze}
          className="font-medium text-sales-text-muted hover:text-sales-text-secondary"
        >
          Snooze
        </button>
        <button
          type="button"
          disabled={acting}
          onClick={onDone}
          className="font-medium text-sales-text-muted hover:text-sales-text-secondary"
        >
          Done
        </button>
        <button
          type="button"
          disabled={acting}
          onClick={onDismiss}
          className="font-medium text-sales-text-muted hover:text-sales-text-secondary"
        >
          Not relevant
        </button>
      </div>
    </div>
  );
}
