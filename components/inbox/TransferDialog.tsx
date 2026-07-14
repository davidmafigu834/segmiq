"use client";

import { useState } from "react";
import { Loader2, X } from "lucide-react";

type Salesperson = { id: string; name: string };

type Props = {
  open: boolean;
  salespeople: Salesperson[];
  currentAssigneeId: string | null;
  onClose: () => void;
  onTransfer: (assigneeId: string, handoverNotes: string) => Promise<void>;
  whatsappMode?: boolean;
};

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
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/55 p-4 backdrop-blur-[2px] sm:items-center">
      <div
        className={`w-full max-w-md rounded-2xl border p-5 shadow-2xl ${
          whatsappMode ? "border-[#E9EDEF] bg-white" : "border-[var(--border)] bg-[var(--surface-card)]"
        }`}
      >
        <div className="mb-3 flex items-center justify-between">
          <h3 className={`text-base font-semibold ${whatsappMode ? "text-[#111B21]" : "text-[var(--text-primary)]"}`}>
            Transfer conversation
          </h3>
          <button
            type="button"
            onClick={onClose}
            className={`rounded-full p-1 ${whatsappMode ? "text-[#54656F] hover:bg-[#F0F2F5]" : "text-[var(--text-tertiary)]"}`}
          >
            <X size={18} />
          </button>
        </div>

        <label className={`mb-1 block text-xs font-medium ${whatsappMode ? "text-[#667781]" : "text-[var(--text-secondary)]"}`}>
          Transfer to
        </label>
        <select
          value={assigneeId}
          onChange={(e) => setAssigneeId(e.target.value)}
          className={`mb-3 w-full rounded-lg border px-3 py-2 text-sm ${
            whatsappMode ? "border-[#E9EDEF] bg-white text-[#111B21]" : "border-[var(--border)] bg-[var(--bg-primary)]"
          }`}
        >
          <option value="">Select salesperson…</option>
          {options.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>

        <label className={`mb-1 block text-xs font-medium ${whatsappMode ? "text-[#667781]" : "text-[var(--text-secondary)]"}`}>
          Handover note (internal)
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          placeholder="Customer summary, next action, context for the new rep…"
          className={`mb-3 w-full resize-none rounded-lg border px-3 py-2 text-sm ${
            whatsappMode ? "border-[#E9EDEF] bg-white text-[#111B21]" : "border-[var(--border)] bg-[var(--bg-primary)]"
          }`}
        />

        {error ? <p className="mb-2 text-xs text-red-600">{error}</p> : null}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className={`rounded-lg px-3 py-2 text-sm ${whatsappMode ? "text-[#54656F] hover:bg-[#F0F2F5]" : "text-[var(--text-secondary)]"}`}
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!assigneeId || submitting}
            onClick={() => void handleSubmit()}
            className="wa-btn-primary !w-auto px-5 py-2.5"
          >
            {submitting ? <Loader2 size={14} className="animate-spin" /> : null}
            Transfer
          </button>
        </div>
      </div>
    </div>
  );
}
