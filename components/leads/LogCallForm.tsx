"use client";

import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import type { CallOutcome, LeadRow } from "@/types";

const OUTCOMES: { value: CallOutcome; label: string }[] = [
  { value: "ANSWERED", label: "Answered" },
  { value: "NO_ANSWER", label: "No answer" },
  { value: "FOLLOW_UP", label: "Follow-up" },
  { value: "WON", label: "Won" },
  { value: "LOST", label: "Lost" },
  { value: "NOT_QUALIFIED", label: "Not qualified" },
];

function todayLocalISO(): string {
  const t = new Date();
  const y = t.getFullYear();
  const m = String(t.getMonth() + 1).padStart(2, "0");
  const d = String(t.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export type LogCallFormProps = {
  leadId: string;
  magicToken?: string | null;
  /** When set, success is reported to parent instead of inline toast */
  onMagicSubmitSuccess?: (ctx: {
    outcome: CallOutcome;
    lead: LeadRow;
    followUpDate: string | null;
    dealValue: number | null;
    notes: string;
  }) => void;
  onLogged?: () => void;
  onLeadUpdated?: (lead: LeadRow) => void;
  variant?: "panel" | "magic";
};

export function LogCallForm({
  leadId,
  magicToken,
  onMagicSubmitSuccess,
  onLogged,
  onLeadUpdated,
  variant = "panel",
}: LogCallFormProps) {
  const [outcome, setOutcome] = useState<CallOutcome>("ANSWERED");
  const [followUpDate, setFollowUpDate] = useState("");
  const [lostReason, setLostReason] = useState("");
  const [dealValue, setDealValue] = useState("");
  const [followUpFieldError, setFollowUpFieldError] = useState<string | null>(null);
  const [lostReasonFieldError, setLostReasonFieldError] = useState<string | null>(null);
  const [dealValueFieldError, setDealValueFieldError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [savedToast, setSavedToast] = useState(false);
  const [channel, setChannel] = useState<"call" | "whatsapp">("call");
  const isMagic = variant === "magic";

  useEffect(() => {
    try {
      const key = `log:channel:${leadId}`;
      const v = window.localStorage.getItem(key);
      if (v === "whatsapp") {
        setChannel("whatsapp");
        window.localStorage.removeItem(key);
      }
    } catch {}
    if (outcome !== "FOLLOW_UP") {
      setFollowUpDate("");
      setFollowUpFieldError(null);
    } else {
      setFollowUpDate((prev) => {
        if (prev) return prev;
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const y = tomorrow.getFullYear();
        const mo = String(tomorrow.getMonth() + 1).padStart(2, "0");
        const da = String(tomorrow.getDate()).padStart(2, "0");
        return `${y}-${mo}-${da}`;
      });
    }
  }, [outcome, leadId]);

  useEffect(() => {
    if (outcome !== "LOST") {
      setLostReason("");
      setLostReasonFieldError(null);
    }
  }, [outcome]);

  useEffect(() => {
    if (outcome !== "WON") {
      setDealValue("");
      setDealValueFieldError(null);
    }
  }, [outcome]);

  const minDate = todayLocalISO();

  const fieldZoomClass = isMagic
    ? "text-base sm:text-sm"
    : "text-[16px] sm:text-sm";

  return (
    <form
      className={isMagic ? "min-w-0 max-w-full space-y-4" : "space-y-4"}
      onSubmit={async (e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const notes = (fd.get("notes") as string) ?? "";
        setFollowUpFieldError(null);
        setLostReasonFieldError(null);
        setDealValueFieldError(null);
        setFormError(null);

        if (outcome === "FOLLOW_UP") {
          if (!followUpDate.trim()) {
            setFollowUpFieldError("Please pick a follow-up date");
            return;
          }
          if (followUpDate < minDate) {
            setFollowUpFieldError("Follow-up date cannot be in the past");
            return;
          }
        }

        if (outcome === "LOST") {
          if (!lostReason.trim()) {
            setLostReasonFieldError("Please pick a reason the deal was lost");
            return;
          }
          if (lostReason.length > 500) {
            setLostReasonFieldError("Reason must be 500 characters or less");
            return;
          }
        }

        if (outcome === "WON") {
          const n = Number(dealValue);
          if (!dealValue.trim() || !Number.isFinite(n) || n <= 0) {
            setDealValueFieldError("Enter the deal value");
            return;
          }
        }

        const body: Record<string, unknown> = {
          outcome,
          notes,
          followUpDate: outcome === "FOLLOW_UP" ? followUpDate : null,
          lostReason: outcome === "LOST" ? lostReason.trim() : null,
          channel,
        };
        if (outcome === "WON") {
          body.dealValue = Number(dealValue);
        }
        if (magicToken?.trim()) {
          body.magicToken = magicToken.trim();
        }

        const res = await fetch(`/api/leads/${leadId}/log-call`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as { error?: string; field?: string };
          if (data.field === "followUpDate") {
            setFollowUpFieldError(data.error ?? "Invalid follow-up date");
          } else if (data.field === "lostReason") {
            setLostReasonFieldError(data.error ?? "Invalid reason");
          } else if (data.field === "dealValue") {
            setDealValueFieldError(data.error ?? "Invalid deal value");
          } else {
            setFormError(data.error ?? "Failed to log call");
          }
          return;
        }
        const payload = (await res.json()) as { lead?: LeadRow };
        if (payload.lead) {
          onLeadUpdated?.(payload.lead);
        }
        onLogged?.();
        const fu = outcome === "FOLLOW_UP" ? followUpDate : null;
        const dv = outcome === "WON" ? Number(dealValue) : null;
        if (onMagicSubmitSuccess && payload.lead) {
          onMagicSubmitSuccess({
            outcome,
            lead: payload.lead,
            followUpDate: fu,
            dealValue: Number.isFinite(dv as number) ? (dv as number) : null,
            notes: notes.trim(),
          });
        } else {
          setSavedToast(true);
          window.setTimeout(() => setSavedToast(false), 2000);
        }
      }}
    >
      <div className="font-mono text-[11px] uppercase text-ink-tertiary">Log call</div>
      <div>
        <span className="mb-2 block font-mono text-[11px] uppercase text-ink-secondary">Outcome</span>
        <div className="grid grid-cols-2 gap-1 rounded-md bg-surface-card-alt p-1 sm:flex sm:flex-wrap">
          {OUTCOMES.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setOutcome(opt.value)}
              className={[
                "rounded px-2 py-1.5 text-sm transition-all touch-manipulation sm:px-3",
                isMagic
                  ? "min-h-[44px] text-xs sm:min-h-0 sm:text-sm"
                  : "min-h-[44px] text-[13px] sm:min-h-0 sm:py-1.5",
                outcome === opt.value
                  ? "bg-surface-card font-medium text-ink-primary shadow-sm"
                  : "text-ink-secondary hover:text-ink-primary",
              ].join(" ")}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
      <label className="block font-mono text-[11px] uppercase text-ink-secondary">
        Notes
        <textarea
          name="notes"
          className={`input-base mt-1 min-h-[80px] min-w-0 py-2 ${fieldZoomClass}`}
          rows={3}
        />
      </label>
      {outcome === "FOLLOW_UP" ? (
        <div>
          <label className="block font-mono text-[11px] uppercase text-ink-secondary">
            Follow-up date <span className="text-[#DC2626]">*</span>
            <input
              name="followUpDate"
              type="date"
              className={`input-base mt-1 min-w-0 max-w-full ${fieldZoomClass}`}
              min={minDate}
              required={outcome === "FOLLOW_UP"}
              value={followUpDate}
              onChange={(e) => {
                setFollowUpDate(e.target.value);
                setFollowUpFieldError(null);
              }}
            />
          </label>
          {followUpFieldError ? (
            <p className="mt-1.5 font-sans text-[12px] text-[#DC2626]">{followUpFieldError}</p>
          ) : null}
        </div>
      ) : null}
      {outcome === "WON" ? (
        <div>
          <label className="mb-2 block font-mono text-[11px] uppercase tracking-[0.12em] text-ink-secondary">
            Deal value <span className="text-[var(--danger-fg)]">*</span>
          </label>
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-ink-tertiary">
              $
            </span>
            <input
              type="number"
              min={0}
              step={100}
              value={dealValue}
              onChange={(e) => {
                setDealValue(e.target.value);
                setDealValueFieldError(null);
              }}
              placeholder="80000"
              className={`input-base mt-0 min-w-0 w-full py-2 pl-7 pr-3 ${fieldZoomClass}`}
            />
          </div>
          <p className="mt-1.5 text-xs text-ink-tertiary">
            Total contract value. Used in reporting and shown to your manager.
          </p>
          {dealValueFieldError ? (
            <p className="mt-1.5 font-sans text-[12px] text-[#DC2626]">{dealValueFieldError}</p>
          ) : null}
        </div>
      ) : null}
      {outcome === "LOST" ? (
        <div>
          <label className="block font-mono text-[11px] uppercase tracking-wide text-ink-secondary">
            Reason lost <span className="text-[#DC2626]">*</span>
            <input
              type="text"
              className={`input-base mt-1 min-w-0 ${fieldZoomClass}`}
              placeholder="e.g. Went with competitor, project cancelled, budget cut"
              maxLength={500}
              value={lostReason}
              onChange={(e) => {
                setLostReason(e.target.value);
                setLostReasonFieldError(null);
              }}
            />
          </label>
          <div className="mt-1 flex justify-end font-mono text-[10px] text-ink-tertiary">{lostReason.length}/500</div>
          {lostReasonFieldError ? (
            <p className="mt-1.5 font-sans text-[12px] text-[#DC2626]">{lostReasonFieldError}</p>
          ) : null}
        </div>
      ) : null}
      {formError ? <p className="font-sans text-[12px] text-[#DC2626]">{formError}</p> : null}
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <button
          type="submit"
          className={
            isMagic
              ? "btn-primary min-h-[48px] w-full touch-manipulation py-3 text-base sm:min-h-0 sm:text-[13px]"
              : "btn-primary w-full min-h-12 touch-manipulation sm:min-w-[12rem] sm:flex-1 sm:min-h-0"
          }
          disabled={
            (outcome === "FOLLOW_UP" && !followUpDate.trim()) ||
            (outcome === "LOST" && !lostReason.trim()) ||
            (outcome === "WON" && (!dealValue.trim() || Number(dealValue) <= 0))
          }
        >
          Save call log
        </button>
        {!onMagicSubmitSuccess && savedToast ? (
          <span className="flex items-center gap-1.5 text-sm text-[var(--success-fg)]">
            <Check className="h-4 w-4" strokeWidth={2} />
            Saved ✓
          </span>
        ) : null}
      </div>
    </form>
  );
}
