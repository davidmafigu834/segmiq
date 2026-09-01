"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function DocumentsModuleToggle({
  clientId,
  enabled: initialEnabled,
}: {
  clientId: string;
  enabled: boolean;
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
          ? "Enable SegmiQ Documents for this company? Managers and salespeople can upload, search, and analyze company documents."
          : "Disable SegmiQ Documents for this company? Existing files stay stored, but the module will be hidden and uploads blocked."
      )
    ) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/clients/${clientId}/documents-module`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: next }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        enabled?: boolean;
      };
      if (!res.ok) {
        setError(data.error ?? "Update failed");
        return;
      }
      setEnabled(Boolean(data.enabled));
      router.refresh();
    } catch {
      setError("Update failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-border bg-surface-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-ink-primary">SegmiQ Documents</h3>
          <p className="mt-1 text-xs leading-relaxed text-ink-secondary">
            Intelligent document storage, classification, search, and CRM linking. When enabled, this
            company sees <strong className="text-ink-primary">Documents</strong> in their workspace at{" "}
            <code className="font-mono text-[10px]">/client/documents</code>.
          </p>
          {error ? <p className="mt-2 text-xs text-red-600">{error}</p> : null}
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          aria-label="Enable SegmiQ Documents"
          disabled={busy}
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
          {busy ? "Saving…" : enabled ? "Enabled" : "Not enabled"}
        </span>
      </p>
    </div>
  );
}
