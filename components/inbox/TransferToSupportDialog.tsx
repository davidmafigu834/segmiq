"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { PremiumSheet } from "@/components/sales/PremiumSheet";
import { SUPPORT_REASON_CATEGORIES, SUPPORT_REASON_LABEL } from "@/lib/inbox/conversation-type";

type Props = {
  open: boolean;
  salespeople: { id: string; name: string }[];
  currentUserId: string;
  onClose: () => void;
  onTransfer: (payload: {
    destination: "team" | "person";
    assigned_to_id?: string | null;
    reason_category: (typeof SUPPORT_REASON_CATEGORIES)[number];
    reason?: string;
    notes?: string;
    keep_collaborator: boolean;
  }) => Promise<void>;
};

export function TransferToSupportDialog({
  open,
  salespeople,
  currentUserId,
  onClose,
  onTransfer,
}: Props) {
  const [destination, setDestination] = useState<"team" | "person">("team");
  const [assigneeId, setAssigneeId] = useState("");
  const [reasonCategory, setReasonCategory] = useState<(typeof SUPPORT_REASON_CATEGORIES)[number]>("TECHNICAL");
  const [notes, setNotes] = useState("");
  const [keepCollaborator, setKeepCollaborator] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  if (!open) return null;

  async function handleSubmit() {
    if (submitting) return;
    if (destination === "person" && !assigneeId) {
      setError("Select a person");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      await onTransfer({
        destination,
        assigned_to_id: destination === "person" ? assigneeId : null,
        reason_category: reasonCategory,
        reason: SUPPORT_REASON_LABEL[reasonCategory],
        notes: notes.trim() || undefined,
        keep_collaborator: keepCollaborator,
      });
      onClose();
      setNotes("");
      setAssigneeId("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Transfer failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <PremiumSheet
      eyebrow="WhatsApp"
      title="Transfer conversation"
      description="The customer stays in the same WhatsApp thread. This only changes internal routing."
      onClose={onClose}
      labelledBy="transfer-support-title"
      maxWidthClass="max-w-md"
      footer={
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 items-center rounded-[10px] border border-sales-border-strong bg-sales-surface px-4 text-[13px] font-medium text-sales-text-primary hover:bg-sales-surface-hover"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={submitting}
            onClick={() => void handleSubmit()}
            className="inline-flex h-10 items-center gap-2 rounded-[10px] bg-[#D4FF4F] px-5 text-[13px] font-semibold text-[#101828] disabled:opacity-50"
          >
            {submitting ? <Loader2 size={14} className="animate-spin" /> : null}
            Transfer to Support
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        <fieldset>
          <legend className="mb-1.5 text-[12px] font-medium text-sales-text-secondary">Destination</legend>
          <div className="grid grid-cols-2 gap-2">
            {(["team", "person"] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setDestination(value)}
                className={`rounded-[10px] border px-3 py-2 text-[13px] font-medium ${
                  destination === value
                    ? "border-sales-brand-border bg-sales-brand-soft text-sales-text-primary"
                    : "border-sales-border text-sales-text-secondary hover:bg-sales-surface-hover"
                }`}
              >
                {value === "team" ? "Team" : "Person"}
              </button>
            ))}
          </div>
        </fieldset>

        {destination === "team" ? (
          <div className="rounded-[10px] border border-sales-border bg-sales-surface-subtle px-3 py-2 text-[13px] text-sales-text-primary">
            Support
          </div>
        ) : (
          <label className="block">
            <span className="mb-1.5 block text-[12px] font-medium text-sales-text-secondary">Person</span>
            <select
              value={assigneeId}
              onChange={(e) => setAssigneeId(e.target.value)}
              className="h-11 w-full rounded-[10px] border border-sales-border-strong bg-sales-surface px-3 text-[13px] text-sales-text-primary"
            >
              <option value="">Select teammate…</option>
              {salespeople
                .filter((person) => person.id !== currentUserId)
                .map((person) => (
                  <option key={person.id} value={person.id}>
                    {person.name}
                  </option>
                ))}
            </select>
          </label>
        )}

        <label className="block">
          <span className="mb-1.5 block text-[12px] font-medium text-sales-text-secondary">Reason</span>
          <select
            value={reasonCategory}
            onChange={(e) => setReasonCategory(e.target.value as (typeof SUPPORT_REASON_CATEGORIES)[number])}
            className="h-11 w-full rounded-[10px] border border-sales-border-strong bg-sales-surface px-3 text-[13px] text-sales-text-primary"
          >
            {SUPPORT_REASON_CATEGORIES.map((key) => (
              <option key={key} value={key}>
                {SUPPORT_REASON_LABEL[key]}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-1.5 block text-[12px] font-medium text-sales-text-secondary">Internal handover note</span>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="Issue summary, equipment, last customer message…"
            className="min-h-[88px] w-full resize-none rounded-[10px] border border-sales-border-strong bg-sales-surface px-3 py-2.5 text-[13px] text-sales-text-primary"
          />
        </label>

        <label className="flex items-center gap-2 text-[13px] text-sales-text-primary">
          <input
            type="checkbox"
            checked={keepCollaborator}
            onChange={(e) => setKeepCollaborator(e.target.checked)}
            className="h-4 w-4 rounded border-sales-border"
          />
          Keep me as collaborator
        </label>

        {error ? <p className="text-[12px] text-[#EF4444]">{error}</p> : null}
      </div>
    </PremiumSheet>
  );
}
