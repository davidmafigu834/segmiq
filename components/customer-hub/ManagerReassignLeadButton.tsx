"use client";

import { useEffect, useState } from "react";
import { UserRoundCog } from "lucide-react";
import { TransferDialog } from "@/components/inbox/TransferDialog";

type Salesperson = { id: string; name: string };

type Props = {
  clientId: string;
  leadId: string;
  currentAssigneeId: string | null;
  currentAssigneeName?: string | null;
  /** Compact button for inline rows; default is a full-width action button. */
  variant?: "button" | "link" | "row";
  className?: string;
  onReassigned?: (next: { assigneeId: string | null; assigneeName: string | null }) => void;
};

export function ManagerReassignLeadButton({
  clientId,
  leadId,
  currentAssigneeId,
  currentAssigneeName,
  variant = "button",
  className = "",
  onReassigned,
}: Props) {
  const [open, setOpen] = useState(false);
  const [salespeople, setSalespeople] = useState<Salesperson[]>([]);

  useEffect(() => {
    if (!open || !clientId) return;
    let cancelled = false;
    fetch(`/api/clients/${clientId}/users`)
      .then((r) => r.json())
      .then((d: { users?: Salesperson[] }) => {
        if (!cancelled) setSalespeople(Array.isArray(d.users) ? d.users : []);
      })
      .catch(() => {
        if (!cancelled) setSalespeople([]);
      });
    return () => {
      cancelled = true;
    };
  }, [open, clientId]);

  async function handleTransfer(assigneeId: string, handoverNotes: string) {
    const res = await fetch("/api/leads/bulk/reassign", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        leadIds: [leadId],
        assigned_to_id: assigneeId,
        handover_notes: handoverNotes || null,
      }),
    });
    const json = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      error?: string;
    };
    if (!res.ok || !json.ok) {
      throw new Error(json.error ?? "Reassignment failed");
    }
    const next = salespeople.find((s) => s.id === assigneeId) ?? null;
    onReassigned?.({
      assigneeId,
      assigneeName: next?.name ?? null,
    });
  }

  const label = currentAssigneeId ? "Reassign" : "Assign";

  return (
    <>
      {variant === "link" ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={`text-[12px] font-medium text-[var(--accent)] hover:underline ${className}`}
        >
          {label}
        </button>
      ) : variant === "row" ? (
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setOpen(true);
          }}
          className={`inline-flex h-8 items-center gap-1.5 rounded-lg border border-[var(--border)] px-2.5 text-[12px] font-medium text-[var(--text-secondary)] transition hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)] ${className}`}
        >
          <UserRoundCog className="h-3.5 w-3.5" strokeWidth={1.75} />
          {label}
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={`inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--bg-tertiary)] px-4 text-[13px] font-medium text-[var(--text-secondary)] transition hover:text-[var(--text-primary)] ${className}`}
        >
          <UserRoundCog className="h-4 w-4" strokeWidth={1.5} />
          {currentAssigneeId
            ? `Reassign${currentAssigneeName ? ` (${currentAssigneeName})` : ""}`
            : "Assign to salesperson"}
        </button>
      )}

      <TransferDialog
        open={open}
        salespeople={salespeople}
        currentAssigneeId={currentAssigneeId}
        whatsappMode={false}
        onClose={() => setOpen(false)}
        onTransfer={handleTransfer}
      />
    </>
  );
}
