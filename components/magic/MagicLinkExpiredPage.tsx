"use client";

import { useState } from "react";
import { Check, Clock, Loader2, RefreshCw } from "lucide-react";

export function MagicLinkExpiredPage({ token }: { token: string }) {
  const [renewing, setRenewing] = useState(false);
  const [renewalSent, setRenewalSent] = useState(false);
  const [renewalError, setRenewalError] = useState("");
  const [newMagicLink, setNewMagicLink] = useState("");

  async function handleRenew() {
    setRenewing(true);
    setRenewalError("");

    try {
      const res = await fetch(`/api/leads/magic/${token}/renew`, {
        method: "POST",
      });

      const data = await res.json();

      if (res.ok && data.success) {
        if (data.renewed && data.magicLink) {
          setNewMagicLink(data.magicLink);
        }
        setRenewalSent(true);
      } else {
        setRenewalError(data.error || "Failed to renew link. Contact your manager.");
      }
    } catch {
      setRenewalError("Something went wrong. Please try again.");
    } finally {
      setRenewing(false);
    }
  }

  return (
    <div className="flex min-h-[100dvh] w-full min-w-0 max-w-[100vw] items-center justify-center overflow-x-hidden bg-surface-canvas px-4 py-12">
      <div className="w-full max-w-[400px] text-center">
        <p className="mb-8 text-[15px] font-semibold tracking-tight text-accent">Segmiq</p>

        <div className="rounded-2xl border border-border bg-bg-secondary px-8 py-10">
          {renewalSent ? (
            <>
              <div className="mx-auto mb-5 flex h-[52px] w-[52px] items-center justify-center rounded-full border border-[var(--success-border)] bg-[var(--success-muted)]">
                <Check className="h-6 w-6 text-[var(--success)]" strokeWidth={1.5} />
              </div>
              <h1 className="mb-3 font-display text-[20px] text-ink-primary">New link sent</h1>
              <p className="text-[14px] leading-relaxed text-ink-secondary">
                A fresh link has been sent to your WhatsApp and email. Check both and use the new link to open
                your lead.
              </p>
              {newMagicLink ? (
                <a
                  href={newMagicLink}
                  className="mt-6 inline-flex h-[42px] w-full items-center justify-center rounded-[10px] bg-accent text-[14px] font-semibold text-accent-foreground transition-colors hover:bg-accent-hover"
                >
                  Open lead now
                </a>
              ) : null}
            </>
          ) : (
            <>
              <div className="mx-auto mb-5 flex h-[52px] w-[52px] items-center justify-center rounded-full border border-[var(--warning-border)] bg-[var(--warning-muted)]">
                <Clock className="h-6 w-6 text-[var(--warning)]" strokeWidth={1.5} />
              </div>
              <h1 className="mb-3 font-display text-[20px] text-ink-primary">Link expired</h1>
              <p className="mb-6 text-[14px] leading-relaxed text-ink-secondary">
                This link has expired. Tap below to get a fresh link sent to your WhatsApp and email instantly.
              </p>
              {renewalError ? <p className="mb-4 text-[13px] text-[var(--error)]">{renewalError}</p> : null}
              <button
                type="button"
                onClick={() => void handleRenew()}
                disabled={renewing}
                className="inline-flex h-[42px] w-full items-center justify-center gap-2 rounded-[10px] bg-accent text-[14px] font-semibold text-accent-foreground transition-colors hover:bg-accent-hover disabled:opacity-60"
              >
                {renewing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                {renewing ? "Sending new link…" : "Send me a new link"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
