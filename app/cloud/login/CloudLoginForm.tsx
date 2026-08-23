"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { signIn, useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertCircle, Eye, EyeOff, Loader2 } from "lucide-react";

const inputClass =
  "auth-input h-12 w-full rounded-[9px] border border-[var(--marketing-border-strong)] bg-[var(--marketing-bg)] px-3.5 text-[15px] text-[var(--marketing-text)] placeholder:text-[var(--marketing-text-muted)] transition-[border-color,box-shadow] focus:border-[#A8D52C] focus:outline-none focus:ring-2 focus:ring-[rgba(212,255,79,0.14)] disabled:opacity-60";

function CloudLoginFormInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session, status } = useSession();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/cloud/dashboard";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (status === "loading") return;
    if (!session?.user) return;
    const target = callbackUrl.startsWith("/cloud") ? callbackUrl : "/cloud/dashboard";
    router.replace(target);
  }, [callbackUrl, router, session?.user, status]);

  if (session?.user) {
    return (
      <div className="flex w-full items-center justify-center py-16 text-[var(--marketing-text-muted)]">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
        Opening workspace…
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const res = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });
    setLoading(false);
    if (res?.error) {
      setError("Email or password is incorrect.");
    } else {
      router.push(callbackUrl.startsWith("/cloud") ? callbackUrl : "/cloud/dashboard");
    }
  }

  return (
    <div className="w-full">
      <h1
        className="text-[28px] font-semibold tracking-[-0.03em] text-[var(--marketing-text-heading)] sm:text-[30px]"
        style={{ fontWeight: 650 }}
      >
        Welcome back
      </h1>
      <p className="mt-2 text-[14px] leading-relaxed text-[var(--marketing-text-secondary)]">
        Sign in to your SegmiQ Cloud account.
      </p>

      <form className="mt-8 space-y-[18px]" onSubmit={handleSubmit}>
        <div>
          <label
            className="mb-1.5 block text-[13px] font-medium text-[var(--marketing-text-label)]"
            htmlFor="cloud-email"
          >
            Email address
          </label>
          <input
            id="cloud-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
            disabled={loading}
            placeholder="you@company.com"
            className={inputClass}
          />
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between gap-3">
            <label
              className="text-[13px] font-medium text-[var(--marketing-text-label)]"
              htmlFor="cloud-password"
            >
              Password
            </label>
            <Link
              href="/cloud/forgot-password"
              className="text-[12px] font-semibold text-[var(--marketing-link)] hover:text-[var(--marketing-link-hover)]"
            >
              Forgot password?
            </Link>
          </div>
          <div className="relative">
            <input
              id="cloud-password"
              type={showPw ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
              disabled={loading}
              placeholder="Enter your password"
              className={`${inputClass} pr-12`}
            />
            <button
              type="button"
              onClick={() => setShowPw((v) => !v)}
              className="absolute right-1.5 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-lg text-[var(--marketing-text-muted)] hover:text-[var(--marketing-text)]"
              aria-label={showPw ? "Hide password" : "Show password"}
            >
              {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
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
          className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-[9px] bg-[var(--marketing-brand)] text-[14px] font-semibold text-[var(--marketing-brand-ink)] transition-colors hover:bg-[var(--marketing-brand-hover)] disabled:cursor-not-allowed disabled:opacity-60"
          style={{ fontWeight: 650 }}
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              Signing in…
            </>
          ) : (
            "Sign in"
          )}
        </button>
      </form>

      <p className="mt-6 text-[13px] text-[var(--marketing-text-secondary)]">
        New to SegmiQ Cloud?{" "}
        <Link
          href="/cloud/signup"
          className="font-semibold text-[var(--marketing-link)] hover:text-[var(--marketing-link-hover)]"
        >
          Create account
        </Link>
      </p>
    </div>
  );
}

export default function CloudLoginForm() {
  return (
    <Suspense
      fallback={
        <div className="flex w-full items-center justify-center py-16 text-[var(--marketing-text-muted)]">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
          Loading…
        </div>
      }
    >
      <CloudLoginFormInner />
    </Suspense>
  );
}
