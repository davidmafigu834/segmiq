"use client";

import { useEffect, useState } from "react";
import type { InboxConversation } from "@/lib/inbox/types";
import { formatAwaitingReply } from "@/lib/inbox/queue-filters";
import { ArrowLeftRight, CheckCircle2, ChevronDown, StickyNote, UserRound } from "lucide-react";

const EXPANDED_STORAGE_KEY = "segmiq-manager-workflow-expanded";

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
  const [expanded, setExpanded] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const status = workflowStatus(conversation);
  const isResolved = conversation.conversationStatus === "RESOLVED";

  useEffect(() => {
    try {
      setExpanded(localStorage.getItem(EXPANDED_STORAGE_KEY) === "1");
    } catch {
      /* ignore */
    }
    setHydrated(true);
  }, []);

  function toggleExpanded() {
    setExpanded((current) => {
      const next = !current;
      try {
        localStorage.setItem(EXPANDED_STORAGE_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  return (
    <div className="wa-manager-assist manager-workflow-strip shrink-0 border-b border-sales-border bg-sales-surface">
      <button
        type="button"
        onClick={toggleExpanded}
        className="flex w-full items-center gap-2 px-3 py-1.5 text-left sm:px-4"
        aria-expanded={hydrated ? expanded : false}
      >
        <span className="shrink-0 text-[9px] font-semibold uppercase tracking-[0.07em] text-sales-text-muted">
          Team
        </span>
        <span className={`min-w-0 flex-1 truncate text-[12px] font-medium ${status.tone}`}>{status.label}</span>
        <ChevronDown
          size={14}
          className={`shrink-0 text-sales-text-muted transition-transform ${expanded ? "rotate-180" : ""}`}
        />
      </button>

      {expanded ? (
        <div className="space-y-2 border-t border-sales-border-subtle px-3 py-2 sm:px-4">
          <p className="text-[11px] text-sales-text-secondary">{status.detail}</p>
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
      ) : null}
    </div>
  );
}
