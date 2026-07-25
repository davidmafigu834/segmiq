"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Loader2, Plus, MoreVertical, X, Mail, Phone, UserCheck, AlertCircle, Copy, RefreshCw } from "lucide-react";
import { CloudAdminGate } from "@/app/cloud/components/CloudAdminGate";
import { CloudPage } from "@/app/cloud/components/CloudPage";
import { SkeletonListRows } from "@/app/cloud/components/SkeletonCard";
import { isCloudAdminRole } from "@/lib/auth/roles";

type TeamMember = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: string;
  is_active: boolean;
  created_at: string;
  client_id: string | null;
};

type Client = { id: string; name: string };

const ROLE_LABELS: Record<string, string> = {
  CLIENT_MANAGER: "Manager",
  SALESPERSON: "Salesperson",
  AGENCY_ADMIN: "Admin",
};

function roleBadgeClass(role: string) {
  if (role === "CLIENT_MANAGER") return "bg-[var(--cloud-accent-muted)] text-[var(--cloud-ink)] border border-[rgba(212,255,79,0.35)]";
  if (role === "AGENCY_ADMIN") return "bg-[var(--cloud-ink)] text-[var(--cloud-accent)] border border-transparent";
  return "bg-[var(--cloud-surface-muted)] text-[var(--cloud-text-secondary)] border border-[var(--cloud-border)]";
}

