"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function AgencyManagedToggle({
  clientId,
  agencyManaged: initial,
}: {
  clientId: string;
  agencyManaged: boolean;
}) {
  const router = useRouter();
  const [agencyManaged, setAgencyManaged] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle() {
    if (busy) return;
    const next = !agencyManaged;
    if (
      !window.confirm(
        next
          ? "Mark this client as managed by Segmiq?"
          : "Mark this client as self-serve? Meta and billing access stay with Super Admin."
      )
    ) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/clients/${clientId}/agency-managed`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agency_managed: next }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; agency_managed?: boolean };
      if (!res.ok) {
        setError(data.error ?? "Update failed");
        return;
      }
      setAgencyManaged(Boolean(data.agency_managed));
      router.refresh();
    } catch {
      setError("Update failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <button
        type="button"
        disabled={busy}
        onClick={() => void toggle()}
        className="inline-flex items-center gap-2 rounded-md border border-[var(--ag-border)] bg-[var(--surface-card)] px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--ag-text-secondary)] transition-colors hover:text-[var(--ag-text-primary)] disabled:opacity-60"
        title={agencyManaged ? "Managed marketing partner" : "Self-serve client"}
      >
        <span
          className={`h-1.5 w-1.5 rounded-full ${agencyManaged ? "bg-[var(--success)]" : "bg-[var(--text-tertiary)]"}`}
        />
        {busy ? "Updating…" : agencyManaged ? "Managed" : "Self-serve"}
      </button>
      {error ? <span className="text-[11px] text-[var(--error)]">{error}</span> : null}
    </div>
  );
}
