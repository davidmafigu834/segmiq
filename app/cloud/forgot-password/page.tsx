"use client";

import { useState } from "react";
import Link from "next/link";
import { CloudUpload, Loader2, CheckCircle2 } from "lucide-react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await fetch("/api/cloud/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      setSent(true);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
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
        {sent ? (
          <div className="text-center">
            <div className="mb-4 flex justify-center">
              <CheckCircle2 className="h-12 w-12 text-[#D4FF4F]" strokeWidth={1.5} />
            </div>
            <h1 className="mb-2 text-[22px] font-semibold text-white">Check your email</h1>
            <p className="mb-2 text-[13px] text-white/50">
              We sent a reset link to <span className="text-white">{email}</span>. It expires in 1 hour.
            </p>
            <p className="mb-8 text-[12px] text-white/30">
              Didn&apos;t receive it? Check your spam folder or{" "}
              <button
                onClick={() => { setSent(false); setEmail(""); }}
                className="text-white/50 underline hover:text-white transition-colors"
              >
                try again
              </button>
              .
            </p>
            <Link
              href="/cloud/login"
              className="text-[13px] text-[#D4FF4F] hover:underline"
            >
              ← Back to sign in
            </Link>
          </div>
        ) : (
          <>
            <h1 className="mb-2 text-[22px] font-semibold text-white">Forgot your password?</h1>
            <p className="mb-8 text-[13px] text-white/50">
              Enter your email and we&apos;ll send you a reset link.
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
                  placeholder="you@company.com"
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
                {loading ? "Sending…" : "Send reset link"}
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