export default function CloudTeamPage() {
  const { data: session, status } = useSession();
  const isAdmin = session?.role === "AGENCY_ADMIN";
  const canManageTeam = isCloudAdminRole(session?.role);

  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [menuOpen, setMenuOpen] = useState<string | null>(null);

  const [inviteName, setInviteName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [invitePhone, setInvitePhone] = useState("");
  const [inviteRole, setInviteRole] = useState<"CLIENT_MANAGER" | "SALESPERSON">("SALESPERSON");
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState("");
  const [inviteSuccess, setInviteSuccess] = useState(false);

  useEffect(() => {
    if (status === "loading") return;
    if (isAdmin) {
      fetch("/api/clients")
        .then((r) => r.json())
        .then((data: unknown) => {
          if (Array.isArray(data) && (data as Client[]).length > 0) {
            setClients(data as Client[]);
            setSelectedClientId((prev) => prev || (data as Client[])[0]!.id);
          } else {
            setLoading(false);
          }
        })
        .catch(() => setLoading(false));
    } else if (session?.clientId) {
      setSelectedClientId(session.clientId);
    } else {
      setLoading(false);
    }
  }, [status, isAdmin, session?.clientId]);

  const fetchMembers = useCallback(() => {
    if (!selectedClientId) return;
    setLoading(true);
    const qs = isAdmin ? `?clientId=${selectedClientId}` : "";
    fetch(`/api/cloud/team${qs}`)
      .then((r) => r.json())
      .then((data: unknown) => {
        if (Array.isArray(data)) setMembers(data as TeamMember[]);
      })
      .catch(() => {})
      .finally(() => {
        setLoading(false);
        setHasLoaded(true);
      });
  }, [selectedClientId, isAdmin]);

  useEffect(() => { fetchMembers(); }, [fetchMembers]);

  function handleCopyLoginLink() {
    const url = `${window.location.origin}/cloud/login`;
    void navigator.clipboard.writeText(url);
    setMenuOpen(null);
  }

  const [resendingId, setResendingId] = useState<string | null>(null);

  async function handleResendInvite(member: TeamMember) {
    if (!selectedClientId) return;
    setResendingId(member.id);
    setMenuOpen(null);
    await fetch(`/api/cloud/team/resend`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: member.id, clientId: selectedClientId }),
    });
    setResendingId(null);
  }

  async function handleDeactivate(member: TeamMember) {
    if (!confirm(`Deactivate ${member.name}?`)) return;
    await fetch(`/api/cloud/team`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: member.id, is_active: false }),
    });
    setMembers((prev) => prev.map((m) => m.id === member.id ? { ...m, is_active: false } : m));
    setMenuOpen(null);
  }

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
          clientId: selectedClientId,
        }),
      });
      const data = (await res.json()) as { success?: boolean; error?: string };
      if (!res.ok) { setInviteError(data.error ?? "Invite failed."); setInviting(false); return; }
      setInviteSuccess(true);
      setInviteName("");
      setInviteEmail("");
      setInvitePhone("");
      fetchMembers();
      setTimeout(() => { setInviteSuccess(false); setShowInvite(false); }, 2000);
    } catch {
      setInviteError("Something went wrong.");
    } finally {
      setInviting(false);
    }
  }

  if (status === "loading" || (loading && !hasLoaded)) {
    return (
      <CloudAdminGate>
        <CloudPage>
          <SkeletonListRows count={5} />
        </CloudPage>
      </CloudAdminGate>
    );
  }

  return (
    <CloudAdminGate>
    <CloudPage>
      <div className="cloud-toolbar mb-5">
        {isAdmin && clients.length > 0 ? (
          <select
            value={selectedClientId}
            onChange={(e) => setSelectedClientId(e.target.value)}
            className="cloud-select min-w-[180px]"
            aria-label="Select workspace"
          >
            {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        ) : (
          <div className="flex-1" />
        )}
        {canManageTeam && (
          <div className="cloud-toolbar-actions">
            <button type="button" onClick={() => setShowInvite(true)} className="cloud-btn-primary">
              <Plus className="h-3.5 w-3.5 shrink-0" strokeWidth={2.2} />
              Invite member
            </button>
          </div>
        )}
      </div>

      {loading ? (
        <SkeletonListRows count={5} />
      ) : members.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-white border border-black/[0.07]">
            <UserCheck className="h-6 w-6 text-[#6B7280]" strokeWidth={1.5} />
          </div>
          <p className="font-cloud-display text-[18px] text-[#0a0a0a] mb-1">No team members yet</p>
          <p className="text-[13px] text-[#6B7280] font-cloud-body mb-5">Invite your first team member to get started.</p>
          {canManageTeam && (
          <button
            type="button"
            onClick={() => setShowInvite(true)}
            className="cloud-btn-primary"
          >
            <Plus className="h-3.5 w-3.5 shrink-0" strokeWidth={2.2} />
            Invite first member
          </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {members.map((m) => (
            <div key={m.id} className="cloud-card flex items-center gap-3 px-4 py-4 sm:gap-4 sm:px-5">
              <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-[var(--cloud-ink)] text-[13px] font-bold text-[var(--cloud-accent)]">
                {m.name.slice(0, 1).toUpperCase()}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate text-[14px] font-semibold text-[var(--cloud-text-primary)] font-cloud-body">{m.name}</p>
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold font-cloud-body ${roleBadgeClass(m.role)}`}>
                    {ROLE_LABELS[m.role] ?? m.role}
                  </span>
                  {!m.is_active && (
                    <span className="rounded-full border border-[var(--cloud-border)] bg-[var(--cloud-surface-muted)] px-2 py-0.5 text-[11px] text-[var(--cloud-text-tertiary)] font-cloud-body">
                      Inactive
                    </span>
                  )}
                </div>
                <div className="mt-0.5 flex flex-col gap-0.5 text-[12px] text-[var(--cloud-text-secondary)] font-cloud-body sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-3">
                  <span className="flex min-w-0 items-center gap-1 truncate"><Mail className="h-3 w-3 shrink-0" />{m.email}</span>
                  {m.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3 shrink-0" />{m.phone}</span>}
                </div>
              </div>

              <div className="relative shrink-0">
                <button
                  type="button"
                  onClick={() => setMenuOpen(menuOpen === m.id ? null : m.id)}
                  className="cloud-icon-btn"
                  aria-label="Member actions"
                >
                  <MoreVertical className="h-4 w-4" />
                </button>
                {menuOpen === m.id && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(null)} />
                    <div className="absolute right-0 top-8 z-20 w-48 rounded-xl border border-black/[0.08] bg-white py-1.5 shadow-xl">
                      <button
                        onClick={handleCopyLoginLink}
                        className="flex w-full items-center gap-2.5 px-4 py-2 text-[13px] text-[#666660] hover:bg-[#F5F5F0] hover:text-[#0a0a0a]"
                      >
                        <Copy className="h-3.5 w-3.5" />
                        Copy login link
                      </button>
                      <button
                        onClick={() => void handleResendInvite(m)}
                        disabled={resendingId === m.id}
                        className="flex w-full items-center gap-2.5 px-4 py-2 text-[13px] text-[#666660] hover:bg-[#F5F5F0] hover:text-[#0a0a0a] disabled:opacity-50"
                      >
                        {resendingId === m.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                        Resend invite
                      </button>
                      {canManageTeam && m.is_active && (
                        <>
                          <hr className="my-1 border-black/[0.06]" />
                          <button
                            onClick={() => void handleDeactivate(m)}
                            className="flex w-full items-center gap-2.5 px-4 py-2 text-[13px] text-red-500 hover:bg-red-50"
                          >
                            Deactivate
                          </button>
                        </>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Invite slide-over */}
      {showInvite && (
        <div className="fixed inset-0 z-[60] flex items-end md:items-stretch">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowInvite(false)} />
          <div className="cloud-sheet relative z-10 bg-white">
            <div className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-black/10 md:hidden" aria-hidden />
            <div className="flex items-center justify-between border-b border-[var(--cloud-border)] px-5 py-4">
              <h2 className="font-cloud-display text-[18px] text-[var(--cloud-text-primary)]">Invite team member</h2>
              <button
                type="button"
                onClick={() => setShowInvite(false)}
                className="cloud-icon-btn"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={(e) => void handleInvite(e)} className="cloud-scroll-y flex min-h-0 flex-1 flex-col">
              <div className="flex-1 space-y-4 px-5 py-5">
                {inviteSuccess && (
                  <div className="rounded-xl bg-[#F0FFF8] border border-[#60E8A0]/40 px-4 py-3 text-[13px] text-[#00875A] font-cloud-body">
                    Invite sent successfully!
                  </div>
                )}

                <div>
                  <label className="mb-1.5 block text-[12px] font-semibold text-[#666660] uppercase tracking-[0.06em] font-cloud-body">Full name</label>
                  <input
                    type="text"
                    value={inviteName}
                    onChange={(e) => setInviteName(e.target.value)}
                    required
                    autoFocus
                    placeholder="Jane Smith"
                    className="cloud-input cloud-input--lg"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-[12px] font-semibold text-[#666660] uppercase tracking-[0.06em] font-cloud-body">Email address</label>
                  <input
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    required
                    placeholder="jane@company.com"
                    className="cloud-input cloud-input--lg"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-[12px] font-semibold text-[#666660] uppercase tracking-[0.06em] font-cloud-body">Phone number</label>
                  <input
                    type="tel"
                    value={invitePhone}
                    onChange={(e) => setInvitePhone(e.target.value)}
                    required
                    placeholder="+1 555 000 0000"
                    className="cloud-input cloud-input--lg"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-[12px] font-semibold text-[#666660] uppercase tracking-[0.06em] font-cloud-body">Role</label>
                  <select
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value as "CLIENT_MANAGER" | "SALESPERSON")}
                    className="cloud-select cloud-select--lg w-full"
                  >
                    <option value="SALESPERSON">Salesperson</option>
                    <option value="CLIENT_MANAGER">Manager</option>
                  </select>
                </div>

                {inviteError && (
                  <div className="flex items-start gap-2 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-[13px] text-red-500 font-cloud-body">
                    <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                    {inviteError}
                  </div>
                )}
              </div>

              <div className="cloud-sheet-footer border-t border-[var(--cloud-border)] px-5 pt-4">
                <button
                  type="submit"
                  disabled={inviting}
                  className="cloud-btn-primary h-12 w-full disabled:opacity-60"
                >
                  {inviting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                  {inviting ? "Sending…" : "Send invite"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </CloudPage>
    </CloudAdminGate>
  );
}
