"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CloudUpload, Eye, EyeOff, Loader2, ChevronRight } from "lucide-react";

const INDUSTRIES = [
  "Construction",
  "Solar Installation",
  "Landscaping",
  "Electrical",
  "Plumbing",
  "Interior Design",
  "Roofing",
  "Fencing",
  "Events",
  "Architecture",
  "Other",
];

function passwordStrength(pw: string): { label: string; color: string; width: string } {
  if (pw.length === 0) return { label: "", color: "", width: "0%" };
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  if (score <= 1) return { label: "Weak", color: "bg-red-500", width: "30%" };
  if (score <= 3) return { label: "Medium", color: "bg-yellow-400", width: "60%" };
  return { label: "Strong", color: "bg-[#D4FF4F]", width: "100%" };
}

export default function CloudSignupPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [name, setName] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [industry, setIndustry] = useState("");
  const [phone, setPhone] = useState("");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [showPw, setShowPw] = useState(false);

  const strength = passwordStrength(password);

  function validateStep1() {
    if (!name.trim()) return "Full name is required.";
    if (!businessName.trim()) return "Business name is required.";
    if (!industry) return "Please select your industry.";
    if (!phone.trim() || phone.trim().length < 8) return "A valid phone number is required.";
    return null;
  }

  function handleNext(e: React.FormEvent) {
    e.preventDefault();
    const err = validateStep1();
    if (err) { setError(err); return; }
    setError("");
    setStep(2);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) { setError("Password must be at least 8 characters."); return; }
    if (password !== confirmPw) { setError("Passwords do not match."); return; }
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/cloud/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, businessName, industry, phone, email, password }),
      });
      const data = await res.json() as { success?: boolean; error?: string; field?: string };
      if (!res.ok) {
        setError(data.error ?? "Signup failed. Please try again.");
        setLoading(false);
        return;
      }
      const signInRes = await signIn("credentials", { email, password, redirect: false });
      if (signInRes?.error) {
        setError("Account created, but auto sign-in failed. Please sign in manually.");
        setLoading(false);
        return;
      }
      router.push("/cloud/dashboard");
    } catch {
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#0a0a0a] px-6 py-12">
      {/* Logo */}
      <div className="mb-8 flex flex-col items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#D4FF4F]">
          <CloudUpload className="h-5 w-5 text-black" strokeWidth={2.5} />
        </div>
        <span className="text-sm font-semibold text-white">Segmiq Cloud</span>
      </div>

      <div className="w-full max-w-sm">
        {/* Progress */}
        <div className="mb-8">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs text-white/40">Step {step} of 2</span>
            <span className="text-xs text-white/40">{step === 1 ? "About you" : "Your account"}</span>
          </div>
          <div className="h-1 w-full overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-[#D4FF4F] transition-all duration-300"
              style={{ width: step === 1 ? "50%" : "100%" }}
            />
          </div>
        </div>

        {step === 1 ? (
          <>
            <h1 className="mb-2 text-2xl font-semibold text-white">About your business</h1>
            <p className="mb-8 text-sm text-white/50">Tell us a bit about you and your work.</p>

            <form onSubmit={handleNext} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-white/60">Your full name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  placeholder="Jane Smith"
                  autoFocus
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-white/30 outline-none transition-colors focus:border-[#D4FF4F]"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-white/60">Business name</label>
                <input
                  type="text"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  required
                  placeholder="Smith Electrical Co."
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-white/30 outline-none transition-colors focus:border-[#D4FF4F]"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-white/60">Industry</label>
                <select
                  value={industry}
                  onChange={(e) => setIndustry(e.target.value)}
                  required
                  className="w-full rounded-xl border border-white/10 bg-[#1a1a1a] px-4 py-3 text-sm text-white outline-none transition-colors focus:border-[#D4FF4F]"
                >
                  <option value="">Select your industry…</option>
                  {INDUSTRIES.map((ind) => (
                    <option key={ind} value={ind}>{ind}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-white/60">Phone number</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  required
                  placeholder="+1 555 000 0000"
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-white/30 outline-none transition-colors focus:border-[#D4FF4F]"
                />
              </div>

              {error && (
                <p className="rounded-lg bg-red-500/10 px-4 py-2.5 text-sm text-red-400">{error}</p>
              )}

              <button
                type="submit"
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#D4FF4F] py-3.5 text-sm font-semibold text-black transition-colors hover:bg-[#c4ef3f]"
              >
                Continue
                <ChevronRight className="h-4 w-4" />
              </button>
            </form>
          </>
        ) : (
          <>
            <h1 className="mb-2 text-2xl font-semibold text-white">Create your account</h1>
            <p className="mb-8 text-sm text-white/50">
              Setting up{" "}
              <span className="text-white">{businessName}</span>
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-white/60">Email address</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  required
                  autoFocus
                  placeholder="jane@smithelectrical.com"
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-white/30 outline-none transition-colors focus:border-[#D4FF4F]"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-white/60">Password</label>
                <div className="relative">
                  <input
                    type={showPw ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="new-password"
                    required
                    minLength={8}
                    placeholder="Min 8 characters"
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 pr-12 text-sm text-white placeholder-white/30 outline-none transition-colors focus:border-[#D4FF4F]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60"
                  >
                    {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {password.length > 0 && (
                  <div className="mt-2">
                    <div className="h-1 w-full overflow-hidden rounded-full bg-white/10">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${strength.color}`}
                        style={{ width: strength.width }}
                      />
                    </div>
                    <p className="mt-1 text-[10px] text-white/40">{strength.label}</p>
                  </div>
                )}
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-white/60">Confirm password</label>
                <input
                  type={showPw ? "text" : "password"}
                  value={confirmPw}
                  onChange={(e) => setConfirmPw(e.target.value)}
                  autoComplete="new-password"
                  required
                  placeholder="Repeat password"
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-white/30 outline-none transition-colors focus:border-[#D4FF4F]"
                />
              </div>

              {error && (
                <p className="rounded-lg bg-red-500/10 px-4 py-2.5 text-sm text-red-400">{error}</p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#D4FF4F] py-3.5 text-sm font-semibold text-black transition-colors hover:bg-[#c4ef3f] disabled:opacity-60"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {loading ? "Creating account…" : "Create account"}
              </button>

              <button
                type="button"
                onClick={() => { setStep(1); setError(""); }}
                className="w-full text-center text-xs text-white/30 hover:text-white/60 transition-colors"
              >
                ← Back
              </button>
            </form>
          </>
        )}

        <div className="mt-8 space-y-2 text-center text-sm">
          <p className="text-white/40">
            Already have an account?{" "}
            <Link href="/cloud/login" className="text-[#D4FF4F] hover:underline">
              Sign in →
            </Link>
          </p>
          <p className="text-xs text-white/25">
            Have a Segmiq agency account?{" "}
            <Link href="/login" className="hover:text-white/50 transition-colors">
              Sign in →
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
