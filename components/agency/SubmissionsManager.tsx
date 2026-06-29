"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Search, FileText } from "lucide-react";
import type { MarketingSubmission, SubmissionStatus, SubmissionType } from "@/lib/marketing-submissions";

const inputCls =
  "w-full rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] px-3 py-2.5 text-[13px] text-[var(--text-primary)] outline-none focus:border-[var(--accent)] transition-colors";

const STATUSES: SubmissionStatus[] = ["new", "contacted", "converted", "archived"];
const TYPES: SubmissionType[] = ["demo", "contact", "partner", "career"];

function StatusBadge({ status }: { status: SubmissionStatus }) {
  const styles: Record<SubmissionStatus, { bg: string; color: string }> = {
    new: { bg: "rgba(212,255,79,0.15)", color: "#9bbf2e" },
    contacted: { bg: "rgba(59,130,246,0.12)", color: "#3b82f6" },
    converted: { bg: "rgba(46,125,94,0.12)", color: "#2E7D5E" },
    archived: { bg: "rgba(0,0,0,0.06)", color: "#999990" },
  };
  const s = styles[status];
  return (
    <span className="inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-bold capitalize" style={{ background: s.bg, color: s.color }}>
      {status}
    </span>
  );
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function SubmissionsManager({ initialSubmissions }: { initialSubmissions: MarketingSubmission[] }) {
  const router = useRouter();
  const [rows, setRows] = useState(initialSubmissions);
  const [typeFilter, setTypeFilter] = useState<"all" | SubmissionType>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | SubmissionStatus>("all");
  const [search, setSearch] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [proposalBusyId, setProposalBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (typeFilter !== "all" && r.type !== typeFilter) return false;
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (q && !`${r.name} ${r.email} ${r.company ?? ""}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [rows, typeFilter, statusFilter, search]);

  async function updateStatus(id: string, status: SubmissionStatus) {
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch(`/api/marketing/submissions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Request failed");
      setRows((list) => list.map((r) => (r.id === id ? { ...r, status } : r)));
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusyId(null);
    }
  }

  async function createProposal(submissionId: string) {
    setProposalBusyId(submissionId);
    setError(null);
    try {
      const res = await fetch("/api/agency/proposals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ submission_id: submissionId }),
      });
      const data = (await res.json().catch(() => ({}))) as { proposal?: { id: string }; error?: string };
      if (!res.ok || !data.proposal) throw new Error(data.error ?? "Could not create proposal");
      router.push(`/dashboard/proposals?open=${data.proposal.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      setProposalBusyId(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-tertiary)]" />
          <input className={`${inputCls} pl-9`} placeholder="Search name, email, company…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <select className={inputCls} value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as typeof typeFilter)}>
          <option value="all">All types</option>
          {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <select className={inputCls} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}>
          <option value="all">All statuses</option>
          {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {error && <p className="text-sm text-[var(--danger)]">{error}</p>}

      <div className="rounded-2xl border border-[var(--border)] overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-8 text-center text-[13px] text-[var(--text-tertiary)]">No submissions yet.</div>
        ) : (
          <div className="divide-y divide-[var(--border)]">
            {filtered.map((r) => (
              <div key={r.id} className="p-5 bg-[var(--bg-secondary)]">
                <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-[var(--text-primary)]">{r.name}</span>
                      <span className="text-[11px] uppercase tracking-wide text-[var(--text-tertiary)]">{r.type}</span>
                      <StatusBadge status={r.status} />
                    </div>
                    <div className="mt-1 text-[13px] text-[var(--text-secondary)]">
                      {r.email}
                      {r.phone ? ` · ${r.phone}` : ""}
                      {r.company ? ` · ${r.company}` : ""}
                    </div>
                    <div className="mt-1 text-[12px] text-[var(--text-tertiary)]">
                      {[r.market, r.industry, r.team_size, r.lead_volume].filter(Boolean).join(" · ")}
                      {r.source ? ` · from ${r.source}` : ""}
                    </div>
                    {r.message && <p className="mt-2 text-[13px] text-[var(--text-secondary)] whitespace-pre-wrap">{r.message}</p>}
                    <div className="mt-2 text-[11px] text-[var(--text-tertiary)]">{formatDate(r.created_at)}</div>
                  </div>
                  <div className="shrink-0 flex items-center gap-2">
                    {busyId === r.id && <Loader2 className="w-4 h-4 animate-spin text-[var(--text-tertiary)]" />}
                    {(r.type === "demo" || r.type === "contact") && (
                      <button
                        type="button"
                        onClick={() => void createProposal(r.id)}
                        disabled={proposalBusyId === r.id}
                        className="flex items-center gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] px-3 py-2 text-[12px] font-semibold text-[var(--text-primary)] hover:border-[var(--accent)] disabled:opacity-50"
                      >
                        {proposalBusyId === r.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <FileText className="w-3.5 h-3.5" />
                        )}
                        Proposal
                      </button>
                    )}
                    <select
                      className="rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] px-3 py-2 text-[12px] capitalize"
                      value={r.status}
                      disabled={busyId === r.id}
                      onChange={(e) => updateStatus(r.id, e.target.value as SubmissionStatus)}
                    >
                      {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
