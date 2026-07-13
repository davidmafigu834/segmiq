"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Plus, X, Mail, AlertCircle } from "lucide-react";

type TeamMember = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: string;
  is_active: boolean;
};

const ROLE_LABELS: Record<string, string> = {
  CLIENT_MANAGER: "Manager",
  SALESPERSON: "Salesperson",
};

export function CloudTeamModal({
  clientId,
  clientName,
  onClose,
}: {
  clientId: string;
  clientName: string;
  onClose: () => void;
}) {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteName, setInviteName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [invitePhone, setInvitePhone] = useState("");
  const [inviteRole, setInviteRole] = useState<"CLIENT_MANAGER" | "SALESPERSON">("SALESPERSON");
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState("");
  const [inviteSuccess, setInviteSuccess] = useState(false);

  const fetchMembers = useCallback(() => {
    setLoading(true);
    fetch(`/api/cloud/team?clientId=${clientId}`)
      .then((r) => r.json())
      .then((data: unknown) => {
        if (Array.isArray(data)) setMembers(data as TeamMember[]);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [clientId]);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!inviteName.trim() || !inviteEmail.trim() || !invitePhone.trim()) {
      setInviteError("All fields are required.");
      return;
    }
    setInviting(true);
    setInviteError("");
    try {
      const res = await fetch("/api/cloud/team/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: inviteName,
          email: inviteEmail,
          phone: invitePhone,
          role: inviteRole,
          clientId,
        }),
      });
      const data = (await res.json()) as { success?: boolean; error?: string };
      if (!res.ok) {
        setInviteError(typeof data.error === "string" ? data.error : "Invite failed.");
        return;
      }
      setInviteSuccess(true);
      setInviteName("");
      setInviteEmail("");
      setInvitePhone("");
      fetchMembers();
      setTimeout(() => {
        setInviteSuccess(false);
        setShowInvite(false);
      }, 2000);
    } catch {
      setInviteError("Something went wrong.");
    } finally {
      setInviting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] shadow-2xl">
        <div className="flex items-start justify-between border-b border-[var(--border)] px-6 py-4">
          <div>
            <p className="text-[15px] font-semibold text-[var(--text-primary)]">Cloud team — {clientName}</p>
            <p className="text-[12px] text-[var(--text-tertiary)]">
              Invite managers (full settings access) or salespeople (field uploads only).
            </p>
          </div>
          <button onClick={onClose} className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)]">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {loading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-[var(--text-tertiary)]" />
            </div>
          ) : members.length === 0 ? (
            <p className="py-8 text-center text-[13px] text-[var(--text-tertiary)]">No team members yet.</p>
          ) : (
            <div className="space-y-2">
              {members.map((m) => (
                <div
                  key={m.id}
                  className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] px-4 py-3"
                >
                  <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-[var(--bg-tertiary)] text-[12px] font-bold">
                    {m.name.slice(0, 1).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-semibold text-[var(--text-primary)]">{m.name}</p>
                    <p className="truncate text-[11px] text-[var(--text-tertiary)]">{m.email}</p>
                  </div>
                  <span className="rounded-full bg-[var(--bg-card)] px-2 py-0.5 text-[10px] font-semibold text-[var(--text-secondary)]">
                    {ROLE_LABELS[m.role] ?? m.role}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="border-t border-[var(--border)] px-6 py-4">
          {!showInvite ? (
            <button
              onClick={() => setShowInvite(true)}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--accent)] py-2.5 text-[13px] font-bold text-[var(--accent-ink)] hover:bg-[var(--accent-hover)] transition-colors"
            >
              <Plus className="h-4 w-4" />
              Invite member
            </button>
          ) : (
            <form onSubmit={(e) => void handleInvite(e)} className="space-y-3">
              {inviteSuccess && (
                <p className="rounded-lg bg-green-50 px-3 py-2 text-[12px] text-green-700">Invite sent!</p>
              )}
              <input
                type="text"
                value={inviteName}
                onChange={(e) => setInviteName(e.target.value)}
                placeholder="Full name"
                required
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] px-3 py-2 text-[13px] outline-none focus:border-[var(--accent)]"
              />
              <input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="Email"
                required
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] px-3 py-2 text-[13px] outline-none focus:border-[var(--accent)]"
              />
              <input
                type="tel"
                value={invitePhone}
                onChange={(e) => setInvitePhone(e.target.value)}
                placeholder="Phone"
                required
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] px-3 py-2 text-[13px] outline-none focus:border-[var(--accent)]"
              />
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as "CLIENT_MANAGER" | "SALESPERSON")}
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] px-3 py-2 text-[13px] outline-none focus:border-[var(--accent)]"
              >
                <option value="SALESPERSON">Salesperson — field uploads only</option>
                <option value="CLIENT_MANAGER">Manager — full Cloud settings access</option>
              </select>
              {inviteError && (
                <div className="flex items-start gap-2 text-[12px] text-red-500">
                  <AlertCircle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
                  {inviteError}
                </div>
              )}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowInvite(false)}
                  className="flex-1 rounded-xl border border-[var(--border)] py-2 text-[13px] font-semibold text-[var(--text-secondary)]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={inviting}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[var(--accent)] py-2 text-[13px] font-bold text-[var(--accent-ink)] disabled:opacity-60"
                >
                  {inviting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                  {inviting ? "Sending…" : "Send invite"}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
