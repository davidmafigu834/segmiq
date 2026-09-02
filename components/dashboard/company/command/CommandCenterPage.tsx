"use client";

import { useCallback, useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import Link from "next/link";
import { ThumbsDown, ThumbsUp } from "lucide-react";
import { CompanyWorkspaceShell } from "@/components/dashboard/company/CompanyWorkspaceShell";
import { CompanyDashboardHeader } from "@/components/dashboard/company/CompanyDashboardHeader";
import { Button, StatusDot } from "@/components/sales/ui";
import {
  CommandAttentionStrip,
  CommandCommandRow,
  CommandComposer,
  CommandEmptyState,
  CommandExampleChips,
  CommandExecutionStatus,
  CommandRailSection,
  CommandRailStat,
  CommandResultHeader,
  CommandScopeChip,
} from "@/components/command/CommandPrimitives";
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
  { label: "What needs my attention today?", prompt: "What needs my attention today?" },
  { label: "Which Deals are at risk?", prompt: "Show Deals with no next action" },
  { label: "Show quotation approvals", prompt: "Show quotations waiting for approval" },
  { label: "Who has overdue follow-ups?", prompt: "Show overdue follow-ups" },
  { label: "What changed since yesterday?", prompt: "What did SegmiQ Agent do overnight?" },
];

