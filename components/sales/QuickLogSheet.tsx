"use client";

import { useState } from "react";
import {
  Phone,
  PhoneMissed,
  PhoneCall,
  CheckCircle,
  XCircle,
  MinusCircle,
  X,
} from "lucide-react";
import type { PriorityLead } from "@/lib/sales-priority-lead";

type Outcome =
  | "ANSWERED"
  | "NO_ANSWER"
  | "FOLLOW_UP"
  | "WON"
  | "LOST"
  | "NOT_QUALIFIED";

const OUTCOMES: Array<{
  value: Outcome;
  label: string;
  icon: React.ElementType;
  colour: string;
}> = [
  { value: "ANSWERED", label: "Answered", icon: Phone, colour: "var(--success)" },
  { value: "NO_ANSWER", label: "No answer", icon: PhoneMissed, colour: "var(--text-tertiary)" },
  { value: "FOLLOW_UP", label: "Follow-up", icon: PhoneCall, colour: "var(--warning)" },
  { value: "WON", label: "Won", icon: CheckCircle, colour: "var(--accent)" },
  { value: "LOST", label: "Lost", icon: XCircle, colour: "var(--error)" },
  { value: "NOT_QUALIFIED", label: "Not qualified", icon: MinusCircle, colour: "var(--text-disabled)" },
];

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
  const [selectedOutcome, setSelectedOutcome] = useState<Outcome | "">("");
  const [notes, setNotes] = useState("");
  const [logging, setLogging] = useState(false);
  const [success, setSuccess] = useState(false);
  const [channel] = useState<"call" | "whatsapp">(defaultChannel);

  async function handleLog() {
    if (!selectedLeadId || !selectedOutcome) return;
    setLogging(true);
    try {
      const res = await fetch("/api/sales/quick-log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leadId: selectedLeadId,
          outcome: selectedOutcome,
          notes: notes.trim() || undefined,
          channel,
        }),
      });
      if (res.ok) {
        setSuccess(true);
        setTimeout(() => {
          onSuccess();
          onClose();
        }, 1200);
      }
    } catch {
      // silent — user can retry
    } finally {
      setLogging(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end bg-black/75"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full rounded-t-2xl bg-[var(--surface-card)] border-t border-x border-[var(--border)]">
        <div className="w-10 h-1 rounded-full bg-[var(--bg-quaternary)] mx-auto mt-3" />

        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
          <h3 className="font-display text-[18px] font-semibold text-[var(--text-primary)]">
            {channel === "whatsapp" ? "Log WhatsApp contact" : "Log a call"}
          </h3>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-[var(--bg-tertiary)] border border-[var(--border)] flex items-center justify-center text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors"
          >
            <X size={14} />
          </button>
        </div>
        <div
          className="px-5 py-5"
          style={{ paddingBottom: "calc(20px + env(safe-area-inset-bottom))" }}
        >
          {success ? (
            <div className="flex flex-col items-center justify-center py-6 text-center">
              <div className="w-12 h-12 rounded-full bg-[var(--bg-tertiary)] border border-[var(--border)] flex items-center justify-center mb-3">
                <CheckCircle size={22} className="text-[var(--success)]" />
              </div>
              <p className="text-[15px] font-semibold text-[var(--success)]">
                {channel === "whatsapp" ? "WhatsApp contact logged" : "Call logged"}
              </p>
            </div>
          ) : (
            <>
              <div className="mb-4">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--text-tertiary)] mb-2">
                  Lead
                </p>
                <select
                  value={selectedLeadId}
                  onChange={(e) => setSelectedLeadId(e.target.value)}
                  className="w-full h-11 px-3 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border)] text-[var(--text-primary)] text-[14px] focus:border-[var(--border-focus,var(--border-hover))] focus:outline-none transition-colors"
                >
                  <option value="">Select lead...</option>
                  {leads.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name ?? "Unknown"}
                    </option>
                  ))}
                </select>
              </div>

              <div className="mb-4">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--text-tertiary)] mb-2">
                  Outcome
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {OUTCOMES.map((outcome) => {
                    const isSelected = selectedOutcome === outcome.value;
                    return (
                      <button
                        key={outcome.value}
                        type="button"
                        onClick={() => setSelectedOutcome(outcome.value)}
                        className="h-11 rounded-lg border text-[12px] font-semibold transition-colors flex items-center justify-center gap-1.5"
                        style={{
                          background: isSelected
                            ? `color-mix(in srgb, ${outcome.colour} 15%, transparent)`
                            : undefined,
                          borderColor: isSelected
                            ? `color-mix(in srgb, ${outcome.colour} 40%, transparent)`
                            : "var(--border)",
                          color: isSelected ? outcome.colour : "var(--text-tertiary)",
                        }}
                      >
                        <outcome.icon size={13} />
                        {outcome.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="mb-5">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--text-tertiary)] mb-2">
                  Notes{" "}
                  <span className="normal-case font-normal text-[var(--text-disabled)]">
                    optional
                  </span>
                </p>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="What happened on the call..."
                  rows={2}
                  className="w-full px-3 py-2.5 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border)] text-[var(--text-primary)] text-[14px] resize-none focus:border-[var(--border-focus,var(--border-hover))] focus:outline-none transition-colors placeholder:text-[var(--text-disabled)]"
                />
              </div>

              <button
                type="button"
                onClick={handleLog}
                disabled={!selectedLeadId || !selectedOutcome || logging}
                className={`w-full h-12 rounded-xl text-[15px] font-semibold transition-colors ${
                  !selectedLeadId || !selectedOutcome || logging
                    ? "bg-[var(--bg-tertiary)] text-[var(--text-disabled)] cursor-not-allowed border border-[var(--border)]"
                    : "bg-[var(--accent)] text-[var(--accent-foreground)] hover:bg-[var(--accent-hover)]"
                }`}
              >
                {logging ? "Logging..." : channel === "whatsapp" ? "Log WhatsApp" : "Log call"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
