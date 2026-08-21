"use client";

import type { InboxConversation } from "@/lib/inbox/types";
import { formatAwaitingReply } from "@/lib/inbox/queue-filters";
import { CheckCircle2, StickyNote, UserRound, ArrowLeftRight } from "lucide-react";

type Props = {
  conversation: InboxConversation;
  canReassign: boolean;
  onAssign?: () => void;
  onTransfer?: () => void;
  onNote: () => void;
  onResolve?: () => void;
  resolving?: boolean;
};

function workflowStatus(conversation: InboxConversation): { label: string; detail: string; tone: string } {
  if (conversation.conversationStatus === "RESOLVED") {
    return { label: "Resolved", detail: "This conversation is marked complete.", tone: "text-sales-success" };
  }
  if (conversation.lastMessageDirection === "inbound") {
    const waiting = formatAwaitingReply(conversation.awaitingReplyMinutes);
    return {
      label: "Waiting on team",
      detail: waiting ? `Customer waiting ${waiting.replace(" waiting", "")}` : "Customer is awaiting a reply",
      tone: "text-[#D97706]",
    };
  }
  return {
    label: "Waiting on customer",
    detail: "Your team sent the last message.",
    tone: "text-sales-text-secondary",
  };
}

export function ManagerWorkflowStrip({
  conversation,
  canReassign,
  onAssign,
  onTransfer,
  onNote,
  onResolve,
  resolving = false,
}: Props) {
  const status = workflowStatus(conversation);
  const isResolved = conversation.conversationStatus === "RESOLVED";

  return (
    <div className="manager-workflow-strip shrink-0 border-b border-sales-border bg-sales-surface px-3 py-2 sm:px-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[9px] font-semibold uppercase tracking-[0.06em] text-sales-text-muted">
            Conversation status
          </div>
          <div className={`text-[13px] font-semibold ${status.tone}`}>{status.label}</div>
          <div className="text-[11px] text-sales-text-secondary">{status.detail}</div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {canReassign && onAssign ? (
            <button type="button" onClick={onAssign} className="manager-workflow-chip">
              <UserRound size={13} strokeWidth={1.8} /> Assign
            </button>
          ) : null}
          {canReassign && onTransfer ? (
            <button type="button" onClick={onTransfer} className="manager-workflow-chip">
              <ArrowLeftRight size={13} strokeWidth={1.8} /> Transfer
            </button>
          ) : null}
          <button type="button" onClick={onNote} className="manager-workflow-chip">
            <StickyNote size={13} strokeWidth={1.8} /> Add note
          </button>
          {onResolve ? (
            <button
              type="button"
              disabled={resolving}
              onClick={onResolve}
              className="manager-workflow-chip"
            >
              <CheckCircle2 size={13} strokeWidth={1.8} />
              {isResolved ? "Reopen" : "Resolve"}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
