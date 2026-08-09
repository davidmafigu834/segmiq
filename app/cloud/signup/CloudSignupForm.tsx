"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { signIn, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { AlertCircle, CheckCircle2, ChevronRight, Eye, EyeOff, Loader2 } from "lucide-react";

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

const inputClass =
  "auth-input h-12 w-full rounded-[9px] border border-[var(--marketing-border-strong)] bg-[var(--marketing-bg)] px-3.5 text-[15px] text-[var(--marketing-text)] placeholder:text-[var(--marketing-text-muted)] transition-[border-color,box-shadow] focus:border-[#A8D52C] focus:outline-none focus:ring-2 focus:ring-[rgba(212,255,79,0.14)] disabled:opacity-60";

export default function CloudSignupForm() {
  const router = useRouter();
  const { data: session, status } = useSession();
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

  const lengthOk = password.length >= 8;
  const matchOk = confirmPw.length > 0 && password === confirmPw;

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
    if (err) {
      setError(err);
      return;
    }
    setError("");
    setStep(2);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPw) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/cloud/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, businessName, industry, phone, email, password }),
      });
      const data = (await res.json()) as { success?: boolean; error?: string; field?: string };
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

  useEffect(() => {
    if (status === "loading") return;
    if (session?.user) router.replace("/cloud/dashboard");
  }, [router, session?.user, status]);

  if (status === "loading" || session?.user) {
    return (
      <div className="flex w-full items-center justify-center py-16 text-[var(--marketing-text-muted)]">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
        Opening workspace…
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="mb-6">
        <div className="mb-2 flex items-center justify-between text-[12px] text-[var(--marketing-text-muted)]">
          <span>
            Step {step} of 2
          </span>
          <span>{step === 1 ? "About you" : "Your account"}</span>
        </div>
        <div className="h-1 w-full overflow-hidden rounded-full bg-[var(--marketing-border-subtle)]">
          <div
            className="h-full rounded-full bg-[var(--marketing-brand)] transition-all duration-300"
            style={{ width: step === 1 ? "50%" : "100%" }}
          />
        </div>
      </div>

      {step === 1 ? (
        <>
          <h1
            className="text-[28px] font-semibold tracking-[-0.03em] text-[var(--marketing-text-heading)]"
            style={{ fontWeight: 650 }}
          >
            About your business
          </h1>
          <p className="mt-2 text-[14px] text-[var(--marketing-text-secondary)]">
            Tell us a bit about you and your work.
          </p>

          <form className="mt-8 space-y-[18px]" onSubmit={handleNext}>
            <div>
              <label className="mb-1.5 block text-[13px] font-medium text-[var(--marketing-text-label)]">
                Your full name
              </label>
              <input
                type="text"
                name="name"
                autoComplete="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                placeholder="Jane Smith"
                className={inputClass}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-[13px] font-medium text-[var(--marketing-text-label)]">
                Business name
              </label>
              <input
                type="text"
                name="organization"
                autoComplete="organization"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                required
                placeholder="Smith Electrical Co."
                className={inputClass}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-[13px] font-medium text-[var(--marketing-text-label)]">
                Industry
              </label>
              <select
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
                required
                className={inputClass}
              >
                <option value="">Select your industry…</option>
                {INDUSTRIES.map((ind) => (
                  <option key={ind} value={ind}>
                    {ind}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-[13px] font-medium text-[var(--marketing-text-label)]">
                Phone number
              </label>
              <input
                type="tel"
                autoComplete="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
                placeholder="+263 77 000 0000"
                className={inputClass}
              />
            </div>

            {error ? (
              <div
                role="alert"
                className="flex items-start gap-2 rounded-[9px] border border-[rgba(239,68,68,0.35)] bg-[#FEF2F2] px-3.5 py-2.5 text-[13px] text-[#B91C1C] dark:bg-[rgba(127,29,29,0.35)] dark:text-[#FECACA]"
              >
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                <span>{error}</span>
              </div>
            ) : null}

            <button
              type="submit"
              className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-[9px] bg-[var(--marketing-brand)] text-[14px] font-semibold text-[var(--marketing-brand-ink)] hover:bg-[var(--marketing-brand-hover)]"
              style={{ fontWeight: 650 }}
            >
              Continue
              <ChevronRight className="h-4 w-4" aria-hidden />
            </button>
          </form>
        </>
      ) : (
        <>
          <h1
            className="text-[28px] font-semibold tracking-[-0.03em] text-[var(--marketing-text-heading)]"
            style={{ fontWeight: 650 }}
          >
            Create your account
          </h1>
          <p className="mt-2 text-[14px] text-[var(--marketing-text-secondary)]">
            Setting up <span className="font-medium text-[var(--marketing-text)]">{businessName}</span>
          </p>

          <form className="mt-8 space-y-[18px]" onSubmit={handleSubmit}>
            <div>
              <label className="mb-1.5 block text-[13px] font-medium text-[var(--marketing-text-label)]">
                Email address
              </label>
              <input
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@company.com"
                className={inputClass}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-[13px] font-medium text-[var(--marketing-text-label)]">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPw ? "text" : "password"}
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  placeholder="Minimum 8 characters"
                  className={`${inputClass} pr-12`}
                />
                <button
                  type="button"
                  onClick={() => setShowPw((v) => !v)}
                  aria-label={showPw ? "Hide password" : "Show password"}
                  className="absolute right-1.5 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-lg text-[var(--marketing-text-muted)] hover:text-[var(--marketing-text)]"
                >
                  {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {password.length > 0 ? (
                <p
                  className={`mt-2 flex items-center gap-1.5 text-[12px] ${
                    lengthOk ? "text-[var(--marketing-olive)]" : "text-[var(--marketing-text-muted)]"
                  }`}
                >
                  <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
                  At least 8 characters
                </p>
              ) : null}
            </div>
            <div>
              <label className="mb-1.5 block text-[13px] font-medium text-[var(--marketing-text-label)]">
                Confirm password
              </label>
              <input
                type={showPw ? "text" : "password"}
                autoComplete="new-password"
                value={confirmPw}
                onChange={(e) => setConfirmPw(e.target.value)}
                required
                placeholder="Repeat password"
                className={`${inputClass}${
                  confirmPw.length > 0 && !matchOk ? " border-[#EF4444]" : ""
                }`}
              />
            </div>

            {error ? (
              <div
                role="alert"
                className="flex items-start gap-2 rounded-[9px] border border-[rgba(239,68,68,0.35)] bg-[#FEF2F2] px-3.5 py-2.5 text-[13px] text-[#B91C1C] dark:bg-[rgba(127,29,29,0.35)] dark:text-[#FECACA]"
              >
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                <span>{error}</span>
              </div>
            ) : null}

            <button
              type="submit"
              disabled={loading}
              className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-[9px] bg-[var(--marketing-brand)] text-[14px] font-semibold text-[var(--marketing-brand-ink)] hover:bg-[var(--marketing-brand-hover)] disabled:opacity-60"
              style={{ fontWeight: 650 }}
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  Creating account…
                </>
              ) : (
                "Create account"
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                setStep(1);
                setError("");
              }}
              className="w-full text-center text-[12px] text-[var(--marketing-text-muted)] hover:text-[var(--marketing-text)]"
            >
              ← Back
            </button>
          </form>
        </>
      )}

      <p className="mt-6 text-[13px] text-[var(--marketing-text-secondary)]">
        Already have an account?{" "}
        <Link
          href="/cloud/login"
          className="font-semibold text-[var(--marketing-link)] hover:text-[var(--marketing-link-hover)]"
        >
          Sign in
        </Link>
      </p>
    </div>
  );
}
