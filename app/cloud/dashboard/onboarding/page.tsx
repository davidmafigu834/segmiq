"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  CloudUpload, Camera, Loader2, Check, ChevronRight,
  Upload, Users, Globe, X,
} from "lucide-react";

type Step = 1 | 2 | 3;

function StepIndicator({ current }: { current: Step }) {
  const steps = [
    { n: 1 as Step, label: "Upload logo" },
    { n: 2 as Step, label: "Invite team" },
    { n: 3 as Step, label: "Profile page" },
  ];
  return (
    <div className="flex items-center justify-center gap-0 mb-10">
      {steps.map((s, i) => (
        <div key={s.n} className="flex items-center">
          <div className="flex flex-col items-center gap-1.5">
            <div
              className={`flex h-7 w-7 items-center justify-center rounded-full text-[12px] font-bold transition-colors ${
                s.n < current
                  ? "bg-[#D4FF4F] text-black"
                  : s.n === current
                  ? "bg-white text-black"
                  : "bg-white/10 text-white/30"
              }`}
            >
              {s.n < current ? <Check className="h-3.5 w-3.5" /> : s.n}
            </div>
            <span className={`text-[11px] whitespace-nowrap ${s.n === current ? "text-white" : "text-white/30"}`}>
              {s.label}
            </span>
          </div>
          {i < steps.length - 1 && (
            <div
              className={`mb-4 h-px w-12 mx-1 transition-colors ${s.n < current ? "bg-[#D4FF4F]" : "bg-white/10"}`}
            />
          )}
        </div>
      ))}
    </div>
  );
}

