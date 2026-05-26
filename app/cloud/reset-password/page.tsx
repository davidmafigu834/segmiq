"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { CloudUpload, Eye, EyeOff, Loader2, CheckCircle2, XCircle } from "lucide-react";

function passwordStrength(pw: string): { label: string; color: string; pct: number } {
  if (pw.length === 0) return { label: "", color: "", pct: 0 };
  let score = 0;
  if (pw.length >= 8) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  if (score <= 1) return { label: "Weak", color: "bg-red-500", pct: 33 };
  if (score <= 2) return { label: "Medium", color: "bg-yellow-400", pct: 66 };
  return { label: "Strong", color: "bg-[#D4FF4F]", pct: 100 };
}

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token") ?? "";

  const [validating, setValidating] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);
  const [tokenError, setTokenError] = useState("");

  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const strength = passwordStrength(newPw);

  useEffect(() => {
    if (!token) {
      setValidating(false);
      setTokenError("No reset token found. Please request a new reset link.");
      return;
    }
    fetch(`/api/cloud/auth/validate-reset-token?token=${encodeURIComponent(token)}`)
      .then((r) => r.json())
      .then((data: { valid: boolean; error?: string }) => {
        setTokenValid(data.valid);
        if (!data.valid) setTokenError(data.error ?? "Invalid or expired reset link");
      })
      .catch(() => setTokenError("Could not validate reset link"))
      .finally(() => setValidating(false));
  }, [token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (newPw.length < 8) { setError("Password must be at least 8 characters."); return; }
    if (newPw !== confirmPw) { setError("Passwords do not match."); return; }
    setLoading(true);
    setError("");
    const res = await fetch("/api/cloud/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password: newPw }),
    });
    const data = await res.json() as { success?: boolean; error?: string };
    setLoading(false);
    if (!res.ok || !data.success) {
      setError(data.error ?? "Failed to reset password.");
      return;
    }
    setDone(true);
    setTimeout(() => router.push("/cloud/login"), 3000);
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#0a0a0a] px-6 py-12">
      <div className="mb-10 flex flex-col items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#D4FF4F]">
          <CloudUpload className="h-5 w-5 text-black" strokeWidth={2.5} />
        </div>
        <span className="text-sm font-semibold text-white">Segmiq Cloud</span>
      </div>

      <div className="w-full max-w-sm">
        {validating ? (
          <div className="flex flex-col items-center gap-3 py-12">
            <Loader2 className="h-6 w-6 animate-spin text-white/40" />
            <p className="text-[13px] text-white/40">Validating reset link…</p>
          </div>
        ) : !tokenValid ? (
          <div className="text-center">
            <div className="mb-4 flex justify-center">
              <XCircle className="h-12 w-12 text-red-400" strokeWidth={1.5} />
            </div>
            <h1 className="mb-2 text-[22px] font-semibold text-white">Invalid reset link</h1>
            <p className="mb-8 text-[13px] text-white/50">{tokenError}</p>
            <Link
              href="/cloud/forgot-password"
              className="rounded-xl bg-[#D4FF4F] px-6 py-3 text-sm font-semibold text-black hover:bg-[#c4ef3f] transition-colors"
            >
              Request a new reset link
            </Link>
            <div className="mt-6">
              <Link href="/cloud/login" className="text-[13px] text-white/40 hover:text-white transition-colors">
                ← Back to sign in
              </Link>
            </div>
          </div>
        ) : done ? (
          <div className="text-center">
            <div className="mb-4 flex justify-center">
              <CheckCircle2 className="h-12 w-12 text-[#D4FF4F]" strokeWidth={1.5} />
            </div>
            <h1 className="mb-2 text-[22px] font-semibold text-white">Password updated</h1>
            <p className="mb-6 text-[13px] text-white/50">
              Your password has been changed. Redirecting to sign in…
            </p>
            <Link
              href="/cloud/login"
              className="rounded-xl bg-[#D4FF4F] px-6 py-3 text-sm font-semibold text-black hover:bg-[#c4ef3f] transition-colors"
            >
              Sign in →
            </Link>
          </div>
        ) : (
          <>
            <h1 className="mb-2 text-[22px] font-semibold text-white">Choose a new password</h1>
            <p className="mb-8 text-[13px] text-white/50">Must be at least 8 characters.</p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-white/60">New password</label>
                <div className="relative">
                  <input
                    type={showPw ? "text" : "password"}
                    value={newPw}
                    onChange={(e) => setNewPw(e.target.value)}
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
                {newPw.length > 0 && (
                  <div className="mt-2">
                    <div className="h-1 w-full overflow-hidden rounded-full bg-white/10">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${strength.color}`}
                        style={{ width: `${strength.pct}%` }}
                      />
                    </div>
                    <p className="mt-1 text-[10px] text-white/40">{strength.label}</p>
                  </div>
                )}
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-white/60">Confirm new password</label>
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
                {loading ? "Updating…" : "Reset password"}
              </button>
            </form>

            <div className="mt-6 text-center">
              <Link href="/cloud/login" className="text-[13px] text-white/40 hover:text-white transition-colors">
                ← Back to sign in
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0a0a0a]" />}>
      <ResetPasswordForm />
    </Suspense>
  );
}
