"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import Link from "next/link";
import { Loader2, SendHorizontal, ThumbsDown, ThumbsUp } from "lucide-react";
import { CompanyWorkspaceShell } from "@/components/dashboard/company/CompanyWorkspaceShell";
import { CompanyDashboardHeader } from "@/components/dashboard/company/CompanyDashboardHeader";
import { Button } from "@/components/sales/ui";
import { cn } from "@/lib/ui/cn";
import type { UserRole } from "@/types";
import type { AttentionSnapshot, ManagerBlock, ResultRow } from "@/lib/agent/manager/types";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  blocks: ManagerBlock[];
  executionId?: string | null;
};

const QUICK_PROMPTS = [
  { label: "What needs attention?", prompt: "What needs my attention today?" },
  { label: "Approval queue", prompt: "Show quotations waiting for approval" },
  { label: "Customers waiting", prompt: "Which customers are waiting for us?" },
  { label: "Agent overnight", prompt: "What did SegmiQ Agent do overnight?" },
  { label: "Viewing approvals", prompt: "Show viewing approvals waiting" },
  { label: "Deals at risk", prompt: "Show Deals with no next action" },
  { label: "Today's appointments", prompt: "What appointments do we have today?" },
];

export function CommandCenterPage({
  clientId,
  companyName,
  companyLogoUrl,
  userName,
  avatarUrl,
  unreadNotifications,
  notificationRole,
  whatsappBadge,
}: {
  clientId: string;
  companyName: string;
  companyLogoUrl: string | null;
  userName: string;
  avatarUrl: string | null;
  unreadNotifications: number;
  notificationRole: UserRole;
  whatsappBadge: number;
}) {
  const [snapshot, setSnapshot] = useState<AttentionSnapshot | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [phase, setPhase] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void fetch(`/api/agent/manager/chat?clientId=${clientId}`)
      .then((r) => r.json())
      .then((j: { snapshot?: AttentionSnapshot }) => {
        if (j.snapshot) setSnapshot(j.snapshot);
      })
      .catch(() => undefined);
  }, [clientId]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  const send = useCallback(
    async (text: string) => {
      const message = text.trim();
      if (!message || loading) return;
      setInput("");
      setMessages((prev) => [
        ...prev,
        { id: `u-${Date.now()}`, role: "user", content: message, blocks: [] },
      ]);
      setLoading(true);
      setPhase("Checking live sales data...");
      try {
        const res = await fetch(`/api/agent/manager/chat?clientId=${clientId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message, sessionId }),
        });
        const j = (await res.json()) as {
          reply?: string;
          blocks?: ManagerBlock[];
          sessionId?: string;
          executionId?: string | null;
          phase?: string | null;
          error?: string;
        };
        if (j.sessionId) setSessionId(j.sessionId);
        if (j.phase) setPhase(j.phase);
        const attention = j.blocks?.find((b) => b.type === "attention");
        if (attention && attention.type === "attention") setSnapshot(attention.snapshot);
        setMessages((prev) => [
          ...prev,
          {
            id: `a-${Date.now()}`,
            role: "assistant",
            content: j.reply || j.error || "I couldn't complete that request.",
            blocks: j.blocks ?? [],
            executionId: j.executionId,
          },
        ]);
      } catch {
        setMessages((prev) => [
          ...prev,
          {
            id: `e-${Date.now()}`,
            role: "assistant",
            content: "I couldn't retrieve the current data.",
            blocks: [{ type: "status", kind: "error", message: "I couldn't retrieve the current data." }],
          },
        ]);
      } finally {
        setLoading(false);
        setPhase(null);
      }
    },
    [clientId, loading, sessionId]
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

  async function decide(confirmationId: string, decision: "confirm" | "cancel") {
    setLoading(true);
    setPhase(decision === "confirm" ? "Executing approved action..." : "Cancelling...");
    try {
      const res = await fetch(`/api/agent/manager/confirm?clientId=${clientId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmationId, decision }),
      });
      const j = (await res.json()) as { reply?: string; blocks?: ManagerBlock[] };
      setMessages((prev) => [
        ...prev,
        {
          id: `c-${Date.now()}`,
          role: "assistant",
          content: j.reply || "Done.",
          blocks: j.blocks ?? [],
        },
      ]);
    } finally {
      setLoading(false);
      setPhase(null);
    }
  }

  return (
    <CompanyWorkspaceShell
      companyName={companyName}
      companyLogoUrl={companyLogoUrl}
      userName={userName}
      avatarUrl={avatarUrl}
      unreadNotifications={unreadNotifications}
      notificationRole={notificationRole}
      whatsappBadge={whatsappBadge}
      immersive
    >
      <div className="flex h-full min-h-0 flex-col layout:flex-row">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <div className="shrink-0 px-4 pt-3 sm:px-6 layout:px-8 layout:pt-6">
            <CompanyDashboardHeader
              unreadNotifications={unreadNotifications}
              notificationRole={notificationRole}
              userName={userName}
              avatarUrl={avatarUrl}
              canAddLead={false}
              breadcrumb="Company / Command Center"
              title="Command Center"
              description="Ask SegmiQ what's happening across your sales operation and take action."
              primaryAction={null}
            />
          </div>

          <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6 layout:px-8">
            {messages.length === 0 ? (
              <EmptyState snapshot={snapshot} onPrompt={(p) => void send(p)} />
            ) : (
              <div className="mx-auto flex max-w-3xl flex-col gap-5">
                {messages.map((m) => (
                  <MessageBubble key={m.id} message={m} onConfirm={decide} />
                ))}
                {loading ? (
                  <p className="flex items-center gap-2 text-[13px] text-sales-text-muted">
                    <Loader2 size={14} className="animate-spin" />
                    {phase || "Working..."}
                  </p>
                ) : null}
              </div>
            )}
          </div>

          <div className="shrink-0 border-t border-sales-border bg-sales-bg px-4 py-3 sm:px-6 layout:px-8">
            <form onSubmit={onSubmit} className="mx-auto max-w-3xl">
              <div className="flex items-end gap-2 rounded-sales-md border border-sales-border-strong bg-sales-surface px-3 py-2 shadow-sales-card">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={onKeyDown}
                  rows={1}
                  placeholder="Ask SegmiQ about Leads, Deals, quotations, customers or your team..."
                  className="max-h-28 min-h-[40px] flex-1 resize-none bg-transparent py-2 text-[14px] text-sales-text-primary outline-none placeholder:text-sales-text-muted"
                />
                <Button type="submit" size="sm" disabled={loading || !input.trim()} leftIcon={<SendHorizontal size={14} />}>
                  Ask
                </Button>
              </div>
              <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
                {QUICK_PROMPTS.map((q) => (
                  <button
                    key={q.label}
                    type="button"
                    onClick={() => void send(q.prompt)}
                    className="shrink-0 rounded-full border border-sales-border bg-sales-surface px-3 py-1 text-[11px] font-medium text-sales-text-secondary hover:bg-sales-surface-hover"
                  >
                    {q.label}
                  </button>
                ))}
              </div>
            </form>
          </div>
        </div>

        <aside className="hidden w-[280px] shrink-0 border-l border-sales-border bg-sales-surface-subtle layout:flex layout:flex-col">
          <div className="border-b border-sales-border px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-sales-text-muted">Attention</p>
            <p className="mt-1 text-[12px] text-sales-text-secondary">Live operational snapshot</p>
          </div>
          <div className="flex-1 overflow-y-auto px-4 py-3">
            {snapshot ? <AttentionRail snapshot={snapshot} onPrompt={(p) => void send(p)} /> : (
              <p className="text-[12px] text-sales-text-muted">Loading...</p>
            )}
          </div>
        </aside>
      </div>
    </CompanyWorkspaceShell>
  );
}

