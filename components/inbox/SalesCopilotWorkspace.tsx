"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";
import { PremiumSheet } from "@/components/sales/PremiumSheet";
import { customerDraft } from "@/lib/sales-copilot/draft";
import { readableCopilotSummary } from "@/lib/sales-copilot/summary";
import type { CopilotWorkView } from "@/lib/sales-copilot/types";

export const SALES_COPILOT_DRAFT_EVENT = "segmiq:sales-copilot-draft";

type Payload = {
  analysis: { status: string; summary: string | null; error: string | null };
  items: CopilotWorkView[];
};

export function useSalesCopilot(leadId: string | null) {
  const [data, setData] = useState<Payload | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!leadId) return;
    try {
      const res = await fetch(`/api/sales/copilot/conversations/${leadId}`, { cache: "no-store" });
      if (!res.ok) return;
      setData((await res.json()) as Payload);
    } catch {
      setData({
        analysis: {
          status: "failed",
          summary: "Sales Copilot could not be loaded. Chat and manual tasks still work.",
          error: "unavailable",
        },
        items: [],
      });
    }
  }, [leadId]);

  useEffect(() => {
    setData(null);
    setNotice(null);
    void load();
    if (!leadId) return;
    const timer = window.setInterval(() => void load(), 20000);
    return () => window.clearInterval(timer);
  }, [leadId, load]);

  const act = useCallback(
    async (itemId: string, body: Record<string, unknown>) => {
      setBusy(true);
      setNotice(null);
      try {
        const res = await fetch(`/api/sales/copilot/work-items/${itemId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const json = (await res.json().catch(() => ({}))) as { error?: string };
        if (!res.ok) setNotice(json.error ?? "That action was not completed.");
        await load();
        return res.ok;
      } finally {
        setBusy(false);
      }
    },
    [load]
  );

  return { data, busy, notice, reload: load, act };
}

function quoteReady(item: CopilotWorkView) {
  return Boolean(
    item.linkedQuotationId &&
      item.executionStatus === "succeeded" &&
      (item.actionType === "quotation_draft" || item.actionType === "send_quotation")
  );
}

function needsDetails(item: CopilotWorkView) {
  return (
    item.actionType === "listing_shortlist" ||
    item.actionType === "quotation_choice" ||
    item.reviewStatus === "stale" ||
    (item.actionType === "appointment" && !item.proposedAt) ||
    item.missing.length > 0
  );
}

function knownValues(item: CopilotWorkView): Array<{ key: string; value: string }> {
  const known = item.payload.known;
  if (!Array.isArray(known)) return [];
  return known.flatMap((row) => {
    if (!row || typeof row !== "object") return [];
    const value = "value" in row ? row.value : null;
    const key = "key" in row ? row.key : value;
    if (typeof value !== "string" || !value.trim()) return [];
    return [{ key: String(key), value }];
  });
}

function datetimeLocalValue(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function usesSchedule(item: CopilotWorkView) {
  return (
    item.actionType === "update_reminder" ||
    item.actionType === "create_reminder" ||
    item.actionType === "customer_checkin" ||
    item.actionType === "contact_later" ||
    item.actionType === "appointment" ||
    item.linkedFollowUp
  );
}

function statusLabel(item: CopilotWorkView, analysisStatus?: string) {
  if (item.executionStatus === "failed") return "Failed";
  if (item.executionStatus === "running") return "Working";
  if (item.reviewStatus === "stale") return "Out of date";
  if (item.queue === "needs_review") return "Needs review";
  if (item.queue === "waiting") return "Waiting";
  if (analysisStatus === "pending") return "Reading";
  return "To do";
}

export function priorityWorkItem(items: CopilotWorkView[]): CopilotWorkView | null {
  const rank = { high: 0, medium: 1, low: 2 };
  const actionable = items.filter((item) => item.payload.onDemand !== true && item.reviewStatus !== "dismissed");
  return (
    [...actionable].sort((left, right) => {
      const priority = rank[left.priority] - rank[right.priority];
      if (priority !== 0) return priority;
      return (right.evidence[0]?.at ?? "").localeCompare(left.evidence[0]?.at ?? "");
    })[0] ?? null
  );
}

const cardButton =
  "inline-flex h-11 items-center rounded-[10px] px-3 text-[14px] font-semibold";
const cardPrimary = `${cardButton} bg-sales-brand text-sales-brand-text disabled:opacity-50`;
const cardSecondary = `${cardButton} border border-sales-border bg-transparent text-sales-text-primary`;

export function SalesCopilotCard({
  item,
  analysisStatus,
  keyboardOpen,
  busy,
  onOpen,
  onAct,
  onDraft,
}: {
  item: CopilotWorkView | null;
  analysisStatus?: string;
  keyboardOpen: boolean;
  busy: boolean;
  onOpen: () => void;
  onAct: (item: CopilotWorkView, body: Record<string, unknown>) => void;
  onDraft: (text: string) => void;
}) {
  const [userCollapsed, setUserCollapsed] = useState(false);
  useEffect(() => {
    setUserCollapsed(false);
  }, [item?.id]);

  if (!item && analysisStatus === "pending") {
    return (
      <div className="wa-copilot-card mx-3 mb-2 rounded-[14px] border border-sales-border border-l-[3px] border-l-sales-brand bg-sales-surface-subtle px-3 py-2.5 min-[1100px]:!hidden" role="status">
        <p className="text-[12px] font-semibold text-sales-text-secondary">Sales Copilot</p>
        <p className="mt-1 text-[14px] leading-5 text-sales-text-primary">Reading conversation…</p>
        <div className="mt-2 h-[3px] overflow-hidden rounded-full bg-sales-border" aria-hidden>
          <div className="h-full w-1/3 animate-pulse rounded-full bg-sales-brand" />
        </div>
      </div>
    );
  }
  if (!item && analysisStatus === "failed") {
    return (
      <div className="wa-copilot-card mx-3 mb-2 rounded-[14px] border border-sales-border bg-sales-surface-subtle px-3 py-2.5 min-[1100px]:!hidden" role="status">
        <p className="text-[12px] font-semibold text-sales-text-secondary">Sales Copilot</p>
        <p className="mt-1 text-[14px] leading-5 text-sales-text-primary">
          Sales Copilot could not read the latest messages. Chat and your tasks still work.
        </p>
      </div>
    );
  }
  if (!item) return null;

  const ready = quoteReady(item);
  const quoteHref = ready && item.linkedQuotationId ? `/sales/quotes/${item.linkedQuotationId}` : null;
  const detailsFirst = needsDetails(item) || item.actionType === "quotation_missing";
  const collapsed = keyboardOpen || userCollapsed;

  if (collapsed) {
    return (
      <div className="wa-copilot-card mx-3 mb-2 flex min-h-11 items-center gap-2 rounded-[12px] border border-sales-border bg-sales-surface-subtle px-3 min-[1100px]:!hidden">
        <button
          type="button"
          className="min-w-0 flex-1 truncate py-2 text-left text-[13px] font-medium text-sales-text-primary"
          onClick={() => {
            if (keyboardOpen) onOpen();
            else setUserCollapsed(false);
          }}
        >
          {item.title}
        </button>
        <button type="button" onClick={onOpen} className="shrink-0 text-[13px] font-semibold text-sales-text-primary">
          {item.primaryLabel}
        </button>
      </div>
    );
  }

  return (
    <section aria-label="Sales Copilot" className="wa-copilot-card mx-3 mb-2 rounded-[14px] border border-sales-border border-l-[3px] border-l-sales-brand bg-sales-surface-subtle px-3 py-3 min-[1100px]:!hidden">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[12px] font-semibold text-sales-text-secondary">Sales Copilot</p>
        <button
          type="button"
          aria-label="Collapse Sales Copilot"
          onClick={() => setUserCollapsed(true)}
          className="inline-flex h-11 w-11 items-center justify-center rounded-full text-sales-text-secondary"
        >
          <ChevronDown size={16} />
        </button>
      </div>
      <h2 className="text-[16px] font-semibold leading-5 text-sales-text-primary">{item.title}</h2>
      <p className="mt-1 line-clamp-2 text-[14px] leading-5 text-sales-text-secondary">{item.explanation}</p>
      {item.executionError ? <p className="mt-1 text-[13px] leading-5 text-sales-danger">{item.executionError}</p> : null}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {quoteHref ? (
          <a href={quoteHref} className={cardPrimary}>
            Review draft
          </a>
        ) : (
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              if (detailsFirst || item.executionStatus === "running") {
                onOpen();
                return;
              }
              if (item.actionType === "answer_question") {
                onDraft(customerDraft(item));
                return;
              }
              onAct(item, { action: item.executionStatus === "failed" ? "retry" : "approve" });
            }}
            className={cardPrimary}
          >
            {item.executionStatus === "failed" ? "Retry" : item.primaryLabel}
          </button>
        )}
        {quoteHref ? (
          <a href={quoteHref} className={cardSecondary}>
            Edit items
          </a>
        ) : item.actionType === "contact_later" ? (
          <button type="button" onClick={onOpen} className={cardSecondary}>
            Change date
          </button>
        ) : item.linkedFollowUp && item.primaryLabel !== "Change time" ? (
          <button type="button" onClick={onOpen} className={cardSecondary}>
            Change time
          </button>
        ) : null}
      </div>
    </section>
  );
}

export function SalesCopilotSheet({
  open,
  items,
  summary,
  busy,
  notice,
  onClose,
  onAct,
  onDraft,
}: {
  open: boolean;
  items: CopilotWorkView[];
  summary: string | null;
  busy: boolean;
  notice: string | null;
  onClose: () => void;
  onAct: (item: CopilotWorkView, body: Record<string, unknown>) => void;
  onDraft: (text: string) => void;
}) {
  const [times, setTimes] = useState<Record<string, string>>({});
  const [snoozeFor, setSnoozeFor] = useState<string | null>(null);
  const [snoozeUntil, setSnoozeUntil] = useState("");
  const [evidenceFor, setEvidenceFor] = useState<string | null>(null);
  void summary;
  if (!open) return null;
  const pendingCount = items.length;
  return (
    <PremiumSheet
      title="Sales Copilot"
      description={pendingCount ? `${pendingCount} ${pendingCount === 1 ? "item" : "items"} to review` : "Nothing is waiting"}
      onClose={onClose}
      closeDisabled={busy}
      labelledBy="sales-copilot-title"
      maxWidthClass="max-w-lg"
      className="wa-copilot-sheet"
    >
      {notice ? (
        <p role="alert" className="mb-3 text-[13px] text-sales-danger">
          {notice}
        </p>
      ) : null}
      {items.length === 0 ? (
        <p className="text-[14px] leading-5 text-sales-text-secondary">No actions are waiting on this conversation.</p>
      ) : (
        <ul className="space-y-3">
          {items.map((item) => {
            const ready = quoteReady(item);
            const scheduled = usesSchedule(item);
            const when = times[item.id] ?? datetimeLocalValue(item.proposedAt);
            return (
              <li key={item.id} className="rounded-[12px] border border-sales-border p-3">
                <p className="text-[12px] font-medium text-sales-text-muted">{statusLabel(item)}</p>
                <p className="mt-1 text-[16px] font-semibold leading-5 text-sales-text-primary">{item.title}</p>
                <p className="mt-1 text-[14px] leading-5 text-sales-text-secondary">{item.explanation}</p>
                {item.evidence[0]?.text ? (
                  <div className="mt-2">
                    <button
                      type="button"
                      className="min-h-11 text-left text-[13px] font-semibold text-sales-text-primary"
                      aria-expanded={evidenceFor === item.id}
                      onClick={() => setEvidenceFor((current) => (current === item.id ? null : item.id))}
                    >
                      View supporting messages
                    </button>
                    {evidenceFor === item.id ? (
                      <p className="text-[13px] leading-5 text-sales-text-secondary">“{item.evidence[0].text}”</p>
                    ) : null}
                  </div>
                ) : null}
                {item.currentDueAt || item.proposedAt ? (
                  <p className="mt-2 text-[13px] leading-5 text-sales-text-secondary">
                    {item.currentDueAt ? `Current: ${new Date(item.currentDueAt).toLocaleString()}` : "No current reminder."}
                    {item.proposedAt
                      ? ` Proposed: ${new Date(item.proposedAt).toLocaleString()}${item.hourSuggested ? " (suggested time)" : ""}`
                      : ""}
                  </p>
                ) : null}
                {knownValues(item).length ? (
                  <ul className="mt-2 space-y-1 text-[13px] leading-5 text-sales-text-secondary">
                    {knownValues(item).map((fact) => (
                      <li key={fact.key}>Known: {fact.value}</li>
                    ))}
                  </ul>
                ) : null}
                {item.missing.length ? (
                  <div className="mt-2">
                    <p className="text-[13px] font-semibold text-sales-text-primary">Still to confirm</p>
                    <ul className="mt-1 list-disc pl-4 text-[13px] leading-5 text-sales-text-secondary">
                      {item.missing.map((label) => (
                        <li key={label}>{label}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {item.executionError ? <p className="mt-2 text-[13px] leading-5 text-sales-danger">{item.executionError}</p> : null}
                {item.reviewStatus === "stale" ? (
                  <p className="mt-2 text-[13px] leading-5 text-sales-text-secondary">
                    This proposal is out of date. Review the latest conversation before approving it.
                  </p>
                ) : null}
                {Array.isArray(item.payload.options) ? (
                  <div className="mt-2 flex flex-col gap-2">
                    {(item.payload.options as Array<{ id: string; name?: string }>).map((option) => (
                      <button
                        key={option.id}
                        type="button"
                        disabled={busy}
                        onClick={() => onAct(item, { action: "choose", productId: option.id })}
                        className="min-h-11 rounded-[8px] border border-sales-border px-3 text-left text-[14px] font-medium text-sales-text-primary"
                      >
                        {option.name ?? "Choose"}
                      </button>
                    ))}
                  </div>
                ) : null}
                {scheduled ? (
                  <label className="mt-3 block text-[12px] font-medium text-sales-text-secondary">
                    Date and time
                    <input
                      type="datetime-local"
                      value={when}
                      onChange={(event) => setTimes((current) => ({ ...current, [item.id]: event.target.value }))}
                      className="mt-1 min-h-11 w-full rounded-[8px] border border-sales-border bg-transparent px-2 text-[16px] text-inherit"
                    />
                  </label>
                ) : snoozeFor === item.id ? (
                  <label className="mt-3 block text-[12px] font-medium text-sales-text-secondary">
                    Snooze until
                    <input
                      type="datetime-local"
                      value={snoozeUntil}
                      onChange={(event) => setSnoozeUntil(event.target.value)}
                      className="mt-1 min-h-11 w-full rounded-[8px] border border-sales-border bg-transparent px-2 text-[16px] text-inherit"
                    />
                  </label>
                ) : null}
                <div className="mt-3 flex flex-wrap gap-2">
                  {ready && item.linkedQuotationId ? (
                    <a href={`/sales/quotes/${item.linkedQuotationId}`} className={cardPrimary}>
                      Review draft
                    </a>
                  ) : item.actionType === "quotation_missing" ? null : (
                    <button
                      type="button"
                      disabled={busy || item.reviewStatus === "stale"}
                      onClick={() =>
                        onAct(item, {
                          action: item.executionStatus === "failed" ? "retry" : "approve",
                          proposedAt: when ? new Date(when).toISOString() : undefined,
                        })
                      }
                      className={cardPrimary}
                    >
                      {item.executionStatus === "failed" ? "Retry" : item.primaryLabel}
                    </button>
                  )}
                  {ready && item.linkedQuotationId ? (
                    <a href={`/sales/quotes/${item.linkedQuotationId}`} className={cardSecondary}>
                      Edit items
                    </a>
                  ) : null}
                  {item.actionType === "answer_question" || item.actionType === "contact_later" || item.actionType === "customer_checkin" ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => onDraft(customerDraft(item))}
                      className={cardSecondary}
                    >
                      Draft reply
                    </button>
                  ) : null}
                  {snoozeFor === item.id ? (
                    <button
                      type="button"
                      disabled={busy || !snoozeUntil}
                      onClick={() => onAct(item, { action: "snooze", snoozeUntil: new Date(snoozeUntil).toISOString() })}
                      className={cardSecondary}
                    >
                      Confirm snooze
                    </button>
                  ) : (
                    <button type="button" disabled={busy} onClick={() => setSnoozeFor(item.id)} className={cardSecondary}>
                      Snooze
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => onAct(item, { action: "dismiss" })}
                    className="inline-flex h-11 items-center px-3 text-[14px] font-semibold text-sales-text-secondary disabled:opacity-50"
                  >
                    Dismiss
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </PremiumSheet>
  );
}

function SalesCopilotPanelItem({
  item,
  busy,
  onAct,
}: {
  item: CopilotWorkView;
  busy: boolean;
  onAct: (itemId: string, body: Record<string, unknown>) => void;
}) {
  const [when, setWhen] = useState(() => datetimeLocalValue(item.proposedAt));
  useEffect(() => {
    setWhen(datetimeLocalValue(item.proposedAt));
  }, [item.id, item.proposedAt]);
  const options = Array.isArray(item.payload.options)
    ? (item.payload.options as Array<{ id: string; name?: string }>)
    : [];
  const choosing = options.length > 0 && (item.actionType === "listing_shortlist" || item.actionType === "quotation_choice");
  const quoteReady = Boolean(
    item.linkedQuotationId && item.executionStatus === "succeeded" && item.actionType === "quotation_draft"
  );
  return (
    <li className="rounded-[10px] border border-sales-border bg-sales-surface px-3 py-2">
      <p className="text-[12px] font-medium text-sales-text-muted">{statusLabel(item)}</p>
      <p className="mt-0.5 text-[13px] font-semibold text-sales-text-primary">{item.title}</p>
      <p className="mt-1 text-[12px] leading-5 text-sales-text-secondary">{item.explanation}</p>
      {item.evidence[0] ? (
        <p className="mt-2 text-[12px] leading-5 text-sales-text-secondary">Evidence: “{item.evidence[0].text}”</p>
      ) : null}
      {choosing ? (
        <div className="mt-2 flex flex-col gap-1">
          {options.map((option) => (
            <button
              key={option.id}
              type="button"
              disabled={busy}
              onClick={() => onAct(item.id, { action: "choose", productId: option.id })}
              className="min-h-11 rounded-[8px] border border-sales-border px-2 text-left text-[13px] font-medium text-sales-text-primary"
            >
              {option.name ?? "Choose"}
            </button>
          ))}
        </div>
      ) : null}
      {item.actionType === "appointment" || item.linkedFollowUp ? (
        <label className="mt-2 block text-[12px] font-medium text-sales-text-secondary">
          Date and time
          <input
            type="datetime-local"
            value={when}
            onChange={(event) => setWhen(event.target.value)}
            className="mt-1 min-h-11 w-full rounded-[8px] border border-sales-border bg-sales-surface px-2 text-[13px] text-sales-text-primary"
          />
        </label>
      ) : null}
      <div className="mt-2 flex flex-wrap gap-2">
        {quoteReady && item.linkedQuotationId ? (
          <>
            <a href={`/sales/quotes/${item.linkedQuotationId}`} className="inline-flex min-h-11 items-center text-[13px] font-semibold text-sales-text-primary">
              Review draft
            </a>
            <a href={`/sales/quotes/${item.linkedQuotationId}`} className="inline-flex min-h-11 items-center text-[13px] font-semibold text-sales-text-secondary">
              Edit items
            </a>
          </>
        ) : choosing || item.actionType === "quotation_missing" ? null : (
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              if (item.actionType === "answer_question") {
                window.dispatchEvent(new CustomEvent(SALES_COPILOT_DRAFT_EVENT, { detail: customerDraft(item) }));
                return;
              }
              onAct(item.id, {
                action: item.executionStatus === "failed" ? "retry" : "approve",
                proposedAt: when ? new Date(when).toISOString() : undefined,
              });
            }}
            className="inline-flex min-h-11 items-center text-[13px] font-semibold text-sales-text-primary disabled:opacity-50"
          >
            {item.executionStatus === "failed" ? "Retry" : item.primaryLabel}
          </button>
        )}
        {item.actionType === "contact_later" || item.actionType === "customer_checkin" ? (
          <button
            type="button"
            onClick={() =>
              window.dispatchEvent(new CustomEvent(SALES_COPILOT_DRAFT_EVENT, { detail: customerDraft(item) }))
            }
            className="inline-flex min-h-11 items-center text-[13px] font-semibold text-sales-text-secondary"
          >
            Draft reply
          </button>
        ) : null}
        <button
          type="button"
          disabled={busy}
          onClick={() => onAct(item.id, { action: "dismiss" })}
          className="inline-flex min-h-11 items-center text-[13px] font-semibold text-sales-text-secondary disabled:opacity-50"
        >
          Dismiss
        </button>
      </div>
    </li>
  );
}

export function SalesCopilotPanel({ leadId }: { leadId: string }) {
  const copilot = useSalesCopilot(leadId);
  const items = copilot.data?.items ?? [];
  const summary = readableCopilotSummary(copilot.data?.analysis.summary);
  return (
    <section className="border-b border-sales-border-subtle px-4 py-3.5">
      <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.04em] text-sales-text-muted">Sales Copilot</div>
      {summary ? (
        <p className="text-[13px] leading-5 text-sales-text-secondary">{summary}</p>
      ) : (
        <p className="text-[13px] text-sales-text-secondary">
          {copilot.data?.analysis.status === "pending"
            ? "Sales Copilot is reading this conversation."
            : items.length > 0
              ? "Review the actions below."
              : "Nothing to review on this conversation."}
        </p>
      )}
      {copilot.notice ? <p className="mt-2 text-[12px] text-sales-danger">{copilot.notice}</p> : null}
      <ul className="mt-3 space-y-2">
        {items.map((item) => (
          <SalesCopilotPanelItem key={item.id} item={item} busy={copilot.busy} onAct={(itemId, body) => void copilot.act(itemId, body)} />
        ))}
      </ul>
    </section>
  );
}
