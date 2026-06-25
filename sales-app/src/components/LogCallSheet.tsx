import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { CrmButton } from "./crm";
import { enqueueCallLog, submitCallLog } from "../lib/call-log-queue";
import type { LeadRow, LogCallPayload, ReachOutcome, CallResult } from "../lib/types";
import { leadDisplayName } from "../lib/format";

const REACH_OPTIONS: Array<{ value: ReachOutcome; label: string }> = [
  { value: "reached", label: "Reached them" },
  { value: "no_answer", label: "No answer" },
  { value: "call_back", label: "Call me back" },
];

const RESULT_OPTIONS: Array<{ value: CallResult; label: string }> = [
  { value: "follow_up", label: "Follow-up" },
  { value: "won", label: "Won" },
  { value: "lost", label: "Lost" },
  { value: "not_qualified", label: "Not qualified" },
];

type Props = {
  open: boolean;
  leads: LeadRow[];
  initialLeadId?: string;
  initialChannel?: "call" | "whatsapp";
  online: boolean;
  onClose: () => void;
  onLogged: (lead?: LeadRow) => void;
};

export function LogCallSheet({
  open,
  leads,
  initialLeadId,
  initialChannel = "call",
  online,
  onClose,
  onLogged,
}: Props) {
  const [leadId, setLeadId] = useState(initialLeadId ?? "");
  const [reachOutcome, setReachOutcome] = useState<ReachOutcome>("reached");
  const [result, setResult] = useState<CallResult>("follow_up");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setLeadId(initialLeadId ?? leads[0]?.id ?? "");
      setReachOutcome("reached");
      setResult("follow_up");
      setNotes("");
      setError("");
    }
  }, [open, initialLeadId, leads]);

  const selectedLead = useMemo(
    () => leads.find((l) => l.id === leadId) ?? null,
    [leads, leadId]
  );

  if (!open) return null;

  async function handleSubmit() {
    if (!selectedLead) {
      setError("Pick a lead");
      return;
    }

    const payload: LogCallPayload = {
      reachOutcome,
      channel: initialChannel,
      notes: notes.trim() || undefined,
    };

    if (reachOutcome === "reached") {
      payload.result = result;
      if (result === "follow_up") {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(9, 0, 0, 0);
        payload.callbackAt = tomorrow.toISOString();
      }
      if (result === "lost") {
        payload.reason = "Went cold";
      }
      if (result === "not_qualified") {
        payload.reason = "Budget too small";
      }
    } else if (reachOutcome === "call_back") {
      const inOneHour = new Date(Date.now() + 60 * 60 * 1000);
      payload.callbackAt = inOneHour.toISOString();
    }

    setSubmitting(true);
    setError("");

    try {
      const attempt = await submitCallLog(selectedLead!.id, payload, online);
      if (attempt.queued) {
        await enqueueCallLog({
          leadId: selectedLead!.id,
          leadName: leadDisplayName(selectedLead!.name),
          payload,
        });
        onLogged(undefined);
      } else {
        onLogged(attempt.lead);
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to log call");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex flex-col justify-end bg-black/70">
      <button type="button" className="flex-1" aria-label="Close" onClick={onClose} />
      <div className="safe-bottom max-h-[85vh] overflow-y-auto rounded-t-2xl border-t border-border bg-bg-secondary px-5 pb-6 pt-4">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-[18px] font-semibold text-ink-primary">Log call</h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-bg-tertiary text-ink-secondary"
          >
            <X size={18} />
          </button>
        </div>

        <label className="mb-1 block text-[13px] font-medium text-ink-secondary">Lead</label>
        <select
          value={leadId}
          onChange={(e) => setLeadId(e.target.value)}
          className="mb-4 w-full rounded-lg border border-border bg-bg-primary px-4 py-3 text-[16px] text-ink-primary outline-none focus:border-border-focus"
        >
          {leads.map((l) => (
            <option key={l.id} value={l.id}>
              {leadDisplayName(l.name)}
            </option>
          ))}
        </select>

        <p className="mb-2 text-[13px] font-medium text-ink-secondary">What happened?</p>
        <div className="mb-4 grid grid-cols-1 gap-2">
          {REACH_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setReachOutcome(opt.value)}
              className={`min-h-[48px] rounded-lg border px-4 text-left text-[15px] font-medium transition-colors ${
                reachOutcome === opt.value
                  ? "border-accent bg-accent-muted text-accent"
                  : "border-border bg-bg-primary text-ink-primary"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {reachOutcome === "reached" ? (
          <>
            <p className="mb-2 text-[13px] font-medium text-ink-secondary">Result</p>
            <div className="mb-4 grid grid-cols-2 gap-2">
              {RESULT_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setResult(opt.value)}
                  className={`min-h-[48px] rounded-lg border px-3 text-[14px] font-medium transition-colors ${
                    result === opt.value
                      ? "border-accent bg-accent-muted text-accent"
                      : "border-border bg-bg-primary text-ink-primary"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </>
        ) : null}

        <label className="mb-1 block text-[13px] font-medium text-ink-secondary">Notes (optional)</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          className="mb-4 w-full resize-none rounded-lg border border-border bg-bg-primary px-4 py-3 text-[16px] text-ink-primary outline-none focus:border-border-focus"
          placeholder="Quick note…"
        />

        {error ? <p className="mb-3 text-[13px] text-[var(--error)]">{error}</p> : null}

        {!online ? (
          <p className="mb-3 text-[13px] text-[var(--warning)]">
            Offline — this will sync when you&apos;re back online
          </p>
        ) : null}

        <CrmButton className="w-full" disabled={submitting} onClick={() => void handleSubmit()}>
          {submitting ? "Saving…" : "Save log"}
        </CrmButton>
      </div>
    </div>
  );
}
