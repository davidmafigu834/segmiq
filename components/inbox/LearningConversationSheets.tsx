"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Ban, BookOpen, GraduationCap } from "lucide-react";
import { PremiumSheet } from "@/components/sales/PremiumSheet";
import { Button } from "@/components/sales/ui/Button";
import { EXCLUSION_REASONS, TEACH_INTENTS, type TeachIntent } from "@/lib/agent/learning/types";
import { CATEGORY_LABELS } from "@/lib/agent/learning/types";

const TEACH_LABELS: Record<TeachIntent, string> = {
  GOOD_RESPONSE: "This was a good response",
  WRONG_RESPONSE: "This response was wrong",
  REMEMBER_APPROACH: "Remember this approach",
  NEVER_RESPOND_THIS_WAY: "Never respond this way",
  ADD_AS_FAQ: "Add as FAQ",
  ADD_TO_PLAYBOOK: "Add to Playbook",
  ADD_TERMINOLOGY: "Add terminology",
};

const EXCLUSION_LABELS: Record<(typeof EXCLUSION_REASONS)[number], string> = {
  SENSITIVE_CUSTOMER: "Sensitive customer",
  LEGAL_MATTER: "Legal matter",
  UNUSUAL_EXCEPTION: "Unusual exception",
  CONFIDENTIAL_NEGOTIATION: "Confidential negotiation",
  OTHER: "Other",
};

type ChatLearning = {
  learningEnabled: boolean;
  excluded: boolean;
  candidates: Array<{
    id: string;
    title: string;
    category: string;
    summary: string;
  }>;
};

export function LearningConversationMenuItems(props: {
  onTeach: () => void;
  onExclude: () => void;
  onFromChat: () => void;
}) {
  return (
    <>
      <button
        type="button"
        onClick={props.onTeach}
        className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-sales-text-primary hover:bg-sales-surface-hover"
      >
        <GraduationCap size={14} />
        Teach SegmiQ
      </button>
      <button
        type="button"
        onClick={props.onFromChat}
        className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-sales-text-primary hover:bg-sales-surface-hover"
      >
        <BookOpen size={14} />
        What did SegmiQ learn?
      </button>
      <button
        type="button"
        onClick={props.onExclude}
        className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-sales-text-primary hover:bg-sales-surface-hover"
      >
        <Ban size={14} />
        Exclude from Learning
      </button>
    </>
  );
}

