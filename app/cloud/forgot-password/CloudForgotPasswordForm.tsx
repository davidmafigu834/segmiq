"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertCircle, Loader2, Mail } from "lucide-react";

const inputClass =
  "auth-input h-12 w-full rounded-[9px] border border-[var(--marketing-border-strong)] bg-[var(--marketing-bg)] px-3.5 text-[15px] text-[var(--marketing-text)] placeholder:text-[var(--marketing-text-muted)] transition-[border-color,box-shadow] focus:border-[#A8D52C] focus:outline-none focus:ring-2 focus:ring-[rgba(212,255,79,0.14)] disabled:opacity-60";

export default function CloudForgotPasswordForm() {
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

  if (sent) {
    return (
      <div className="w-full">
        <div className="mb-6 inline-flex h-12 w-12 items-center justify-center rounded-full bg-[rgba(212,255,79,0.14)] text-[var(--marketing-olive)]">
          <Mail className="h-5 w-5" aria-hidden />
        </div>
        <h1
          className="text-[28px] font-semibold tracking-[-0.03em] text-[var(--marketing-text-heading)]"
          style={{ fontWeight: 650 }}
        >
          Check your email
        </h1>
        <p className="mt-3 text-[14px] leading-relaxed text-[var(--marketing-text-secondary)]">
          If an account exists for that email, you&apos;ll receive password reset instructions.
        </p>
        <Link
          href="/cloud/login"
          className="mt-8 inline-flex text-[13px] font-semibold text-[var(--marketing-link)] hover:text-[var(--marketing-link-hover)]"
        >
          ← Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="w-full">
      <h1
        className="text-[28px] font-semibold tracking-[-0.03em] text-[var(--marketing-text-heading)]"
        style={{ fontWeight: 650 }}
      >
        Reset your password
      </h1>
      <p className="mt-2 text-[14px] text-[var(--marketing-text-secondary)]">
        Enter your email and we&apos;ll send you instructions to reset your password.
      </p>

      <form className="mt-8 space-y-[18px]" onSubmit={handleSubmit}>
        <div>
          <label
            className="mb-1.5 block text-[13px] font-medium text-[var(--marketing-text-label)]"
            htmlFor="cloud-forgot-email"
          >
            Email address
          </label>
          <input
            id="cloud-forgot-email"
            type="email"
            autoComplete="email"
            required
            disabled={loading}
            placeholder="you@company.com"
            className={inputClass}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
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
          disabled={loading || !email.trim()}
          className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-[9px] bg-[var(--marketing-brand)] text-[14px] font-semibold text-[var(--marketing-brand-ink)] hover:bg-[var(--marketing-brand-hover)] disabled:opacity-60"
          style={{ fontWeight: 650 }}
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              Sending…
            </>
          ) : (
            "Send reset link"
          )}
        </button>
      </form>

      <p className="mt-6 text-[13px]">
        <Link
          href="/cloud/login"
          className="font-semibold text-[var(--marketing-link)] hover:text-[var(--marketing-link-hover)]"
        >
          ← Back to sign in
        </Link>
      </p>
    </div>
  );
}
