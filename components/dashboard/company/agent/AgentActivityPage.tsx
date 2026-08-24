"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  ChevronRight,
  Loader2,
  MessageSquare,
  RefreshCw,
  Settings2,
  ShieldAlert,
  XCircle,
} from "lucide-react";
import { CompanyWorkspaceShell } from "@/components/dashboard/company/CompanyWorkspaceShell";
import { PremiumSheet } from "@/components/sales/PremiumSheet";
import { Button, SegmentedControl, ToastProvider, useSalesToast } from "@/components/sales/ui";
import { cn } from "@/lib/ui/cn";
import type { UserRole } from "@/types";

type ExecutionRow = {
  id: string;
  lead_id: string;
  state: string;
  intents: string[];
  confidence: number | null;
  decision_summary: string | null;
  customer_reply: string | null;
  reply_status: string | null;
  autonomy_mode: string | null;
  model: string | null;
  tool_call_count: number;
  latency_ms: number | null;
  error_code: string | null;
  test_mode: boolean;
  created_at: string;
  completed_at: string | null;
  customer_name: string;
};

type EscalationRow = {
  id: string;
  lead_id: string;
  execution_id: string | null;
  reason: string;
  severity: string;
  summary: string;
  status: string;
  created_at: string;
};

type ActionRow = {
  id: string;
  tool_name: string;
  risk_level: string;
  status: string;
  input_summary: Record<string, unknown> | null;
  result_summary: Record<string, unknown> | null;
  blocked_reason: string | null;
  error: string | null;
  created_record_type: string | null;
  performed_at: string;
};

type Tab = "human" | "completed" | "failed" | "active";

const STATE_STYLES: Record<string, string> = {
  COMPLETED: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  WAITING_FOR_HUMAN: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  FAILED: "bg-red-500/10 text-red-600 dark:text-red-400",
  CANCELLED: "bg-sales-neutral-100 text-sales-text-muted",
  SKIPPED: "bg-sales-neutral-100 text-sales-text-muted",
  RUNNING: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
  QUEUED: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
};

const ACTION_STATUS_STYLES: Record<string, string> = {
  EXECUTED: "text-emerald-600 dark:text-emerald-400",
  SIMULATED: "text-sky-600 dark:text-sky-400",
  BLOCKED: "text-amber-600 dark:text-amber-400",
  FAILED: "text-red-600 dark:text-red-400",
  INVALID: "text-red-600 dark:text-red-400",
};

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function intentLabel(intent: string): string {
  return intent.replace(/_/g, " ").toLowerCase();
}

export function AgentActivityPage(props: {
  clientId: string;
  companyName: string;
  companyLogoUrl: string | null;
  userName: string;
  avatarUrl: string | null;
  unreadNotifications: number;
  notificationRole: UserRole;
  whatsappBadge: number;
}) {
  return (
    <ToastProvider>
      <AgentActivityInner {...props} />
    </ToastProvider>
  );
}

