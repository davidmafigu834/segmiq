"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, FileText, ExternalLink } from "lucide-react";
import { formatMoney } from "@/lib/proposals/totals";
import { ProposalBuilder } from "@/components/proposals/ProposalBuilder";
import type { ProposalRow, ProposalStatus, ProposalWithDetails } from "@/types";

const STATUS_STYLES: Record<ProposalStatus, { bg: string; color: string }> = {
  draft: { bg: "rgba(0,0,0,0.06)", color: "#999990" },
  sent: { bg: "rgba(59,130,246,0.12)", color: "#3b82f6" },
  viewed: { bg: "rgba(168,85,247,0.12)", color: "#a855f7" },
  accepted: { bg: "rgba(46,125,94,0.14)", color: "#2E7D5E" },
  rejected: { bg: "rgba(220,38,38,0.12)", color: "#dc2626" },
  expired: { bg: "rgba(0,0,0,0.06)", color: "#999990" },
};

function StatusBadge({ status }: { status: ProposalStatus }) {
  const s = STATUS_STYLES[status];
  return (
    <span className="inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-bold capitalize" style={{ background: s.bg, color: s.color }}>
      {status}
    </span>
  );
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export function ProposalsManager({
  initialProposals,
  openId,
}: {
  initialProposals: ProposalRow[];
  openId?: string;
}) {
  const router = useRouter();
  const [rows, setRows] = useState<ProposalRow[]>(initialProposals);
  const [editing, setEditing] = useState<ProposalWithDetails | null>(null);
  const [statusFilter, setStatusFilter] = useState<"all" | ProposalStatus>("all");
  const [busy, setBusy] = useState(false);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const filtered = useMemo(
    () => rows.filter((r) => (statusFilter === "all" ? true : r.status === statusFilter)),
    [rows, statusFilter]
  );

  async function openProposal(id: string) {
    setOpeningId(id);
    setError(null);
    try {
      const res = await fetch(`/api/agency/proposals/${id}`);
      const json = (await res.json().catch(() => ({}))) as { proposal?: ProposalWithDetails; error?: string };
      if (!res.ok || !json.proposal) throw new Error(json.error ?? "Could not load proposal");
      setEditing(json.proposal);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load proposal");
    } finally {
      setOpeningId(null);
    }
  }

  // Auto-open a proposal passed via ?open= (e.g. created from a submission).
  useEffect(() => {
    if (openId) {
      void openProposal(openId);
      router.replace("/dashboard/proposals");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openId]);

  async function createProposal() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/agency/proposals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const json = (await res.json().catch(() => ({}))) as { proposal?: ProposalWithDetails; error?: string };
      if (!res.ok || !json.proposal) throw new Error(json.error ?? "Could not create proposal");
      setRows((list) => [json.proposal as ProposalRow, ...list]);
      setEditing(json.proposal);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create proposal");
    } finally {
      setBusy(false);
    }
  }

  function handleSaved(p: ProposalWithDetails) {
    setEditing(p);
    setRows((list) => list.map((r) => (r.id === p.id ? { ...r, ...p } : r)));
  }

  function handleClose() {
    setEditing(null);
    router.refresh();
  }

  if (editing) {
    return (
      <ProposalBuilder
        proposal={editing}
        onSaved={handleSaved}
        onSent={() => setRows((list) => list.map((r) => (r.id === editing.id ? { ...r, status: "sent" } : r)))}
        onClose={handleClose}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <select
          className="rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] px-3 py-2.5 text-[13px] text-[var(--text-primary)]"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
        >
          <option value="all">All statuses</option>
          {(Object.keys(STATUS_STYLES) as ProposalStatus[]).map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => void createProposal()}
          disabled={busy}
          className="flex items-center justify-center gap-1.5 rounded-xl bg-[var(--accent)] px-4 py-2.5 text-[13px] font-bold text-[var(--accent-ink)] hover:bg-[var(--accent-hover)] disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          New proposal
        </button>
      </div>

      {error && <p className="text-sm text-[var(--danger)]">{error}</p>}

      <div className="rounded-2xl border border-[var(--border)] overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-8 text-center text-[13px] text-[var(--text-tertiary)]">
            No proposals yet. Create one, or start from a marketing submission.
          </div>
        ) : (
          <div className="divide-y divide-[var(--border)]">
            {filtered.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => void openProposal(r.id)}
                className="flex w-full items-start justify-between gap-4 bg-[var(--bg-secondary)] p-5 text-left hover:bg-[var(--bg-primary)] transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <FileText className="h-4 w-4 text-[var(--text-tertiary)]" />
                    <span className="font-semibold text-[var(--text-primary)]">
                      {r.company_name || r.recipient_name || "Untitled prospect"}
                    </span>
                    <StatusBadge status={r.status} />
                    {r.proposal_number ? (
                      <span className="font-mono text-[11px] text-[var(--text-tertiary)]">{r.proposal_number}</span>
                    ) : null}
                  </div>
                  <div className="mt-1 text-[13px] text-[var(--text-secondary)]">{r.title}</div>
                  <div className="mt-1 text-[12px] text-[var(--text-tertiary)]">
                    {[r.recipient_email, `Created ${formatDate(r.created_at)}`].filter(Boolean).join(" · ")}
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  {r.total ? (
                    <p className="font-semibold text-[var(--text-primary)]">{formatMoney(r.total, r.currency)}</p>
                  ) : null}
                  {openingId === r.id ? (
                    <Loader2 className="ml-auto mt-1 h-4 w-4 animate-spin text-[var(--text-tertiary)]" />
                  ) : (
                    <ExternalLink className="ml-auto mt-1 h-4 w-4 text-[var(--text-tertiary)]" />
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
