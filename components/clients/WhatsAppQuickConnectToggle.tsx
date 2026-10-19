"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type PatchResponse = {
  error?: string;
  message?: string;
  enrollPath?: string;
  whatsapp_temporary_web_enabled?: boolean;
};

async function verifyStepUp(totpCode: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const code = totpCode.trim();
  if (code.length < 6) {
    return { ok: false, error: "Enter the 6-digit code from your authenticator app." };
  }
  const stepUpRes = await fetch("/api/auth/mfa", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "step_up", totpCode: code }),
  });
  const stepUp = (await stepUpRes.json().catch(() => ({}))) as {
    error?: string;
    reason?: string;
  };
  if (!stepUpRes.ok) {
    return {
      ok: false,
      error:
        stepUp.reason === "totp_required"
          ? "That authenticator code is invalid or expired. Try the latest code."
          : stepUp.error || "Could not verify your authenticator code.",
    };
  }
  return { ok: true };
}

export function WhatsAppQuickConnectToggle({
  clientId,
  enabled: initialEnabled,
  globalFeatureEnabled,
}: {
  clientId: string;
  enabled: boolean;
  globalFeatureEnabled: boolean;
}) {
  const router = useRouter();
  const mfaInputId = useId();
  const [enabled, setEnabled] = useState(initialEnabled);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enrollPath, setEnrollPath] = useState<string | null>(null);
  const [mfaRequired, setMfaRequired] = useState(false);
  const [mfaCode, setMfaCode] = useState("");
  const [pendingEnabled, setPendingEnabled] = useState<boolean | null>(null);

  async function patchQuickConnect(next: boolean): Promise<PatchResponse & { ok: boolean }> {
    const res = await fetch(`/api/clients/${clientId}/whatsapp-quick-connect`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ whatsapp_temporary_web_enabled: next }),
    });
    const data = (await res.json().catch(() => ({}))) as PatchResponse;
    return { ...data, ok: res.ok };
  }

  async function applyToggle(next: boolean, afterStepUp = false) {
    if (busy) return;
    setBusy(true);
    setError(null);
    setEnrollPath(null);
    try {
      if (afterStepUp) {
        const step = await verifyStepUp(mfaCode);
        if (!step.ok) {
          setError(step.error);
          return;
        }
      }
      const data = await patchQuickConnect(next);
      if (!data.ok) {
        if (data.error === "MFA_REQUIRED") {
          setMfaRequired(true);
          setPendingEnabled(next);
          setMfaCode("");
          setError(null);
          return;
        }
        if (data.error === "MFA_ENROLMENT_REQUIRED") {
          setMfaRequired(false);
          setPendingEnabled(null);
          setEnrollPath(data.enrollPath ?? "/dashboard/settings?tab=account&enrollMfa=1");
          setError("Set up two-step verification in Account Settings before changing this.");
          return;
        }
        setError(data.message ?? data.error ?? "Update failed");
        return;
      }
      setEnabled(Boolean(data.whatsapp_temporary_web_enabled));
      setMfaRequired(false);
      setPendingEnabled(null);
      setMfaCode("");
      router.refresh();
    } catch {
      setError("Update failed");
    } finally {
      setBusy(false);
    }
  }

  async function toggle() {
    if (busy) return;
    const next = !enabled;
    if (
      !window.confirm(
        next
          ? "Enable WhatsApp Sales Hub QR connection for this company? Their manager can scan a QR code to link WhatsApp."
          : "Disable QR connection for this company? Existing sessions stay until disconnected — new QR connects will be blocked."
      )
    ) {
      return;
    }
    await applyToggle(next);
  }

  function cancelMfa() {
    setMfaRequired(false);
    setPendingEnabled(null);
    setMfaCode("");
    setError(null);
  }

  const disabled = busy || !globalFeatureEnabled;

  return (
    <div className="rounded-xl border border-border bg-surface-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-ink-primary">WhatsApp Sales Hub QR connection</h3>
          <p className="mt-1 text-xs leading-relaxed text-ink-secondary">
            When enabled, this company&apos;s manager can connect WhatsApp by scanning a QR code from{" "}
            <strong className="text-ink-primary">Settings → Integrations → WhatsApp</strong>. No Meta Cloud
            phone number ID is required for this transport.
          </p>
          {!globalFeatureEnabled ? (
            <p className="mt-2 text-xs font-medium text-amber-700 dark:text-amber-400">
              QR connection is switched off globally for this SegmiQ environment (
              <code className="font-mono text-[10px]">WHATSAPP_TEMPORARY_WEB_ENABLED</code>).
            </p>
          ) : null}
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          aria-label="Enable WhatsApp Sales Hub QR connection"
          disabled={disabled}
          onClick={() => void toggle()}
          className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed disabled:opacity-50 ${
            enabled ? "bg-accent" : "bg-surface-card-alt"
          }`}
        >
          <span
            className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
              enabled ? "translate-x-6" : "translate-x-1"
            }`}
          />
        </button>
      </div>

      {mfaRequired && pendingEnabled !== null ? (
        <form
          className="mt-4 rounded-lg border border-border bg-surface-card-alt p-4"
          onSubmit={(e) => {
            e.preventDefault();
            void applyToggle(pendingEnabled, true);
          }}
        >
          <label className="block text-[12px] font-semibold text-ink-primary" htmlFor={mfaInputId}>
            Confirm with your authenticator
          </label>
          <p className="mt-1 text-xs text-ink-secondary">
            This change needs a current code from your authenticator app.
          </p>
          <input
            id={mfaInputId}
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            autoFocus
            maxLength={12}
            className="input-base mt-3 h-11 w-full font-mono text-base tracking-[0.2em] md:h-10 md:text-sm"
            value={mfaCode}
            onChange={(e) => setMfaCode(e.target.value.replace(/\s/g, ""))}
            placeholder="6-digit code"
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? `${mfaInputId}-error` : undefined}
          />
          <div className="mt-3 flex flex-wrap justify-end gap-2">
            <button type="button" className="btn-ghost h-11 px-3 md:h-9" onClick={cancelMfa} disabled={busy}>
              Cancel
            </button>
            <button type="submit" className="btn-primary h-11 px-3 md:h-9" disabled={busy || mfaCode.trim().length < 6}>
              {busy ? "Verifying…" : "Verify & continue"}
            </button>
          </div>
        </form>
      ) : null}

      {error ? (
        <p id={mfaRequired ? `${mfaInputId}-error` : undefined} className="mt-2 text-xs text-red-600" role="alert">
          {error}
          {enrollPath ? (
            <>
              {" "}
              <Link href={enrollPath} className="font-medium underline underline-offset-2">
                Open security settings
              </Link>
            </>
          ) : null}
        </p>
      ) : null}

      <p className="mt-3 text-[11px] text-ink-tertiary">
        Status:{" "}
        <span className="font-medium text-ink-secondary">
          {busy ? "Saving…" : mfaRequired ? "Waiting for authenticator code" : enabled ? "Enrolled in QR beta" : "Not enrolled"}
        </span>
      </p>
    </div>
  );
}
