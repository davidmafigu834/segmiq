"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, X } from "lucide-react";
import type { AppShellClientRow } from "@/components/shell/app-shell-types";

export function NewLeadModal({
  open,
  onClose,
  clients,
}: {
  open: boolean;
  onClose: () => void;
  clients: AppShellClientRow[];
}) {
  const router = useRouter();
  const [clientId, setClientId] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [budget, setBudget] = useState("");
  const [projectType, setProjectType] = useState("");
  const [timeline, setTimeline] = useState("");
  const [notes, setNotes] = useState("");
  const [assignMode, setAssignMode] = useState<"round_robin" | "specific">("round_robin");
  const [assigneeId, setAssigneeId] = useState("");
  const [sendNotifications, setSendNotifications] = useState(true);
  const [salespeople, setSalespeople] = useState<{ id: string; name: string }[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [phoneError, setPhoneError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setPhoneError(null);
  }, [open]);

  useEffect(() => {
    if (!clientId) {
      setSalespeople([]);
      setAssigneeId("");
      return;
    }
    let cancelled = false;
    fetch(`/api/clients/${clientId}/users`)
      .then((r) => r.json())
      .then((d: { users?: { id: string; name: string }[] }) => {
        if (!cancelled) {
          setSalespeople(d.users ?? []);
          setAssigneeId("");
        }
      })
      .catch(() => {
        if (!cancelled) setSalespeople([]);
      });
    return () => {
      cancelled = true;
    };
  }, [clientId]);

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPhoneError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/leads/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId,
          name: name.trim(),
          phone: phone.trim(),
          email: email.trim() || undefined,
          budget: budget.trim() || undefined,
          projectType: projectType.trim() || undefined,
          timeline: timeline.trim() || undefined,
          notes: notes.trim() || undefined,
          assignMode,
          assigneeId: assignMode === "specific" ? assigneeId : undefined,
          sendNotifications,
        }),
      });
      const j = (await res.json().catch(() => ({}))) as { error?: string; field?: string; leadId?: string };
      if (!res.ok) {
        if (j.field === "phone") setPhoneError(typeof j.error === "string" ? j.error : "Invalid phone");
        else window.alert(typeof j.error === "string" ? j.error : "Could not create lead");
        return;
      }
      onClose();
      const cli = clients.find((c) => c.id === clientId)?.name ?? "client";
      window.alert(`Lead created for ${cli}. Opening lead…`);
      if (j.leadId) router.push(`/dashboard/leads?lead=${j.leadId}`);
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  const canSubmit =
    Boolean(clientId && name.trim() && phone.trim() && (assignMode === "round_robin" || assigneeId));

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-surface-overlay md:items-center md:justify-center md:px-4 md:py-8">
      <div className="flex h-full w-full flex-col border border-border bg-surface-card shadow-lg md:h-auto md:max-h-[90vh] md:max-w-lg md:rounded-lg">
        <header className="flex h-14 items-center gap-3 border-b border-border px-4 md:h-auto md:border-b-0 md:px-6 md:pt-6">
          <button type="button" className="flex h-9 w-9 items-center justify-center md:hidden" onClick={onClose} aria-label="Back">
            <ChevronLeft className="h-5 w-5" strokeWidth={1.5} />
          </button>
          <h2 className="min-w-0 flex-1 truncate font-display text-xl text-ink-primary">Create a lead manually</h2>
          <button
            type="button"
            className="hidden text-ink-tertiary hover:text-ink-primary md:block"
            onClick={onClose}
            aria-label="Close"
          >
            <X className="h-5 w-5" strokeWidth={1.5} />
          </button>
        </header>
        <form onSubmit={(e) => void handleSubmit(e)} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 pb-6 pt-4 md:px-6 md:pt-2">
          <div>
            <label className="mb-1 block text-[12px] font-medium text-ink-secondary">Client *</label>
            <select
              required
              className="input-base h-11 w-full text-base md:h-10 md:text-sm"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
            >
              <option value="">Select client…</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-[12px] font-medium text-ink-secondary">Lead name *</label>
              <input className="input-base h-11 w-full text-base md:h-10 md:text-sm" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div>
              <label className="mb-1 block text-[12px] font-medium text-ink-secondary">Phone *</label>
              <input
                className="input-base h-11 w-full font-mono text-base md:h-10 md:text-sm"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+263 77 123 4567"
                inputMode="tel"
                required
              />
              {phoneError ? <p className="mt-1 text-xs text-[var(--status-lost-fg)]">{phoneError}</p> : null}
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-[12px] font-medium text-ink-secondary">Email</label>
              <input type="email" inputMode="email" autoCapitalize="off" className="input-base h-11 w-full text-base md:h-10 md:text-sm" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div>
              <label className="mb-1 block text-[12px] font-medium text-ink-secondary">Budget</label>
              <input className="input-base h-11 w-full text-base md:h-10 md:text-sm" value={budget} onChange={(e) => setBudget(e.target.value)} placeholder="$10K - $25K" />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-[12px] font-medium text-ink-secondary">Project type</label>
              <input className="input-base h-11 w-full text-base md:h-10 md:text-sm" value={projectType} onChange={(e) => setProjectType(e.target.value)} />
            </div>
            <div>
              <label className="mb-1 block text-[12px] font-medium text-ink-secondary">Timeline</label>
              <input className="input-base h-11 w-full text-base md:h-10 md:text-sm" value={timeline} onChange={(e) => setTimeline(e.target.value)} placeholder="Q3 2026" />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-[12px] font-medium text-ink-secondary">Notes</label>
            <textarea className="textarea-base min-h-[5.5rem] resize-none text-base md:text-sm" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
          </div>
          <div>
            <span className="mb-2 block text-[12px] font-medium text-ink-secondary">Assign to *</span>
            <div className="space-y-2 text-sm">
              <label className="flex items-center gap-2">
                <input type="radio" name="am" checked={assignMode === "round_robin"} onChange={() => setAssignMode("round_robin")} />
                Auto-assign (round-robin)
              </label>
              <label className="flex items-center gap-2">
                <input type="radio" name="am" checked={assignMode === "specific"} onChange={() => setAssignMode("specific")} />
                Specific salesperson
              </label>
            </div>
            {assignMode === "specific" ? (
              <select
                className="input-base mt-2 h-11 w-full text-base md:h-10 md:text-sm"
                value={assigneeId}
                onChange={(e) => setAssigneeId(e.target.value)}
                required={assignMode === "specific"}
              >
                <option value="">Select…</option>
                {salespeople.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            ) : null}
          </div>
          <label className="flex items-start gap-2 rounded-md border border-border bg-surface-card-alt p-3 text-sm">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={sendNotifications}
              onChange={(e) => setSendNotifications(e.target.checked)}
            />
            <span>Send WhatsApp + email notifications to the assigned salesperson</span>
          </label>
          </div>
          <div className="safe-bottom mt-auto flex justify-end gap-2 border-t border-border p-4 md:px-6 md:pb-6">
            <button type="button" className="btn-ghost h-11 flex-1 text-sm md:h-9 md:flex-none" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn-primary h-11 flex-1 text-sm md:h-9 md:flex-none" disabled={!canSubmit || submitting}>
              {submitting ? "Creating…" : "Create lead"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
