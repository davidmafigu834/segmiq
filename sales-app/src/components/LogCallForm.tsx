import { useEffect, useMemo, useState } from "react";
import { Check, Star } from "lucide-react";
import { apiGet } from "../lib/api";
import { enqueueCallLog, submitCallLog } from "../lib/call-log-queue";
import {
  ASSET_REQUEST_OPTIONS,
  CALLBACK_SCHEDULE_LABELS,
  CALLBACK_SCHEDULE_OPTIONS,
  CALL_RESULT_LABELS,
  CALL_RESULTS,
  FOLLOW_UP_HOLDUP_REASONS,
  LOST_REASONS,
  NOT_QUALIFIED_REASONS,
  REACH_OUTCOME_LABELS,
  REACH_OUTCOMES,
  resolveCallbackAt,
  todayLocalISO,
  type AssetRequestKey,
  type CallResult,
  type CallbackScheduleOption,
  type ReachOutcome,
} from "../lib/call-log-constants";
import { leadDisplayName } from "../lib/format";
import type { LeadRow, LogCallPayload } from "../lib/types";
import { CrmButton } from "./crm";

function SegmentedControl<T extends string>({
  label,
  options,
  value,
  onChange,
  columns = 1,
}: {
  label: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  columns?: 1 | 2 | 3;
}) {
  const gridClass =
    columns === 3 ? "grid-cols-3" : columns === 2 ? "grid-cols-2" : "grid-cols-1";

  return (
    <div>
      <span className="mb-2 block font-mono text-[11px] uppercase tracking-[0.12em] text-ink-tertiary">
        {label}
      </span>
      <div
        className={`grid ${gridClass} overflow-hidden rounded-xl border border-border divide-x divide-y divide-border`}
      >
        {options.map((opt) => {
          const active = value === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange(opt.value)}
              className={`min-h-[48px] px-3 py-2.5 text-[14px] transition-colors touch-manipulation ${
                active
                  ? "bg-bg-quaternary font-semibold text-ink-primary"
                  : "bg-bg-tertiary text-ink-secondary"
              }`}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ReasonPills({
  label,
  options,
  value,
  onChange,
  hint,
}: {
  label: string;
  options: readonly string[];
  value: string;
  onChange: (v: string) => void;
  hint?: string;
}) {
  return (
    <div className="ag-fade-in space-y-2">
      <span className="block font-mono text-[11px] uppercase tracking-[0.12em] text-ink-tertiary">
        {label}
      </span>
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => {
          const active = value === opt;
          return (
            <button
              key={opt}
              type="button"
              onClick={() => onChange(active ? "" : opt)}
              className={`rounded-full border px-3 py-2 text-[13px] transition-colors touch-manipulation ${
                active
                  ? "border-accent bg-accent-muted text-accent"
                  : "border-border text-ink-secondary"
              }`}
            >
              {opt}
            </button>
          );
        })}
      </div>
      {hint ? <p className="text-[12px] text-ink-tertiary">{hint}</p> : null}
    </div>
  );
}

type Props = {
  lead: LeadRow;
  defaultChannel?: "call" | "whatsapp";
  online: boolean;
  variant?: "inline" | "sheet";
  onLogged?: (lead?: LeadRow) => void;
  onOpenSendTab?: () => void;
};

export function LogCallForm({
  lead,
  defaultChannel = "call",
  online,
  variant = "inline",
  onLogged,
  onOpenSendTab,
}: Props) {
  const [reachOutcome, setReachOutcome] = useState<ReachOutcome>("reached");
  const [result, setResult] = useState<CallResult | null>(null);
  const [reason, setReason] = useState("");
  const [scheduleOption, setScheduleOption] = useState<CallbackScheduleOption | "">("");
  const [customCallback, setCustomCallback] = useState("");
  const [assetsRequested, setAssetsRequested] = useState<AssetRequestKey[]>([]);
  const [convertLater, setConvertLater] = useState(false);
  const [noAnswerCount, setNoAnswerCount] = useState(0);
  const [notes, setNotes] = useState("");
  const [channel] = useState<"call" | "whatsapp">(defaultChannel);

  const [reasonError, setReasonError] = useState<string | null>(null);
  const [scheduleError, setScheduleError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [savedToast, setSavedToast] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const isClosed = ["WON", "LOST", "NOT_QUALIFIED"].includes(lead.status);

  useEffect(() => {
    if (!lead.id) return;
    let cancelled = false;
    void apiGet<{ noAnswerCount?: number }>(`/api/leads/${lead.id}/call-logs`).then((res) => {
      if (!cancelled && res.ok) setNoAnswerCount(res.data.noAnswerCount ?? 0);
    });
    return () => {
      cancelled = true;
    };
  }, [lead.id, savedToast]);

  useEffect(() => {
    if (reachOutcome !== "reached") {
      setResult(null);
      setAssetsRequested([]);
    }
    if (reachOutcome !== "reached" || result !== "follow_up") {
      setConvertLater(false);
    }
    if (reachOutcome === "no_answer") {
      setReason("");
      setScheduleOption("");
      setCustomCallback("");
    }
    setReasonError(null);
    setScheduleError(null);
  }, [reachOutcome, result]);

  const needsSchedule =
    (reachOutcome === "reached" && result === "follow_up") || reachOutcome === "call_back";

  const callbackAtIso = useMemo(() => {
    if (!needsSchedule || !scheduleOption) return null;
    if (scheduleOption === "pick" && !customCallback.trim()) return null;
    return resolveCallbackAt(
      scheduleOption,
      scheduleOption === "pick" ? customCallback : null
    ).toISOString();
  }, [needsSchedule, scheduleOption, customCallback]);

  function toggleAsset(key: AssetRequestKey) {
    setAssetsRequested((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  }

  function validate(): boolean {
    setReasonError(null);
    setScheduleError(null);
    setFormError(null);

    if (reachOutcome === "reached") {
      if (result === "lost" || result === "not_qualified" || result === "follow_up") {
        if (!reason.trim()) {
          setReasonError("Please select a reason");
          return false;
        }
      }
      if (result === "follow_up" && !callbackAtIso) {
        setScheduleError("Please schedule when to follow up");
        return false;
      }
    }

    if (reachOutcome === "call_back" && !callbackAtIso) {
      setScheduleError("Please schedule when to call back");
      return false;
    }

    return true;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isClosed || !validate()) return;

    const payload: LogCallPayload = {
      reachOutcome,
      result: reachOutcome === "reached" ? result : null,
      reason: reason.trim() || null,
      callbackAt: callbackAtIso,
      assetsRequested: assetsRequested.length ? assetsRequested : null,
      notes: notes.trim() || undefined,
      channel,
      isConvertLaterPick: convertLater,
      convertLaterNote:
        convertLater && reason.trim()
          ? reason.trim()
          : convertLater
            ? notes.trim() || null
            : null,
    };

    setSubmitting(true);
    setFormError("");

    try {
      const attempt = await submitCallLog(lead.id, payload, online);
      if (attempt.queued) {
        await enqueueCallLog({
          leadId: lead.id,
          leadName: leadDisplayName(lead.name),
          payload,
        });
        onLogged?.(undefined);
      } else {
        onLogged?.(attempt.lead);
      }
      setSavedToast(true);
      window.setTimeout(() => setSavedToast(false), 2000);
      setReachOutcome("reached");
      setResult(null);
      setReason("");
      setScheduleOption("");
      setCustomCallback("");
      setAssetsRequested([]);
      setConvertLater(false);
      setNotes("");
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to log call");
    } finally {
      setSubmitting(false);
    }
  }

  if (isClosed) {
    return (
      <p className="text-[14px] text-ink-tertiary">This lead is closed — call log is read-only.</p>
    );
  }

  const minPickDate = todayLocalISO();

  return (
    <form className="space-y-4" onSubmit={(e) => void handleSubmit(e)}>
      {variant === "inline" ? (
        <div className="flex items-center gap-2">
          <div className="h-px flex-1 bg-border" />
          <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink-tertiary">
            Log call
          </span>
          <div className="h-px flex-1 bg-border" />
        </div>
      ) : null}

      <SegmentedControl
        label="Did you reach them?"
        options={REACH_OUTCOMES.map((v) => ({ value: v, label: REACH_OUTCOME_LABELS[v] }))}
        value={reachOutcome}
        onChange={setReachOutcome}
        columns={3}
      />

      {reachOutcome === "reached" ? (
        <>
          <div className="ag-fade-in">
            <span className="mb-2 block font-mono text-[11px] uppercase tracking-[0.12em] text-ink-tertiary">
              Result
            </span>
            <div className="grid grid-cols-2 overflow-hidden rounded-xl border border-border divide-x divide-y divide-border">
              {CALL_RESULTS.map((v) => {
                const active = result === v;
                return (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setResult(active ? null : v)}
                    className={`min-h-[48px] px-3 py-2.5 text-[14px] transition-colors touch-manipulation ${
                      active
                        ? "bg-bg-quaternary font-semibold text-ink-primary"
                        : "bg-bg-tertiary text-ink-secondary"
                    }`}
                  >
                    {CALL_RESULT_LABELS[v]}
                  </button>
                );
              })}
            </div>
          </div>

          {result === "follow_up" ? (
            <ReasonPills
              label="What's the hold-up?"
              options={FOLLOW_UP_HOLDUP_REASONS}
              value={reason}
              onChange={setReason}
            />
          ) : null}

          {result === "lost" ? (
            <ReasonPills
              label="Why did it die?"
              options={LOST_REASONS}
              value={reason}
              onChange={setReason}
            />
          ) : null}

          {result === "not_qualified" ? (
            <ReasonPills
              label="Why not a fit?"
              options={NOT_QUALIFIED_REASONS}
              value={reason}
              onChange={setReason}
              hint='Aggregated "not a fit" reasons indicate ad-targeting mismatch, not a sales problem.'
            />
          ) : null}

          {result === "won" ? (
            <p className="ag-fade-in text-[12px] text-ink-tertiary">
              Deal won — add any confirmation details in notes below.
            </p>
          ) : null}

          <div className="ag-fade-in space-y-2">
            <span className="block font-mono text-[11px] uppercase tracking-[0.12em] text-ink-tertiary">
              Did they ask for anything?
            </span>
            <div className="flex flex-wrap gap-2">
              {ASSET_REQUEST_OPTIONS.map((opt) => {
                const active = assetsRequested.includes(opt.key);
                return (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => toggleAsset(opt.key)}
                    className={`rounded-full border px-3 py-2 text-[13px] transition-colors touch-manipulation ${
                      active
                        ? "border-accent bg-accent-muted text-accent"
                        : "border-border text-ink-secondary"
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
            {assetsRequested.length > 0 && onOpenSendTab ? (
              <button
                type="button"
                onClick={onOpenSendTab}
                className="rounded-lg border border-border px-3 py-2 text-[13px] font-medium text-ink-primary touch-manipulation"
              >
                Open send panel
              </button>
            ) : null}
          </div>
        </>
      ) : null}

      {reachOutcome === "no_answer" ? (
        <p className="ag-fade-in rounded-xl border border-border bg-bg-tertiary px-4 py-3 text-[13px] leading-relaxed text-ink-secondary">
          Attempt #{noAnswerCount + 1}. Repeated no-answers keep this lead in Call now, then
          Recover — and feed retargeting when it graduates.
        </p>
      ) : null}

      {needsSchedule ? (
        <div className="ag-fade-in space-y-3">
          <span className="block font-mono text-[11px] uppercase tracking-[0.12em] text-ink-tertiary">
            When should it come back?
          </span>
          <div className="flex flex-wrap gap-2">
            {CALLBACK_SCHEDULE_OPTIONS.map((opt) => {
              const active = scheduleOption === opt;
              return (
                <button
                  key={opt}
                  type="button"
                  onClick={() => {
                    setScheduleOption(active ? "" : opt);
                    setScheduleError(null);
                  }}
                  className={`rounded-full border px-3 py-2 text-[13px] transition-colors touch-manipulation ${
                    active
                      ? "border-accent bg-accent-muted text-accent"
                      : "border-border text-ink-secondary"
                  }`}
                >
                  {CALLBACK_SCHEDULE_LABELS[opt]}
                </button>
              );
            })}
          </div>
          {scheduleOption === "pick" ? (
            <label className="block font-mono text-[11px] uppercase tracking-[0.12em] text-ink-tertiary">
              Date & time
              <input
                type="datetime-local"
                className="mt-1 w-full rounded-lg border border-border bg-bg-primary px-4 py-3 text-[16px] text-ink-primary outline-none focus:border-border-focus"
                min={`${minPickDate}T00:00`}
                value={customCallback}
                onChange={(e) => {
                  setCustomCallback(e.target.value);
                  setScheduleError(null);
                }}
              />
            </label>
          ) : null}
          {reachOutcome === "reached" && result === "follow_up" ? (
            <button
              type="button"
              onClick={() => setConvertLater((v) => !v)}
              className={`flex w-full items-center gap-2 rounded-xl border px-4 py-3 text-[13px] transition-colors touch-manipulation ${
                convertLater
                  ? "border-accent bg-accent-muted text-accent"
                  : "border-border text-ink-secondary"
              }`}
            >
              <Star className="h-4 w-4" strokeWidth={1.5} fill={convertLater ? "currentColor" : "none"} />
              Save to my convert-later picks
            </button>
          ) : null}
          {scheduleError ? <p className="text-[12px] text-[var(--error)]">{scheduleError}</p> : null}
        </div>
      ) : null}

      {reasonError ? <p className="text-[12px] text-[var(--error)]">{reasonError}</p> : null}

      <label className="block font-mono text-[11px] uppercase tracking-[0.12em] text-ink-tertiary">
        Notes
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          className="mt-1 w-full resize-none rounded-xl border border-border bg-bg-primary px-4 py-3 text-[16px] text-ink-primary outline-none focus:border-border-focus"
          placeholder="Quick note…"
        />
      </label>

      {formError ? <p className="text-[12px] text-[var(--error)]">{formError}</p> : null}

      {!online ? (
        <p className="text-[13px] text-[var(--warning)]">
          Offline — this will sync when you&apos;re back online
        </p>
      ) : null}

      <div className="flex items-center gap-3">
        <CrmButton className="flex-1" disabled={submitting} type="submit">
          {submitting ? "Saving…" : channel === "whatsapp" ? "Log WhatsApp" : "Save call log"}
        </CrmButton>
        {savedToast ? (
          <span className="flex shrink-0 items-center gap-1.5 text-[14px] text-[var(--success)]">
            <Check className="h-4 w-4" strokeWidth={2} />
            Saved
          </span>
        ) : null}
      </div>
    </form>
  );
}
