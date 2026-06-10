"use client";

import { useState } from "react";
import { Loader2, Mail } from "lucide-react";

export function OnboardingExpired({ token }: { token: string }) {
  const [renewing, setRenewing] = useState(false);
  const [renewalSent, setRenewalSent] = useState(false);
  const [renewalError, setRenewalError] = useState("");

  async function handleRenew() {
    setRenewing(true);
    setRenewalError("");
    try {
      const res = await fetch(`/api/onboard/${token}/renew`, { method: "POST" });
      const data = (await res.json()) as { success?: boolean; error?: string; renewed?: boolean };
      if (res.ok && data.success) {
        setRenewalSent(true);
      } else {
        setRenewalError(data.error || "Failed to renew link. Contact your agency.");
      }
    } catch {
      setRenewalError("Something went wrong. Please try again.");
    } finally {
      setRenewing(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--bg-primary)] px-4 py-12">
      <div className="w-full max-w-[400px] text-center">
        <p className="mb-8 text-[15px] font-semibold tracking-tight text-[var(--accent)]">Segmiq</p>
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-secondary)] px-8 py-10">
          {renewalSent ? (
            <>
              <div className="mx-auto mb-5 flex h-[52px] w-[52px] items-center justify-center rounded-full border border-[var(--success-border)] bg-[var(--success-muted)]">
                <Mail className="h-6 w-6 text-[var(--success)]" strokeWidth={1.5} />
              </div>
              <h1
                className="mb-3 text-[20px] text-[var(--text-primary)]"
                style={{ fontFamily: "var(--font-instrument-serif), 'Instrument Serif', serif" }}
              >
                New link sent
              </h1>
              <p className="text-[14px] leading-relaxed text-[var(--text-secondary)]">
                Check your email for a fresh onboarding link. It is valid for 7 days.
              </p>
            </>
          ) : (
            <>
              <h1
                className="mb-3 text-[20px] text-[var(--text-primary)]"
                style={{ fontFamily: "var(--font-instrument-serif), 'Instrument Serif', serif" }}
              >
                Link expired
              </h1>
              <p className="mb-6 text-[14px] leading-relaxed text-[var(--text-secondary)]">
                This onboarding link has expired. Request a new one and we&apos;ll email it to you.
              </p>
              {renewalError ? (
                <p className="mb-4 text-[13px] text-[var(--error)]">{renewalError}</p>
              ) : null}
              <button
                type="button"
                onClick={() => void handleRenew()}
                disabled={renewing}
                className="inline-flex h-[42px] w-full items-center justify-center gap-2 rounded-[10px] bg-[var(--accent)] text-[14px] font-semibold text-[var(--accent-foreground)] transition-colors hover:bg-[var(--accent-hover)] disabled:opacity-60"
              >
                {renewing ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {renewing ? "Sending…" : "Send new link"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
