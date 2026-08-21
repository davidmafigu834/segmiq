"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

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
  const [enabled, setEnabled] = useState(initialEnabled);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/clients/${clientId}/whatsapp-quick-connect`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ whatsapp_temporary_web_enabled: next }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        whatsapp_temporary_web_enabled?: boolean;
      };
      if (!res.ok) {
        setError(data.error ?? "Update failed");
        return;
      }
      setEnabled(Boolean(data.whatsapp_temporary_web_enabled));
      router.refresh();
    } catch {
      setError("Update failed");
    } finally {
      setBusy(false);
    }
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
          {error ? <p className="mt-2 text-xs text-red-600">{error}</p> : null}
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
      <p className="mt-3 text-[11px] text-ink-tertiary">
        Status:{" "}
        <span className="font-medium text-ink-secondary">
          {busy ? "Saving…" : enabled ? "Enrolled in QR beta" : "Not enrolled"}
        </span>
      </p>
    </div>
  );
}
