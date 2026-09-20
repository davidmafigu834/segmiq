"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, ShieldCheck, X } from "lucide-react";
import { Button } from "@/components/ui";
import {
  ALL_SUPPORT_ACCESS_SCOPES,
  SUPPORT_ACCESS_SCOPE_DESCRIPTIONS,
  SUPPORT_ACCESS_SCOPE_LABELS,
  type SupportAccessScope,
} from "@/lib/security/support-access/scopes";
import {
  SUPPORT_ACCESS_DURATION_OPTIONS,
  SUPPORT_ACCESS_MIN_REASON_LENGTH,
} from "@/lib/security/support-access/policy";

export type RequestSupportAccessResult = {
  status: string;
  reference: string;
  expiresAt: string | null;
  scopes: SupportAccessScope[];
  organisation: string;
};

export function RequestSupportAccessModal({
  open,
  onClose,
  organisationId,
  organisationName,
  onGranted,
}: {
  open: boolean;
  onClose: () => void;
  organisationId: string;
  organisationName: string;
  onGranted: (result: RequestSupportAccessResult) => void;
}) {
  const [reason, setReason] = useState("");
  const [ticket, setTicket] = useState("");
  const [scopes, setScopes] = useState<SupportAccessScope[]>([]);
  const [duration, setDuration] = useState<number>(30);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reasonRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    const timer = setTimeout(() => reasonRef.current?.focus(), 60);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  const reasonValid = reason.trim().length >= SUPPORT_ACCESS_MIN_REASON_LENGTH;
  const canSubmit = useMemo(
    () => reasonValid && scopes.length > 0 && !submitting,
    [reasonValid, scopes.length, submitting]
  );

  function toggleScope(scope: SupportAccessScope) {
    setScopes((prev) =>
      prev.includes(scope) ? prev.filter((s) => s !== scope) : [...prev, scope]
    );
  }

  async function submit() {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/support-access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: organisationId,
          reason: reason.trim(),
          ticketReference: ticket.trim() || undefined,
          scopes,
          durationMinutes: duration,
        }),
      });
      const payload = (await res.json()) as {
        error?: string;
        grant?: {
          status: string;
          reference: string;
          expiresAt: string | null;
          scopes: SupportAccessScope[];
          organisation: string;
        };
      };
      if (!res.ok || !payload.grant) {
        setError(payload.error ?? "Could not start Support Access");
        return;
      }
      onGranted(payload.grant);
      setReason("");
      setTicket("");
      setScopes([]);
      setDuration(30);
      onClose();
    } catch {
      setError("Could not reach SegmiQ. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[120]" role="presentation">
      <button
        type="button"
        className="absolute inset-0 bg-black/45 backdrop-blur-[2px]"
        aria-label="Close dialog"
        onClick={onClose}
      />
      <div className="pointer-events-none relative flex h-full items-center justify-center p-4 sm:p-6">
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="support-access-title"
          className="pointer-events-auto flex max-h-[min(90vh,760px)] w-full max-w-[560px] flex-col overflow-hidden rounded-2xl border border-border bg-surface-card shadow-[0_24px_60px_-24px_rgba(0,0,0,0.45)]"
          onMouseDown={(e) => e.stopPropagation()}
        >
        <header className="flex shrink-0 items-start justify-between gap-4 border-b border-border px-6 py-5">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 grid h-8 w-8 place-items-center rounded-lg border border-border bg-[var(--bg-tertiary)]">
              <ShieldCheck className="h-4 w-4 text-ink-secondary" strokeWidth={1.5} aria-hidden />
            </span>
            <div>
              <h2
                id="support-access-title"
                className="font-display text-[19px] tracking-display text-ink-primary"
              >
                Request Support Access
              </h2>
              <p className="mt-1 text-[13px] leading-relaxed text-ink-secondary">
                Temporary, scoped access to this organisation&rsquo;s customer data.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cancel"
            className="rounded-md p-1 text-ink-tertiary transition-colors hover:bg-[var(--bg-tertiary)] hover:text-ink-primary"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto overscroll-contain px-6 py-6">
          <section>
            <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-tertiary">
              Organisation
            </p>
            <div className="mt-2 rounded-lg border border-border bg-[var(--bg-tertiary)] px-3.5 py-3">
              <p className="text-[14px] font-medium text-ink-primary">{organisationName}</p>
              <p className="mt-0.5 font-mono text-[11px] text-ink-tertiary">{organisationId}</p>
            </div>
          </section>

          <section>
            <label
              htmlFor="support-access-reason"
              className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-tertiary"
            >
              Reason <span className="text-[var(--error)]">*</span>
            </label>
            <textarea
              id="support-access-reason"
              ref={reasonRef}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              placeholder="Describe why access to customer data is required..."
              className="mt-2 w-full resize-y rounded-lg border border-border bg-[var(--bg-primary)] px-3.5 py-2.5 text-[14px] text-ink-primary placeholder:text-ink-tertiary focus:border-[var(--border-hover)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
            />
            <p className="mt-1.5 text-[12px] text-ink-tertiary">
              {reasonValid
                ? "Recorded on the access log."
                : `At least ${SUPPORT_ACCESS_MIN_REASON_LENGTH} characters.`}
            </p>
          </section>

          <section>
            <label
              htmlFor="support-access-ticket"
              className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-tertiary"
            >
              Support ticket / incident reference
            </label>
            <input
              id="support-access-ticket"
              value={ticket}
              onChange={(e) => setTicket(e.target.value)}
              placeholder="Optional"
              className="mt-2 h-9 w-full rounded-lg border border-border bg-[var(--bg-primary)] px-3.5 text-[14px] text-ink-primary placeholder:text-ink-tertiary focus:border-[var(--border-hover)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
            />
          </section>

          <section>
            <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-tertiary">
              Access scope <span className="text-[var(--error)]">*</span>
            </p>
            <div className="mt-2 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
              {ALL_SUPPORT_ACCESS_SCOPES.map((scope) => {
                const checked = scopes.includes(scope);
                return (
                  <label
                    key={scope}
                    className={`flex cursor-pointer gap-2.5 rounded-lg border px-3 py-2.5 transition-colors ${
                      checked
                        ? "border-[var(--accent)] bg-[var(--accent)]/[0.07]"
                        : "border-border hover:border-[var(--border-hover)]"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleScope(scope)}
                      className="mt-0.5 h-3.5 w-3.5 shrink-0 accent-[var(--accent)]"
                    />
                    <span className="min-w-0">
                      <span className="block text-[13px] font-medium text-ink-primary">
                        {SUPPORT_ACCESS_SCOPE_LABELS[scope]}
                      </span>
                      <span className="mt-0.5 block text-[11px] leading-snug text-ink-tertiary">
                        {SUPPORT_ACCESS_SCOPE_DESCRIPTIONS[scope]}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
          </section>

          <section>
            <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-tertiary">
              Duration
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {SUPPORT_ACCESS_DURATION_OPTIONS.map((minutes) => (
                <button
                  key={minutes}
                  type="button"
                  onClick={() => setDuration(minutes)}
                  className={`h-8 rounded-md border px-3 text-[13px] font-medium tabular-nums transition-colors ${
                    duration === minutes
                      ? "border-ink-primary bg-ink-primary text-[var(--bg-primary)]"
                      : "border-border text-ink-secondary hover:border-[var(--border-hover)] hover:text-ink-primary"
                  }`}
                >
                  {minutes < 60 ? `${minutes} minutes` : `${minutes / 60} hour${minutes > 60 ? "s" : ""}`}
                </button>
              ))}
            </div>
          </section>

          <p className="rounded-lg border border-border bg-[var(--bg-tertiary)] px-3.5 py-3 text-[12.5px] leading-relaxed text-ink-secondary">
            This access will be logged. Only access information necessary to resolve the
            stated issue.
          </p>

          {error ? (
            <p role="alert" className="text-[13px] text-[var(--error)]">
              {error}
            </p>
          ) : null}
        </div>

        <footer className="flex shrink-0 items-center justify-end gap-2 border-t border-border px-6 py-4">
          <Button variant="ghost" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!canSubmit}>
            {submitting ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                Requesting
              </>
            ) : (
              "Request Access"
            )}
          </Button>
        </footer>
        </div>
      </div>
    </div>
  );
}
