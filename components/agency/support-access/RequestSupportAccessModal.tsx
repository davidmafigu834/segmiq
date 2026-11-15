"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { X } from "lucide-react";
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
        className="absolute inset-0 bg-black/45"
        aria-label="Close dialog"
        onClick={onClose}
      />
      <div className="pointer-events-none relative flex h-full items-center justify-center p-4 sm:p-6">
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="support-access-title"
          className="pointer-events-auto flex max-h-[min(90vh,760px)] w-full max-w-[560px] flex-col overflow-hidden rounded-[6px] border border-[var(--border)] bg-[var(--bg-primary)]"
          onMouseDown={(e) => e.stopPropagation()}
        >
        <header className="flex shrink-0 items-start justify-between gap-4 border-b border-[var(--border)] px-5 py-4">
          <div>
            <h2
              id="support-access-title"
              className="text-[18px] font-semibold tracking-[-0.02em] text-[var(--text-primary)]"
            >
              Request support access
            </h2>
            <p className="mt-1 text-[14px] text-[var(--text-secondary)]">
              Temporary, scoped access to this organisation&rsquo;s customer data.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cancel"
            className="inline-flex h-8 w-8 items-center justify-center rounded-[6px] text-[var(--text-tertiary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain px-5 py-5">
          <section>
            <p className="text-[13px] font-medium text-[var(--text-secondary)]">Organisation</p>
            <div className="mt-2 rounded-[6px] border border-[var(--border)] bg-[var(--bg-secondary)] px-3.5 py-3">
              <p className="text-[14px] font-semibold text-[var(--text-primary)]">{organisationName}</p>
              <p className="mt-0.5 text-[13px] text-[var(--text-tertiary)]">{organisationId}</p>
            </div>
          </section>

          <section>
            <label
              htmlFor="support-access-reason"
              className="text-[13px] font-medium text-[var(--text-secondary)]"
            >
              Reason
            </label>
            <textarea
              id="support-access-reason"
              ref={reasonRef}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              placeholder="Why access to customer data is required"
              className="textarea-base mt-2 w-full"
            />
            <p className="mt-1.5 text-[13px] text-[var(--text-tertiary)]">
              {reasonValid
                ? "Recorded on the access log."
                : `At least ${SUPPORT_ACCESS_MIN_REASON_LENGTH} characters.`}
            </p>
          </section>

          <section>
            <label
              htmlFor="support-access-ticket"
              className="text-[13px] font-medium text-[var(--text-secondary)]"
            >
              Support ticket
            </label>
            <input
              id="support-access-ticket"
              value={ticket}
              onChange={(e) => setTicket(e.target.value)}
              placeholder="Optional"
              className="input-base mt-2 w-full"
            />
          </section>

          <section>
            <p className="text-[13px] font-medium text-[var(--text-secondary)]">Access scope</p>
            <div className="mt-2 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
              {ALL_SUPPORT_ACCESS_SCOPES.map((scope) => {
                const checked = scopes.includes(scope);
                return (
                  <label
                    key={scope}
                    className={`flex cursor-pointer gap-2.5 rounded-[6px] border px-3 py-2.5 ${
                      checked
                        ? "border-[var(--text-primary)] bg-[var(--bg-secondary)]"
                        : "border-[var(--border)] hover:bg-[var(--bg-secondary)]"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleScope(scope)}
                      className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--text-primary)]"
                    />
                    <span className="min-w-0">
                      <span className="block text-[13px] font-semibold text-[var(--text-primary)]">
                        {SUPPORT_ACCESS_SCOPE_LABELS[scope]}
                      </span>
                      <span className="mt-0.5 block text-[12px] leading-snug text-[var(--text-tertiary)]">
                        {SUPPORT_ACCESS_SCOPE_DESCRIPTIONS[scope]}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
          </section>

          <section>
            <p className="text-[13px] font-medium text-[var(--text-secondary)]">Duration</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {SUPPORT_ACCESS_DURATION_OPTIONS.map((minutes) => (
                <button
                  key={minutes}
                  type="button"
                  onClick={() => setDuration(minutes)}
                  className={`h-9 rounded-[6px] border px-3 text-[13px] font-semibold tabular-nums ${
                    duration === minutes
                      ? "border-[var(--text-primary)] bg-[var(--text-primary)] text-[var(--bg-primary)]"
                      : "border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] hover:text-[var(--text-primary)]"
                  }`}
                >
                  {minutes < 60 ? `${minutes} minutes` : `${minutes / 60} hour${minutes > 60 ? "s" : ""}`}
                </button>
              ))}
            </div>
          </section>

          <p className="rounded-[6px] border border-[var(--border)] bg-[var(--bg-secondary)] px-3.5 py-3 text-[13px] leading-relaxed text-[var(--text-secondary)]">
            This access is logged. Open only what is needed to resolve the stated issue.
          </p>

          {error ? (
            <p role="alert" className="text-[13px] text-[var(--error)]">
              {error}
            </p>
          ) : null}
        </div>

        <footer className="flex shrink-0 items-center justify-end gap-2 border-t border-[var(--border)] px-5 py-4">
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!canSubmit}>
            {submitting ? "Requesting…" : "Request access"}
          </Button>
        </footer>
        </div>
      </div>
    </div>
  );
}
