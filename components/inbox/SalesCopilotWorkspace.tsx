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
  const detailsFirst = needsDetails(item);
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
          Review
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
      <p className="mt-1 text-[14px] leading-5 text-sales-text-secondary">{item.explanation}</p>
      {item.missing.length ? (
        <p className="mt-1 text-[14px] leading-5 text-sales-text-secondary">Still needed: {item.missing.join(", ")}</p>
      ) : null}
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
            {item.executionStatus === "failed" ? "Retry" : detailsFirst ? "Review" : item.primaryLabel}
          </button>
        )}
        {quoteHref ? (
          <a href={quoteHref} className={cardSecondary}>
            Edit items
          </a>
        ) : item.primaryLabel !== "Review" && !detailsFirst ? (
          <button type="button" onClick={onOpen} className={cardSecondary}>
            Review
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
  const [when, setWhen] = useState("");
  if (!open) return null;
  return (
    <PremiumSheet
      title="Sales Copilot"
      description={readableCopilotSummary(summary) ?? "Review what was understood and what still needs a decision."}
      onClose={onClose}
      closeDisabled={busy}
      labelledBy="sales-copilot-title"
      maxWidthClass="max-w-lg"
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
            return (
              <li key={item.id} className="rounded-[12px] border border-sales-border p-3">
                <p className="text-[12px] font-medium text-sales-text-muted">{statusLabel(item)}</p>
                <p className="mt-1 text-[16px] font-semibold leading-5 text-sales-text-primary">{item.title}</p>
                <p className="mt-1 text-[14px] leading-5 text-sales-text-secondary">{item.explanation}</p>
                {item.evidence[0]?.text ? (
                  <p className="mt-2 text-[13px] leading-5 text-sales-text-secondary">“{item.evidence[0].text}”</p>
                ) : null}
                {item.currentDueAt || item.proposedAt ? (
                  <p className="mt-2 text-[13px] leading-5 text-sales-text-secondary">
                    {item.currentDueAt ? `Current: ${new Date(item.currentDueAt).toLocaleString()}` : "No current reminder."}
                    {item.proposedAt
                      ? ` Proposed: ${new Date(item.proposedAt).toLocaleString()}${item.hourSuggested ? " (suggested time)" : ""}`
                      : ""}
                  </p>
                ) : null}
                {item.missing.length ? (
                  <p className="mt-2 text-[13px] leading-5 text-sales-text-secondary">Still needed: {item.missing.join(", ")}</p>
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
                <label className="mt-3 block text-[12px] font-medium text-sales-text-secondary">
                  {scheduled ? "Date and time" : "Snooze until"}
                  <input
                    type="datetime-local"
                    value={when}
                    onChange={(event) => setWhen(event.target.value)}
                    className="mt-1 min-h-11 w-full rounded-[8px] border border-sales-border bg-sales-surface px-2 text-[16px] text-sales-text-primary"
                  />
                </label>
                <div className="mt-3 flex flex-wrap gap-2">
                  {ready && item.linkedQuotationId ? (
                    <a href={`/sales/quotes/${item.linkedQuotationId}`} className={cardPrimary}>
                      Review draft
                    </a>
                  ) : (
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
                  <button
                    type="button"
                    disabled={busy || !when}
                    onClick={() => onAct(item, { action: "snooze", snoozeUntil: new Date(when).toISOString() })}
                    className={cardSecondary}
                  >
                    Snooze
                  </button>
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
          <>
            <a href={`/sales/quotes/${item.linkedQuotationId}`} className="inline-flex min-h-11 items-center text-[13px] font-semibold text-sales-text-primary">
              Review draft
            </a>
            <a href={`/sales/quotes/${item.linkedQuotationId}`} className="inline-flex min-h-11 items-center text-[13px] font-semibold text-sales-text-secondary">
              Edit items
            </a>
          </>
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
