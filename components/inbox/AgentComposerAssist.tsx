"use client";

import { useCallback, useEffect, useState } from "react";
import { Bot, Check, Loader2, Pencil, X } from "lucide-react";

type SuggestedAction = { id: string; toolName: string; label: string };

type AgentComposerData = {
  agentEnabledForCompany: boolean;
  draftedReply: { executionId: string; text: string } | null;
  suggestedActions: SuggestedAction[];
};

export function AgentComposerAssist({
  leadId,
  canSend,
  onEditDraft,
  onSent,
}: {
  leadId: string;
  canSend: boolean;
  onEditDraft: (text: string) => void;
  onSent: () => void;
}) {
  const [data, setData] = useState<AgentComposerData | null>(null);
  const [busy, setBusy] = useState<"send" | "reject" | "apply" | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/agent/conversations/${leadId}`, { cache: "no-store" });
      if (res.ok) setData(await res.json());
    } catch {
      /* composer assist is best-effort */
    }
  }, [leadId]);

  useEffect(() => {
    setData(null);
    setNotice(null);
    void load();
  }, [load]);

  const patch = useCallback(
    async (action: "send_draft" | "reject_draft" | "apply_suggestions") => {
      setBusy(action === "send_draft" ? "send" : action === "reject_draft" ? "reject" : "apply");
      setNotice(null);
      try {
        const res = await fetch(`/api/agent/conversations/${leadId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action }),
        });
        const json = (await res.json().catch(() => ({}))) as {
          error?: string;
          applied?: string[];
          failed?: string[];
        };
        if (!res.ok) {
          setNotice(json.error ?? "Could not update agent suggestion");
          return;
        }
        if (action === "send_draft") onSent();
        if (action === "apply_suggestions") {
          const applied = json.applied ?? [];
          const failed = json.failed ?? [];
          if (applied.length) setNotice(`Applied: ${applied.join(", ")}`);
          else if (failed.length) setNotice(`Could not apply: ${failed.join(", ")}`);
          else setNotice("No pending actions to apply");
        }
        await load();
      } finally {
        setBusy(null);
      }
    },
    [leadId, load, onSent]
  );

  if (!data?.agentEnabledForCompany) return null;
  const draft = data.draftedReply?.text?.trim() ?? "";
  const suggestions = data.suggestedActions ?? [];
  if (!draft && suggestions.length === 0) return null;

  return (
    <div className="mx-3 mb-1 rounded-[10px] border border-sales-border bg-sales-surface-subtle px-3 py-2.5">
      <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.04em] text-sales-text-muted">
        <Bot size={12} className="text-sales-brand" />
        SegmiQ Agent suggests
      </div>
      {draft ? (
        <p className="line-clamp-4 text-[12px] leading-relaxed text-sales-text-primary">{draft}</p>
      ) : null}
      {suggestions.length ? (
        <ul className="mt-1.5 flex flex-wrap gap-1">
          {suggestions.map((item) => (
            <li
              key={item.id}
              className="rounded-full border border-sales-border bg-sales-surface px-2 py-0.5 text-[10px] font-medium text-sales-text-secondary"
            >
              {item.label}
            </li>
          ))}
        </ul>
      ) : null}
      {notice ? <p className="mt-1.5 text-[11px] text-sales-text-secondary">{notice}</p> : null}
      {canSend ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {draft ? (
            <>
              <button
                type="button"
                disabled={busy !== null}
                onClick={() => onEditDraft(draft)}
                className="inline-flex h-7 items-center gap-1 rounded-[7px] border border-sales-border bg-sales-surface px-2 text-[10px] font-medium text-sales-text-primary hover:bg-sales-surface-hover"
              >
                <Pencil size={11} /> Edit
              </button>
              <button
                type="button"
                disabled={busy !== null}
                onClick={() => void patch("send_draft")}
                className="inline-flex h-7 items-center gap-1 rounded-[7px] bg-sales-brand px-2 text-[10px] font-semibold text-sales-brand-text"
              >
                {busy === "send" ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />}
                Send
              </button>
              <button
                type="button"
                disabled={busy !== null}
                onClick={() => void patch("reject_draft")}
                className="inline-flex h-7 items-center gap-1 rounded-[7px] px-2 text-[10px] font-medium text-sales-text-secondary hover:bg-sales-surface-hover"
              >
                {busy === "reject" ? <Loader2 size={11} className="animate-spin" /> : <X size={11} />}
                Dismiss
              </button>
            </>
          ) : null}
          {suggestions.length ? (
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => void patch("apply_suggestions")}
              className="inline-flex h-7 items-center gap-1 rounded-[7px] border border-sales-border bg-sales-surface px-2 text-[10px] font-medium text-sales-text-primary hover:bg-sales-surface-hover"
            >
              {busy === "apply" ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />}
              Apply actions
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