const SCOPE_CHIPS = [
  { label: "Today", prompt: "What needs my attention today?" },
  { label: "My team", prompt: "Show team performance this month" },
  { label: "Pipeline", prompt: "Show Deals with no next action" },
  { label: "Quotations", prompt: "Show quotations waiting for approval" },
  { label: "Agent", prompt: "Show conversations waiting for a human" },
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
  const [activeScope, setActiveScope] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const composerId = useId();

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
      setPhase("Checking live sales data…");
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

  async function decide(confirmationId: string, decision: "confirm" | "cancel") {
    setLoading(true);
    setPhase(decision === "confirm" ? "Executing approved action…" : "Cancelling…");
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

  const brief = snapshot?.brief;
  const attentionItems = brief
    ? [
        {
          id: "waiting",
          label: "customers waiting",
          count: brief.customersWaiting,
          onClick: () => void send("Which customers are waiting for us?"),
        },
        {
          id: "approvals",
          label: "quote approvals",
          count: brief.quoteApprovals,
          onClick: () => void send("Show quotations waiting for approval"),
        },
        {
          id: "no-action",
          label: "no next action",
          count: brief.dealsNoNextAction,
          onClick: () => void send("Show Deals with no next action"),
        },
        {
          id: "overdue",
          label: "overdue tasks",
          count: brief.overdueFollowUps,
          onClick: () => void send("Show overdue follow-ups"),
        },
        {
          id: "agent",
          label: "Agent escalations",
          count: brief.humanNeeded,
          onClick: () => void send("Show conversations waiting for a human"),
        },
      ].filter((i) => i.count > 0 || messages.length === 0)
    : [];

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
      <div className="flex h-full min-h-0 flex-col">
        <div className="shrink-0 px-4 pt-3 sm:px-6 layout:px-8 layout:pt-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <CompanyDashboardHeader
              unreadNotifications={unreadNotifications}
              notificationRole={notificationRole}
              userName={userName}
              avatarUrl={avatarUrl}
              canAddLead={false}
              breadcrumb="Company / Command Center"
              title="Command Center"
              description="Ask about the business or tell SegmiQ what to do."
              primaryAction={null}
            />
            <div className="inline-flex items-center gap-2 rounded-full border border-sales-border bg-sales-surface px-2.5 py-1">
              <StatusDot tone="success" size="sm" />
              <span className="text-[11px] font-medium text-sales-text-secondary">Manager Agent</span>
              <span className="text-[11px] font-semibold text-sales-text-primary">Active</span>
            </div>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6 layout:px-8">
          <div className="grid grid-cols-1 gap-5 layout:grid-cols-[minmax(0,1fr)_minmax(240px,0.28fr)] layout:gap-6">
            <div className="min-w-0 space-y-4">
              {attentionItems.length ? <CommandAttentionStrip items={attentionItems} /> : null}

              <form onSubmit={onSubmit}>
                <CommandComposer
                  id={composerId}
                  value={input}
                  onChange={setInput}
                  onSubmit={() => void send(input)}
                  onKeyDown={onKeyDown}
                  placeholder="Ask about your sales operation or tell SegmiQ what to do…"
                  loading={loading}
                  rows={2}
                  scopeChips={SCOPE_CHIPS.map((chip) => (
                    <CommandScopeChip
                      key={chip.label}
                      label={chip.label}
                      active={activeScope === chip.label}
                      onClick={() => {
                        setActiveScope(chip.label);
                        void send(chip.prompt);
                      }}
                    />
                  ))}
                />
              </form>

              <CommandExampleChips
                examples={QUICK_PROMPTS.map((q) => q.label)}
                onSelect={(label) => {
                  const hit = QUICK_PROMPTS.find((q) => q.label === label);
                  if (hit) void send(hit.prompt);
                }}
              />

              <div ref={listRef} className="space-y-4">
                {messages.length === 0 ? (
                  <CommandEmptyState
                    title="Ask about your sales operation"
                    description="SegmiQ can surface what needs attention or help you carry out approved actions across the team."
                  />
                ) : (
                  messages.map((m) =>
                    m.role === "user" ? (
                      <CommandCommandRow key={m.id} role="user" content={m.content} />
                    ) : (
                      <div
                        key={m.id}
                        className="space-y-3 rounded-[12px] border border-sales-border bg-sales-surface p-4 shadow-sales-card"
                      >
                        <CommandResultHeader
                          title={resultTitle(m)}
                          tone={resultTone(m)}
                        />
                        {m.blocks.length ? (
                          m.blocks.map((block, i) => (
                            <BlockView key={`${m.id}-${i}`} block={block} onConfirm={decide} onPrompt={(p) => void send(p)} />
                          ))
                        ) : (
                          <p className="whitespace-pre-wrap text-[14px] leading-relaxed text-sales-text-primary">
                            {m.content}
                          </p>
                        )}
                        {m.executionId ? <FeedbackRow executionId={m.executionId} /> : null}
                      </div>
                    )
                  )
                )}
                {loading ? <CommandExecutionStatus phase={phase} label="Checking the live operation" /> : null}
              </div>
            </div>

            <aside className="hidden min-w-0 layout:block">
              <div className="sticky top-4 space-y-5 rounded-[12px] border border-sales-border bg-sales-surface-subtle/60 p-4">
                <OperationalContextRail
                  snapshot={snapshot}
                  onPrompt={(p) => void send(p)}
                />
              </div>
            </aside>
          </div>

          <div className="mt-4 layout:hidden">
            <details className="rounded-[12px] border border-sales-border bg-sales-surface">
              <summary className="cursor-pointer list-none px-4 py-3 text-[13px] font-semibold text-sales-text-primary">
                Operation context
              </summary>
              <div className="border-t border-sales-border-subtle px-4 py-3">
                <OperationalContextRail snapshot={snapshot} onPrompt={(p) => void send(p)} />
              </div>
            </details>
          </div>
        </div>
      </div>
    </CompanyWorkspaceShell>
  );
}

function resultTitle(m: ChatMessage): string {
  if (m.blocks.some((b) => b.type === "confirmation")) return "Ready for confirmation";
  if (m.blocks.some((b) => b.type === "attention")) return "Needs your attention";
  if (m.blocks.some((b) => b.type === "table")) {
    const table = m.blocks.find((b) => b.type === "table");
    if (table && table.type === "table") return table.title;
  }
  if (m.blocks.some((b) => b.type === "status" && (b.kind === "error" || b.kind === "denied"))) {
    return "Couldn't complete";
  }
  return "Result";
}

function resultTone(m: ChatMessage): "success" | "warning" | "error" | "neutral" | "info" {
  if (m.blocks.some((b) => b.type === "status" && (b.kind === "error" || b.kind === "denied"))) return "error";
  if (m.blocks.some((b) => b.type === "confirmation")) return "warning";
  if (m.blocks.some((b) => b.type === "attention")) return "info";
  return "success";
}

