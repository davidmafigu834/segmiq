"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Bot, ChevronDown, Loader2, Pause, Play } from "lucide-react";
import type { InboxConversation } from "@/lib/inbox/types";

type AgentConversationData = {
  agentEnabledForCompany: boolean;
  autonomyMode: string;
  state: {
    status: string;
    agentEnabled: boolean;
    humanNeededReason: string | null;
    pausedUntil: string | null;
    humanTakeover: boolean;
  } | null;
  recentExecutions: Array<{
    id: string;
    state: string;
    intents: string[];
    confidence: number | null;
    decision_summary: string | null;
    customer_reply: string | null;
    reply_status: string | null;
    created_at: string;
  }>;
  openEscalation: {
    id: string;
    reason: string;
    severity: string;
    summary: string;
    briefing: Record<string, unknown> | null;
  } | null;
};

const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  AI_HANDLING: { label: "AI handling", className: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" },
  WAITING_ON_CUSTOMER: { label: "AI · waiting on customer", className: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" },
  FOLLOW_UP_SCHEDULED: { label: "AI · follow-up scheduled", className: "bg-sky-500/10 text-sky-600 dark:text-sky-400" },
  HUMAN_NEEDED: { label: "Human needed", className: "bg-amber-500/10 text-amber-600 dark:text-amber-400" },
  PAUSED: { label: "Agent paused", className: "bg-sales-neutral-100 text-sales-text-muted" },
  HUMAN_HANDLING: { label: "Human handling", className: "bg-sky-500/10 text-sky-600 dark:text-sky-400" },
  IDLE: { label: "Agent ready", className: "bg-sales-neutral-100 text-sales-text-secondary" },
};

type MenuAction =
  | { action: "pause"; pauseFor: "indefinite" | "1h" | "tomorrow"; label: string }
  | { action: "resume" | "takeover" | "release" | "escalate"; label: string };

/**
 * Agent status + briefing + controls for one conversation.
 * Renders nothing when SegmiQ Agent is off for the company.
 */
export function AgentConversationCard({
  leadId,
  conversation,
  activityHref,
}: {
  leadId: string;
  conversation?: InboxConversation | null;
  activityHref?: string;
}) {
  const [data, setData] = useState<AgentConversationData | null>(null);
  const [busy, setBusy] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/agent/conversations/${leadId}`, { cache: "no-store" });
      if (res.ok) setData(await res.json());
    } catch {
      /* rail card is best-effort */
    }
  }, [leadId]);

  useEffect(() => {
    setData(null);
    void load();
  }, [load]);

  const act = useCallback(
    async (body: Record<string, unknown>) => {
      setBusy(true);
      setMenuOpen(false);
      try {
        await fetch(`/api/agent/conversations/${leadId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        await load();
      } finally {
        setBusy(false);
      }
    },
    [leadId, load]
  );

  if (!data?.agentEnabledForCompany) return null;

  const status = data.state?.humanTakeover
    ? "HUMAN_HANDLING"
    : data.state?.status ?? "IDLE";
  const statusMeta = STATUS_LABELS[status] ?? STATUS_LABELS.IDLE;
  const isPaused = status === "PAUSED" || data.state?.agentEnabled === false;
  const lastRun = data.recentExecutions.find((run) => run.decision_summary);
  const briefing = data.openEscalation?.briefing ?? null;

  const menuItems: MenuAction[] = isPaused
    ? [
        { action: "resume", label: "Resume agent" },
        { action: "escalate", label: "Escalate to human" },
      ]
    : [
        { action: "pause", pauseFor: "1h", label: "Pause for 1 hour" },
        { action: "pause", pauseFor: "tomorrow", label: "Pause until tomorrow" },
        { action: "pause", pauseFor: "indefinite", label: "Pause until resumed" },
        status === "HUMAN_HANDLING"
          ? { action: "release", label: "Let agent handle" }
          : { action: "takeover", label: "I'll take over" },
        { action: "escalate", label: "Escalate to human" },
      ];

  return (
    <section className="border-b border-sales-border-subtle px-4 py-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-sales-brand-soft text-sales-brand">
            <Bot size={13} />
          </span>
          <span className="text-[12px] font-semibold text-sales-text-primary">SegmiQ Agent</span>
          <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${statusMeta.className}`}>
            {isPaused ? "Paused" : statusMeta.label}
          </span>
        </div>
        <div className="relative">
          <button
            type="button"
            disabled={busy}
            onClick={() => setMenuOpen((open) => !open)}
            className="inline-flex h-7 items-center gap-1 rounded-[7px] border border-sales-border bg-sales-surface px-2 text-[10px] font-medium text-sales-text-primary hover:bg-sales-surface-hover disabled:opacity-50"
            aria-expanded={menuOpen}
            aria-haspopup="menu"
          >
            {busy ? <Loader2 size={11} className="animate-spin" /> : isPaused ? <Play size={11} /> : <Pause size={11} />}
            Agent
            <ChevronDown size={11} />
          </button>
          {menuOpen ? (
            <>
              <button
                type="button"
                className="fixed inset-0 z-20 cursor-default"
                aria-label="Close agent menu"
                onClick={() => setMenuOpen(false)}
              />
              <div
                role="menu"
                className="absolute right-0 z-30 mt-1 w-48 overflow-hidden rounded-[10px] border border-sales-border bg-sales-surface py-1 shadow-[0_8px_24px_rgba(16,24,40,0.08)]"
              >
                {menuItems.map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    role="menuitem"
                    className="flex w-full px-3 py-1.5 text-left text-[11px] text-sales-text-primary hover:bg-sales-surface-hover"
                    onClick={() =>
                      void act(
                        item.action === "pause"
                          ? { action: "pause", pauseFor: item.pauseFor }
                          : { action: item.action }
                      )
                    }
                  >
                    {item.label}
                  </button>
                ))}
                {activityHref ? (
                  <Link
                    href={activityHref}
                    className="flex w-full px-3 py-1.5 text-left text-[11px] text-sales-text-primary hover:bg-sales-surface-hover"
                    onClick={() => setMenuOpen(false)}
                  >
                    View AI activity
                  </Link>
                ) : null}
              </div>
            </>
          ) : null}
        </div>
      </div>

      {data.openEscalation ? (
        <div className="mt-2 rounded-[8px] border border-amber-300/50 bg-amber-50/60 px-2.5 py-2 text-[11px] leading-relaxed text-amber-900 dark:border-amber-500/25 dark:bg-amber-500/[0.07] dark:text-amber-200">
          <span className="font-semibold">
            {data.openEscalation.reason.replace(/_/g, " ").toLowerCase()}:
          </span>{" "}
          {data.openEscalation.summary}
        </div>
      ) : null}

      <dl className="mt-2 space-y-1.5 text-[11px] leading-relaxed">
        {conversation?.projectType || briefing?.customer_request ? (
          <div>
            <dt className="text-[9px] font-semibold uppercase tracking-[0.04em] text-sales-text-muted">What they want</dt>
            <dd className="text-sales-text-primary">
              {String(briefing?.customer_request ?? conversation?.projectType ?? "").trim() || "—"}
            </dd>
          </div>
        ) : null}
        {conversation?.leadBudget || conversation?.leadTimeline ? (
          <div>
            <dt className="text-[9px] font-semibold uppercase tracking-[0.04em] text-sales-text-muted">Qualification</dt>
            <dd className="text-sales-text-secondary">
              {[conversation.leadBudget, conversation.leadTimeline].filter(Boolean).join(" · ")}
            </dd>
          </div>
        ) : null}
        {conversation?.dealName || conversation?.latestQuoteNumber ? (
          <div>
            <dt className="text-[9px] font-semibold uppercase tracking-[0.04em] text-sales-text-muted">Commercial</dt>
            <dd className="text-sales-text-secondary">
              {[conversation.dealName, conversation.latestQuoteNumber].filter(Boolean).join(" · ")}
            </dd>
          </div>
        ) : null}
        {lastRun?.decision_summary ? (
          <div>
            <dt className="text-[9px] font-semibold uppercase tracking-[0.04em] text-sales-text-muted">
              {data.openEscalation ? "Why agent stopped" : "Latest action"}
            </dt>
            <dd className="line-clamp-3 text-sales-text-secondary">{lastRun.decision_summary}</dd>
          </div>
        ) : !data.openEscalation ? (
          <p className="text-sales-text-muted">No agent activity in this conversation yet.</p>
        ) : null}
      </dl>
    </section>
  );
}
