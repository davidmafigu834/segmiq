"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { MoreHorizontal, Lightbulb } from "lucide-react";
import { ClientAvatar } from "@/components/ClientAvatar";
import { formatDuration } from "@/lib/format";
import type { ClientPerfRow } from "@/lib/dashboard-data";

type RecSummary = { count: number; hasCritical: boolean };

export function ClientCard({ row }: { row: ClientPerfRow }) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [recSummary, setRecSummary] = useState<RecSummary | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/clients/${row.id}/recommendations`)
      .then((r) => r.json())
      .then((data: { recommendations?: Array<{ priority: string }> }) => {
        const recs = data.recommendations ?? [];
        if (recs.length === 0) return;
        setRecSummary({
          count: recs.length,
          hasCritical: recs.some((r) => r.priority === "critical"),
        });
      })
      .catch(() => {});
  }, [row.id]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    }
    document.addEventListener("click", onDoc);
    return () => document.removeEventListener("click", onDoc);
  }, []);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (confirmOpen && !dialog.open) dialog.showModal();
    if (!confirmOpen && dialog.open) dialog.close();
  }, [confirmOpen]);

  async function handleTogglePause() {
    const newState = !row.is_active;
    setIsSaving(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/clients/${row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: newState }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setActionError(body.error ?? "We couldn’t update this client. Try again.");
        return;
      }
      setConfirmOpen(false);
      router.refresh();
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <>
    <div
      role="link"
      tabIndex={0}
      className="group relative block cursor-pointer rounded-lg px-3 py-6 transition-colors duration-150 ease-[var(--ease-out)] hover:bg-[var(--bg-tertiary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--accent)] sm:px-4"
      onClick={() => router.push(`/dashboard/clients/${row.id}`)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          router.push(`/dashboard/clients/${row.id}`);
        }
      }}
    >
      {row.hasFlag ? (
        <span
          className="absolute right-4 top-4 h-2 w-2 rounded-full bg-[var(--error)]"
          aria-label="Has uncontacted leads over limit"
        />
      ) : null}
      {recSummary && !row.hasFlag ? (
        <div
          className={`absolute right-4 top-4 flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
            recSummary.hasCritical
              ? "border-[var(--error-border)] bg-[var(--error-muted)] text-[var(--error)]"
              : "border-[var(--warning-border)] bg-[var(--warning-muted)] text-[var(--warning)]"
          }`}
          aria-label="Active recommendations"
        >
          <Lightbulb size={9} />
          {recSummary.count}
        </div>
      ) : null}
      <div className={`flex items-start justify-between gap-2 ${row.hasFlag || recSummary ? "pr-8" : ""}`}>
        <div className="flex min-w-0 gap-3">
          <ClientAvatar name={row.name} size={36} />
          <div className="min-w-0">
            <div className="flex flex-wrap items-baseline gap-2">
              <div className="text-[14px] font-semibold text-[var(--text-primary)]">{row.name}</div>
              {!row.is_active ? (
                <span className="rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--bg-quaternary)] px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-[var(--text-tertiary)]">
                  Paused
                </span>
              ) : null}
            </div>
            <div className="mt-0.5 text-[11px] uppercase tracking-[0.06em] text-[var(--text-tertiary)]">
              {row.industry}
            </div>
          </div>
        </div>
        <div className={`relative shrink-0 ${row.hasFlag ? "absolute right-9 top-4" : ""}`} ref={menuRef}>
          <button
            type="button"
            className="flex h-8 w-8 items-center justify-center rounded-md text-[var(--text-tertiary)] transition-colors hover:bg-[var(--bg-quaternary)] hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
            aria-label="More"
            onClick={(e) => {
              e.stopPropagation();
              setMenuOpen((o) => !o);
            }}
          >
            <MoreHorizontal className="h-4 w-4" strokeWidth={1.5} />
          </button>
          {menuOpen ? (
            <div className="absolute right-0 top-full z-20 mt-1 min-w-[160px] rounded-md border border-[var(--border)] bg-[var(--surface-dropdown)] py-1 shadow-[var(--shadow-md)]">
              <button
                type="button"
                className="block w-full px-3 py-1.5 text-left text-[12px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  router.push(`/dashboard/clients/${row.id}`);
                  setMenuOpen(false);
                }}
              >
                View
              </button>
              <button
                type="button"
                className="block w-full px-3 py-1.5 text-left text-[12px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  router.push(`/dashboard/clients/${row.id}/settings`);
                  setMenuOpen(false);
                }}
              >
                Edit settings
              </button>
              <button
                type="button"
                className="block w-full px-3 py-1.5 text-left text-[12px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  router.push(`/dashboard/clients/${row.id}/landing-page`);
                  setMenuOpen(false);
                }}
              >
                Landing page
              </button>
              <button
                type="button"
                className="w-full px-3 py-1.5 text-left text-[12px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  setMenuOpen(false);
                  setActionError(null);
                  setConfirmOpen(true);
                }}
              >
                {row.is_active ? "Pause client" : "Resume client"}
              </button>
            </div>
          ) : null}
        </div>
      </div>

      <div className="my-4 h-px bg-[var(--border)]" />

      <div className="grid grid-cols-2 gap-x-5 gap-y-4">
        <div>
          <div className="text-[10px] font-medium uppercase tracking-[0.06em] text-[var(--text-tertiary)]">
            Leads this week
          </div>
          <div className="mt-0.5 text-[20px] font-semibold tabular-nums text-[var(--text-primary)]">{row.leadsThisWeek}</div>
        </div>
        <div>
          <div className="text-[10px] font-medium uppercase tracking-[0.06em] text-[var(--text-tertiary)]">
            Within SLA
          </div>
          <div className="mt-0.5 text-[20px] font-semibold tabular-nums text-[var(--text-primary)]">{row.slaComplianceRate}%</div>
        </div>
        <div>
          <div className="text-[10px] font-medium uppercase tracking-[0.06em] text-[var(--text-tertiary)]">Deals won</div>
          <div className="mt-0.5 text-[20px] font-semibold tabular-nums text-[var(--text-primary)]">{row.dealsWonMtd}</div>
        </div>
        <div>
          <div className="text-[10px] font-medium uppercase tracking-[0.06em] text-[var(--text-tertiary)]">
            Avg response
          </div>
          <div className="mt-0.5 text-[20px] font-semibold tabular-nums text-[var(--text-primary)]">
            {formatDuration(row.avgResponseMinutes ?? null)}
          </div>
        </div>
      </div>

      <div className="mt-5">
        <div className="h-[3px] w-full overflow-hidden rounded-full bg-[var(--border)]">
          <div
            className="h-full w-full origin-left rounded-full bg-[var(--accent)] transition-transform duration-[400ms] ease-[var(--ease-out)]"
            style={{ transform: `scaleX(${Math.min(100, Math.max(0, row.slaComplianceRate)) / 100})` }}
          />
        </div>
        <p className="mt-2 text-[11px] text-[var(--text-tertiary)]">
          {row.slaComplianceRate}% of leads contacted within SLA
        </p>
      </div>
    </div>
    <dialog
      ref={dialogRef}
      aria-labelledby={`client-status-title-${row.id}`}
      aria-describedby={`client-status-description-${row.id}`}
      className="m-auto w-[min(92vw,28rem)] rounded-xl border border-[var(--border-strong)] bg-[var(--surface-modal)] p-0 text-[var(--text-primary)] shadow-[var(--shadow-modal)] backdrop:bg-black/60 backdrop:backdrop-blur-sm"
      onCancel={(event) => {
        event.preventDefault();
        if (!isSaving) setConfirmOpen(false);
      }}
      onClose={() => setConfirmOpen(false)}
    >
      <div className="p-6">
        <h2 id={`client-status-title-${row.id}`} className="font-display text-xl font-semibold tracking-[-0.025em]">
          {row.is_active ? `Pause ${row.name}?` : `Resume ${row.name}?`}
        </h2>
        <p id={`client-status-description-${row.id}`} className="mt-2 text-sm leading-relaxed text-[var(--text-secondary)]">
          {row.is_active
            ? "Their landing page will be unavailable and new leads will stop until you resume the client."
            : "Their landing page will return and can accept new leads again."}
        </p>
        {actionError ? (
          <p role="alert" className="mt-4 rounded-md border border-[var(--error-border)] bg-[var(--error-muted)] px-3 py-2 text-sm text-[var(--error)]">
            {actionError}
          </p>
        ) : null}
        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            disabled={isSaving}
            className="inline-flex h-10 items-center justify-center whitespace-nowrap rounded-md border border-[var(--border)] px-4 text-sm font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-tertiary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-50"
            onClick={() => setConfirmOpen(false)}
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={isSaving}
            className="inline-flex h-10 items-center justify-center whitespace-nowrap rounded-md bg-[var(--accent)] px-4 text-sm font-semibold text-[var(--accent-foreground)] transition-[background-color,transform] duration-150 ease-[var(--ease-out)] hover:bg-[var(--accent-hover)] active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-modal)] disabled:cursor-wait disabled:opacity-60"
            onClick={() => void handleTogglePause()}
          >
            {isSaving ? "Updating…" : row.is_active ? "Pause client" : "Resume client"}
          </button>
        </div>
      </div>
    </dialog>
    </>
  );
}