export default function OnboardingPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);

  const logoInputRef = useRef<HTMLInputElement>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [logoError, setLogoError] = useState("");

  const [inviteName, setInviteName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [invitePhone, setInvitePhone] = useState("");
  const [inviteRole, setInviteRole] = useState<"CLIENT_MANAGER" | "SALESPERSON">("SALESPERSON");
  const [sendingInvite, setSendingInvite] = useState(false);
  const [inviteError, setInviteError] = useState("");
  const [invitedMembers, setInvitedMembers] = useState<{ name: string; email: string; role: string }[]>([]);

  const [headline, setHeadline] = useState("");
  const [ctaText, setCtaText] = useState("Get a Free Quote");
  const [businessName, setBusinessName] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);

  useEffect(() => {
    if (session?.clientId) {
      fetch("/api/clients")
        .then((r) => r.json())
        .then((list: unknown) => {
          if (Array.isArray(list)) {
            const c = (list as { id: string; name: string; logo_url?: string }[]).find(
              (x) => x.id === session.clientId
            );
            if (c) {
              setBusinessName(c.name);
              if (c.logo_url) setLogoUrl(c.logo_url);
            }
          }
        })
        .catch(() => {});
    }
  }, [session?.clientId]);

  function handleLogoFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setLogoError("File too large. Max 5 MB.");
      return;
    }
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
        body: JSON.stringify({
          filename: logoFile.name,
          contentType: logoFile.type,
          clientId: session.clientId,
          purpose: "logo",
        }),
      });
      if (!presignRes.ok) throw new Error("Failed to get upload URL");
      const { uploadUrl, publicUrl } = (await presignRes.json()) as {
        uploadUrl: string;
        publicUrl: string;
      };
      await fetch(uploadUrl, { method: "PUT", body: logoFile, headers: { "Content-Type": logoFile.type } });
      await fetch("/api/cloud/settings/client", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ logo_url: publicUrl }),
      });
      setLogoUrl(publicUrl);
    } catch {
      setLogoError("Upload failed. Please try again.");
    } finally {
      setUploadingLogo(false);
    }
  }

  async function advanceStep1() {
    await fetch("/api/cloud/onboarding", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ step: 2 }),
    });
    setStep(2);
  }

  async function sendInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!session?.clientId) return;
    setSendingInvite(true);
    setInviteError("");
    const res = await fetch("/api/cloud/team/invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: inviteName.trim(),
        email: inviteEmail.trim(),
        phone: invitePhone.trim() || null,
        role: inviteRole,
        clientId: session.clientId,
      }),
    });
    const data = (await res.json()) as { error?: string };
    setSendingInvite(false);
    if (!res.ok) { setInviteError(data.error ?? "Failed to send invite"); return; }
    setInvitedMembers((prev) => [...prev, { name: inviteName.trim(), email: inviteEmail.trim(), role: inviteRole }]);
    setInviteName(""); setInviteEmail(""); setInvitePhone("");
  }

  async function advanceStep2() {
    await fetch("/api/cloud/onboarding", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ step: 3 }),
    });
    setStep(3);
  }

  async function finishOnboarding() {
    if (!session?.clientId) return;
    setSavingProfile(true);
    await fetch(`/api/clients/${session.clientId}/profile`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ headline: headline.trim(), cta_text: ctaText.trim() || "Get a Free Quote" }),
    });
    await fetch("/api/cloud/onboarding", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ completed: true }),
    });
    setSavingProfile(false);
    sessionStorage.setItem("lq_ob", "1");
    router.push("/cloud/dashboard?welcome=1");
  }

  async function skipOnboarding() {
    await fetch("/api/cloud/onboarding", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ completed: true }),
    });
    sessionStorage.setItem("lq_ob", "1");
    router.push("/cloud/dashboard");
  }

  return (
    <div className="fixed inset-0 z-[200] flex flex-col items-center justify-start overflow-y-auto bg-[#0a0a0a] px-6 py-8">
      <div className="mb-8 flex flex-col items-center gap-2.5">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#D4FF4F]">
          <CloudUpload className="h-4.5 w-4.5 text-black" strokeWidth={2.5} />
        </div>
        <span className="text-[13px] font-semibold text-white">Leadstaq Cloud</span>
      </div>

      <div className="w-full max-w-lg">
        <StepIndicator current={step} />

        {step === 1 && (
          <div>
            <h1 className="mb-1.5 text-[22px] font-semibold text-white">Upload your business logo</h1>
            <p className="mb-8 text-[13px] text-white/50">
              Your logo appears on your project share pages and as a watermark on photos.
            </p>

            <input
              ref={logoInputRef}
              type="file"
              accept="image/png,image/jpeg,image/jpg,image/svg+xml"
              className="hidden"
              onChange={handleLogoFileChange}
            />

            {logoPreview ? (
              <div className="mb-6">
                <div className="flex items-center gap-6 rounded-2xl border border-white/10 bg-[#111] p-6">
                  <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-white/5">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={logoPreview} alt="Logo circle" className="h-full w-full object-contain p-1" />
                  </div>
                  <div className="flex h-16 w-28 items-center justify-center overflow-hidden rounded-lg border border-white/10 bg-white/5">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={logoPreview} alt="Logo square" className="h-full w-full object-contain p-2" />
                  </div>
                  <button
                    onClick={() => { setLogoFile(null); setLogoPreview(null); }}
                    className="ml-auto rounded-lg p-1.5 text-white/30 hover:bg-white/10 hover:text-white"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                {logoError && <p className="mt-2 text-[13px] text-red-400">{logoError}</p>}
                <div className="mt-5 flex flex-col gap-3">
                  <button
                    onClick={() => void uploadLogo()}
                    disabled={uploadingLogo || !!logoUrl}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#D4FF4F] py-3.5 text-[14px] font-semibold text-black disabled:opacity-60 hover:bg-[#c4ef3f] transition-colors"
                  >
                    {uploadingLogo ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                    {logoUrl ? "Uploaded ✓" : uploadingLogo ? "Uploading…" : "Upload logo"}
                  </button>
                  {logoUrl && (
                    <button
                      onClick={() => void advanceStep1()}
                      className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 py-3 text-[14px] font-medium text-white hover:bg-white/5 transition-colors"
                    >
                      Looks good, continue <ChevronRight className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <button
                onClick={() => logoInputRef.current?.click()}
                className="mb-6 flex h-[200px] w-full flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-white/15 text-white/40 transition-colors hover:border-white/30 hover:bg-white/5 hover:text-white/60"
              >
                <Camera className="h-10 w-10" strokeWidth={1.5} />
                <span className="text-[14px] font-medium">Click to upload your logo</span>
                <span className="text-[12px]">PNG, JPG, SVG — max 5 MB</span>
              </button>
            )}

            <button
              onClick={() => void advanceStep1()}
              className="w-full text-center text-[13px] text-white/30 hover:text-white/60 transition-colors"
            >
              Skip for now →
            </button>
          </div>
        )}

        {step === 2 && (
          <div>
            <h1 className="mb-1.5 text-[22px] font-semibold text-white">Invite your first team member</h1>
            <p className="mb-8 text-[13px] text-white/50">
              Add the people who will be uploading photos from the field.
            </p>

            {invitedMembers.length > 0 && (
              <div className="mb-6 space-y-2">
                {invitedMembers.map((m, i) => (
                  <div key={i} className="flex items-center gap-3 rounded-xl border border-white/10 bg-[#111] px-4 py-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#D4FF4F] text-[12px] font-bold text-black">
                      {m.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-medium text-white truncate">{m.name}</p>
                      <p className="text-[12px] text-white/40 truncate">{m.email}</p>
                    </div>
                    <span className="rounded-full bg-[#D4FF4F]/10 px-2.5 py-0.5 text-[11px] font-medium text-[#D4FF4F]">
                      Invited
                    </span>
                  </div>
                ))}
              </div>
            )}

            <form onSubmit={(e) => void sendInvite(e)} className="space-y-4 mb-6">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-white/60">Full name</label>
                <input
                  type="text"
                  value={inviteName}
                  onChange={(e) => setInviteName(e.target.value)}
                  required
                  placeholder="Jane Smith"
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-white/30 outline-none focus:border-[#D4FF4F]"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-white/60">Email address</label>
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
                <label className="mb-1.5 block text-xs font-medium text-white/60">Phone (optional)</label>
                <input
                  type="tel"
                  value={invitePhone}
                  onChange={(e) => setInvitePhone(e.target.value)}
                  placeholder="+1 555 000 0000"
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-white/30 outline-none focus:border-[#D4FF4F]"
                />
              </div>
              <div>
                <label className="mb-2 block text-xs font-medium text-white/60">Role</label>
                <div className="flex gap-2">
                  {(["CLIENT_MANAGER", "SALESPERSON"] as const).map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setInviteRole(r)}
                      className={`flex-1 rounded-xl border py-2.5 text-[13px] font-medium transition-colors ${
                        inviteRole === r
                          ? "border-[#D4FF4F]/50 bg-[#D4FF4F]/10 text-[#D4FF4F]"
                          : "border-white/10 text-white/50 hover:bg-white/5"
                      }`}
                    >
                      {r === "CLIENT_MANAGER" ? "Manager" : "Salesperson"}
                    </button>
                  ))}
                </div>
              </div>
              {inviteError && <p className="text-[13px] text-red-400">{inviteError}</p>}
              <button
                type="submit"
                disabled={sendingInvite}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#D4FF4F] py-3.5 text-[14px] font-semibold text-black disabled:opacity-60 hover:bg-[#c4ef3f] transition-colors"
              >
                {sendingInvite ? <Loader2 className="h-4 w-4 animate-spin" /> : <Users className="h-4 w-4" />}
                {sendingInvite ? "Sending…" : "Send invite"}
              </button>
            </form>

            <button
              onClick={() => void advanceStep2()}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 py-3 text-[14px] font-medium text-white hover:bg-white/5 transition-colors"
            >
              Continue <ChevronRight className="h-4 w-4" />
            </button>

            <button
              onClick={() => void advanceStep2()}
              className="mt-3 w-full text-center text-[13px] text-white/30 hover:text-white/60 transition-colors"
            >
              Skip — I&apos;ll do this later →
            </button>
          </div>
        )}

        {step === 3 && (
          <div>
            <h1 className="mb-1.5 text-[22px] font-semibold text-white">Set up your public profile</h1>
            <p className="mb-8 text-[13px] text-white/50">
              This is the page you share with prospects. Let&apos;s give it a headline.
            </p>

            <div className="grid gap-8 lg:grid-cols-2">
              <div className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-white/60">
                    What do you do in one line?
                  </label>
                  <input
                    type="text"
                    value={headline}
                    onChange={(e) => setHeadline(e.target.value)}
                    placeholder="We build remarkable spaces for people to live and work"
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-white/30 outline-none focus:border-[#D4FF4F]"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-white/60">CTA button text</label>
                  <input
                    type="text"
                    value={ctaText}
                    onChange={(e) => setCtaText(e.target.value)}
                    placeholder="Get a Free Quote"
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-white/30 outline-none focus:border-[#D4FF4F]"
                  />
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-[#111] p-5">
                <p className="mb-3 text-[11px] font-medium uppercase tracking-[0.1em] text-white/30">Preview</p>
                <div className="rounded-xl bg-black p-4 text-center">
                  {logoUrl && (
                    <div className="mb-3 flex justify-center">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={logoUrl} alt="Logo" className="h-10 object-contain" />
                    </div>
                  )}
                  <p className="mb-1 text-[11px] font-medium text-white/50">{businessName}</p>
                  <p className="mb-4 text-[15px] font-light text-white leading-snug">
                    {headline || "Your headline will appear here"}
                  </p>
                  <div
                    className="inline-block rounded-lg px-4 py-2 text-[12px] font-semibold text-black"
                    style={{ backgroundColor: "#D4FF4F" }}
                  >
                    {ctaText || "Get a Free Quote"}
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-8 flex flex-col gap-3">
              <button
                onClick={() => void finishOnboarding()}
                disabled={savingProfile}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#D4FF4F] py-3.5 text-[14px] font-semibold text-black disabled:opacity-60 hover:bg-[#c4ef3f] transition-colors"
              >
                {savingProfile ? <Loader2 className="h-4 w-4 animate-spin" /> : <Globe className="h-4 w-4" />}
                {savingProfile ? "Saving…" : "Finish setup →"}
              </button>
              <button
                onClick={() => void skipOnboarding()}
                className="w-full text-center text-[13px] text-white/30 hover:text-white/60 transition-colors"
              >
                Skip →
              </button>
            </div>
          </div>
        )}

        <div className="mt-8 text-center">
          <button
            onClick={() => void skipOnboarding()}
            className="text-[12px] text-white/20 hover:text-white/40 transition-colors"
          >
            Skip setup entirely
          </button>
        </div>
      </div>
    </div>
  );
}
