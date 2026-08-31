"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertCircle, Bot, Check, Loader2, UserRound } from "lucide-react";
import type { AgentActionCard } from "@/lib/agent/hub-action-cards";

type AgentCardsPayload = {
  agentEnabledForCompany: boolean;
  suggestReplies?: boolean;
  actionCards?: AgentActionCard[];
};

export function AgentActionCards({
  leadId,
  canSend,
  onUpdated,
}: {
  leadId: string;
  canSend: boolean;
  onUpdated?: () => void;
}) {
  const [data, setData] = useState<AgentCardsPayload | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/agent/conversations/${leadId}`, { cache: "no-store" });
      if (res.ok) setData(await res.json());
    } catch {
      /* best-effort */
    }
  }, [leadId]);

  useEffect(() => {
    setData(null);
    setDismissed(new Set());
    setNotice(null);
    void load();
  }, [load]);

  const patch = useCallback(
    async (body: Record<string, unknown>) => {
      setNotice(null);
      try {
        const res = await fetch(`/api/agent/conversations/${leadId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const json = (await res.json().catch(() => ({}))) as {
          error?: string;
          applied?: string[];
        };
        if (!res.ok) {
          setNotice(json.error ?? "Could not complete action");
          return false;
        }
        if (json.applied?.length) setNotice(`Done: ${json.applied.join(", ")}`);
        await load();
        onUpdated?.();
        return true;
      } finally {
        setBusyId(null);
      }
    },
    [leadId, load, onUpdated]
  );

  const handlePrimary = useCallback(
    async (card: AgentActionCard) => {
      if (!canSend) return;
      setBusyId(card.id);
      if (card.type === "VIEWING_APPROVAL" || card.type === "VIEWING_SCHEDULE_BLOCKED") {
        const input = card.inputSummary ?? {};
        const date = typeof input.date === "string" ? input.date : "";
        const time = typeof input.time === "string" ? input.time : "";
        if (!date || !time) {
          setNotice("Missing viewing date or time");
          setBusyId(null);
          return;
        }
        await patch({
          action: "approve_viewing",
          escalationId: card.escalationId,
          listing_id: typeof input.listing_id === "string" ? input.listing_id : undefined,
          date,
          time,
          reason:
            typeof input.customer_request === "string" ? input.customer_request : undefined,
        });
        return;
      }
      if (card.type === "GENERIC_BLOCKED" && card.actionId) {
        await patch({ action: "apply_action", actionId: card.actionId });
        return;
      }
      if (card.type === "CUSTOMER_QUESTION") {
        await patch({ action: "takeover" });
      }
    },
    [canSend, patch]
  );

  const handleSecondary = useCallback(
    async (card: AgentActionCard) => {
      if (card.secondaryLabel === "Take over" || card.type === "CUSTOMER_QUESTION") {
        setBusyId(card.id);
        await patch({ action: "takeover" });
        return;
      }
      setDismissed((prev) => new Set(prev).add(card.id));
    },
    [patch]
  );

  if (!data?.agentEnabledForCompany && !data?.suggestReplies) return null;

  const cards = (data.actionCards ?? []).filter((card) => !dismissed.has(card.id));
  if (!cards.length) return null;

  return (
    <div className="mx-3 mb-1 space-y-2">
      {cards.map((card) => (
        <div
          key={card.id}
          className="rounded-[10px] border border-amber-300/60 bg-amber-50/70 px-3 py-2.5 dark:border-amber-500/25 dark:bg-amber-500/[0.08]"
        >
          <div className="mb-1.5 flex items-start gap-2">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-200/80 text-amber-900 dark:bg-amber-500/20 dark:text-amber-200">
              {card.type === "CUSTOMER_QUESTION" ? (
                <AlertCircle size={12} />
              ) : (
                <Bot size={12} />
              )}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold text-amber-950 dark:text-amber-100">{card.title}</p>
              {card.subtitle ? (
                <p className="mt-0.5 text-[12px] font-medium text-amber-900 dark:text-amber-200">
                  {card.subtitle}
                </p>
              ) : null}
              {card.detailLines.length ? (
                <ul className="mt-1 space-y-0.5 text-[11px] leading-relaxed text-amber-900/90 dark:text-amber-200/90">
                  {card.detailLines.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          </div>
          {notice ? <p className="mb-1.5 text-[11px] text-amber-900 dark:text-amber-200">{notice}</p> : null}
          {canSend ? (
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                disabled={busyId !== null}
                onClick={() => void handlePrimary(card)}
                className="inline-flex h-7 items-center gap-1 rounded-[7px] bg-amber-600 px-2.5 text-[10px] font-semibold text-white hover:bg-amber-700 disabled:opacity-50 dark:bg-amber-500 dark:hover:bg-amber-400"
              >
                {busyId === card.id ? (
                  <Loader2 size={11} className="animate-spin" />
                ) : card.type === "CUSTOMER_QUESTION" ? (
                  <UserRound size={11} />
                ) : (
                  <Check size={11} />
                )}
                {card.primaryLabel}
              </button>
              {card.secondaryLabel ? (
                <button
                  type="button"
                  disabled={busyId !== null}
                  onClick={() => void handleSecondary(card)}
                  className="inline-flex h-7 items-center gap-1 rounded-[7px] border border-amber-400/50 bg-transparent px-2 text-[10px] font-medium text-amber-900 hover:bg-amber-100/60 disabled:opacity-50 dark:text-amber-200 dark:hover:bg-amber-500/10"
                >
                  {card.secondaryLabel}
                </button>
              ) : null}
              {card.takeoverLabel && card.type === "VIEWING_SCHEDULE_BLOCKED" ? (
                <button
                  type="button"
                  disabled={busyId !== null}
                  onClick={() => {
                    setBusyId(card.id);
                    void patch({ action: "takeover" });
                  }}
                  className="inline-flex h-7 items-center gap-1 rounded-[7px] px-2 text-[10px] font-medium text-amber-900 hover:bg-amber-100/60 disabled:opacity-50 dark:text-amber-200"
                >
                  <UserRound size={11} />
                  {card.takeoverLabel}
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}
