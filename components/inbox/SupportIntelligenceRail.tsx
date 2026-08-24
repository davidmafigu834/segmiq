"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowLeftRight, Headphones, PanelRightClose, Phone } from "lucide-react";
import type { InboxConversation } from "@/lib/inbox/types";
import {
  SUPPORT_CASE_STATUS_LABEL,
  SUPPORT_REASON_LABEL,
  parseSupportCaseStatus,
  type SupportCaseStatus,
} from "@/lib/inbox/conversation-type";
import { displayContactName, WhatsAppAvatar } from "./WhatsAppAvatar";
import { AgentConversationCard } from "./AgentConversationCard";
import { TransferDialog } from "./TransferDialog";
import { TransferToSupportDialog } from "./TransferToSupportDialog";

type SupportCaseRow = {
  id: string;
  status: SupportCaseStatus;
  reasonCategory: string | null;
  reason: string | null;
  notes: string | null;
  createdAt: string;
  resolvedAt: string | null;
};

export function SupportIntelligenceRail({
  conversation,
  salespeople,
  currentUserId,
  canTransfer,
  canClaim,
  claiming,
  onClaim,
  onUpdated,
  open,
  onCollapse,
  onMobileBack,
  panelWidth,
}: {
  conversation: InboxConversation;
  salespeople: { id: string; name: string }[];
  currentUserId: string;
  canTransfer: boolean;
  canClaim: boolean;
  claiming: boolean;
  onClaim: (leadId: string) => void;
  onUpdated: () => void;
  open: boolean;
  onCollapse: () => void;
  onMobileBack?: () => void;
  panelWidth?: number;
}) {
  const [cases, setCases] = useState<SupportCaseRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [supportOpen, setSupportOpen] = useState(false);
  const name = displayContactName(conversation);
  const current = cases.find((row) => row.status !== "RESOLVED") ?? conversation.supportCase;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/inbox/conversations/${conversation.id}/support-case`)
      .then((res) => (res.ok ? res.json() : null))
      .then((json: { cases?: SupportCaseRow[] } | null) => {
        if (!cancelled) setCases(json?.cases ?? []);
      })
      .catch(() => {
        if (!cancelled) setCases([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [conversation.id, conversation.supportCase?.id, conversation.supportCase?.status]);

  const responsiveClass = open
    ? "max-[1099px]:fixed max-[1099px]:inset-0 max-[1099px]:z-50 max-[1099px]:flex max-[1099px]:w-full max-[1279px]:flex"
    : "max-[1279px]:hidden";

  async function openCase() {
    setBusy(true);
    try {
      await fetch(`/api/inbox/conversations/${conversation.id}/support-case`, { method: "POST" });
      onUpdated();
    } finally {
      setBusy(false);
    }
  }

  async function patchStatus(status: SupportCaseStatus) {
    setBusy(true);
    try {
      await fetch(`/api/inbox/conversations/${conversation.id}/support-case`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      onUpdated();
    } finally {
      setBusy(false);
    }
  }

  return (
    <aside
      style={panelWidth != null ? { width: panelWidth } : undefined}
      className={`inbox-panel-animated wa-panel flex h-full min-h-0 min-w-0 shrink-0 flex-col bg-sales-surface ${responsiveClass}`}
    >
      <header className="flex min-h-[52px] shrink-0 items-center gap-2 border-b border-sales-border px-3.5">
        {onMobileBack ? (
          <button type="button" onClick={onMobileBack} className="wa-icon-btn-muted" aria-label="Back to conversation">
            <ArrowLeft size={19} />
          </button>
        ) : null}
        <h2 className="min-w-0 flex-1 truncate text-[15px] font-semibold text-sales-text-primary">Support</h2>
        <button type="button" onClick={onCollapse} className="wa-icon-btn !h-8 !w-8" aria-label="Hide support context">
          <PanelRightClose size={15} />
        </button>
      </header>

      <div className="inbox-scroll min-h-0 flex-1 overflow-y-auto">
        <AgentConversationCard leadId={conversation.id} conversation={conversation} />
        <section className="border-b border-sales-border-subtle px-4 py-4">
          <div className="flex items-start gap-3">
            <WhatsAppAvatar name={name} phone={conversation.phone} size="md" />
            <div className="min-w-0">
              <div className="truncate text-[15px] font-semibold text-sales-text-primary">{name}</div>
              <div className="mt-1 text-[12px] tabular-nums text-sales-text-secondary">{conversation.phone || "No phone"}</div>
              <span className="mt-2 inline-flex rounded-full bg-[#EFF8FF] px-2 py-0.5 text-[10px] font-semibold text-[#175CD3]">
                Support
              </span>
            </div>
          </div>
        </section>

        <section className="border-b border-sales-border-subtle px-4 py-4">
          <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-sales-text-muted">Support case</h3>
          {loading ? (
            <div className="h-16 animate-pulse rounded-[10px] bg-sales-surface-hover" />
          ) : current ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-sales-text-primary">
                  <Headphones size={14} />
                  {SUPPORT_CASE_STATUS_LABEL[parseSupportCaseStatus(current.status)]}
                </span>
              </div>
              {current.reason || current.reasonCategory ? (
                <p className="text-[12px] text-sales-text-secondary">
                  {current.reason ||
                    (current.reasonCategory && current.reasonCategory in SUPPORT_REASON_LABEL
                      ? SUPPORT_REASON_LABEL[current.reasonCategory as keyof typeof SUPPORT_REASON_LABEL]
                      : current.reasonCategory)}
                </p>
              ) : null}
              <div className="flex flex-wrap gap-1">
                {(["OPEN", "IN_PROGRESS", "WAITING_ON_CUSTOMER", "RESOLVED"] as const).map((status) => (
                  <button
                    key={status}
                    type="button"
                    disabled={busy || current.status === status}
                    onClick={() => void patchStatus(status)}
                    className={`rounded-full border px-2 py-1 text-[10px] font-semibold ${
                      current.status === status
                        ? "border-sales-brand-border bg-sales-brand-soft text-sales-text-primary"
                        : "border-sales-border text-sales-text-secondary hover:bg-sales-surface-hover"
                    }`}
                  >
                    {SUPPORT_CASE_STATUS_LABEL[status]}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-3">
              <p className="text-[13px] text-sales-text-secondary">No support case open</p>
              <button
                type="button"
                disabled={busy}
                onClick={() => void openCase()}
                className="rounded-[8px] bg-sales-brand px-3 py-2 text-[12px] font-semibold text-sales-brand-text"
              >
                Open support case
              </button>
            </div>
          )}
        </section>

        <section className="border-b border-sales-border-subtle px-4 py-4">
          <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-sales-text-muted">Related project / completed work</h3>
          <p className="text-[13px] text-sales-text-muted">No related project linked to this conversation.</p>
        </section>

        <section className="border-b border-sales-border-subtle px-4 py-4">
          <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-sales-text-muted">Issue details</h3>
          <p className="text-[13px] text-sales-text-secondary">
            {conversation.lastMessage || "No issue details recorded yet."}
          </p>
        </section>

        <section className="border-b border-sales-border-subtle px-4 py-4">
          <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-sales-text-muted">Support history</h3>
          {cases.length === 0 ? (
            <p className="text-[13px] text-sales-text-muted">No previous support cases.</p>
          ) : (
            <ul className="space-y-2">
              {cases.slice(0, 5).map((row) => (
                <li key={row.id} className="text-[12px] text-sales-text-secondary">
                  <span className="font-medium text-sales-text-primary">{SUPPORT_CASE_STATUS_LABEL[row.status]}</span>
                  {row.reason ? ` · ${row.reason}` : ""}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="border-b border-sales-border-subtle px-4 py-4">
          <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-sales-text-muted">Files</h3>
          <p className="text-[13px] text-sales-text-muted">No files attached to this case.</p>
        </section>

        <section className="border-b border-sales-border-subtle px-4 py-4">
          <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-sales-text-muted">Internal activity</h3>
          <p className="text-[13px] text-sales-text-muted">Team notes and transfers appear in the conversation timeline.</p>
        </section>

        <section className="px-4 py-4">
          <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-sales-text-muted">Ownership & handover</h3>
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-sales-surface-hover text-[11px] font-semibold">
              {conversation.assignee?.name?.slice(0, 1) ?? "?"}
            </span>
            <div className="min-w-0">
              <div className="truncate text-[13px] font-semibold text-sales-text-primary">
                {conversation.assignee?.name ?? "Unassigned"}
              </div>
              <div className="text-[11px] text-sales-text-muted">
                {conversation.assignee ? "Sales Executive" : "No owner"}
              </div>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {conversation.phone ? (
              <a href={`tel:${conversation.phone}`} className="wa-btn-secondary !h-8 !w-auto !px-3 !text-[11px]">
                <Phone size={13} /> Call
              </a>
            ) : null}
            <Link href={`/sales/leads?lead=${conversation.id}`} className="wa-btn-secondary !h-8 !w-auto !px-3 !text-[11px]">
              View customer
            </Link>
            {canTransfer ? (
              <button type="button" onClick={() => setTransferOpen(true)} className="wa-btn-secondary !h-8 !w-auto !px-3 !text-[11px]">
                <ArrowLeftRight size={13} /> Transfer conversation
              </button>
            ) : null}
            <button type="button" onClick={() => setSupportOpen(true)} className="wa-btn-secondary !h-8 !w-auto !px-3 !text-[11px]">
              Transfer to Support
            </button>
            {!conversation.assignedToId && canClaim ? (
              <button
                type="button"
                disabled={claiming}
                onClick={() => onClaim(conversation.id)}
                className="rounded-[8px] bg-sales-brand px-3 py-1.5 text-[11px] font-semibold text-sales-brand-text"
              >
                {claiming ? "Claiming…" : "Claim"}
              </button>
            ) : null}
          </div>
        </section>
      </div>

      <TransferDialog
        open={transferOpen}
        salespeople={salespeople}
        currentAssigneeId={conversation.assignedToId}
        onClose={() => setTransferOpen(false)}
        onTransfer={async (assigneeId, handoverNotes) => {
          const res = await fetch(`/api/leads/${conversation.id}/transfer`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ assigned_to_id: assigneeId, handover_notes: handoverNotes || null }),
          });
          if (!res.ok) throw new Error("Transfer failed");
          onUpdated();
        }}
      />
      <TransferToSupportDialog
        open={supportOpen}
        salespeople={salespeople}
        currentUserId={currentUserId}
        onClose={() => setSupportOpen(false)}
        onTransfer={async (payload) => {
          const res = await fetch(`/api/inbox/conversations/${conversation.id}/transfer-support`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
          const json = (await res.json().catch(() => ({}))) as { error?: string };
          if (!res.ok) throw new Error(json.error ?? "Transfer failed");
          onUpdated();
        }}
      />
    </aside>
  );
}
