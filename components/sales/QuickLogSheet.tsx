"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle, X } from "lucide-react";
import { LogCallForm } from "@/components/leads/LogCallForm";
import type { PriorityLead } from "@/lib/sales-priority-lead";
import { leadCardDisplayName } from "@/lib/leads/whatsapp-lead-display";

export function QuickLogSheet({
  leads,
  preselectedLeadId,
  onClose,
  onSuccess,
  defaultChannel = "call",
}: {
  leads: PriorityLead[];
  preselectedLeadId: string;
  onClose: () => void;
  onSuccess: () => void;
  defaultChannel?: "call" | "whatsapp";
}) {
  const [selectedLeadId, setSelectedLeadId] = useState(preselectedLeadId);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    setSelectedLeadId(preselectedLeadId);
    setSuccess(false);
  }, [preselectedLeadId]);

  const selectedLead = useMemo(
    () => leads.find((l) => l.id === selectedLeadId) ?? null,
    [leads, selectedLeadId]
  );

  const needsLeadPicker = !preselectedLeadId;

  function handleSubmitSuccess() {
    setSuccess(true);
    window.setTimeout(() => {
      onSuccess();
      onClose();
    }, 1200);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end bg-black/75"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex max-h-[min(92dvh,100dvh)] w-full flex-col rounded-t-2xl border-x border-t border-[var(--border)] bg-[var(--surface-card)]">
        <div className="w-10 h-1 shrink-0 rounded-full bg-[var(--bg-quaternary)] mx-auto mt-3" />

        <div className="flex shrink-0 items-center justify-between border-b border-[var(--border)] px-5 py-4">
          <div className="min-w-0">
            <h3 className="font-display text-[18px] font-semibold text-[var(--text-primary)] truncate">
              {defaultChannel === "whatsapp" ? "Log WhatsApp contact" : "Log a call"}
            </h3>
            {selectedLead && !needsLeadPicker ? (
              <p className="mt-0.5 truncate text-[13px] text-[var(--text-secondary)]">
                {leadCardDisplayName(selectedLead)}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--bg-tertiary)] text-[var(--text-tertiary)] transition-colors hover:text-[var(--text-primary)]"
            aria-label="Close"
          >
            <X size={14} />
          </button>
        </div>

        <div
          className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-5 py-5"
          style={{ paddingBottom: "calc(20px + env(safe-area-inset-bottom))" }}
        >
          {success ? (
            <div className="ag-fade-in flex flex-col items-center justify-center py-6 text-center">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--bg-tertiary)]">
                <CheckCircle size={22} className="text-[var(--success)]" />
              </div>
              <p className="text-[15px] font-semibold text-[var(--success)]">
                {defaultChannel === "whatsapp" ? "WhatsApp contact logged" : "Call logged"}
              </p>
            </div>
          ) : (
            <div className="ag-fade-in space-y-4">
              {needsLeadPicker ? (
                <div>
                  <p className="mb-2 font-mono text-[10px] font-semibold uppercase tracking-widest text-[var(--text-tertiary)]">
                    Lead
                  </p>
                  <select
                    value={selectedLeadId}
                    onChange={(e) => setSelectedLeadId(e.target.value)}
                    className="h-11 w-full rounded-lg border border-[var(--border)] bg-[var(--bg-tertiary)] px-3 text-[14px] text-[var(--text-primary)] transition-colors focus:border-[var(--border-hover)] focus:outline-none"
                  >
                    <option value="">Select lead…</option>
                    {leads.map((l) => (
                      <option key={l.id} value={l.id}>
                        {leadCardDisplayName(l)}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}

              {selectedLeadId ? (
                <LogCallForm
                  key={`${selectedLeadId}-${defaultChannel}`}
                  leadId={selectedLeadId}
                  variant="compact"
                  defaultChannel={defaultChannel}
                  onSubmitSuccess={handleSubmitSuccess}
                />
              ) : needsLeadPicker ? (
                <p className="text-[13px] text-[var(--text-tertiary)]">
                  Choose a lead to log the outcome.
                </p>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
