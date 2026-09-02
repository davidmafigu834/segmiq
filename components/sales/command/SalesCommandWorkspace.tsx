"use client";

import { useCallback, useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowUpRight, BriefcaseBusiness, CalendarDays, Crosshair, FileText, ListTodo, Search, UserRound } from "lucide-react";
import { Badge, StatusDot } from "@/components/sales/ui";
import { SalesCommandBlocks } from "@/components/sales/command/blocks";
import { TodaysFocusPanel } from "@/components/sales/command/TodaysFocusPanel";
import {
  CommandCommandRow,
  CommandComposer,
  CommandEmptyState,
  CommandExampleChips,
  CommandExecutionStatus,
  CommandQuickAction,
  CommandRailSection,
  CommandRecentWork,
  CommandResultHeader,
  CommandScopeChip,
} from "@/components/command/CommandPrimitives";
import type {
  SalesBlock,
  SalesChoice,
  SalesContextCard,
  SalesPageContext,
  SalesRecentWork,
  SalesTurnResult,
} from "@/lib/agent/sales/types";
import type { SalesAttentionItem } from "@/lib/sales/attention/types";
import { cn } from "@/lib/ui/cn";

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

function SalesContextRail({
  context,
  compact,
  onFindCustomer,
}: {
  context: SalesContextCard | null;
  compact?: boolean;
  onFindCustomer: () => void;
}) {
  if (!context?.customerName) {
    return (
      <div className="space-y-4">
        <CommandRailSection title="Current context">
          <p className="text-[12px] leading-relaxed text-sales-text-muted">
            No customer selected. Find a customer or open a Deal to ground SegmiQ in your work.
          </p>
          <button
            type="button"
            onClick={onFindCustomer}
            className="mt-2 text-[12px] font-medium text-sales-text-secondary underline-offset-2 hover:underline"
          >
            Find customer
          </button>
        </CommandRailSection>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <CommandRailSection title="Current context">
        <div className="rounded-[10px] border border-sales-border bg-sales-surface p-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.06em] text-sales-text-muted">Customer</p>
          <p className="mt-1 text-[14px] font-semibold text-sales-text-primary">{context.customerName}</p>
          {context.projectType ? (
            <p className="mt-0.5 text-[12px] text-sales-text-secondary">{context.projectType}</p>
          ) : null}
          {context.customerHref ? (
            <Link
              href={context.customerHref}
              className="mt-2 inline-flex items-center gap-1 text-[12px] font-medium text-sales-text-secondary hover:text-sales-text-primary"
            >
              Open customer
              <ArrowUpRight size={12} aria-hidden />
            </Link>
          ) : null}
        </div>
      </CommandRailSection>

      {context.dealName ? (
        <CommandRailSection title="Deal">
          <div className="rounded-[10px] border border-sales-border bg-sales-surface p-3">
            <p className="text-[13px] font-semibold text-sales-text-primary">{context.dealName}</p>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {context.dealStage ? (
                <Badge tone="info" appearance="soft" size="sm">
                  {context.dealStage}
                </Badge>
              ) : null}
            </div>
            {context.dealHref ? (
              <Link
                href={context.dealHref}
                className="mt-2 inline-flex items-center gap-1 text-[12px] font-medium text-sales-text-secondary hover:text-sales-text-primary"
              >
                Open Deal
                <ArrowUpRight size={12} aria-hidden />
              </Link>
            ) : null}
          </div>
        </CommandRailSection>
      ) : null}

      {context.quotationNumber ? (
        <CommandRailSection title="Quotation">
          <div className="rounded-[10px] border border-sales-border bg-sales-surface p-3">
            <p className="text-[13px] font-semibold text-sales-text-primary">{context.quotationNumber}</p>
            {context.quotationStatus ? (
              <p className="mt-0.5 text-[12px] text-sales-text-muted">{context.quotationStatus}</p>
            ) : null}
          </div>
        </CommandRailSection>
      ) : null}

      {context.conversationId ? (
        <CommandRailSection title="Conversation">
          <div className="rounded-[10px] border border-sales-border bg-sales-surface p-3">
            <p className="text-[12px] text-sales-text-secondary">Linked conversation context is available to SegmiQ.</p>
            <Link
              href={`/sales/inbox?lead=${context.leadId ?? context.conversationId}`}
              className="mt-2 inline-flex items-center gap-1 text-[12px] font-medium text-sales-text-secondary hover:text-sales-text-primary"
            >
              View conversation
              <ArrowUpRight size={12} aria-hidden />
            </Link>
          </div>
        </CommandRailSection>
      ) : null}

      {!compact ? (
        <CommandRailSection title="Quick links">
          <ul className="overflow-hidden rounded-[10px] border border-sales-border bg-sales-surface">
            {[
              { href: "/sales/tasks", label: "Create task", enabled: true },
              { href: "/sales/calendar", label: "Schedule appointment", enabled: true },
            ].map((item) => (
              <li key={item.href} className="border-b border-sales-border-subtle last:border-0">
                <Link
                  href={item.href}
                  className="flex items-center justify-between px-3 py-2.5 text-[12px] font-medium text-sales-text-secondary hover:bg-sales-surface-hover hover:text-sales-text-primary"
                >
                  {item.label}
                  <ArrowUpRight size={12} aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        </CommandRailSection>
      ) : null}
    </div>
  );
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
  const searchParams = useSearchParams();
  const viewFocus = !compact && searchParams.get("view") === "focus";
  const [focusMode, setFocusMode] = useState(viewFocus);
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
  const [agentOn, setAgentOn] = useState(true);
  const listRef = useRef<HTMLDivElement>(null);
  const composerId = useId();

  useEffect(() => {
    setFocusMode(viewFocus);
  }, [viewFocus]);

  const qs = new URLSearchParams();
  if (pageContext?.conversationId) qs.set("conversationId", pageContext.conversationId);
  if (pageContext?.leadId) qs.set("leadId", pageContext.leadId);
  if (pageContext?.dealId) qs.set("dealId", pageContext.dealId);
  if (pageContext?.quotationId) qs.set("quotationId", pageContext.quotationId);
  if (pageContext?.customerId) qs.set("customerId", pageContext.customerId);
  if (pageContext?.companyId) qs.set("companyId", pageContext.companyId);

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
          setAgentOn(false);
          setError(j.error);
          return;
        }
        const surfaceOn = compact ? j.flags?.salesHubCommand !== false : j.flags?.commandCenter !== false;
        const on = j.flags?.enabled !== false && surfaceOn;
        setEnabled(on);
        setAgentOn(on);
        if (j.context) setContext(j.context);
        setHasPackages(Boolean(j.hasPackages));
        setSamplePackage(j.samplePackageName ?? null);
        setRecent(j.recent ?? []);
      })
      .catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- bootstrap once per page context
  }, [pageContext?.conversationId, pageContext?.leadId, pageContext?.dealId, pageContext?.quotationId, pageContext?.companyId]);

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
      setPhase("Understanding request…");
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

  useEffect(() => {
    const prompt = searchParams.get("prompt");
    if (!prompt?.trim() || compact) return;
    setFocusMode(false);
    void send(prompt.trim());
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one-shot URL prompt
  }, []);

  function onFocusDraft(item: SalesAttentionItem) {
    setFocusMode(false);
    const prompt = item.actions.find((a) => a.kind === "draft_message")?.prompt
      || "Draft a follow-up message for this customer.";
    void send(prompt);
  }

  function onFocusPrepareQuote(item: SalesAttentionItem) {
    setFocusMode(false);
    const prompt = item.actions.find((a) => a.kind === "prepare_quotation" || a.kind === "revise_quotation")?.prompt
      || (item.type === "QUOTE_REVISION_REQUESTED"
        ? "Prepare a revised quotation based on the customer's request."
        : "Create a quotation for this customer.");
    void send(prompt);
  }

  function onSubmit(e?: FormEvent) {
    e?.preventDefault();
    void send(input);
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void send(input);
    }
  }

  function cancel() {
    if (sessionId) {
      void fetch("/api/agent/sales/command", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      });
    }
    setLoading(false);
    setPhase(null);
  }

  const examples = [
    context?.customerName && hasPackages && samplePackage
      ? `Create a quote for this customer using the ${samplePackage} Package.`
      : null,
    context?.customerName ? "Create a quotation for this customer." : null,
    hasPackages ? "Quote what the customer requested." : "Prepare a quotation for 100 helmets and 100 reflective vests.",
  ].filter(Boolean) as string[];

  if (!enabled) {
    return (
      <div className={cn("p-4", !compact && "mx-auto w-full max-w-4xl")}>
        <CommandEmptyState
          title="Sales Command Center unavailable"
          description={error || "Sales Command Center is not enabled for this company."}
        />
      </div>
    );
  }

  const composer = (
    <form onSubmit={onSubmit}>
      <CommandComposer
        id={composerId}
        value={input}
        onChange={setInput}
        onSubmit={() => void send(input)}
        onKeyDown={onKeyDown}
        placeholder="Ask SegmiQ to prepare a quotation or manage your sales work…"
        loading={loading}
        onCancel={cancel}
        rows={compact ? 2 : 2}
        scopeChips={
          <>
            <CommandScopeChip label="This customer" active={Boolean(context?.customerName)} />
            <CommandScopeChip label="This Deal" active={Boolean(context?.dealId)} />
            <CommandScopeChip label="From conversation" active={Boolean(context?.conversationId)} />
          </>
        }
      />
    </form>
  );

  const quickActions = (
    <div className="flex gap-2 overflow-x-auto pb-0.5">
      <CommandQuickAction
        icon={<Crosshair size={14} strokeWidth={1.9} aria-hidden />}
        label="Today's Focus"
        hint="What needs attention"
        onClick={() => {
          setFocusMode(true);
          if (typeof window !== "undefined") {
            const url = new URL(window.location.href);
            url.searchParams.set("view", "focus");
            window.history.replaceState({}, "", url.toString());
          }
        }}
      />
      <CommandQuickAction
        icon={<FileText size={14} strokeWidth={1.9} aria-hidden />}
        label="Create quotation"
        hint="Prepare a draft"
        onClick={() => {
          setFocusMode(false);
          const prompt = context?.customerName
            ? "Create a quotation for this customer."
            : "Create a quotation for ";
          if (prompt.endsWith(" ")) setInput(prompt);
          else void send(prompt);
        }}
      />
      <CommandQuickAction
        icon={<Search size={14} strokeWidth={1.9} aria-hidden />}
        label="Find customer"
        hint="Look up a customer"
        onClick={() => {
          setFocusMode(false);
          setInput("Find customer ");
        }}
      />
      <CommandQuickAction
        icon={<ListTodo size={14} strokeWidth={1.9} aria-hidden />}
        label="My follow-ups"
        hint="Open tasks"
        onClick={() => {
          window.location.href = "/sales/tasks";
        }}
      />
      <CommandQuickAction
        icon={<CalendarDays size={14} strokeWidth={1.9} aria-hidden />}
        label="Appointments"
        hint="Open calendar"
        onClick={() => {
          window.location.href = "/sales/calendar";
        }}
      />
      <CommandQuickAction
        icon={<BriefcaseBusiness size={14} strokeWidth={1.9} aria-hidden />}
        label="My Deals"
        hint="Open pipeline"
        onClick={() => {
          window.location.href = "/sales/pipeline";
        }}
      />
    </div>
  );

  const results = (
    <div ref={listRef} className="min-h-0 space-y-4 overflow-y-auto">
      {turns.length === 0 ? (
        <>
          {!compact ? (
            <CommandEmptyState
              title="What would you like SegmiQ to do?"
              description="Start with a quotation, customer or Deal. SegmiQ works through your live sales records."
            />
          ) : (
            <CommandExampleChips examples={examples} onSelect={(ex) => void send(ex)} />
          )}
          {!compact && recent.length ? (
            <CommandRecentWork
              items={recent.map((r) => ({
                id: r.quotationId,
                title: r.quoteNumber,
                subtitle: `${r.summary}${r.customerName ? ` · ${r.customerName}` : ""}`,
                href: r.href,
              }))}
              viewAllHref="/sales/quotes"
            />
          ) : null}
        </>
      ) : (
        turns.map((t) =>
          t.role === "user" ? (
            <CommandCommandRow key={t.id} role="user" content={t.content} />
          ) : (
            <div key={t.id} className="space-y-3 rounded-[12px] border border-sales-border bg-sales-surface p-4 shadow-sales-card">
              <CommandResultHeader
                title={
                  t.blocks.some((b) => b.type === "quotation_draft")
                    ? "Quotation prepared"
                    : t.blocks.some((b) => b.type === "choice")
                      ? "One detail needed"
                      : t.blocks.some((b) => b.type === "status" && (b.kind === "error" || b.kind === "denied" || b.kind === "blocked"))
                        ? "Command couldn't complete"
                        : "Done"
                }
                tone={
                  t.blocks.some((b) => b.type === "status" && (b.kind === "error" || b.kind === "denied" || b.kind === "blocked"))
                    ? "error"
                    : t.blocks.some((b) => b.type === "choice")
                      ? "info"
                      : "success"
                }
              />
              <SalesCommandBlocks
                blocks={t.blocks.length ? t.blocks : [{ type: "text", text: t.content }]}
                disabled={loading}
                onSelect={(opt) => void send(opt.title, opt)}
                onAction={(prompt) => void send(prompt)}
              />
            </div>
          )
        )
      )}
      {loading ? <CommandExecutionStatus phase={phase} /> : null}
    </div>
  );

  if (compact) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
          {context?.customerName ? (
            <div className="flex items-center gap-2.5 rounded-[10px] border border-sales-border bg-sales-surface px-3 py-2.5">
              <UserRound size={16} className="shrink-0 text-sales-text-muted" aria-hidden />
              <div className="min-w-0">
                <p className="truncate text-[13px] font-semibold text-sales-text-primary">{context.customerName}</p>
                {context.dealName ? (
                  <p className="truncate text-[11px] text-sales-text-muted">
                    {context.dealName}
                    {context.dealStage ? ` · ${context.dealStage}` : ""}
                  </p>
                ) : null}
              </div>
            </div>
          ) : null}
          {results}
        </div>
        <div className="shrink-0 border-t border-sales-border-subtle px-4 py-3">{composer}</div>
        {onClose ? (
          <button type="button" className="sr-only" onClick={onClose}>
            Close
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0" />
        <div className="inline-flex items-center gap-2 rounded-full border border-sales-border bg-sales-surface px-2.5 py-1">
          <StatusDot tone={agentOn ? "success" : "neutral"} size="sm" />
          <span className="text-[11px] font-medium text-sales-text-secondary">Sales Agent</span>
          <span className="text-[11px] font-semibold text-sales-text-primary">{agentOn ? "Active" : "Off"}</span>
        </div>
      </div>

      {quickActions}

      {focusMode ? (
        <div className="min-h-[60vh] overflow-hidden rounded-[12px] border border-sales-border bg-sales-surface">
          <TodaysFocusPanel onDraft={onFocusDraft} onPrepareQuote={onFocusPrepareQuote} />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-5 layout:grid-cols-[minmax(0,1fr)_minmax(240px,0.32fr)] layout:gap-6">
            <div className="min-w-0 space-y-4">
              {composer}
              <CommandExampleChips
                examples={[
                  "What should I focus on today?",
                  ...examples,
                ]}
                onSelect={(ex) => void send(ex)}
              />
              {results}
            </div>
            <aside className="hidden min-w-0 layout:block">
              <div className="sticky top-4 rounded-[12px] border border-sales-border bg-sales-surface-subtle/60 p-4">
                <SalesContextRail context={context} onFindCustomer={() => setInput("Find customer ")} />
              </div>
            </aside>
          </div>

          <div className="layout:hidden">
            <details className="rounded-[12px] border border-sales-border bg-sales-surface">
              <summary className="cursor-pointer list-none px-4 py-3 text-[13px] font-semibold text-sales-text-primary">
                Current context
              </summary>
              <div className="border-t border-sales-border-subtle px-4 py-3">
                <SalesContextRail context={context} compact onFindCustomer={() => setInput("Find customer ")} />
              </div>
            </details>
          </div>
        </>
      )}
    </div>
  );
}
