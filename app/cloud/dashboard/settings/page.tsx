"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Loader2, Save, ExternalLink, Eye, EyeOff } from "lucide-react";

type ClientData = {
  id: string;
  name: string;
  industry: string;
  slug: string;
  logo_url: string | null;
};

type ProfileData = {
  slug: string | null;
  is_published: boolean;
};

const INDUSTRIES = [
  "Construction", "Solar Installation", "Landscaping", "Electrical",
  "Plumbing", "Interior Design", "Roofing", "Fencing", "Events", "Architecture", "Other",
];

export default function CloudSettingsPage() {
  const { data: session } = useSession();

  const [client, setClient] = useState<ClientData | null>(null);
  const [profile, setProfile] = useState<ProfileData | null>(null);

  const [bizName, setBizName] = useState("");
  const [bizIndustry, setBizIndustry] = useState("");
  const [savingBiz, setSavingBiz] = useState(false);
  const [bizSaved, setBizSaved] = useState(false);

  const [userName, setUserName] = useState("");
  const [userPhone, setUserPhone] = useState("");
  const [savingUser, setSavingUser] = useState(false);
  const [userSaved, setUserSaved] = useState(false);

  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [pwError, setPwError] = useState("");
  const [savingPw, setSavingPw] = useState(false);
  const [pwSaved, setPwSaved] = useState(false);

  const [togglingPublish, setTogglingPublish] = useState(false);

  const fetchData = useCallback(async () => {
    if (!session?.clientId) return;
    const [clientListRes, profileRes] = await Promise.all([
      fetch(`/api/clients`),
      fetch(`/api/clients/${session.clientId}/profile`),
    ]);
    if (clientListRes.ok) {
      const list = (await clientListRes.json()) as ClientData[];
      const c = list.find((x) => x.id === session.clientId) ?? list[0] ?? null;
      if (c) {
        setClient(c);
        setBizName(c.name);
        setBizIndustry(c.industry);
      }
    }
    if (profileRes.ok) {
      const p = (await profileRes.json()) as ProfileData;
      setProfile(p);
    }
    setUserName(session.user?.name ?? "");
  }, [session?.clientId, session?.user?.name]);

  useEffect(() => { void fetchData(); }, [fetchData]);

  async function saveBusiness() {
    if (!session?.clientId || !bizName.trim()) return;
    setSavingBiz(true);
    await fetch(`/api/cloud/settings/client`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: bizName.trim(), industry: bizIndustry }),
    });
    setSavingBiz(false);
    setBizSaved(true);
    setTimeout(() => setBizSaved(false), 2000);
  }

  async function saveUser() {
    if (!session?.userId || !userName.trim()) return;
    setSavingUser(true);
    await fetch(`/api/users/me`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: userName.trim(), phone: userPhone.trim() || null }),
    });
    setSavingUser(false);
    setUserSaved(true);
    setTimeout(() => setUserSaved(false), 2000);
  }

  async function savePassword(e: React.FormEvent) {
    e.preventDefault();
    if (newPw.length < 8) { setPwError("Password must be at least 8 characters."); return; }
    if (newPw !== confirmPw) { setPwError("Passwords do not match."); return; }
    setSavingPw(true);
    setPwError("");
    const res = await fetch(`/api/users/me/password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword: currentPw, newPassword: newPw }),
    });
    setSavingPw(false);
    if (!res.ok) {
      const d = (await res.json()) as { error?: string };
      setPwError(d.error ?? "Failed to change password.");
      return;
    }
    setPwSaved(true);
    setCurrentPw("");
    setNewPw("");
    setConfirmPw("");
    setTimeout(() => setPwSaved(false), 2000);
  }

  async function togglePublish() {
    if (!session?.clientId || !profile) return;
    setTogglingPublish(true);
    const res = await fetch(`/api/clients/${session.clientId}/profile`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_published: !profile.is_published }),
    });
    if (res.ok) {
      setProfile((p) => p ? { ...p, is_published: !p.is_published } : p);
    }
    setTogglingPublish(false);
  }

  const profileUrl = profile?.slug ? `/p/${profile.slug}` : null;

  return (
    <div className="px-6 py-6 pb-28 lg:px-8 lg:pb-8">
      <div className="mx-auto max-w-xl space-y-8">

        {/* Business profile */}
        <section>
          <h2 className="mb-4 text-[15px] font-semibold text-white">Business profile</h2>
          <div className="rounded-2xl border border-white/10 bg-[#111111] p-5 space-y-4">
            <div>
              <label className="mb-1.5 block text-[13px] font-medium text-white/60">Business name</label>
              <input
                type="text"
                value={bizName}
                onChange={(e) => setBizName(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none focus:border-[#D4FF4F]"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-[13px] font-medium text-white/60">Industry</label>
              <select
                value={bizIndustry}
                onChange={(e) => setBizIndustry(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-[#1a1a1a] px-4 py-3 text-sm text-white outline-none focus:border-[#D4FF4F]"
              >
                <option value="">Select industry…</option>
                {INDUSTRIES.map((ind) => <option key={ind} value={ind}>{ind}</option>)}
              </select>
            </div>
            <button
              onClick={() => void saveBusiness()}
              disabled={savingBiz}
              className="flex items-center gap-2 rounded-xl bg-[#D4FF4F] px-5 py-2.5 text-sm font-semibold text-black disabled:opacity-60 hover:bg-[#c4ef3f]"
            >
              {savingBiz ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              {bizSaved ? "Saved!" : "Save"}
            </button>
          </div>
        </section>

        {/* Your account */}
        <section>
          <h2 className="mb-4 text-[15px] font-semibold text-white">Your account</h2>
          <div className="rounded-2xl border border-white/10 bg-[#111111] p-5 space-y-4">
            <div>
              <label className="mb-1.5 block text-[13px] font-medium text-white/60">Your name</label>
              <input
                type="text"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none focus:border-[#D4FF4F]"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-[13px] font-medium text-white/60">Email address</label>
              <input
                type="email"
                value={session?.user?.email ?? ""}
                readOnly
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/40 outline-none cursor-not-allowed"
              />
              <p className="mt-1 text-[12px] text-white/25">Contact support to change your email.</p>
            </div>
            <div>
              <label className="mb-1.5 block text-[13px] font-medium text-white/60">Phone number</label>
              <input
                type="tel"
                value={userPhone}
                onChange={(e) => setUserPhone(e.target.value)}
                placeholder="+1 555 000 0000"
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-white/30 outline-none focus:border-[#D4FF4F]"
              />
            </div>
            <button
              onClick={() => void saveUser()}
              disabled={savingUser}
              className="flex items-center gap-2 rounded-xl bg-[#D4FF4F] px-5 py-2.5 text-sm font-semibold text-black disabled:opacity-60 hover:bg-[#c4ef3f]"
            >
              {savingUser ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              {userSaved ? "Saved!" : "Save"}
            </button>
          </div>
        </section>

        {/* Change password */}
        <section>
          <h2 className="mb-4 text-[15px] font-semibold text-white">Change password</h2>
          <form onSubmit={(e) => void savePassword(e)} className="rounded-2xl border border-white/10 bg-[#111111] p-5 space-y-4">
            <div className="relative">
              <label className="mb-1.5 block text-[13px] font-medium text-white/60">Current password</label>
              <input
                type={showPw ? "text" : "password"}
                value={currentPw}
                onChange={(e) => setCurrentPw(e.target.value)}
                required
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 pr-10 text-sm text-white outline-none focus:border-[#D4FF4F]"
              />
              <button type="button" onClick={() => setShowPw((v) => !v)} className="absolute right-3 bottom-3 text-white/30 hover:text-white/60">
                {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <div>
              <label className="mb-1.5 block text-[13px] font-medium text-white/60">New password</label>
              <input
                type={showPw ? "text" : "password"}
                value={newPw}
                onChange={(e) => setNewPw(e.target.value)}
                required
                minLength={8}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none focus:border-[#D4FF4F]"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-[13px] font-medium text-white/60">Confirm new password</label>
              <input
                type={showPw ? "text" : "password"}
                value={confirmPw}
                onChange={(e) => setConfirmPw(e.target.value)}
                required
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none focus:border-[#D4FF4F]"
              />
            </div>
            {pwError && <p className="rounded-lg bg-red-500/10 px-4 py-2.5 text-sm text-red-400">{pwError}</p>}
            <button
              type="submit"
              disabled={savingPw}
              className="flex items-center gap-2 rounded-xl bg-[#D4FF4F] px-5 py-2.5 text-sm font-semibold text-black disabled:opacity-60 hover:bg-[#c4ef3f]"
            >
              {savingPw ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              {pwSaved ? "Password changed!" : "Change password"}
            </button>
          </form>
        </section>

        {/* Public profile */}
        {client && profile !== null && (
          <section>
            <h2 className="mb-4 text-[15px] font-semibold text-white">Public profile</h2>
            <div className="rounded-2xl border border-white/10 bg-[#111111] p-5 space-y-4">
              {profileUrl && (
                <div className="flex items-center justify-between rounded-xl bg-white/5 px-4 py-3">
                  <div>
                    <p className="text-[13px] text-white/40">Your profile URL</p>
                    <p className="text-[13px] font-mono text-white/70">leadstaq.tech{profileUrl}</p>
                  </div>
                  <a
                    href={profileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-lg p-2 text-white/40 hover:bg-white/10 hover:text-white"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </div>
              )}

              <div className="flex items-center justify-between rounded-xl border border-white/10 px-4 py-3">
                <div>
                  <p className="text-[14px] font-medium text-white">Profile published</p>
                  <p className="text-[13px] text-white/40">
                    {profile.is_published ? "Your profile is visible to the public" : "Your profile is hidden"}
                  </p>
                </div>
                <button
                  onClick={() => void togglePublish()}
                  disabled={togglingPublish}
                  className={`relative h-6 w-11 rounded-full transition-colors ${profile.is_published ? "bg-[#D4FF4F]" : "bg-white/10"}`}
                >
                  <span
                    className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${profile.is_published ? "translate-x-5" : "translate-x-0.5"}`}
                  />
                </button>
              </div>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