function AgentActivityInner({
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
  const { toast } = useSalesToast();
  const [tab, setTab] = useState<Tab>("human");
  const [executions, setExecutions] = useState<ExecutionRow[]>([]);
  const [escalations, setEscalations] = useState<EscalationRow[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<ExecutionRow | null>(null);
  const [detail, setDetail] = useState<{ actions: ActionRow[]; execution: Record<string, unknown> } | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/agent/activity?tab=${tab}&clientId=${encodeURIComponent(clientId)}`,
        { cache: "no-store" }
      );
      const data = await res.json();
      if (res.ok) {
        setExecutions(data.executions ?? []);
        setCounts(data.counts ?? {});
        setEscalations(data.openEscalations ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, [tab, clientId]);

  useEffect(() => {
    void load();
  }, [load]);

  const openDetail = useCallback(async (row: ExecutionRow) => {
    setSelected(row);
    setDetail(null);
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/agent/executions/${row.id}`, { cache: "no-store" });
      const data = await res.json();
      if (res.ok) setDetail({ actions: data.actions ?? [], execution: data.execution ?? {} });
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const resolveEscalation = useCallback(
    async (id: string, resumeAgent: boolean) => {
      const res = await fetch(`/api/agent/escalations/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "RESOLVED", resumeAgent }),
      });
      if (res.ok) {
        toast({ title: resumeAgent ? "Resolved — agent resumed" : "Resolved — kept with team", tone: "success" });
        void load();
      } else {
        toast({ title: "Could not resolve escalation", tone: "error" });
      }
    },
    [load, toast]
  );

  const tabOptions = useMemo(
    () => [
      { value: "human" as const, label: "Human needed", badge: counts.human || undefined },
      { value: "completed" as const, label: "Completed", badge: counts.completed || undefined },
      { value: "failed" as const, label: "Failed / skipped", badge: counts.failed || undefined },
      { value: "active" as const, label: "Active", badge: counts.active || undefined },
    ],
    [counts]
  );

  return (
    <CompanyWorkspaceShell
      companyName={companyName}
      companyLogoUrl={companyLogoUrl}
      userName={userName}
      avatarUrl={avatarUrl}
      unreadNotifications={unreadNotifications}
      notificationRole={notificationRole}
      whatsappBadge={whatsappBadge}
    >
      <div className="flex min-w-0 flex-col gap-4 pb-8">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-[12px] bg-sales-brand-soft text-sales-brand">
              <Bot size={19} />
            </span>
            <div>
              <h1 className="text-[18px] font-semibold text-sales-text-primary">SegmiQ Agent</h1>
              <p className="text-[12px] text-sales-text-secondary">
                {counts.today ?? 0} runs today · every action logged and explainable
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" leftIcon={<RefreshCw size={13} />} onClick={() => void load()}>
              Refresh
            </Button>
            <Link href="/client/settings/automation/agent">
              <Button variant="secondary" size="sm" leftIcon={<Settings2 size={13} />}>
                Agent settings
              </Button>
            </Link>
          </div>
        </header>

        {escalations.length ? (
          <section className="rounded-[12px] border border-amber-300/50 bg-amber-50/60 dark:border-amber-500/25 dark:bg-amber-500/[0.06]">
            <header className="flex items-center gap-2 border-b border-amber-300/40 px-4 py-3 dark:border-amber-500/20">
              <ShieldAlert size={15} className="text-amber-600 dark:text-amber-400" />
              <h2 className="text-[13px] font-semibold text-sales-text-primary">
                Waiting for a human ({escalations.length})
              </h2>
            </header>
            <ul className="divide-y divide-amber-300/30 dark:divide-amber-500/15">
              {escalations.map((esc) => (
                <li key={esc.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-medium text-sales-text-primary">
                      {intentLabel(esc.reason)}
                      <span
                        className={cn(
                          "ml-2 rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase",
                          esc.severity === "HIGH"
                            ? "bg-red-500/10 text-red-600 dark:text-red-400"
                            : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                        )}
                      >
                        {esc.severity}
                      </span>
                    </p>
                    <p className="mt-0.5 line-clamp-2 text-[12px] text-sales-text-secondary">{esc.summary}</p>
                    <p className="mt-0.5 text-[11px] text-sales-text-muted">{timeAgo(esc.created_at)}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Link href={`/client/inbox?lead=${esc.lead_id}`}>
                      <Button variant="secondary" size="sm" leftIcon={<MessageSquare size={13} />}>
                        Open conversation
                      </Button>
                    </Link>
                    <Button variant="secondary" size="sm" onClick={() => void resolveEscalation(esc.id, true)}>
                      Resolve & resume agent
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <SegmentedControl options={tabOptions} value={tab} onChange={setTab} aria-label="Agent activity tabs" />

        <section className="rounded-[12px] border border-sales-border bg-sales-surface">
          {loading ? (
            <div className="flex h-40 items-center justify-center">
              <Loader2 size={18} className="animate-spin text-sales-text-muted" />
            </div>
          ) : !executions.length ? (
            <div className="flex h-40 flex-col items-center justify-center gap-1 text-center">
              <p className="text-[13px] font-medium text-sales-text-primary">Nothing here yet</p>
              <p className="text-[12px] text-sales-text-secondary">
                Agent runs will appear as soon as customers message you on WhatsApp.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-sales-border-subtle">
              {executions.map((row) => (
                <li key={row.id}>
                  <button
                    type="button"
                    onClick={() => void openDetail(row)}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-sales-surface-hover"
                  >
                    <span
                      className={cn(
                        "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                        STATE_STYLES[row.state] ?? "bg-sales-neutral-100 text-sales-text-muted"
                      )}
                    >
                      {row.state === "COMPLETED" ? (
                        <CheckCircle2 size={15} />
                      ) : row.state === "WAITING_FOR_HUMAN" ? (
                        <AlertTriangle size={15} />
                      ) : row.state === "FAILED" ? (
                        <XCircle size={15} />
                      ) : (
                        <Bot size={15} />
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-center gap-x-2 text-[13px] font-medium text-sales-text-primary">
                        {row.customer_name}
                        {row.test_mode ? (
                          <span className="rounded-full bg-sky-500/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-sky-600 dark:text-sky-400">
                            test
                          </span>
                        ) : null}
                        {(row.intents ?? []).slice(0, 2).map((intent) => (
                          <span
                            key={intent}
                            className="rounded-full bg-sales-neutral-100 px-1.5 py-0.5 text-[10px] font-medium text-sales-text-secondary"
                          >
                            {intentLabel(intent)}
                          </span>
                        ))}
                      </p>
                      <p className="mt-0.5 line-clamp-1 text-[12px] text-sales-text-secondary">
                        {row.decision_summary ?? row.error_code ?? row.state.toLowerCase()}
                      </p>
                    </div>
                    <div className="hidden shrink-0 flex-col items-end gap-0.5 sm:flex">
                      <span className="text-[11px] text-sales-text-muted">{timeAgo(row.created_at)}</span>
                      <span className="text-[11px] text-sales-text-muted">
                        {row.tool_call_count} action{row.tool_call_count === 1 ? "" : "s"}
                        {row.confidence != null ? ` · ${Math.round(row.confidence * 100)}%` : ""}
                        {row.reply_status ? ` · reply ${row.reply_status.toLowerCase()}` : ""}
                      </span>
                    </div>
                    <ChevronRight size={15} className="shrink-0 text-sales-text-muted" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {selected ? (
        <PremiumSheet title="Agent run" onClose={() => setSelected(null)} size="lg">
          <div className="flex flex-col gap-4 pb-6">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-[11px] font-semibold",
                  STATE_STYLES[selected.state] ?? "bg-sales-neutral-100 text-sales-text-muted"
                )}
              >
                {selected.state.replace(/_/g, " ")}
              </span>
              {selected.autonomy_mode ? (
                <span className="rounded-full bg-sales-neutral-100 px-2 py-0.5 text-[11px] text-sales-text-secondary">
                  {selected.autonomy_mode}
                </span>
              ) : null}
              {selected.model ? (
                <span className="rounded-full bg-sales-neutral-100 px-2 py-0.5 text-[11px] text-sales-text-secondary">
                  {selected.model}
                </span>
              ) : null}
              <span className="text-[11px] text-sales-text-muted">
                {new Date(selected.created_at).toLocaleString()}
                {selected.latency_ms ? ` · ${(selected.latency_ms / 1000).toFixed(1)}s` : ""}
              </span>
            </div>

            <div>
              <h3 className="text-[12px] font-semibold uppercase tracking-[0.04em] text-sales-text-muted">
                What the agent decided
              </h3>
              <p className="mt-1 text-[13px] leading-relaxed text-sales-text-primary">
                {selected.decision_summary ?? "No decision summary recorded."}
              </p>
              {detail?.execution?.evidence ? (
                <p className="mt-1.5 rounded-[8px] bg-sales-neutral-100 px-3 py-2 text-[12px] italic text-sales-text-secondary">
                  Customer said: “{String(detail.execution.evidence)}”
                </p>
              ) : null}
              {selected.confidence != null ? (
                <p className="mt-1 text-[12px] text-sales-text-muted">
                  Confidence {Math.round(selected.confidence * 100)}%
                </p>
              ) : null}
            </div>

            {selected.customer_reply ? (
              <div>
                <h3 className="text-[12px] font-semibold uppercase tracking-[0.04em] text-sales-text-muted">
                  Reply {selected.reply_status ? `(${selected.reply_status.toLowerCase()})` : ""}
                </h3>
                <p className="mt-1 whitespace-pre-wrap rounded-[10px] border border-sales-border-subtle bg-sales-bg px-3 py-2.5 text-[13px] text-sales-text-primary">
                  {selected.customer_reply}
                </p>
              </div>
            ) : null}

            <div>
              <h3 className="text-[12px] font-semibold uppercase tracking-[0.04em] text-sales-text-muted">
                Actions
              </h3>
              {detailLoading ? (
                <div className="flex h-16 items-center justify-center">
                  <Loader2 size={15} className="animate-spin text-sales-text-muted" />
                </div>
              ) : !detail?.actions.length ? (
                <p className="mt-1 text-[13px] text-sales-text-secondary">No tool actions in this run.</p>
              ) : (
                <ul className="mt-1.5 flex flex-col gap-1.5">
                  {detail.actions.map((action) => (
                    <li
                      key={action.id}
                      className="rounded-[10px] border border-sales-border-subtle bg-sales-bg px-3 py-2.5"
                    >
                      <p className="flex flex-wrap items-center gap-2 text-[12px]">
                        <code className="font-semibold text-sales-text-primary">{action.tool_name}</code>
                        <span className={cn("font-semibold", ACTION_STATUS_STYLES[action.status] ?? "")}>
                          {action.status.toLowerCase()}
                        </span>
                        <span className="text-sales-text-muted">{action.risk_level.toLowerCase()} risk</span>
                        {action.created_record_type ? (
                          <span className="text-sales-text-muted">created {action.created_record_type}</span>
                        ) : null}
                      </p>
                      {action.blocked_reason ? (
                        <p className="mt-1 text-[12px] text-amber-600 dark:text-amber-400">
                          {action.blocked_reason}
                        </p>
                      ) : null}
                      {action.error ? (
                        <p className="mt-1 text-[12px] text-red-600 dark:text-red-400">{action.error}</p>
                      ) : null}
                      {action.result_summary && Object.keys(action.result_summary).length ? (
                        <pre className="mt-1.5 overflow-x-auto rounded-[6px] bg-sales-neutral-100 px-2 py-1.5 text-[11px] leading-relaxed text-sales-text-secondary">
                          {JSON.stringify(action.result_summary, null, 1)}
                        </pre>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {selected.error_code ? (
              <p className="rounded-[8px] bg-red-500/5 px-3 py-2 text-[12px] text-red-600 dark:text-red-400">
                {selected.error_code}
                {String(detail?.execution?.error_message ?? "") ? ` — ${String(detail?.execution?.error_message)}` : ""}
              </p>
            ) : null}

            <div className="flex justify-end">
              <Link href={`/client/inbox?lead=${selected.lead_id}`}>
                <Button variant="secondary" size="sm" leftIcon={<MessageSquare size={13} />}>
                  Open conversation
                </Button>
              </Link>
            </div>
          </div>
        </PremiumSheet>
      ) : null}
    </CompanyWorkspaceShell>
  );
}
