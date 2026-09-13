"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2, UserRoundSearch } from "lucide-react";

/**
 * Impersonation requires a recent step-up (elevated_until), not only MFA enrolled.
 * Having Google Authenticator enabled is necessary but not sufficient — the current
 * session must be re-verified with a TOTP code before this sensitive action.
 */
export function ImpersonateButton({
  userId,
  userName,
  variant = "button",
}: {
  userId: string;
  userName: string;
  variant?: "button" | "link";
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [pendingReason, setPendingReason] = useState<string | null>(null);
  const [totpCode, setTotpCode] = useState("");

  async function startImpersonation(reason: string) {
    const res = await fetch("/api/agency/impersonate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, reason }),
    });
    const data = (await res.json()) as { redirectTo?: string; error?: string };
    return { res, data };
  }

  async function submitStepUp(code: string): Promise<{ ok: true } | { ok: false; error: string }> {
    const res = await fetch("/api/auth/mfa", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "step_up", totpCode: code.trim() }),
    });
    const data = (await res.json().catch(() => ({}))) as { error?: string; reason?: string };
    if (!res.ok) {
      if (data.reason === "totp_required" || data.error === "Verification failed") {
        return { ok: false, error: "Invalid authenticator code. Try again." };
      }
      return {
        ok: false,
        error: typeof data.error === "string" ? data.error : "Could not verify authenticator",
      };
    }
    return { ok: true };
  }

  async function finishImpersonation(reason: string) {
    const { res, data } = await startImpersonation(reason);
    if (!res.ok) {
      setError(typeof data.error === "string" ? data.error : "Could not impersonate");
      return;
    }
    setPendingReason(null);
    setTotpCode("");
    router.push(data.redirectTo ?? "/client/dashboard");
    router.refresh();
  }

  async function handleClick() {
    if (loading) return;
    const reason = window.prompt(
      `Support reason for viewing as ${userName} (min 8 characters):`,
      ""
    );
    if (reason == null) return;
    const trimmed = reason.trim();
    if (trimmed.length < 8) {
      setError("Provide a support reason (at least 8 characters)");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const { res, data } = await startImpersonation(trimmed);
      if (res.ok) {
        router.push(data.redirectTo ?? "/client/dashboard");
        router.refresh();
        return;
      }

      if (data.error === "Step-up authentication required") {
        // MFA enrolled ≠ session elevated. Collect a fresh authenticator code.
        setPendingReason(trimmed);
        setTotpCode("");
        setError("");
        return;
      }

      setError(typeof data.error === "string" ? data.error : "Could not impersonate");
    } catch {
      setError("Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  async function handleStepUpSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!pendingReason || loading) return;
    const code = totpCode.trim();
    if (code.length < 6) {
      setError("Enter the 6-digit code from Google Authenticator");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const stepped = await submitStepUp(code);
      if (!stepped.ok) {
        setError(stepped.error);
        return;
      }
      await finishImpersonation(pendingReason);
    } catch {
      setError("Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  const label = loading ? "Starting…" : `View as ${userName}`;

  const stepUpForm =
    pendingReason != null ? (
      <form
        onSubmit={(e) => void handleStepUpSubmit(e)}
        className="mt-2 w-full max-w-[240px] rounded-md border border-border bg-surface-card p-2.5 shadow-sm"
      >
        <p className="text-[11px] leading-snug text-ink-secondary">
          Confirm with your authenticator app to start support impersonation.
        </p>
        <input
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          autoFocus
          maxLength={12}
          placeholder="6-digit code"
          value={totpCode}
          onChange={(ev) => setTotpCode(ev.target.value.replace(/\s/g, ""))}
          className="mt-2 h-9 w-full rounded-md border border-border bg-surface-input px-2 font-mono text-[13px] text-ink-primary outline-none focus:border-[var(--accent)]"
          aria-label="Authenticator code"
        />
        <div className="mt-2 flex items-center justify-end gap-2">
          <button
            type="button"
            className="text-[11px] text-ink-tertiary hover:text-ink-secondary"
            disabled={loading}
            onClick={() => {
              setPendingReason(null);
              setTotpCode("");
              setError("");
            }}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="inline-flex h-8 items-center gap-1.5 rounded-md bg-[var(--accent)] px-2.5 text-[11px] font-semibold text-accent-ink disabled:opacity-60"
          >
            {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
            Verify &amp; continue
          </button>
        </div>
      </form>
    ) : null;

  if (variant === "link") {
    return (
      <span className="inline-flex flex-col items-end gap-1">
        <button
          type="button"
          onClick={() => void handleClick()}
          disabled={loading || pendingReason != null}
          className="inline-flex items-center gap-1.5 font-mono text-[11px] text-[var(--accent)] underline-offset-2 hover:underline disabled:opacity-60"
        >
          {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <UserRoundSearch className="h-3 w-3" />}
          {label}
        </button>
        {stepUpForm}
        {error ? <span className="text-[10px] text-red-500">{error}</span> : null}
      </span>
    );
  }

  return (
    <span className="inline-flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={() => void handleClick()}
        disabled={loading || pendingReason != null}
        className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1 font-mono text-[11px] text-ink-secondary transition-colors hover:bg-surface-card-alt disabled:opacity-60"
      >
        {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <UserRoundSearch className="h-3 w-3" />}
        {label}
      </button>
      {stepUpForm}
      {error ? <span className="text-[10px] text-red-500">{error}</span> : null}
    </span>
  );
}
