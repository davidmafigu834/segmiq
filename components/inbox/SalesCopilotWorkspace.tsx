"use client";

import { useCallback, useEffect, useState } from "react";
import { customerDraft } from "@/lib/sales-copilot/draft";
import type { CopilotWorkView } from "@/lib/sales-copilot/types";

export const SALES_COPILOT_DRAFT_EVENT = "segmiq:sales-copilot-draft";

export const SALES_COPILOT_DRAFT_EVENT = "segmiq-sales-copilot-draft";

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

function statusLabel(item: CopilotWorkView, analysisStatus: string | undefined) {
  if (item.executionStatus === "failed") return "Failed";
  if (item.executionStatus === "running") return "Working";
  if (item.reviewStatus === "stale") return "Out of date";
  if (item.queue === "needs_review") return "Needs review";
  if (item.queue === "waiting") return "Waiting";
  if (analysisStatus === "pending") return "Reading";
  return "To do";
}

export function SalesCopilotCard({
  item,
  analysisStatus,
  composing,
  busy,
  onOpen,
  onAct,
  onDraft,
}: {
  item: CopilotWorkView | null;
  analysisStatus?: string;
  composing: boolean;
  busy: boolean;
  onOpen: () => void;
  onAct: (item: CopilotWorkView, body: Record<string, unknown>) => void;
  onDraft: (text: string) => void;
}) {
  if (!item && analysisStatus !== "pending" && analysisStatus !== "failed") return null;
  if (composing && item) {
    return (
      <button
        type="button"
        onClick={onOpen}
        className="flex min-h-11 w-full items-center justify-between gap-3 border-t border-sales-border bg-sales-surface px-3 py-2 text-left"
      >
        <span className="min-w-0 truncate text-[13px] font-medium text-sales-text-primary">
          Sales Copilot · {item.title}
        </span>
        <span className="shrink-0 text-[13px] font-semibold text-sales-text-primary">Review</span>
      </button>
    );
  }
  if (!item) {
    return (
      <div className="border-t border-sales-border bg-sales-surface px-3 py-2" role="status">
        <p className="text-[11px] font-semibold uppercase tracking-[0.04em] text-sales-text-muted">Sales Copilot</p>
        <p className="mt-1 text-[13px] leading-5 text-sales-text-secondary">
          {analysisStatus === "failed"
            ? "Sales Copilot could not read the latest messages. Chat and your tasks still work."
            : "Sales Copilot is reading this conversation."}
        </p>
      </div>
    );
  }
  const quoteHref = item.linkedQuotationId ? `/sales/quotes/${item.linkedQuotationId}` : null;
  const primaryIsLink = Boolean(quoteHref && item.executionStatus === "succeeded" && item.actionType === "quotation_draft");
  const needsChoice = item.actionType === "listing_shortlist" || item.actionType === "quotation_choice";
  const needsTime = item.actionType === "appointment" && !item.proposedAt;
  const primaryDrafts = item.actionType === "answer_question";
  const canDraft =
    item.actionType === "contact_later" || item.actionType === "customer_checkin" || item.actionType === "answer_question";
  return (
    <section aria-label="Sales Copilot" className="border-t border-sales-border bg-sales-surface px-3 py-2.5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.04em] text-sales-text-muted">Sales Copilot</p>
        <p className="text-[12px] font-medium text-sales-text-secondary">{statusLabel(item, analysisStatus)}</p>
      </div>
      <h2 className="mt-1 text-[15px] font-semibold leading-5 text-sales-text-primary">{item.title}</h2>
      <p className="mt-1 text-[13px] leading-5 text-sales-text-secondary">{item.explanation}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {primaryIsLink && quoteHref ? (
          <a href={quoteHref} className="inline-flex min-h-11 items-center rounded-[8px] bg-sales-brand px-3 text-[13px] font-semibold text-sales-brand-text">
            Review draft
          </a>
        ) : (
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              if (needsChoice || needsTime) {
                onOpen();
                return;
              }
              if (primaryDrafts) {
                onDraft(customerDraft(item));
                return;
              }
              onAct(item, { action: item.executionStatus === "failed" ? "retry" : "approve" });
            }}
            className="inline-flex min-h-11 items-center rounded-[8px] bg-sales-brand px-3 text-[13px] font-semibold text-sales-brand-text disabled:opacity-50"
          >
            {item.executionStatus === "failed" ? "Retry" : needsChoice || needsTime ? "Review" : item.primaryLabel}
          </button>
        )}
        {canDraft && !primaryDrafts ? (
          <button
            type="button"
            onClick={() => onDraft(customerDraft(item))}
            className="inline-flex min-h-11 items-center rounded-[8px] border border-sales-border px-3 text-[13px] font-semibold text-sales-text-primary"
          >
            Draft reply
          </button>
        ) : null}
        <button type="button" onClick={onOpen} className="inline-flex min-h-11 items-center rounded-[8px] border border-sales-border px-3 text-[13px] font-semibold text-sales-text-primary">
          Edit
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => onAct(item, { action: "dismiss" })}
          className="inline-flex min-h-11 items-center rounded-[8px] px-3 text-[13px] font-semibold text-sales-text-secondary disabled:opacity-50"
        >
          Dismiss
        </button>
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
  const [when, setWhen] = useState("");
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const close = document.getElementById("sales-copilot-close");
    close?.focus();
    return () => previous?.focus();
  }, [open]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/30" role="presentation" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="sales-copilot-title"
        className="max-h-[85dvh] w-full max-w-lg overflow-y-auto rounded-t-[16px] bg-sales-surface px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-8px_30px_rgba(16,24,40,0.12)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 id="sales-copilot-title" className="text-[16px] font-semibold text-sales-text-primary">
            Sales Copilot
          </h2>
          <button id="sales-copilot-close" type="button" onClick={onClose} className="min-h-11 px-2 text-[13px] font-semibold text-sales-text-primary">
            Close
          </button>
        </div>
        {summary ? <p className="mb-3 text-[13px] leading-5 text-sales-text-secondary">{summary}</p> : null}
        {notice ? (
          <p role="alert" className="mb-3 text-[13px] text-sales-danger">
            {notice}
          </p>
        ) : null}
        {items.length === 0 ? (
          <p className="text-[13px] text-sales-text-secondary">No actions are waiting on this conversation.</p>
        ) : (
          <ul className="space-y-3">
            {items.map((item) => (
              <li key={item.id} className="rounded-[12px] border border-sales-border p-3">
                <p className="text-[12px] font-medium text-sales-text-muted">{statusLabel(item)}</p>
                <p className="mt-1 text-[14px] font-semibold text-sales-text-primary">{item.title}</p>
                <p className="mt-1 text-[13px] leading-5 text-sales-text-secondary">{item.explanation}</p>
                {item.currentDueAt || item.proposedAt ? (
                  <p className="mt-2 text-[12px] leading-5 text-sales-text-secondary">
                    {item.currentDueAt ? `Current: ${new Date(item.currentDueAt).toLocaleString()}` : "No current reminder."}
                    {item.proposedAt
                      ? ` Proposed: ${new Date(item.proposedAt).toLocaleString()}${item.hourSuggested ? " (suggested time)" : ""}`
                      : ""}
                  </p>
                ) : null}
                {item.missing.length ? (
                  <p className="mt-2 text-[12px] text-sales-text-secondary">Still needed: {item.missing.join(", ")}</p>
                ) : null}
                {item.executionError ? <p className="mt-2 text-[12px] text-sales-danger">{item.executionError}</p> : null}
                {Array.isArray(item.payload.options) ? (
                  <div className="mt-2 flex flex-col gap-2">
                    {(item.payload.options as Array<{ id: string; name?: string }>).map((option) => (
                      <button
                        key={option.id}
                        type="button"
                        disabled={busy}
                        onClick={() => onAct(item, { action: "choose", productId: option.id })}
                        className="min-h-11 rounded-[8px] border border-sales-border px-3 text-left text-[13px] font-medium text-sales-text-primary"
                      >
                        {option.name ?? "Choose"}
                      </button>
                    ))}
                  </div>
                ) : null}
                <label className="mt-3 block text-[12px] font-medium text-sales-text-secondary">
                  Date and time
                  <input
                    type="datetime-local"
                    value={when}
                    onChange={(event) => setWhen(event.target.value)}
                    className="mt-1 min-h-11 w-full rounded-[8px] border border-sales-border bg-sales-surface px-2 text-[16px] text-sales-text-primary"
                  />
                </label>
                <div className="mt-3 flex flex-wrap gap-2">
                  {item.linkedQuotationId ? (
                    <a href={`/sales/quotes/${item.linkedQuotationId}`} className="inline-flex min-h-11 items-center rounded-[8px] bg-sales-brand px-3 text-[13px] font-semibold text-sales-brand-text">
                      {item.executionStatus === "succeeded" ? "Review draft" : "Open draft"}
                    </a>
                  ) : (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        onAct(item, {
                          action: item.executionStatus === "failed" ? "retry" : "approve",
                          proposedAt: when ? new Date(when).toISOString() : undefined,
                        })
                      }
                      className="inline-flex min-h-11 items-center rounded-[8px] bg-sales-brand px-3 text-[13px] font-semibold text-sales-brand-text disabled:opacity-50"
                    >
                      {item.executionStatus === "failed" ? "Retry" : item.primaryLabel}
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => onDraft(customerDraft(item))}
                    className="inline-flex min-h-11 items-center rounded-[8px] border border-sales-border px-3 text-[13px] font-semibold"
                  >
                    Draft reply
                  </button>
                  <button
                    type="button"
                    disabled={busy || !when}
                    onClick={() => onAct(item, { action: "snooze", snoozeUntil: new Date(when).toISOString() })}
                    className="inline-flex min-h-11 items-center rounded-[8px] border border-sales-border px-3 text-[13px] font-semibold disabled:opacity-50"
                  >
                    Snooze
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => onAct(item, { action: "dismiss" })}
                    className="inline-flex min-h-11 items-center px-3 text-[13px] font-semibold text-sales-text-secondary"
                  >
                    Dismiss
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
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
  const [when, setWhen] = useState("");
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
          <a href={`/sales/quotes/${item.linkedQuotationId}`} className="inline-flex min-h-11 items-center text-[13px] font-semibold text-sales-text-primary">
            Review draft
          </a>
        ) : choosing ? null : (
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
  return (
    <section className="border-b border-sales-border-subtle px-4 py-3.5">
      <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.04em] text-sales-text-muted">Sales Copilot</div>
      {copilot.data?.analysis.summary ? (
        <p className="text-[13px] leading-5 text-sales-text-secondary">{copilot.data.analysis.summary}</p>
      ) : (
        <p className="text-[13px] text-sales-text-secondary">
          {copilot.data?.analysis.status === "failed"
            ? "Sales Copilot could not read this conversation. The chat and manual tasks still work."
            : "Reading the saved conversation."}
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
