"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSession, signOut } from "next-auth/react";
import { Loader2, Save, ExternalLink, Eye, EyeOff, HardDrive, Droplets, LogOut, Upload, Camera, X } from "lucide-react";

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
  headline: string | null;
  cta_text: string | null;
};

const INDUSTRIES = [
  "Construction", "Solar Installation", "Landscaping", "Electrical",
  "Plumbing", "Interior Design", "Roofing", "Fencing", "Events", "Architecture", "Other",
];

export default function CloudSettingsPage() {
  const { data: session } = useSession();

  const [client, setClient] = useState<ClientData | null>(null);
  const [profile, setProfile] = useState<ProfileData | null>(null);

  const logoInputRef = useRef<HTMLInputElement>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [logoSaved, setLogoSaved] = useState(false);
  const [logoError, setLogoError] = useState("");

  const [bizName, setBizName] = useState("");
  const [bizIndustry, setBizIndustry] = useState("");
  const [savingBiz, setSavingBiz] = useState(false);
  const [bizSaved, setBizSaved] = useState(false);
  const [bizError, setBizError] = useState("");

  const [userName, setUserName] = useState("");
  const [userPhone, setUserPhone] = useState("");
  const [savingUser, setSavingUser] = useState(false);
  const [userSaved, setUserSaved] = useState(false);
  const [userError, setUserError] = useState("");

  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [pwError, setPwError] = useState("");
  const [savingPw, setSavingPw] = useState(false);
  const [pwSaved, setPwSaved] = useState(false);

  const [togglingPublish, setTogglingPublish] = useState(false);
  const [headline, setHeadline] = useState("");
  const [ctaText, setCtaText] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);
  const [profileError, setProfileError] = useState("");
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
  const [reprocessing, setReprocessing] = useState(false);
  const [reprocessResult, setReprocessResult] = useState<{ processed: number; failed: number; total: number } | null>(null);

  const fetchData = useCallback(async () => {
    if (!session?.clientId) return;
    const [clientListRes, profileRes, statsRes, watermarkRes, userRes] = await Promise.all([
      fetch(`/api/clients`),
      fetch(`/api/clients/${session.clientId}/profile`),
      fetch(`/api/cloud/storage/usage`),
      fetch(`/api/cloud/watermark`),
      fetch(`/api/users/me`),
    ]);
    if (clientListRes.ok) {
      const list = (await clientListRes.json()) as ClientData[];
      const c = list.find((x) => x.id === session.clientId) ?? list[0] ?? null;
      if (c) {
        setClient(c);
        setBizName(c.name);
        setBizIndustry(c.industry);
        setLogoUrl(c.logo_url ?? null);
      }
    }
    if (profileRes.ok) {
      const p = (await profileRes.json()) as ProfileData;
      setProfile(p);
      if (p.headline) setHeadline(p.headline);
      if (p.cta_text) setCtaText(p.cta_text);
    }
    if (statsRes.ok) {
      const s = (await statsRes.json()) as typeof stats;
      setStats(s);
    }
    if (watermarkRes.ok) {
      const w = (await watermarkRes.json()) as WatermarkSettings;
      setWatermark(w);
    }
    if (userRes.ok) {
      const ud = (await userRes.json()) as { user?: { phone?: string | null; name?: string } };
      if (ud.user?.name) setUserName(ud.user.name);
      if (ud.user?.phone) setUserPhone(ud.user.phone);
    } else {
      setUserName(session.user?.name ?? "");
    }
  }, [session?.clientId, session?.user?.name]);

  useEffect(() => { void fetchData(); }, [fetchData]);

  function handleLogoFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { setLogoError("File too large. Max 5 MB."); return; }
    setLogoError("");
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
  }

  async function uploadLogo() {
    if (!logoFile || !session?.clientId) return;
    setUploadingLogo(true);
    setLogoError("");
    try {
      const presignRes = await fetch("/api/storage/presign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: logoFile.name, contentType: logoFile.type, clientId: session.clientId, purpose: "logo" }),
      });
      if (!presignRes.ok) throw new Error("Failed to get upload URL");
      const { uploadUrl, key: logoKey, publicUrl } = (await presignRes.json()) as { uploadUrl: string; key: string; publicUrl: string };
      await fetch(uploadUrl, { method: "PUT", body: logoFile, headers: { "Content-Type": logoFile.type } });
      await fetch("/api/cloud/settings/client", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ logo_url: publicUrl, logo_key: logoKey }),
      });
      setLogoUrl(publicUrl);
      setLogoFile(null);
      setLogoPreview(null);
      setLogoSaved(true);
      setTimeout(() => setLogoSaved(false), 2000);
    } catch {
      setLogoError("Upload failed. Please try again.");
    } finally {
      setUploadingLogo(false);
    }
  }

  async function saveProfile() {
    if (!session?.clientId) return;
    setSavingProfile(true);
    setProfileError("");
    const res = await fetch(`/api/clients/${session.clientId}/profile`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ headline: headline.trim(), cta_text: ctaText.trim() }),
    });
    setSavingProfile(false);
    if (!res.ok) {
      const d = (await res.json()) as { error?: string };
      setProfileError(d.error ?? "Failed to save.");
      return;
    }
    setProfileSaved(true);
    setTimeout(() => setProfileSaved(false), 2000);
  }

  async function saveBusiness() {
    if (!session?.clientId || !bizName.trim()) return;
    setSavingBiz(true);
    setBizError("");
    const body: Record<string, string> = { name: bizName.trim() };
    if (bizIndustry) body.industry = bizIndustry;
    const res = await fetch(`/api/cloud/settings/client`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setSavingBiz(false);
    if (!res.ok) {
      const d = (await res.json()) as { error?: string };
      setBizError(d.error ?? "Failed to save. Please try again.");
      return;
    }
    setBizSaved(true);
    setTimeout(() => setBizSaved(false), 2000);
  }

  async function saveUser() {
    if (!session?.userId || !userName.trim()) return;
    setSavingUser(true);
    setUserError("");
    const res = await fetch(`/api/users/me`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: userName.trim(), phone: userPhone.trim() || null }),
    });
    setSavingUser(false);
    if (!res.ok) {
      const d = (await res.json()) as { error?: string };
      setUserError(d.error ?? "Failed to save. Please try again.");
      return;
    }
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
    const res = await fetch("/api/cloud/watermark", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(watermark),
    });
    setSavingWatermark(false);
    if (!res.ok) return;
    setReprocessing(true);
    setReprocessResult(null);
    try {
      const rpRes = await fetch("/api/cloud/watermark/reprocess", { method: "POST" });
      const rpData = (await rpRes.json()) as { processed: number; failed: number; total: number };
      setReprocessResult(rpData);
    } catch {
      // non-fatal
    } finally {
      setReprocessing(false);
      setWatermarkSaved(true);
      setTimeout(() => { setWatermarkSaved(false); setReprocessResult(null); }, 5000);
    }
  }

  const profileUrl = profile?.slug ? `/p/${profile.slug}` : null;

  const inputCls = "w-full rounded-xl border border-black/[0.1] bg-[#F5F5F0] px-4 py-3 text-[13px] text-[#0a0a0a] placeholder-[#999990] outline-none focus:border-black/[0.2] font-cloud-body";
  const labelCls = "mb-1.5 block text-[12px] font-semibold text-[#666660] uppercase tracking-[0.06em] font-cloud-body";
  const saveBtnCls = "flex items-center gap-2 rounded-xl px-5 py-2.5 text-[13px] font-bold disabled:opacity-60 transition-opacity font-cloud-body cursor-pointer" + " bg-[var(--fw-soil)] text-[var(--fw-lime)]";  
  const sectionCardCls = "rounded-[20px] border p-5 space-y-4 bg-white" + " border-[var(--fw-border)]";  

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
            <div>
              <label className={labelCls}>Business logo</label>
              <input ref={logoInputRef} type="file" accept="image/png,image/jpeg,image/jpg,image/svg+xml" className="hidden" onChange={handleLogoFileChange} />
              {(logoPreview ?? logoUrl) ? (
                <div className="flex items-center gap-4 rounded-xl border border-black/[0.08] bg-[#F5F5F0] px-4 py-3">
                  <div className="flex h-12 w-20 flex-shrink-0 items-center justify-center overflow-hidden rounded-lg border border-black/[0.06] bg-white p-1">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={logoPreview ?? logoUrl!} alt="Logo" className="h-full w-full object-contain" />
                  </div>
                  <div className="flex flex-1 flex-col gap-1.5">
                    {logoFile ? (
                      <button onClick={() => void uploadLogo()} disabled={uploadingLogo} className={saveBtnCls}>
                        {uploadingLogo ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                        {logoSaved ? "Saved!" : uploadingLogo ? "Uploading…" : "Save logo"}
                      </button>
                    ) : (
                      <button onClick={() => logoInputRef.current?.click()} className="text-left text-[12px] font-semibold text-[#666660] font-cloud-body hover:text-[#0a0a0a]">
                        Change logo
                      </button>
                    )}
                  </div>
                  {logoFile && (
                    <button onClick={() => { setLogoFile(null); setLogoPreview(null); }} className="text-[#BBBBAA] hover:text-[#666660]">
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ) : (
                <button onClick={() => logoInputRef.current?.click()} className="flex w-full items-center gap-3 rounded-xl border border-dashed border-black/[0.15] bg-[#F5F5F0] px-4 py-4 text-left text-[13px] text-[#999990] font-cloud-body hover:border-black/[0.25] transition-colors">
                  <Camera className="h-4 w-4 flex-shrink-0" />
                  Upload logo (PNG, JPG, SVG — max 5 MB)
                </button>
              )}
              {logoError && <p className="mt-1 text-[12px] text-red-500 font-cloud-body">{logoError}</p>}
            </div>
            <button onClick={() => void saveBusiness()} disabled={savingBiz} className={saveBtnCls}>
              {savingBiz ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              {bizSaved ? "Saved!" : "Save"}
            </button>
            {bizError && <p className="text-[12px] text-red-500 font-cloud-body">{bizError}</p>}
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
            {userError && <p className="text-[12px] text-red-500 font-cloud-body">{userError}</p>}
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
              <div>
                <label className={labelCls}>Profile headline</label>
                <input type="text" value={headline} onChange={(e) => setHeadline(e.target.value)} placeholder="We build remarkable spaces for people to live and work" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>CTA button text</label>
                <input type="text" value={ctaText} onChange={(e) => setCtaText(e.target.value)} placeholder="Get a Free Quote" className={inputCls} />
              </div>
              <button onClick={() => void saveProfile()} disabled={savingProfile} className={saveBtnCls}>
                {savingProfile ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                {profileSaved ? "Saved!" : "Save"}
              </button>
              {profileError && <p className="text-[12px] text-red-500 font-cloud-body">{profileError}</p>}
              <div className="h-px bg-black/[0.06]" />
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
                  {stats.plan === "starter" && (
                    <div className="rounded-xl border border-[#D4FF4F]/20 bg-[#D4FF4F]/5 p-4">
                      <p className="mb-1 text-[13px] font-semibold text-[#D4FF4F] font-cloud-body">Upgrade to Professional</p>
                      <p className="mb-3 text-[12px] text-white/40 font-cloud-body">Get 100 GB storage, custom logo watermark, project analytics, and priority support.</p>
                      <button className="rounded-xl bg-[#D4FF4F] px-4 py-2 text-[13px] font-bold text-black hover:bg-[#C8F244] transition-colors font-cloud-body">
                        Upgrade — $49 / mo
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

            <button onClick={() => void saveWatermark()} disabled={savingWatermark || reprocessing} className={saveBtnCls}>
              {(savingWatermark || reprocessing) ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Droplets className="h-3.5 w-3.5" />}
              {savingWatermark ? "Saving..." : reprocessing ? "Applying to all photos..." : watermarkSaved ? "Applied!" : "Save watermark"}
            </button>
            {reprocessing && (
              <p className="text-[12px] text-[#666660] font-cloud-body">Updating your existing photos with the new watermark settings…</p>
            )}
            {!reprocessing && reprocessResult && reprocessResult.total > 0 && (
              <p className="text-[12px] text-[#666660] font-cloud-body">
                ✓ {reprocessResult.processed} photo{reprocessResult.processed !== 1 ? "s" : ""} updated
                {reprocessResult.failed > 0 ? ` · ${reprocessResult.failed} failed` : ""}
              </p>
            )}
          </div>
        </section>
        {/* Sign out */}
        <section className="pb-4">
          <button
            onClick={() => void signOut({ callbackUrl: "/cloud/login" })}
            className="flex w-full items-center justify-center gap-2 rounded-[20px] border border-red-200/60 bg-white py-4 text-[14px] font-semibold text-red-500 active:scale-[0.99] transition-transform font-cloud-body"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </section>
      </div>
    </div>
  );
}
