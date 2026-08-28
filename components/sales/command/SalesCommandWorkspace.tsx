"use client";

import { useCallback, useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/sales/ui";
import { SalesCommandBlocks } from "@/components/sales/command/blocks";
import type {
  SalesBlock,
  SalesChoice,
  SalesContextCard,
  SalesPageContext,
  SalesRecentWork,
  SalesTurnResult,
} from "@/lib/agent/sales/types";

type Turn = {
  id: string;
  role: "user" | "assistant";
  content: string;
  blocks: SalesBlock[];
};

function newId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `cmd-${Date.now()}`;
}

export function SalesCommandWorkspace({
  pageContext,
  compact = false,
  onClose,
}: {
  pageContext?: SalesPageContext;
  compact?: boolean;
  onClose?: () => void;
}) {
  const [input, setInput] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [phase, setPhase] = useState<string | null>(null);
  const [context, setContext] = useState<SalesContextCard | null>(null);
  const [hasPackages, setHasPackages] = useState(false);
  const [samplePackage, setSamplePackage] = useState<string | null>(null);
  const [recent, setRecent] = useState<SalesRecentWork[]>([]);
  const [enabled, setEnabled] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const composerId = useId();

  const qs = new URLSearchParams();
  if (pageContext?.conversationId) qs.set("conversationId", pageContext.conversationId);
  if (pageContext?.leadId) qs.set("leadId", pageContext.leadId);
  if (pageContext?.dealId) qs.set("dealId", pageContext.dealId);
  if (pageContext?.quotationId) qs.set("quotationId", pageContext.quotationId);
  if (pageContext?.customerId) qs.set("customerId", pageContext.customerId);

  useEffect(() => {
    void fetch(`/api/agent/sales/command?${qs.toString()}`)
      .then((r) => r.json())
      .then((j: {
        flags?: { enabled?: boolean; commandCenter?: boolean; salesHubCommand?: boolean };
        context?: SalesContextCard;
        hasPackages?: boolean;
        samplePackageName?: string | null;
        recent?: SalesRecentWork[];
        error?: string;
      }) => {
        if (j.error) {
          setEnabled(false);
          setError(j.error);
          return;
        }
        const surfaceOn = compact ? j.flags?.salesHubCommand !== false : j.flags?.commandCenter !== false;
        setEnabled(j.flags?.enabled !== false && surfaceOn);
        if (j.context) setContext(j.context);
        setHasPackages(Boolean(j.hasPackages));
        setSamplePackage(j.samplePackageName ?? null);
        setRecent(j.recent ?? []);
      })
      .catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- bootstrap once per page context
  }, [pageContext?.conversationId, pageContext?.leadId, pageContext?.dealId, pageContext?.quotationId]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [turns, loading]);

  const send = useCallback(
    async (text: string, selection?: SalesChoice | null) => {
      const message = text.trim();
      if (!message || loading) return;
      setInput("");
      setError(null);
      setTurns((prev) => [...prev, { id: newId(), role: "user", content: message, blocks: [] }]);
      setLoading(true);
      setPhase("Working…");
      const commandId = newId();
      try {
        const res = await fetch("/api/agent/sales/command", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message,
            sessionId,
            commandId,
            pageContext: pageContext ?? {},
            surface: compact ? "drawer" : "command_center",
            selection: selection ? { id: selection.id, kind: selection.entityType } : null,
          }),
        });
        const j = (await res.json()) as SalesTurnResult & { error?: string };
        if (j.sessionId) setSessionId(j.sessionId);
        if (j.phase) setPhase(j.phase);
        if (j.context) setContext(j.context);
        setTurns((prev) => [
          ...prev,
          {
            id: newId(),
            role: "assistant",
            content: j.reply || j.error || "I couldn't complete that command.",
            blocks: j.blocks ?? [],
          },
        ]);
      } catch {
        setTurns((prev) => [
          ...prev,
          {
            id: newId(),
            role: "assistant",
            content: "The command timed out before it completed.",
            blocks: [{ type: "status", kind: "error", message: "The command timed out before it completed." }],
          },
        ]);
      } finally {
        setLoading(false);
        setPhase(null);
      }
    },
    [loading, pageContext, sessionId, compact]
  );

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    void send(input);
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void send(input);
    }
  }

  const examples = [
    context?.customerName && hasPackages && samplePackage
      ? `Create a quote for this customer using the ${samplePackage} Package.`
      : null,
    context?.customerName ? "Create a quotation for this customer." : "Create a quotation for…",
    hasPackages ? "Quote what the customer requested." : "Prepare a quotation for 100 helmets and 100 reflective vests.",
  ].filter(Boolean) as string[];

  const quick = [
    { label: "Create quotation", prompt: context?.customerName ? "Create a quotation for this customer." : "Create a quotation for " },
    { label: "Find customer", prompt: "Find customer " },
  ];

  if (!enabled) {
    return (
      <div className="rounded-[12px] border border-sales-border bg-sales-surface p-5">
        <p className="text-[14px] text-sales-text-primary">
          {error || "Sales Command Center is not enabled for this company."}
        </p>
      </div>
    );
  }

  return (
    <div className={compact ? "flex min-h-0 flex-1 flex-col" : "mx-auto flex w-full max-w-3xl flex-col gap-5"}>
      {context?.customerName ? (
        <section className="rounded-[12px] border border-sales-border bg-sales-surface px-4 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.06em] text-sales-text-muted">Working with</p>
          <p className="mt-1 text-[15px] font-semibold text-sales-text-primary">{context.customerName}</p>
          {context.projectType ? <p className="text-[12px] text-sales-text-secondary">{context.projectType}</p> : null}
          {context.dealName ? (
            <p className="mt-1 text-[12px] text-sales-text-secondary">
              Deal · {context.dealName}
              {context.dealStage ? ` · ${context.dealStage}` : ""}
            </p>
          ) : null}
          <div className="mt-2 flex flex-wrap gap-2">
            {context.customerHref ? (
              <Link href={context.customerHref} className="text-[12px] font-medium text-sales-text-secondary underline-offset-2 hover:underline">
                Open customer
              </Link>
            ) : null}
            {context.dealHref ? (
              <Link href={context.dealHref} className="text-[12px] font-medium text-sales-text-secondary underline-offset-2 hover:underline">
                Open Deal
              </Link>
            ) : null}
            {!compact ? (
              <button
                type="button"
                className="text-[12px] font-medium text-sales-text-secondary underline-offset-2 hover:underline"
                onClick={() => setInput("Find customer ")}
              >
                Change context
              </button>
            ) : null}
          </div>
        </section>
      ) : null}

      <form onSubmit={onSubmit} className="rounded-[12px] border border-sales-border bg-sales-surface p-3 shadow-sales-card">
        <label htmlFor={composerId} className="sr-only">
          Command SegmiQ
        </label>
        <textarea
          id={composerId}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          rows={compact ? 2 : 3}
          disabled={loading}
          placeholder="Ask SegmiQ to prepare a quotation or manage your sales work…"
          className="w-full resize-none bg-transparent text-[14px] text-sales-text-primary outline-none placeholder:text-sales-text-muted"
        />
        <div className="mt-2 flex items-center justify-between gap-2">
          {loading ? (
            <button
              type="button"
              className="text-[12px] font-medium text-sales-text-secondary"
              onClick={() => {
                if (sessionId) {
                  void fetch("/api/agent/sales/command", {
                    method: "DELETE",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ sessionId }),
                  });
                }
                setLoading(false);
                setPhase(null);
              }}
            >
              Cancel
            </button>
          ) : (
            <span className="text-[12px] text-sales-text-muted">Enter to send</span>
          )}
          <Button type="submit" variant="primary" size="sm" disabled={loading || !input.trim()}>
            {loading ? "Working…" : "Run"}
          </Button>
        </div>
      </form>

      {turns.length === 0 ? (
        <div className="flex flex-wrap gap-2">
          {quick.map((q) => (
            <button
              key={q.label}
              type="button"
              onClick={() => {
                if (q.prompt.endsWith(" ")) setInput(q.prompt);
                else void send(q.prompt);
              }}
              className="rounded-full border border-sales-border bg-sales-surface px-3 py-1.5 text-[12px] font-medium text-sales-text-primary hover:bg-sales-surface-hover"
            >
              {q.label}
            </button>
          ))}
        </div>
      ) : null}

      <div ref={listRef} className={compact ? "min-h-0 flex-1 space-y-5 overflow-y-auto pb-4" : "space-y-5"}>
        {turns.length === 0 ? (
          <div>
            <p className="text-[13px] text-sales-text-secondary">Examples</p>
            <ul className="mt-2 space-y-1.5">
              {examples.map((ex) => (
                <li key={ex}>
                  <button
                    type="button"
                    className="text-left text-[13px] text-sales-text-primary underline-offset-2 hover:underline"
                    onClick={() => void send(ex)}
                  >
                    {ex}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          turns.map((t) => (
            <div key={t.id}>
              {t.role === "user" ? (
                <p className="mb-2 text-[12px] font-medium uppercase tracking-[0.04em] text-sales-text-muted">
                  You · {t.content}
                </p>
              ) : (
                <SalesCommandBlocks
                  blocks={t.blocks.length ? t.blocks : [{ type: "text", text: t.content }]}
                  disabled={loading}
                  onSelect={(opt) => void send(opt.title, opt)}
                  onAction={(prompt) => void send(prompt)}
                />
              )}
            </div>
          ))
        )}
        {loading ? (
          <p className="flex items-center gap-2 text-[13px] text-sales-text-muted" role="status">
            <Loader2 size={14} className="animate-spin" aria-hidden />
            {phase || "Preparing quotation…"}
          </p>
        ) : null}
      </div>

      {!compact && recent.length && turns.length === 0 ? (
        <section>
          <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-sales-text-muted">Recent Agent work</p>
          <ul className="mt-2 space-y-1">
            {recent.map((r) => (
              <li key={r.quotationId}>
                <Link href={r.href} className="text-[13px] text-sales-text-primary hover:underline">
                  {r.quoteNumber} · {r.customerName ?? "Customer"} · {r.summary}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {onClose && compact ? (
        <button type="button" className="sr-only" onClick={onClose}>
          Close
        </button>
      ) : null}
    </div>
  );
}
