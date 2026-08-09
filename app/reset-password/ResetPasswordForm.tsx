"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertCircle, CheckCircle2, Eye, EyeOff, Loader2, Link2Off } from "lucide-react";

const inputClass =
  "auth-input h-12 w-full rounded-[9px] border border-[var(--marketing-border-strong)] bg-[var(--marketing-bg)] px-3.5 text-[15px] text-[var(--marketing-text)] placeholder:text-[var(--marketing-text-muted)] transition-[border-color,box-shadow] focus:border-[#A8D52C] focus:outline-none focus:ring-2 focus:ring-[rgba(212,255,79,0.14)] disabled:opacity-60";

function ResetPasswordInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token");

  const [validating, setValidating] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);
  const [tokenError, setTokenError] = useState("");
  const [userName, setUserName] = useState("");

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!token) {
      setTokenError("No reset token found. Please request a new reset link.");
      setValidating(false);
      return;
    }

    fetch(`/api/auth/validate-reset-token?token=${token}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.valid) {
          setTokenValid(true);
          setUserName(data.userName || "");
        } else {
          setTokenError(
            data.error === "Token expired"
              ? "This reset link has expired. Please request a new one."
              : data.error === "Token already used"
                ? "This reset link has already been used. Please request a new one."
                : "This reset link is invalid. Please request a new one."
          );
        }
        setValidating(false);
      })
      .catch(() => {
        setTokenError("Could not validate your reset link. Please try again.");
        setValidating(false);
      });
  }, [token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setSuccess(true);
        setTimeout(() => router.push("/login"), 3000);
      } else {
        setError(data.error || "Failed to reset password. Please try again.");
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (validating) {
    return (
      <div className="flex w-full items-center justify-center py-16 text-[var(--marketing-text-muted)]">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
        Validating your reset link…
      </div>
    );
  }

  if (!tokenValid) {
    return (
      <div className="w-full">
        <div className="mb-6 inline-flex h-12 w-12 items-center justify-center rounded-full bg-[rgba(239,68,68,0.12)] text-[#EF4444]">
          <Link2Off className="h-5 w-5" aria-hidden />
        </div>
        <h1
          className="text-[28px] font-semibold tracking-[-0.03em] text-[var(--marketing-text-heading)]"
          style={{ fontWeight: 650 }}
        >
          Link invalid
        </h1>
        <p className="mt-3 text-[14px] leading-relaxed text-[var(--marketing-text-secondary)]">
          {tokenError}
        </p>
        <Link
          href="/forgot-password"
          className="mt-8 inline-flex h-12 items-center justify-center rounded-[9px] bg-[var(--marketing-brand)] px-6 text-[14px] font-semibold text-[var(--marketing-brand-ink)] hover:bg-[var(--marketing-brand-hover)]"
          style={{ fontWeight: 650 }}
        >
          Request new link
        </Link>
      </div>
    );
  }

  if (success) {
    return (
      <div className="w-full">
        <div className="mb-6 inline-flex h-12 w-12 items-center justify-center rounded-full bg-[rgba(212,255,79,0.14)] text-[var(--marketing-olive)]">
          <CheckCircle2 className="h-5 w-5" aria-hidden />
        </div>
        <h1
          className="text-[28px] font-semibold tracking-[-0.03em] text-[var(--marketing-text-heading)]"
          style={{ fontWeight: 650 }}
        >
          Password reset
        </h1>
        <p className="mt-3 text-[14px] leading-relaxed text-[var(--marketing-text-secondary)]">
          Your password has been updated. Redirecting you to sign in…
        </p>
      </div>
    );
  }

  const firstName = userName.split(" ")[0];
  const lengthOk = password.length >= 8;
  const matchOk = confirm.length > 0 && password === confirm;

  return (
    <div className="w-full">
      <h1
        className="text-[28px] font-semibold tracking-[-0.03em] text-[var(--marketing-text-heading)] sm:text-[30px]"
        style={{ fontWeight: 650 }}
      >
        {firstName ? `New password, ${firstName}` : "Set new password"}
      </h1>
      <p className="mt-2 text-[14px] leading-relaxed text-[var(--marketing-text-secondary)]">
        Choose a strong password. Minimum 8 characters.
      </p>

      <form className="mt-8 space-y-[18px]" onSubmit={handleSubmit}>
        <div>
          <label
            className="mb-1.5 block text-[13px] font-medium text-[var(--marketing-text-label)]"
            htmlFor="new-password"
          >
            New password
          </label>
          <div className="relative">
            <input
              id="new-password"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              placeholder="Minimum 8 characters"
              required
              disabled={loading}
              className={`${inputClass} pr-12`}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              className="absolute right-1.5 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-lg text-[var(--marketing-text-muted)] hover:text-[var(--marketing-text)]"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
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
          <label
            className="mb-1.5 block text-[13px] font-medium text-[var(--marketing-text-label)]"
            htmlFor="confirm-password"
          >
            Confirm password
          </label>
          <input
            id="confirm-password"
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            placeholder="Repeat your new password"
            required
            disabled={loading}
            aria-invalid={confirm.length > 0 && !matchOk ? true : undefined}
            className={`${inputClass}${
              confirm.length > 0 && !matchOk ? " border-[#EF4444]" : ""
            }`}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
          {confirm.length > 0 && !matchOk ? (
            <p className="mt-1.5 text-[12px] text-[#DC2626]">Passwords do not match</p>
          ) : null}
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
          disabled={loading || !lengthOk || !matchOk}
          className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-[9px] bg-[var(--marketing-brand)] text-[14px] font-semibold text-[var(--marketing-brand-ink)] transition-colors hover:bg-[var(--marketing-brand-hover)] disabled:cursor-not-allowed disabled:opacity-60"
          style={{ fontWeight: 650 }}
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              Updating…
            </>
          ) : (
            "Reset password"
          )}
        </button>
      </form>
    </div>
  );
}

export default function ResetPasswordForm() {
  return (
    <Suspense
      fallback={
        <div className="flex w-full items-center justify-center py-16 text-[var(--marketing-text-muted)]">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
          Loading…
        </div>
      }
    >
      <ResetPasswordInner />
    </Suspense>
  );
}
