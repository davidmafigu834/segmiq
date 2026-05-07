"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession, signOut } from "next-auth/react";
import { Loader2, Save, ExternalLink, Eye, EyeOff, HardDrive, Droplets, LogOut } from "lucide-react";

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
  const [stats, setStats] = useState<{
    plan: string; limit_bytes: number; total_bytes: number;
    total_photos: number; total_projects: number; pct: number;
  } | null>(null);

  type WatermarkSettings = {
    enabled: boolean;
    position: "bottom-right" | "bottom-left" | "bottom-center" | "center";
    opacity: number;
    size: "small" | "medium" | "large";
  };
  const [watermark, setWatermark] = useState<WatermarkSettings>({
    enabled: false, position: "bottom-right", opacity: 40, size: "small",
  });
  const [savingWatermark, setSavingWatermark] = useState(false);
  const [watermarkSaved, setWatermarkSaved] = useState(false);

  const fetchData = useCallback(async () => {
    if (!session?.clientId) return;
    const [clientListRes, profileRes, statsRes, watermarkRes] = await Promise.all([
      fetch(`/api/clients`),
      fetch(`/api/clients/${session.clientId}/profile`),
      fetch(`/api/cloud/storage/usage`),
      fetch(`/api/cloud/watermark`),
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
    if (statsRes.ok) {
      const s = (await statsRes.json()) as typeof stats;
      setStats(s);
    }
    if (watermarkRes.ok) {
      const w = (await watermarkRes.json()) as WatermarkSettings;
      setWatermark(w);
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

  async function saveWatermark() {
    setSavingWatermark(true);
    await fetch("/api/cloud/watermark", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(watermark),
    });
    setSavingWatermark(false);
    setWatermarkSaved(true);
    setTimeout(() => setWatermarkSaved(false), 2000);
  }

  const profileUrl = profile?.slug ? `/p/${profile.slug}` : null;

  const inputCls = "w-full rounded-xl border border-black/[0.1] bg-[#F5F5F0] px-4 py-3 text-[13px] text-[#0a0a0a] placeholder-[#999990] outline-none focus:border-black/[0.2] font-cloud-body";
  const labelCls = "mb-1.5 block text-[12px] font-semibold text-[#666660] uppercase tracking-[0.06em] font-cloud-body";
  const saveBtnCls = "flex items-center gap-2 rounded-xl bg-[#D4FF4F] px-5 py-2.5 text-[13px] font-bold text-black disabled:opacity-60 hover:bg-[#C8F244] transition-colors font-cloud-body";
  const sectionCardCls = "rounded-[20px] border border-[#D0D0C0]/40 bg-gradient-to-br from-[#F8F8F4] via-[#F0F0EA] to-[#E8E8E0] p-5 space-y-4";

  return (
    <div className="min-h-screen bg-[#F5F5F0] font-cloud-body px-5 py-4 pb-28 lg:px-8 lg:pb-8">
      <div className="mx-auto max-w-xl space-y-6">

        {/* Business profile */}
        <section>
          <p className="text-[10px] font-bold tracking-[0.08em] text-[#999990] uppercase mb-3 font-cloud-body">Business profile</p>
          <div className={sectionCardCls}>
            <div>
              <label className={labelCls}>Business name</label>
              <input type="text" value={bizName} onChange={(e) => setBizName(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Industry</label>
              <select value={bizIndustry} onChange={(e) => setBizIndustry(e.target.value)}
                className="w-full rounded-xl border border-black/[0.1] bg-[#F5F5F0] px-4 py-3 text-[13px] text-[#666660] outline-none focus:border-black/[0.2] font-cloud-body">
                <option value="">Select industry…</option>
                {INDUSTRIES.map((ind) => <option key={ind} value={ind}>{ind}</option>)}
              </select>
            </div>
            <button onClick={() => void saveBusiness()} disabled={savingBiz} className={saveBtnCls}>
              {savingBiz ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              {bizSaved ? "Saved!" : "Save"}
            </button>
          </div>
        </section>

        {/* Your account */}
        <section>
          <p className="text-[10px] font-bold tracking-[0.08em] text-[#999990] uppercase mb-3 font-cloud-body">Your account</p>
          <div className={sectionCardCls}>
            <div>
              <label className={labelCls}>Your name</label>
              <input type="text" value={userName} onChange={(e) => setUserName(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Email address</label>
              <input type="email" value={session?.user?.email ?? ""} readOnly
                className="w-full rounded-xl border border-black/[0.06] bg-black/[0.03] px-4 py-3 text-[13px] text-[#999990] outline-none cursor-not-allowed font-cloud-body" />
              <p className="mt-1 text-[11px] text-[#BBBBAA] font-cloud-body">Contact support to change your email.</p>
            </div>
            <div>
              <label className={labelCls}>Phone number</label>
              <input type="tel" value={userPhone} onChange={(e) => setUserPhone(e.target.value)} placeholder="+1 555 000 0000" className={inputCls} />
            </div>
            <button onClick={() => void saveUser()} disabled={savingUser} className={saveBtnCls}>
              {savingUser ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              {userSaved ? "Saved!" : "Save"}
            </button>
          </div>
        </section>

        {/* Change password */}
        <section>
          <p className="text-[10px] font-bold tracking-[0.08em] text-[#999990] uppercase mb-3 font-cloud-body">Change password</p>
          <form onSubmit={(e) => void savePassword(e)} className={sectionCardCls}>
            <div className="relative">
              <label className={labelCls}>Current password</label>
              <input type={showPw ? "text" : "password"} value={currentPw} onChange={(e) => setCurrentPw(e.target.value)} required
                className={`${inputCls} pr-10`} />
              <button type="button" onClick={() => setShowPw((v) => !v)} className="absolute right-3 bottom-3 text-[#999990] hover:text-[#0a0a0a]">
                {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <div>
              <label className={labelCls}>New password</label>
              <input type={showPw ? "text" : "password"} value={newPw} onChange={(e) => setNewPw(e.target.value)} required minLength={8} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Confirm new password</label>
              <input type={showPw ? "text" : "password"} value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} required className={inputCls} />
            </div>
            {pwError && <p className="rounded-xl bg-red-50 border border-red-200 px-4 py-2.5 text-[13px] text-red-500 font-cloud-body">{pwError}</p>}
            <button type="submit" disabled={savingPw} className={saveBtnCls}>
              {savingPw ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              {pwSaved ? "Password changed!" : "Change password"}
            </button>
          </form>
        </section>

        {/* Public profile */}
        {client && profile !== null && (
          <section>
            <p className="text-[10px] font-bold tracking-[0.08em] text-[#999990] uppercase mb-3 font-cloud-body">Public profile</p>
            <div className={sectionCardCls + " !space-y-3"}>
              {profileUrl && (
                <div className="flex items-center justify-between rounded-xl bg-white/60 border border-black/[0.06] px-4 py-3">
                  <div>
                    <p className="text-[11px] text-[#999990] font-cloud-body">Your profile URL</p>
                    <p className="text-[13px] font-mono text-[#0a0a0a]">leadstaq.tech{profileUrl}</p>
                  </div>
                  <a href={profileUrl} target="_blank" rel="noopener noreferrer"
                    className="rounded-lg p-2 text-[#999990] hover:text-[#0a0a0a]">
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </div>
              )}
              <div className="flex items-center justify-between rounded-xl border border-black/[0.07] bg-white/60 px-4 py-3">
                <div>
                  <p className="text-[14px] font-semibold text-[#0a0a0a] font-cloud-body">Profile published</p>
                  <p className="text-[12px] text-[#999990] font-cloud-body">
                    {profile.is_published ? "Visible to the public" : "Hidden from the public"}
                  </p>
                </div>
                <button onClick={() => void togglePublish()} disabled={togglingPublish}
                  className={`relative h-6 w-11 rounded-full transition-colors ${profile.is_published ? "bg-[#D4FF4F]" : "bg-black/10"}`}>
                  <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${profile.is_published ? "translate-x-5" : "translate-x-0.5"}`} />
                </button>
              </div>
            </div>
          </section>
        )}

        {/* Storage */}
        <section>
          <p className="text-[10px] font-bold tracking-[0.08em] text-[#999990] uppercase mb-3 font-cloud-body">Storage</p>
          <div className="rounded-[20px] border border-[#1a1a2e]/20 bg-gradient-to-br from-[#0a0a1a] via-[#111126] to-[#1a1a36] p-5">
            <div className="flex items-center gap-2 mb-4">
              <HardDrive className="h-4 w-4 text-white/40" />
              <span className="text-[13px] font-semibold text-white font-cloud-body">Storage</span>
            </div>
            {stats ? (() => {
              const limitGB = (stats.limit_bytes / (1024 * 1024 * 1024)).toFixed(0);
              const usedStr = stats.total_bytes < 1024 * 1024 * 1024
                ? `${(stats.total_bytes / (1024 * 1024)).toFixed(1)} MB`
                : `${(stats.total_bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
              const planLabel = stats.plan.charAt(0).toUpperCase() + stats.plan.slice(1);
              return (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-[13px] text-white/40 font-cloud-body">Used storage</span>
                    <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-[12px] font-semibold text-white/60 font-cloud-body">{planLabel} plan</span>
                  </div>
                  <div className="overflow-hidden rounded-full bg-white/[0.08] h-1.5">
                    <div className={`h-full rounded-full transition-all ${stats.pct > 80 ? "bg-red-400" : "bg-[#D4FF4F]"}`} style={{ width: `${stats.pct}%` }} />
                  </div>
                  <div className="flex items-center justify-between text-[12px] font-cloud-body">
                    <span className="text-white/40">{usedStr} of {limitGB} GB used</span>
                    <span className="text-white/30">{stats.total_photos.toLocaleString()} photos</span>
                  </div>
                  {stats.plan === "free" && (
                    <div className="rounded-xl border border-[#D4FF4F]/20 bg-[#D4FF4F]/5 p-4">
                      <p className="mb-1 text-[13px] font-semibold text-[#D4FF4F] font-cloud-body">Upgrade to Pro</p>
                      <p className="mb-3 text-[12px] text-white/40 font-cloud-body">Get 50 GB storage, priority support, and advanced watermarking.</p>
                      <button className="rounded-xl bg-[#D4FF4F] px-4 py-2 text-[13px] font-bold text-black hover:bg-[#C8F244] transition-colors font-cloud-body">
                        Upgrade — $29 / mo
                      </button>
                    </div>
                  )}
                </div>
              );
            })() : (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-white/20" />
              </div>
            )}
          </div>
        </section>

        {/* Watermark */}
        <section>
          <p className="text-[10px] font-bold tracking-[0.08em] text-[#999990] uppercase mb-3 font-cloud-body">Watermark</p>
          <div className={sectionCardCls + " !space-y-5"}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[14px] font-semibold text-[#0a0a0a] font-cloud-body">Enable watermark</p>
                <p className="text-[12px] text-[#999990] font-cloud-body">Overlay your logo on shared project photos</p>
              </div>
              <button onClick={() => setWatermark((w) => ({ ...w, enabled: !w.enabled }))}
                className={`relative h-6 w-11 rounded-full transition-colors ${watermark.enabled ? "bg-[#D4FF4F]" : "bg-black/10"}`}>
                <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${watermark.enabled ? "translate-x-5" : "translate-x-0.5"}`} />
              </button>
            </div>

            {watermark.enabled && (
              <>
                <div>
                  <label className={labelCls}>Position</label>
                  <div className="grid grid-cols-2 gap-2">
                    {(["bottom-right", "bottom-left", "bottom-center", "center"] as const).map((pos) => (
                      <button key={pos} onClick={() => setWatermark((w) => ({ ...w, position: pos }))}
                        className={`rounded-xl border px-3 py-2 text-[12px] font-semibold transition-colors font-cloud-body ${
                          watermark.position === pos
                            ? "border-[#0a0a0a]/20 bg-[#0a0a0a] text-white"
                            : "border-black/[0.1] bg-white/50 text-[#666660] hover:bg-white"
                        }`}>
                        {pos.replace("-", " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className={labelCls}>Opacity — {watermark.opacity}%</label>
                  <input type="range" min={10} max={90} step={5} value={watermark.opacity}
                    onChange={(e) => setWatermark((w) => ({ ...w, opacity: Number(e.target.value) }))}
                    className="w-full accent-[#0a0a0a]" />
                  <div className="flex justify-between text-[11px] text-[#999990] mt-1 font-cloud-body">
                    <span>10%</span><span>90%</span>
                  </div>
                </div>

                <div>
                  <label className={labelCls}>Size</label>
                  <div className="flex gap-2">
                    {(["small", "medium", "large"] as const).map((s) => (
                      <button key={s} onClick={() => setWatermark((w) => ({ ...w, size: s }))}
                        className={`flex-1 rounded-xl border py-2 text-[12px] font-semibold transition-colors font-cloud-body ${
                          watermark.size === s
                            ? "border-[#0a0a0a]/20 bg-[#0a0a0a] text-white"
                            : "border-black/[0.1] bg-white/50 text-[#666660] hover:bg-white"
                        }`}>
                        {s.charAt(0).toUpperCase() + s.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}

            <button onClick={() => void saveWatermark()} disabled={savingWatermark} className={saveBtnCls}>
              {savingWatermark ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Droplets className="h-3.5 w-3.5" />}
              {watermarkSaved ? "Saved!" : "Save watermark"}
            </button>
          </div>
        </section>
        {/* Sign out */}
        <section className="pb-4">
          <button
            onClick={() => void signOut({ callbackUrl: "/cloud/login" })}
            className="flex w-full items-center justify-center gap-2 rounded-[20px] border border-red-200/60 bg-gradient-to-br from-[#FFF5F5] via-[#FFE8E8] to-[#FFD0D0] py-4 text-[14px] font-semibold text-red-500 active:scale-[0.99] transition-transform font-cloud-body"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </section>
      </div>
    </div>
  );
}
