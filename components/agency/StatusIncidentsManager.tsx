"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, Plus } from "lucide-react";
import type { StatusIncident } from "@/lib/status-admin";

const inputCls =
  "w-full rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] px-3 py-2.5 text-[13px] text-[var(--text-primary)] outline-none focus:border-[var(--accent)] transition-colors";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function StatusIncidentsManager({ initialIncidents }: { initialIncidents: StatusIncident[] }) {
  const router = useRouter();
  const [incidents, setIncidents] = useState(initialIncidents);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [severity, setSeverity] = useState<"minor" | "major" | "critical">("minor");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function createIncident(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/status/incidents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, body, severity }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Request failed");
      setIncidents((list) => [data as StatusIncident, ...list]);
      setTitle("");
      setBody("");
      setShowForm(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setCreating(false);
    }
  }

  async function resolve(id: string) {
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch(`/api/status/incidents/${id}`, { method: "PATCH" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Request failed");
      setIncidents((list) =>
        list.map((it) => (it.id === id ? { ...it, resolved_at: new Date().toISOString() } : it))
      );
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="inline-flex items-center gap-2 rounded-xl bg-[var(--accent)] px-4 py-2.5 text-[13px] font-semibold text-black hover:opacity-90"
        >
          <Plus className="w-4 h-4" /> New incident
        </button>
      </div>

      {showForm && (
        <form onSubmit={createIncident} className="rounded-2xl border border-[var(--border)] bg-[var(--bg-secondary)] p-5 space-y-3">
          <input className={inputCls} placeholder="Incident title" value={title} onChange={(e) => setTitle(e.target.value)} required />
          <textarea className={inputCls} rows={4} placeholder="What happened and what's the impact?" value={body} onChange={(e) => setBody(e.target.value)} required />
          <select className={inputCls} value={severity} onChange={(e) => setSeverity(e.target.value as typeof severity)}>
            <option value="minor">Minor</option>
            <option value="major">Major</option>
            <option value="critical">Critical</option>
          </select>
          <div className="flex gap-2">
            <button type="submit" disabled={creating} className="rounded-xl bg-[var(--accent)] px-4 py-2 text-[13px] font-semibold text-black disabled:opacity-60">
              {creating ? "Creating…" : "Create incident"}
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="rounded-xl border border-[var(--border)] px-4 py-2 text-[13px]">
              Cancel
            </button>
          </div>
        </form>
      )}

      {error && <p className="text-sm text-[var(--danger)]">{error}</p>}

      <div className="rounded-2xl border border-[var(--border)] divide-y divide-[var(--border)]">
        {incidents.length === 0 ? (
          <div className="p-8 text-center text-[13px] text-[var(--text-tertiary)]">No incidents recorded.</div>
        ) : (
          incidents.map((it) => (
            <div key={it.id} className="p-5 bg-[var(--bg-secondary)]">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{it.title}</span>
                    <span className="text-[11px] uppercase tracking-wide text-[var(--text-tertiary)]">{it.severity}</span>
                    {it.resolved_at ? (
                      <span className="text-[11px] text-[#2E7D5E] font-semibold">Resolved</span>
                    ) : (
                      <span className="text-[11px] text-[#cc2f2f] font-semibold">Ongoing</span>
                    )}
                  </div>
                  <p className="mt-2 text-[13px] text-[var(--text-secondary)] whitespace-pre-wrap">{it.body}</p>
                  <div className="mt-2 text-[11px] text-[var(--text-tertiary)]">
                    Started {formatDate(it.started_at)}
                    {it.resolved_at ? ` · Resolved ${formatDate(it.resolved_at)}` : ""}
                  </div>
                </div>
                {!it.resolved_at && (
                  <button
                    type="button"
                    disabled={busyId === it.id}
                    onClick={() => resolve(it.id)}
                    className="inline-flex items-center gap-1.5 shrink-0 rounded-xl border border-[var(--border)] px-3 py-2 text-[12px] font-semibold hover:border-[var(--accent)]"
                  >
                    {busyId === it.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                    Resolve
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