function OperationalContextRail({
  snapshot,
  onPrompt,
}: {
  snapshot: AttentionSnapshot | null;
  onPrompt: (prompt: string) => void;
}) {
  if (!snapshot) {
    return <p className="text-[12px] text-sales-text-muted">Loading operation context…</p>;
  }
  const b = snapshot.brief;
  return (
    <div className="space-y-5">
      <CommandRailSection title="Today">
        <CommandRailStat
          label="Customers waiting"
          value={b.customersWaiting}
          emphasize
          onClick={() => onPrompt("Which customers are waiting for us?")}
        />
        <CommandRailStat
          label="Overdue tasks"
          value={b.overdueFollowUps}
          emphasize
          onClick={() => onPrompt("Show overdue follow-ups")}
        />
        <CommandRailStat
          label="Appointments"
          value={b.appointmentsToday}
          onClick={() => onPrompt("What appointments do we have today?")}
        />
      </CommandRailSection>

      <CommandRailSection title="Pipeline">
        <CommandRailStat
          label="No next action"
          value={b.dealsNoNextAction}
          emphasize
          onClick={() => onPrompt("Show Deals with no next action")}
        />
      </CommandRailSection>

      <CommandRailSection title="Quotations">
        <CommandRailStat
          label="Awaiting approval"
          value={b.quoteApprovals}
          emphasize
          onClick={() => onPrompt("Show quotations waiting for approval")}
        />
      </CommandRailSection>

      <CommandRailSection title="SegmiQ Agent">
        <CommandRailStat
          label="Human needed"
          value={b.humanNeeded}
          emphasize
          onClick={() => onPrompt("Show conversations waiting for a human")}
        />
        <CommandRailStat label="Failed actions" value={b.failedProactive} emphasize />
      </CommandRailSection>
    </div>
  );
}

