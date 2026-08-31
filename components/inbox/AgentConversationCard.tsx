"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bot, ChevronDown, Loader2, Pause, Play } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  SegmentedControl,
} from "@/components/sales/ui";
import type { InboxConversation } from "@/lib/inbox/types";
import type { AgentConversationMode } from "@/lib/agent/real-estate/types";

type AgentConversationData = {
  agentEnabledForCompany: boolean;
  suggestReplies?: boolean;
  learningEnabled?: boolean;
  learningSignals?: number;
  learningCandidates?: Array<{ id: string; title: string; category: string; status: string }>;
  autonomyMode: string;
  state: {
    status: string;
    agentEnabled: boolean;
    humanNeededReason: string | null;
    pausedUntil: string | null;
    humanTakeover: boolean;
    conversationMode?: AgentConversationMode;
  } | null;
  conversationMode: AgentConversationMode;
  conversationModeLabel: string;
  realEstateSettings: Record<string, unknown> | null;
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
  nextProactive?: {
    id: string;
    triggerType: string;
    scheduledAt: string;
    status: string;
    decisionSummary: string | null;
  } | null;
};

const MODE_LABELS: Record<AgentConversationMode, string> = {
  AI_HANDLING: "AI Handling",
  AI_COPILOT: "Copilot",
  HUMAN_ONLY: "Human Only",
};

const MODE_STATUS_CLASS: Record<AgentConversationMode, string> = {
  AI_HANDLING: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  AI_COPILOT: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
  HUMAN_ONLY: "bg-sales-neutral-100 text-sales-text-muted",
};

type MenuAction =
  | { action: "pause"; pauseFor: "indefinite" | "1h" | "tomorrow"; label: string }
  | { action: "resume" | "takeover" | "release" | "escalate" | "cancel_proactive"; label: string };

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
  const router = useRouter();

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

  if (!data?.agentEnabledForCompany && !data?.learningEnabled && !data?.suggestReplies) return null;

  const learningOnly = !data.agentEnabledForCompany && Boolean(data.learningEnabled);
  const conversationMode = data.conversationMode ?? "AI_HANDLING";
  const statusMeta = learningOnly
    ? { label: "Not responding", className: "bg-sales-neutral-100 text-sales-text-muted" }
    : {
        label: MODE_LABELS[conversationMode],
        className: MODE_STATUS_CLASS[conversationMode],
      };
  const isPaused = conversationMode === "HUMAN_ONLY" || data.state?.agentEnabled === false;
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
        { action: "cancel_proactive", label: "I'll handle the next follow-up" },
        conversationMode === "AI_COPILOT"
          ? { action: "release", label: "Return to AI handling" }
          : { action: "takeover", label: "Take over" },
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
            {learningOnly ? "Not responding" : isPaused ? "Paused" : statusMeta.label}
          </span>
          {data.learningEnabled ? (
            <span
              className="rounded-full bg-sales-brand-soft px-1.5 py-0.5 text-[10px] font-semibold text-sales-brand"
              title="SegmiQ is not responding to this customer. It may learn approved sales patterns from eligible human conversations."
            >
              Learning active
            </span>
          ) : null}
        </div>
        {learningOnly ? (
          <Link
            href="/client/agent/learning"
            className="text-[10px] font-medium text-sales-text-secondary hover:text-sales-text-primary"
          >
            Learning
          </Link>
        ) : (
          <DropdownMenu align="end">
            <DropdownMenuTrigger
              disabled={busy}
              className="inline-flex h-7 items-center gap-1 rounded-[7px] border border-sales-border bg-sales-surface px-2 text-[10px] font-medium text-sales-text-primary hover:bg-sales-surface-hover disabled:opacity-50"
            >
              {busy ? <Loader2 size={11} className="animate-spin" /> : isPaused ? <Play size={11} /> : <Pause size={11} />}
              Agent
              <ChevronDown size={11} />
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-48">
              {menuItems.map((item) => (
                <DropdownMenuItem
                  key={item.label}
                  className="text-[11px]"
                  onSelect={() =>
                    void act(
                      item.action === "pause"
                        ? { action: "pause", pauseFor: item.pauseFor }
                        : { action: item.action }
                    )
                  }
                >
                  {item.label}
                </DropdownMenuItem>
              ))}
              {activityHref ? (
                <DropdownMenuItem className="text-[11px]" onSelect={() => router.push(activityHref)}>
                  View AI activity
                </DropdownMenuItem>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {!learningOnly && data.agentEnabledForCompany ? (
        <div className="mt-3">
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.04em] text-sales-text-muted">
            Agent mode
          </p>
          <SegmentedControl
            value={conversationMode}
            onChange={(mode) => {
              if (busy) return;
              void act({ action: "set_mode", mode: mode as AgentConversationMode });
            }}
            options={(
              ["AI_HANDLING", "AI_COPILOT", "HUMAN_ONLY"] as const
            ).map((mode) => ({
              value: mode,
              label: MODE_LABELS[mode],
            }))}
          />
        </div>
      ) : null}

      {typeof data.learningSignals === "number" && data.learningSignals > 0 ? (
        <Link
          href="/client/agent/learning"
          className="mt-2 block text-[11px] text-sales-text-secondary hover:text-sales-text-primary"
        >
          {data.learningSignals} learning signal{data.learningSignals === 1 ? "" : "s"}
        </Link>
      ) : null}

      {data.nextProactive ? (
        <div className="mt-2 rounded-[8px] border border-sales-border-subtle bg-sales-neutral-100/60 px-2.5 py-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.04em] text-sales-text-muted">
            Next Agent action
          </p>
          <p className="mt-0.5 text-[12px] font-medium text-sales-text-primary">
            {proactiveTriggerLabel(data.nextProactive.triggerType)}
          </p>
          <p className="text-[11px] text-sales-text-secondary">
            {formatWhen(data.nextProactive.scheduledAt)}
            {data.nextProactive.status === "WAITING_FOR_CHANNEL" ? " · waiting for WhatsApp" : ""}
            {data.nextProactive.status === "WAITING_FOR_HUMAN" ? " · waiting for approval" : ""}
          </p>
        </div>
      ) : null}

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

function proactiveTriggerLabel(type: string): string {
  if (type.includes("quotation.followup")) return "Follow up quotation";
  if (type.includes("customer.followup")) return "Customer requested follow-up";
  if (type.includes("appointment.reminder")) return "Appointment reminder";
  if (type.includes("deal.inactive")) return "Inactive Deal review";
  if (type.includes("expiring")) return "Quote expiry review";
  return type.replace(/[._]/g, " ");
}

function formatWhen(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      weekday: "short",
      hour: "numeric",
      minute: "2-digit",
      day: "numeric",
      month: "short",
    });
  } catch {
    return iso;
  }
}