function EmptyState({
  snapshot,
  onPrompt,
}: {
  snapshot: AttentionSnapshot | null;
  onPrompt: (prompt: string) => void;
}) {
  const groups = snapshot?.groups ?? [];
  return (
    <div className="mx-auto max-w-3xl">
      <h2 className="text-[18px] font-semibold tracking-[-0.02em] text-sales-text-primary">
        What needs your attention?
      </h2>
      <p className="mt-1 text-[13px] text-sales-text-secondary">
        Ask SegmiQ anything about your sales operation.
      </p>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {groups.length ? (
          groups.slice(0, 6).map((g) => (
            <button
              key={g.type}
              type="button"
              onClick={() => onPrompt(promptForGroup(g.type))}
              className="rounded-sales-md border border-sales-border bg-sales-surface px-4 py-3 text-left shadow-sales-card hover:bg-sales-surface-hover"
            >
              <p className="text-[20px] font-semibold tabular-nums text-sales-text-primary">{g.count}</p>
              <p className="mt-0.5 text-[12px] text-sales-text-secondary">{g.label}</p>
            </button>
          ))
        ) : (
          <div className="rounded-sales-md border border-sales-border bg-sales-surface px-4 py-3 sm:col-span-2">
            <p className="text-[13px] text-sales-text-secondary">
              {snapshot ? "No urgent issues detected." : "Loading live attention items..."}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function promptForGroup(type: string): string {
  if (type === "QUOTE_APPROVAL") return "Show quotations waiting for approval";
  if (type === "CUSTOMER_WAITING") return "Which customers are waiting for us?";
  if (type === "DEAL_NO_NEXT_ACTION") return "Show Deals with no next action";
  if (type === "OVERDUE_FOLLOW_UP") return "Show overdue follow-ups";
  if (type === "APPOINTMENT_TODAY") return "What appointments do we have today?";
  if (type === "AGENT_HUMAN_NEEDED") return "Show conversations waiting for a human";
  if (type === "SUPPORT_OPEN") return "Show unresolved support cases";
  return "What needs my attention today?";
}

function AttentionRail({
  snapshot,
  onPrompt,
}: {
  snapshot: AttentionSnapshot;
  onPrompt: (prompt: string) => void;
}) {
  const b = snapshot.brief;
  const rows = [
    { label: "Approvals", value: b.quoteApprovals, prompt: "Show quotations waiting for approval" },
    { label: "Customers waiting", value: b.customersWaiting, prompt: "Which customers are waiting for us?" },
    { label: "No next action", value: b.dealsNoNextAction, prompt: "Show Deals with no next action" },
    { label: "Human needed", value: b.humanNeeded, prompt: "Show conversations waiting for a human" },
    { label: "Today", value: b.appointmentsToday, prompt: "What appointments do we have today?" },
  ];
  return (
    <ul className="space-y-2">
      {rows.map((r) => (
        <li key={r.label}>
          <button
            type="button"
            onClick={() => onPrompt(r.prompt)}
            className="flex w-full items-baseline justify-between rounded-md px-1 py-1 text-left hover:bg-sales-surface"
          >
            <span className="text-[12px] text-sales-text-secondary">{r.label}</span>
            <span className="text-[13px] font-semibold tabular-nums text-sales-text-primary">{r.value}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}

function MessageBubble({
  message,
  onConfirm,
}: {
  message: ChatMessage;
  onConfirm: (id: string, decision: "confirm" | "cancel") => void;
}) {
  if (message.role === "user") {
    return (
      <div className="ml-auto max-w-[85%] rounded-sales-md bg-sales-neutral-100 px-3.5 py-2 text-[14px] text-sales-text-primary">
        {message.content}
      </div>
    );
  }
  return (
    <div className="max-w-full space-y-3">
      {message.blocks.length ? (
        message.blocks.map((block, i) => <BlockView key={`${message.id}-${i}`} block={block} onConfirm={onConfirm} />)
      ) : (
        <p className="whitespace-pre-wrap text-[14px] leading-6 text-sales-text-primary">{message.content}</p>
      )}
      {message.executionId ? <FeedbackRow executionId={message.executionId} /> : null}
    </div>
  );
}

function BlockView({
  block,
  onConfirm,
}: {
  block: ManagerBlock;
  onConfirm: (id: string, decision: "confirm" | "cancel") => void;
}) {
  if (block.type === "text") {
    return <p className="whitespace-pre-wrap text-[14px] leading-6 text-sales-text-primary">{block.text}</p>;
  }
  if (block.type === "status") {
    return (
      <p
        className={cn(
          "rounded-sales-md border px-3 py-2 text-[13px]",
          block.kind === "denied" || block.kind === "error"
            ? "border-sales-danger/30 bg-sales-danger/5 text-sales-text-primary"
            : "border-sales-border bg-sales-surface text-sales-text-primary"
        )}
      >
        {block.message}
      </p>
    );
  }
  if (block.type === "attention") {
    return (
      <div className="grid gap-2 sm:grid-cols-2">
        {block.snapshot.groups.map((g) => (
          <div key={g.type} className="rounded-sales-md border border-sales-border bg-sales-surface px-3 py-2">
            <p className="text-[16px] font-semibold tabular-nums">{g.count}</p>
            <p className="text-[12px] text-sales-text-secondary">{g.label}</p>
          </div>
        ))}
      </div>
    );
  }
  if (block.type === "table") {
    return <ResultTable block={block} />;
  }
  if (block.type === "confirmation") {
    return (
      <div className="rounded-sales-md border border-sales-border-strong bg-sales-surface p-4 shadow-sales-card">
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-sales-text-muted">
          {block.preview.risk} risk
        </p>
        <h3 className="mt-1 text-[15px] font-semibold">{block.preview.title}</h3>
        <p className="mt-1 text-[13px] text-sales-text-secondary">{block.preview.summary}</p>
        {block.preview.breakdown?.length ? (
          <ul className="mt-3 space-y-1 text-[12px] text-sales-text-secondary">
            {block.preview.breakdown.map((row) => (
              <li key={row.label}>
                <span className="font-medium text-sales-text-primary">{row.label}:</span> {row.value}
              </li>
            ))}
          </ul>
        ) : null}
        <div className="mt-4 flex flex-wrap gap-2">
          <Button size="sm" onClick={() => onConfirm(block.confirmationId, "confirm")}>
            Confirm
          </Button>
          <Button size="sm" variant="secondary" onClick={() => onConfirm(block.confirmationId, "cancel")}>
            Cancel
          </Button>
        </div>
      </div>
    );
  }
  if (block.type === "customer360") {
    const d = block.data as Record<string, unknown>;
    const deal = d.deal as { name?: string; stage?: string; value?: string; href?: string } | null;
    return (
      <div className="rounded-sales-md border border-sales-border bg-sales-surface p-4">
        <h3 className="text-[15px] font-semibold">{String(d.customer ?? "Customer")}</h3>
        {deal ? (
          <p className="mt-1 text-[13px] text-sales-text-secondary">
            Active Deal: {deal.name} · {deal.stage} · {deal.value}
          </p>
        ) : (
          <p className="mt-1 text-[13px] text-sales-text-secondary">No active Deal</p>
        )}
        {typeof d.href === "string" ? (
          <Link href={d.href} className="mt-3 inline-block text-[12px] font-medium text-sales-brand-fg">
            Open conversation
          </Link>
        ) : null}
      </div>
    );
  }
  if (block.type === "disambiguation") {
    return (
      <div className="space-y-2">
        <p className="text-[13px] font-medium">{block.prompt}</p>
        {block.options.map((row) => (
          <RowLink key={row.id} row={row} />
        ))}
      </div>
    );
  }
  if (block.type === "suggestions") {
    return (
      <div className="flex flex-wrap gap-2">
        {block.actions.filter((a) => a.prompt).map((a) => (
          <span key={a.label} className="rounded-full border border-sales-border px-2.5 py-1 text-[11px] text-sales-text-muted">
            {a.label}
          </span>
        ))}
      </div>
    );
  }
  if (block.type === "sources") {
    const parts = Object.entries(block.counts).map(([k, v]) => `${v} ${k}`);
    return (
      <p className="text-[11px] text-sales-text-muted">
        Based on {parts.join(" · ")} · activity through{" "}
        {new Date(block.asOf).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
      </p>
    );
  }
  return null;
}

function ResultTable({ block }: { block: Extract<ManagerBlock, { type: "table" }> }) {
  return (
    <div className="overflow-hidden rounded-sales-md border border-sales-border">
      <div className="border-b border-sales-border bg-sales-surface-subtle px-3 py-2 text-[12px] font-medium">
        {block.title}
        <span className="ml-2 text-sales-text-muted">{block.totalMatched}</span>
      </div>
      <div className="hidden overflow-x-auto sm:block">
        <table className="w-full text-left text-[12px]">
          <thead className="text-sales-text-muted">
            <tr>
              {block.columns.map((c) => (
                <th key={c.key} className="px-3 py-2 font-medium">
                  {c.label}
                </th>
              ))}
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {block.rows.map((row) => (
              <tr key={row.id} className="border-t border-sales-border">
                <td className="px-3 py-2 font-medium text-sales-text-primary">{row.title}</td>
                <td className="px-3 py-2 text-sales-text-secondary">{row.subtitle || row.status}</td>
                {block.columns.slice(2).map((c) => (
                  <td key={c.key} className="px-3 py-2 text-sales-text-secondary">
                    {cellValue(row, c.key)}
                  </td>
                ))}
                <td className="px-3 py-2 text-right">
                  <Link href={row.href} className="font-medium text-sales-brand-fg">
                    Open
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="divide-y divide-sales-border sm:hidden">
        {block.rows.map((row) => (
          <li key={row.id} className="px-3 py-3">
            <RowLink row={row} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function cellValue(row: ResultRow, key: string): string {
  if (key === "title") return row.title;
  if (key === "subtitle") return row.subtitle ?? "—";
  if (key === "status") return row.status ?? "—";
  if (key === "valueLabel") return row.valueLabel ?? "—";
  if (key === "ownerName") return row.ownerName ?? "—";
  if (key.startsWith("meta.")) {
    const k = key.slice(5);
    const v = row.meta[k];
    return v == null ? "—" : String(v);
  }
  return "—";
}

function RowLink({ row }: { row: ResultRow }) {
  return (
    <Link href={row.href} className="block">
      <p className="text-[13px] font-medium text-sales-text-primary">{row.title}</p>
      <p className="text-[12px] text-sales-text-secondary">
        {[row.subtitle, row.status, row.valueLabel, row.ownerName].filter(Boolean).join(" · ")}
      </p>
    </Link>
  );
}

function FeedbackRow({ executionId }: { executionId: string }) {
  const [done, setDone] = useState(false);
  if (done) return <p className="text-[11px] text-sales-text-muted">Thanks.</p>;
  return (
    <div className="flex gap-2">
      <button
        type="button"
        className="inline-flex items-center gap-1 text-[11px] text-sales-text-muted hover:text-sales-text-primary"
        onClick={() => {
          void fetch("/api/agent/manager/feedback", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ executionId, helpful: true }),
          });
          setDone(true);
        }}
      >
        <ThumbsUp size={12} /> Helpful
      </button>
      <button
        type="button"
        className="inline-flex items-center gap-1 text-[11px] text-sales-text-muted hover:text-sales-text-primary"
        onClick={() => {
          void fetch("/api/agent/manager/feedback", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ executionId, helpful: false, category: "wrong_interpretation" }),
          });
          setDone(true);
        }}
      >
        <ThumbsDown size={12} /> Not correct
      </button>
    </div>
  );
}
