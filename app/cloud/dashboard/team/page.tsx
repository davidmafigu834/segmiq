"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Loader2, Plus, MoreVertical, X, Mail, Phone, UserCheck, AlertCircle } from "lucide-react";

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
  if (role === "CLIENT_MANAGER") return "bg-[#D4FF4F]/15 text-[#D4FF4F]";
  if (role === "AGENCY_ADMIN") return "bg-purple-500/20 text-purple-400";
  return "bg-white/10 text-white/60";
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
    <div className="px-6 py-6 lg:px-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-[16px] font-semibold text-white">Your team</h2>
          {isAdmin && clients.length > 0 && (
            <select
              value={selectedClientId}
              onChange={(e) => setSelectedClientId(e.target.value)}
              className="mt-2 rounded-lg border border-white/10 bg-[#1a1a1a] px-3 py-1.5 text-[13px] text-white outline-none"
            >
              {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          )}
        </div>
        <button
          onClick={() => setShowInvite(true)}
          className="flex items-center gap-1.5 rounded-xl bg-[#D4FF4F] px-4 py-2.5 text-[13px] font-semibold text-black hover:bg-[#c4ef3f] transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
          Invite member
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-[#D4FF4F]" />
        </div>
      ) : members.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <UserCheck className="mb-3 h-10 w-10 text-white/20" />
          <p className="text-[14px] text-white/40">No team members yet.</p>
          <button
            onClick={() => setShowInvite(true)}
            className="mt-4 rounded-lg bg-[#D4FF4F] px-5 py-2.5 text-[14px] font-semibold text-black"
          >
            Invite first member
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {members.map((m) => (
            <div key={m.id} className="flex items-center gap-4 rounded-2xl border border-white/10 bg-[#111111] px-5 py-4">
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-[#D4FF4F] text-sm font-bold text-black">
                {m.name.slice(0, 1).toUpperCase()}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-[14px] font-medium text-white truncate">{m.name}</p>
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${roleBadgeClass(m.role)}`}>
                    {ROLE_LABELS[m.role] ?? m.role}
                  </span>
                  {!m.is_active && (
                    <span className="rounded-full bg-white/5 px-2 py-0.5 text-[11px] text-white/30">
                      Inactive
                    </span>
                  )}
                </div>
                <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[13px] text-white/40">
                  <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{m.email}</span>
                  {m.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{m.phone}</span>}
                </div>
              </div>

              <div className="relative">
                <button
                  onClick={() => setMenuOpen(menuOpen === m.id ? null : m.id)}
                  className="rounded-lg p-1.5 text-white/30 hover:bg-white/10 hover:text-white transition-colors"
                >
                  <MoreVertical className="h-4 w-4" />
                </button>
                {menuOpen === m.id && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(null)} />
                    <div className="absolute right-0 top-8 z-20 w-40 rounded-xl border border-white/10 bg-[#1a1a1a] py-1.5 shadow-xl">
                      {m.is_active && (
                        <button
                          onClick={() => void handleDeactivate(m)}
                          className="flex w-full items-center gap-2.5 px-4 py-2 text-[13px] text-red-400 hover:bg-red-500/10"
                        >
                          Deactivate
                        </button>
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
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowInvite(false)} />
          <div className="relative ml-auto flex h-full w-full max-w-md flex-col bg-[#111111] shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
              <h2 className="text-[15px] font-semibold text-white">Invite team member</h2>
              <button onClick={() => setShowInvite(false)} className="text-white/40 hover:text-white">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={(e) => void handleInvite(e)} className="flex flex-1 flex-col overflow-y-auto">
              <div className="flex-1 space-y-5 px-6 py-5">
                {inviteSuccess && (
                  <div className="rounded-xl bg-[#D4FF4F]/10 px-4 py-3 text-[14px] text-[#D4FF4F]">
                    Invite sent successfully!
                  </div>
                )}

                <div>
                  <label className="mb-1.5 block text-[13px] font-medium text-white/60">Full name</label>
                  <input
                    type="text"
                    value={inviteName}
                    onChange={(e) => setInviteName(e.target.value)}
                    required
                    autoFocus
                    placeholder="Jane Smith"
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-white/30 outline-none focus:border-[#D4FF4F]"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-[13px] font-medium text-white/60">Email address</label>
                  <input
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    required
                    placeholder="jane@company.com"
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-white/30 outline-none focus:border-[#D4FF4F]"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-[13px] font-medium text-white/60">Phone number</label>
                  <input
                    type="tel"
                    value={invitePhone}
                    onChange={(e) => setInvitePhone(e.target.value)}
                    required
                    placeholder="+1 555 000 0000"
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-white/30 outline-none focus:border-[#D4FF4F]"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-[13px] font-medium text-white/60">Role</label>
                  <select
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value as "CLIENT_MANAGER" | "SALESPERSON")}
                    className="w-full rounded-xl border border-white/10 bg-[#1a1a1a] px-4 py-3 text-sm text-white outline-none focus:border-[#D4FF4F]"
                  >
                    <option value="SALESPERSON">Salesperson</option>
                    <option value="CLIENT_MANAGER">Manager</option>
                  </select>
                </div>

                {inviteError && (
                  <div className="flex items-start gap-2 rounded-xl bg-red-500/10 px-4 py-3 text-[14px] text-red-400">
                    <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                    {inviteError}
                  </div>
                )}
              </div>

              <div className="border-t border-white/10 px-6 py-4 pb-24 lg:pb-4">
                <button
                  type="submit"
                  disabled={inviting}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#D4FF4F] py-3 text-[14px] font-semibold text-black disabled:opacity-60"
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