export function LearningConversationSheets(props: {
  leadId: string;
  teachOpen: boolean;
  excludeOpen: boolean;
  fromChatOpen: boolean;
  messageIds: string[];
  onClose: () => void;
}) {
  const [intent, setIntent] = useState<TeachIntent>("REMEMBER_APPROACH");
  const [note, setNote] = useState("");
  const [reason, setReason] = useState<(typeof EXCLUSION_REASONS)[number]>("OTHER");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [fromChat, setFromChat] = useState<ChatLearning | null>(null);

  useEffect(() => {
    if (!props.fromChatOpen) return;
    void fetch(`/api/agent/learning/conversation/${props.leadId}`, { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setFromChat(data))
      .catch(() => setFromChat(null));
  }, [props.fromChatOpen, props.leadId]);

  const close = () => {
    setError(null);
    setDone(null);
    setNote("");
    props.onClose();
  };

  const submitTeach = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/agent/learning/teach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leadId: props.leadId,
          intent,
          messageIds: props.messageIds,
          note: note.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not submit");
      setDone("Submitted for manager review. Company Brain was not changed.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not submit");
    } finally {
      setBusy(false);
    }
  };

  const submitExclude = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/agent/learning/conversation/${props.leadId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not exclude");
      setDone("This conversation is excluded from Learning.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not exclude");
    } finally {
      setBusy(false);
    }
  };

  if (props.teachOpen) {
    return (
      <PremiumSheet
        eyebrow="Agent Learning"
        title="Teach SegmiQ"
        description="Propose what should be learned. A manager still decides what becomes company truth."
        onClose={close}
        labelledBy="teach-segmiq-title"
        maxWidthClass="max-w-md"
      >
        <div className="flex flex-col gap-3">
          <label className="text-[12px] text-sales-text-secondary">
            What should be learned?
            <select
              className="mt-1 w-full rounded-[8px] border border-sales-border bg-sales-surface px-2 py-2 text-[13px] text-sales-text-primary"
              value={intent}
              onChange={(e) => setIntent(e.target.value as TeachIntent)}
            >
              {TEACH_INTENTS.map((item) => (
                <option key={item} value={item}>
                  {TEACH_LABELS[item]}
                </option>
              ))}
            </select>
          </label>
          <label className="text-[12px] text-sales-text-secondary">
            Proposed learning
            <textarea
              className="mt-1 w-full rounded-[10px] border border-sales-border bg-sales-surface px-3 py-2 text-[13px] text-sales-text-primary"
              rows={4}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="When a customer asks about a borehole system, collect pump/load details before recommending a Package."
            />
          </label>
          {error ? <p className="text-[12px] text-sales-danger">{error}</p> : null}
          {done ? <p className="text-[12px] text-sales-text-secondary">{done}</p> : null}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={close}>
              Cancel
            </Button>
            <Button disabled={busy} loading={busy} onClick={() => void submitTeach()}>
              Submit learning
            </Button>
          </div>
        </div>
      </PremiumSheet>
    );
  }

  if (props.excludeOpen) {
    return (
      <PremiumSheet
        eyebrow="Agent Learning"
        title="Exclude from Learning"
        description="Future Learning jobs will skip this conversation."
        onClose={close}
        labelledBy="exclude-learning-title"
        maxWidthClass="max-w-md"
      >
        <div className="flex flex-col gap-3">
          <label className="text-[12px] text-sales-text-secondary">
            Reason
            <select
              className="mt-1 w-full rounded-[8px] border border-sales-border bg-sales-surface px-2 py-2 text-[13px] text-sales-text-primary"
              value={reason}
              onChange={(e) => setReason(e.target.value as (typeof EXCLUSION_REASONS)[number])}
            >
              {EXCLUSION_REASONS.map((item) => (
                <option key={item} value={item}>
                  {EXCLUSION_LABELS[item]}
                </option>
              ))}
            </select>
          </label>
          {error ? <p className="text-[12px] text-sales-danger">{error}</p> : null}
          {done ? <p className="text-[12px] text-sales-text-secondary">{done}</p> : null}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={close}>
              Cancel
            </Button>
            <Button disabled={busy} loading={busy} onClick={() => void submitExclude()}>
              Exclude conversation
            </Button>
          </div>
        </div>
      </PremiumSheet>
    );
  }

  if (props.fromChatOpen) {
    const items = fromChat?.candidates ?? [];
    return (
      <PremiumSheet
        eyebrow="Agent Learning"
        title="Learnings from this conversation"
        description="Only real candidates linked to this chat are shown."
        onClose={close}
        labelledBy="from-chat-title"
        maxWidthClass="max-w-md"
      >
        {items.length === 0 ? (
          <p className="text-[13px] text-sales-text-secondary">
            No learning has been recorded from this conversation yet.
          </p>
        ) : (
          <ul className="space-y-3">
            {items.map((item, index) => (
              <li key={item.id} className="rounded-[10px] border border-sales-border-subtle px-3 py-2">
                <p className="text-[10px] font-semibold uppercase tracking-[0.04em] text-sales-text-muted">
                  {index + 1}. {CATEGORY_LABELS[item.category as keyof typeof CATEGORY_LABELS] ?? item.category}
                </p>
                <p className="mt-0.5 text-[13px] font-semibold text-sales-text-primary">{item.title}</p>
                <p className="mt-1 text-[12px] text-sales-text-secondary">{item.summary}</p>
                <Link
                  href={`/client/agent/learning?candidate=${item.id}`}
                  className="mt-2 inline-block text-[11px] text-sales-text-muted underline-offset-2 hover:underline"
                >
                  View learning
                </Link>
              </li>
            ))}
          </ul>
        )}
      </PremiumSheet>
    );
  }

  return null;
}