function BlockView({
  block,
  onConfirm,
  onPrompt,
}: {
  block: ManagerBlock;
  onConfirm: (id: string, decision: "confirm" | "cancel") => void;
  onPrompt: (prompt: string) => void;
}) {
  if (block.type === "text") {
    return <p className="whitespace-pre-wrap text-[14px] leading-relaxed text-sales-text-primary">{block.text}</p>;
  }
  if (block.type === "status") {
    return (
      <p
        className={cn(
          "rounded-[10px] border px-3 py-2.5 text-[13px]",
          block.kind === "denied" || block.kind === "error"
            ? "border-sales-danger/30 bg-sales-danger-soft text-sales-danger-fg"
            : "border-sales-border bg-sales-surface-subtle text-sales-text-primary"
        )}
      >
        {block.message}
      </p>
    );
  }
  if (block.type === "attention") {
    return (
      <div className="space-y-4">
        {block.snapshot.groups.map((g) => (
          <div key={g.type}>
            <div className="mb-2 flex items-baseline justify-between gap-2 border-b border-sales-border-subtle pb-1.5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-sales-text-muted">
                {g.label}
              </p>
              <p className="text-[13px] font-semibold tabular-nums text-sales-text-primary">{g.count}</p>
            </div>
            <ul className="space-y-1.5">
              {block.snapshot.items
                .filter((item) => item.type === g.type)
                .slice(0, 5)
                .map((item) => (
                  <li key={item.id}>
                    <Link
                      href={item.href}
                      className="flex items-start justify-between gap-3 rounded-[8px] px-1 py-1.5 transition-colors hover:bg-sales-surface-subtle"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-[13px] font-medium text-sales-text-primary">
                          {item.title}
                        </span>
                        <span className="block truncate text-[11px] text-sales-text-muted">
                          {[item.waitingLabel || item.reason, item.ownerName].filter(Boolean).join(" · ")}
                        </span>
                      </span>
                      <span className="shrink-0 text-[11px] font-medium text-sales-text-secondary">Open →</span>
                    </Link>
                  </li>
                ))}
            </ul>
            <button
              type="button"
              className="mt-1 text-[11px] font-medium text-sales-text-secondary hover:text-sales-text-primary"
              onClick={() => onPrompt(promptForGroup(g.type))}
            >
              View all
            </button>
          </div>
        ))}
      </div>
    );
  }
  if (block.type === "table") {
    return <ResultTable block={block} />;
  }
  if (block.type === "confirmation") {
    const highRisk = block.preview.risk === "HIGH" || block.preview.risk === "VERY_HIGH";
    return (
      <div
        className={cn(
          "rounded-[12px] border p-4",
          highRisk
            ? "border-sales-danger/35 bg-sales-danger-soft/40"
            : "border-sales-border-strong bg-sales-surface-subtle"
        )}
      >
        <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-sales-text-muted">
          {block.preview.risk.replace("_", " ").toLowerCase()} risk · confirmation required
        </p>
        <h3 className="mt-1 text-[15px] font-semibold text-sales-text-primary">{block.preview.title}</h3>
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
        {block.preview.exclusions?.length ? (
          <ul className="mt-2 space-y-1 text-[12px] text-sales-text-muted">
            {block.preview.exclusions.map((ex) => (
              <li key={ex}>Excluded · {ex}</li>
            ))}
          </ul>
        ) : null}
        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            size="sm"
            variant={highRisk ? "danger" : "primary"}
            onClick={() => onConfirm(block.confirmationId, "confirm")}
          >
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
      <div className="rounded-[10px] border border-sales-border bg-sales-surface-subtle p-3.5">
        <h3 className="text-[15px] font-semibold text-sales-text-primary">{String(d.customer ?? "Customer")}</h3>
        {deal ? (
          <p className="mt-1 text-[13px] text-sales-text-secondary">
            Active Deal: {deal.name}
            {deal.stage ? ` · ${deal.stage}` : ""}
            {deal.value ? ` · ${deal.value}` : ""}
          </p>
        ) : (
          <p className="mt-1 text-[13px] text-sales-text-secondary">No active Deal</p>
        )}
        {typeof d.href === "string" ? (
          <Link href={d.href} className="mt-3 inline-block text-[12px] font-medium text-sales-text-secondary hover:text-sales-text-primary">
            Open →
          </Link>
        ) : null}
      </div>
    );
  }
  if (block.type === "disambiguation") {
    return (
      <div className="space-y-2">
        <p className="text-[13px] font-medium text-sales-text-primary">{block.prompt}</p>
        {block.options.map((row) => (
          <RowLink key={row.id} row={row} />
        ))}
      </div>
    );
  }
  if (block.type === "suggestions") {
    return (
      <div className="flex flex-wrap gap-2">
        {block.actions
          .filter((a) => a.prompt)
          .map((a) => (
            <button
              key={a.label}
              type="button"
              onClick={() => onPrompt(a.prompt)}
              className="rounded-full border border-sales-border px-2.5 py-1 text-[11px] text-sales-text-secondary hover:border-sales-border-strong hover:text-sales-text-primary"
            >
              {a.label}
            </button>
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

function ResultTable({ block }: { block: Extract<ManagerBlock, { type: "table" }> }) {
  return (
    <div className="overflow-hidden rounded-[10px] border border-sales-border">
      <div className="flex items-baseline justify-between gap-2 border-b border-sales-border bg-sales-surface-subtle px-3 py-2">
        <p className="text-[12px] font-semibold text-sales-text-primary">{block.title}</p>
        <p className="text-[11px] tabular-nums text-sales-text-muted">{block.totalMatched}</p>
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
              <tr key={row.id} className="border-t border-sales-border-subtle">
                <td className="px-3 py-2.5 font-medium text-sales-text-primary">{row.title}</td>
                <td className="px-3 py-2.5 text-sales-text-secondary">{row.subtitle || row.status || "—"}</td>
                {block.columns.slice(2).map((c) => (
                  <td key={c.key} className="px-3 py-2.5 text-sales-text-secondary">
                    {cellValue(row, c.key)}
                  </td>
                ))}
                <td className="px-3 py-2.5 text-right">
                  <Link href={row.href} className="font-medium text-sales-text-secondary hover:text-sales-text-primary">
                    Open
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="divide-y divide-sales-border-subtle sm:hidden">
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
        {[row.subtitle, row.status, row.valueLabel, row.ownerName].filter(Boolean).join(" · ") || "—"}
      </p>
    </Link>
  );
}

function FeedbackRow({ executionId }: { executionId: string }) {
  const [done, setDone] = useState(false);
  if (done) return <p className="text-[11px] text-sales-text-muted">Thanks.</p>;
  return (
    <div className="flex gap-2 border-t border-sales-border-subtle pt-2">
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
        <ThumbsUp size={12} aria-hidden /> Helpful
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
        <ThumbsDown size={12} aria-hidden /> Not correct
      </button>
    </div>
  );
}
