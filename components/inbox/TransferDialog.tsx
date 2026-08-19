"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { PremiumSheet } from "@/components/sales/PremiumSheet";

type Salesperson = { id: string; name: string };

type Props = {
  open: boolean;
  salespeople: Salesperson[];
  currentAssigneeId: string | null;
  onClose: () => void;
  onTransfer: (assigneeId: string, handoverNotes: string) => Promise<void>;
  whatsappMode?: boolean;
};

const fieldClass =
  "h-11 w-full rounded-[10px] border border-sales-border-strong bg-sales-surface px-3 text-[13px] text-sales-text-primary outline-none transition-colors placeholder:text-sales-text-muted focus:border-sales-brand focus:shadow-[var(--sales-focus-ring)]";

export function TransferDialog({
  open,
  salespeople,
  currentAssigneeId,
  onClose,
  onTransfer,
  whatsappMode = true,
}: Props) {
  const [assigneeId, setAssigneeId] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  if (!open) return null;

  const options = salespeople.filter((s) => s.id !== currentAssigneeId);

  async function handleSubmit() {
    if (!assigneeId || submitting) return;
    setSubmitting(true);
    setError("");
    try {
      await onTransfer(assigneeId, notes.trim());
      setAssigneeId("");
      setNotes("");
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Transfer failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <PremiumSheet
      eyebrow={whatsappMode ? "WhatsApp" : "Pipeline"}
      title={whatsappMode ? "Transfer conversation" : "Reassign lead"}
      description="Pass context so the next rep can pick up cleanly."
      onClose={onClose}
      labelledBy="transfer-dialog-title"
      maxWidthClass="max-w-md"
      footer={
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 min-w-[44px] items-center justify-center rounded-[10px] border border-sales-border-strong bg-sales-surface px-4 text-[13px] font-medium text-sales-text-primary transition-colors hover:bg-sales-surface-hover"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!assigneeId || submitting}
            onClick={() => void handleSubmit()}
            className="inline-flex h-10 min-w-[44px] items-center justify-center gap-2 rounded-[10px] bg-[#D4FF4F] px-5 text-[13px] font-semibold text-[#101828] transition-colors hover:bg-[#c8f244] disabled:opacity-50"
          >
            {submitting ? <Loader2 size={14} className="animate-spin" /> : null}
            {whatsappMode ? "Transfer" : "Reassign"}
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        <label className="block">
          <span className="mb-1.5 block text-[12px] font-medium text-sales-text-secondary">Transfer to</span>
          <select
            value={assigneeId}
            onChange={(e) => setAssigneeId(e.target.value)}
            className={fieldClass}
          >
            <option value="">Select salesperson…</option>
            {options.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-1.5 block text-[12px] font-medium text-sales-text-secondary">
            Handover note (internal)
          </span>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="Customer summary, next action, context for the new rep…"
            className={`${fieldClass} h-auto min-h-[88px] resize-none py-2.5`}
          />
        </label>

        {error ? <p className="text-[12px] text-[#EF4444]">{error}</p> : null}
      </div>
    </PremiumSheet>
  );
}
