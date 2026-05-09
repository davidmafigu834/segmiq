"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Loader2, Plus, MoreVertical, X, Mail, Phone, UserCheck, AlertCircle, Copy, RefreshCw } from "lucide-react";

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
  if (role === "CLIENT_MANAGER") return "bg-[#FFF0D0] text-[#7A3800] border border-[#F0D090]/50";
  if (role === "AGENCY_ADMIN") return "bg-[#EDE5FF] text-[#2D1B6B] border border-[#C4A8FF]/30";
  return "bg-[#F5F5F0] text-[#666660] border border-black/[0.07]";
}

export default function CloudTeamPage() {
  const { data: session } = useSession();
  const isAdmin = session?.role === "AGENCY_ADMIN";

  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(false);
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
    if (isAdmin) {
      fetch("/api/clients")
        .then((r) => r.json())
        .then((data: unknown) => {
          if (Array.isArray(data)) {
            setClients(data as Client[]);
            if ((data as Client[]).length > 0) setSelectedClientId((data as Client[])[0].id);
          }
        })
        .catch(() => {});
    } else if (session?.clientId) {
      setSelectedClientId(session.clientId);
    }
  }, [isAdmin, session?.clientId]);

  const fetchMembers = useCallback(() => {
    if (!selectedClientId) { setLoading(false); return; }
    setLoading(true);
    const qs = isAdmin ? `?clientId=${selectedClientId}` : "";
    fetch(`/api/cloud/team${qs}`)
      .then((r) => r.json())
      .then((data: unknown) => {
        if (Array.isArray(data)) setMembers(data as TeamMember[]);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [selectedClientId, isAdmin]);

  useEffect(() => { fetchMembers(); }, [fetchMembers]);

  function handleCopyLoginLink() {
    const url = `${window.location.origin}/cloud/login`;
    void navigator.clipboard.writeText(url);
    setMenuOpen(null);
  }

  const [resendingId, setResendingId] = useState<string | null>(null);

  async function handleResendInvite(member: TeamMember) {
    if (!session?.clientId) return;
    setResendingId(member.id);
    setMenuOpen(null);
    await fetch(`/api/cloud/team/resend`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: member.id, clientId: session.clientId }),
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

  return (
    <div className="min-h-screen bg-[#F5F5F0] font-cloud-body px-5 py-4 lg:px-8">
      <div className="mb-5 flex items-center justify-between">
        <div>
          {isAdmin && clients.length > 0 && (
            <select
              value={selectedClientId}
              onChange={(e) => setSelectedClientId(e.target.value)}
              className="mt-2 rounded-xl border border-black/[0.08] bg-white px-3 py-1.5 text-[13px] text-[#666660] outline-none font-cloud-body"
            >
              {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          )}
        </div>
        <button
          onClick={() => setShowInvite(true)}
          className="flex items-center gap-1.5 rounded-xl bg-[#D4FF4F] px-4 py-2.5 text-[13px] font-bold text-black hover:bg-[#C8F244] transition-colors font-cloud-body"
        >
          <Plus className="h-3.5 w-3.5" />
          Invite member
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-[#0a0a0a]/30" />
        </div>
      ) : members.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-white border border-black/[0.07]">
            <UserCheck className="h-6 w-6 text-[#999990]" strokeWidth={1.5} />
          </div>
          <p className="font-cloud-display text-[18px] text-[#0a0a0a] mb-1">No team members yet</p>
          <p className="text-[13px] text-[#999990] font-cloud-body mb-5">Invite your first team member to get started.</p>
          <button
            onClick={() => setShowInvite(true)}
            className="rounded-xl bg-[#D4FF4F] px-5 py-3 text-[14px] font-bold text-black font-cloud-body hover:bg-[#C8F244] transition-colors"
          >
            Invite first member
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {members.map((m) => (
            <div key={m.id} className="flex items-center gap-4 rounded-[20px] border border-[#F0D090]/40 bg-gradient-to-br from-[#FFFAF0] via-[#FFF5E0] to-[#FFE8C0] px-5 py-4">
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-[#FFE8A0] text-[14px] font-bold text-[#7A3800]">
                {m.name.slice(0, 1).toUpperCase()}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-[14px] font-semibold text-[#3D1C00] truncate font-cloud-body">{m.name}</p>
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold font-cloud-body ${roleBadgeClass(m.role)}`}>
                    {ROLE_LABELS[m.role] ?? m.role}
                  </span>
                  {!m.is_active && (
                    <span className="rounded-full bg-black/5 px-2 py-0.5 text-[11px] text-[#999990] font-cloud-body border border-black/[0.06]">
                      Inactive
                    </span>
                  )}
                </div>
                <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[12px] text-[#BF7020] font-cloud-body">
                  <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{m.email}</span>
                  {m.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{m.phone}</span>}
                </div>
              </div>

              <div className="relative">
                <button
                  onClick={() => setMenuOpen(menuOpen === m.id ? null : m.id)}
                  className="rounded-xl bg-white/40 p-1.5 text-[#BF7020] hover:bg-white/70 transition-colors"
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
                      {m.is_active && (
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
        <div className="fixed inset-0 z-[60] flex">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowInvite(false)} />
          <div className="relative ml-auto flex h-full w-full max-w-md flex-col bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-black/[0.07] px-6 py-4">
              <h2 className="font-cloud-display text-[18px] text-[#0a0a0a]">Invite team member</h2>
              <button onClick={() => setShowInvite(false)} className="text-[#999990] hover:text-[#0a0a0a] transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={(e) => void handleInvite(e)} className="flex flex-1 flex-col overflow-y-auto">
              <div className="flex-1 space-y-4 px-6 py-5">
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
                    className="w-full rounded-xl border border-black/[0.1] bg-[#F5F5F0] px-4 py-3 text-[13px] text-[#0a0a0a] placeholder-[#999990] outline-none focus:border-black/[0.2] font-cloud-body"
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
                    className="w-full rounded-xl border border-black/[0.1] bg-[#F5F5F0] px-4 py-3 text-[13px] text-[#0a0a0a] placeholder-[#999990] outline-none focus:border-black/[0.2] font-cloud-body"
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
                    className="w-full rounded-xl border border-black/[0.1] bg-[#F5F5F0] px-4 py-3 text-[13px] text-[#0a0a0a] placeholder-[#999990] outline-none focus:border-black/[0.2] font-cloud-body"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-[12px] font-semibold text-[#666660] uppercase tracking-[0.06em] font-cloud-body">Role</label>
                  <select
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value as "CLIENT_MANAGER" | "SALESPERSON")}
                    className="w-full rounded-xl border border-black/[0.1] bg-[#F5F5F0] px-4 py-3 text-[13px] text-[#666660] outline-none focus:border-black/[0.2] font-cloud-body"
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

              <div className="border-t border-black/[0.07] px-6 py-4 pb-24 lg:pb-4">
                <button
                  type="submit"
                  disabled={inviting}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#D4FF4F] py-3 text-[14px] font-bold text-black disabled:opacity-60 hover:bg-[#C8F244] transition-colors font-cloud-body"
                >
                  {inviting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                  {inviting ? "Sending…" : "Send invite"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
