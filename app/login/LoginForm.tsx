"use client";

import { Suspense, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { signIn, signOut, useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Mail, Lock, Eye, EyeOff, ArrowRight, Loader2, ShieldCheck, AlertCircle } from "lucide-react";
import { sanitizeCallbackPath } from "@/lib/auth/post-login-redirect";

function reasonBanner(reason: string | null): { message: string; tone: "warning" | "danger" } | null {
  if (reason === "session") {
    return { message: "Your session expired. Sign in again to continue.", tone: "warning" };
  }
  if (reason === "no_client") {
    return {
      message: "Your account is not linked to a client workspace. Ask your manager or Segmiq support to fix your user setup.",
      tone: "danger",
    };
  }
  return null;
}

function LoginFormInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { status } = useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const reason = searchParams.get("reason");
  const banner = reasonBanner(reason);
  const callbackUrl = searchParams.get("callbackUrl");

  useEffect(() => {
    if (status !== "authenticated") return;
    const qs = callbackUrl ? `?callbackUrl=${encodeURIComponent(callbackUrl)}` : "";
    void fetch(`/api/auth/home${qs}`)
      .then(async (res) => {
        if (res.status === 403) {
          await signOut({ redirect: false });
          router.replace("/login?reason=no_client");
          return;
        }
        if (!res.ok) return;
        const data = (await res.json()) as { home?: string };
        if (data.home) router.replace(data.home);
      })
      .catch(() => {});
  }, [status, callbackUrl, router]);

  async function resolveRedirectAfterSignIn() {
    const safeCallback = sanitizeCallbackPath(callbackUrl);
    const qs = safeCallback ? `?callbackUrl=${encodeURIComponent(safeCallback)}` : "";
    const res = await fetch(`/api/auth/home${qs}`);
    if (res.status === 403) {
      await signOut({ redirect: false });
      router.replace("/login?reason=no_client");
      return;
    }
    if (!res.ok) {
      setError("Signed in, but we could not open your workspace. Please try again.");
      return;
    }
    const data = (await res.json()) as { home?: string };
    router.push(data.home ?? "/sales/dashboard");
    router.refresh();
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await signIn("credentials", {
        redirect: false,
        email: email.trim(),
        password,
      });
      if (res?.error || !res?.ok) {
        setError("Invalid email or password. Check your details or use Forgot password.");
        return;
      }
      await resolveRedirectAfterSignIn();
    } catch {
      setError("Sign in failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (status === "loading" || status === "authenticated") {
    return (
      <div className="flex w-full max-w-[420px] items-center justify-center rounded-2xl border border-[var(--border)] bg-[var(--surface-card)] p-10 text-[var(--text-tertiary)]">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Opening workspace…
      </div>
    );
  }

  return (
    <div className="relative w-full max-w-[420px]">
      <div className="mb-8 flex flex-col items-center lg:items-start">
        <Link href="/" className="mb-6 inline-flex lg:hidden">
          <Image
            src="/segmiq-wordmark.png"
            alt="Segmiq"
            width={150}
            height={26}
            className="h-6 w-auto"
            priority
          />
        </Link>

        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--accent-fg)]">
          Segmiq CRM
        </p>
        <h1 className="mt-2 font-display text-[30px] leading-tight tracking-tight text-[var(--text-primary)] sm:text-[34px]">
          Welcome back
        </h1>
        <p className="mt-2 max-w-sm text-[14px] leading-relaxed text-[var(--text-secondary)]">
          Sign in to manage contacts, conversations, and your pipeline.
        </p>
      </div>

      <div className="login-form-card rounded-2xl border border-[var(--border)] bg-[var(--surface-card)] p-6 shadow-[var(--shadow-lg)] sm:p-8">
        {banner ? (
          <div
            className={`mb-5 flex items-start gap-2.5 rounded-xl border px-3.5 py-3 text-sm ${
              banner.tone === "warning"
                ? "border-[var(--warning-border)] bg-[var(--warning-muted)] text-[var(--warning)]"
                : "border-[var(--danger-border)] bg-[var(--danger-bg)] text-[var(--danger-fg)]"
            }`}
          >
            {banner.tone === "warning" ? (
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            ) : (
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            )}
            <span>{banner.message}</span>
          </div>
        ) : null}

        <form className="space-y-5" onSubmit={onSubmit}>
          <div>
            <label className="mb-2 block text-[13px] font-medium text-[var(--text-primary)]" htmlFor="email">
              Work email
            </label>
            <div className="relative">
              <Mail
                className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-tertiary)]"
                aria-hidden
              />
              <input
                id="email"
                type="email"
                inputMode="email"
                autoCapitalize="off"
                autoComplete="email"
                placeholder="you@company.com"
                required
                className="login-input h-12 w-full rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] pl-10 pr-4 text-[15px] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] transition-[border-color,box-shadow] focus:border-[var(--accent)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/20"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between gap-3">
              <label className="text-[13px] font-medium text-[var(--text-primary)]" htmlFor="password">
                Password
              </label>
              <Link
                href="/forgot-password"
                className="text-[12px] font-medium text-[var(--text-tertiary)] transition-colors hover:text-[var(--accent-fg)]"
              >
                Forgot password?
              </Link>
            </div>
            <div className="relative">
              <Lock
                className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-tertiary)]"
                aria-hidden
              />
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                placeholder="Enter your password"
                required
                className="login-input h-12 w-full rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] pl-10 pr-11 text-[15px] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] transition-[border-color,box-shadow] focus:border-[var(--accent)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/20"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                className="absolute right-2 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-lg text-[var(--text-tertiary)] transition-colors hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {error ? (
            <div className="rounded-xl border border-[var(--danger-border)] bg-[var(--danger-bg)] px-3.5 py-2.5 text-sm text-[var(--danger-fg)]">
              {error}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={loading}
            className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[var(--accent)] text-[14px] font-semibold text-[var(--accent-ink)] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Signing in…
              </>
            ) : (
              <>
                Continue to workspace
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
        </form>
      </div>

      <p className="mt-6 text-center text-[13px] leading-relaxed text-[var(--text-tertiary)] lg:text-left">
        Accounts are provisioned by Segmiq.{" "}
        <Link href="/contact" className="font-medium text-[var(--accent-fg)] hover:underline">
          Need access?
        </Link>
      </p>

      <div className="mt-5 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-[12px] text-[var(--text-tertiary)] lg:justify-start">
        <Link href="/legal/privacy" className="transition-colors hover:text-[var(--text-primary)]">
          Privacy
        </Link>
        <Link href="/legal/terms" className="transition-colors hover:text-[var(--text-primary)]">
          Terms
        </Link>
        <Link href="/" className="transition-colors hover:text-[var(--text-primary)]">
          Back to segmiq.com
        </Link>
      </div>
    </div>
  );
}

export function LoginForm() {
  return (
    <Suspense
      fallback={
        <div className="w-full max-w-[420px] rounded-2xl border border-[var(--border)] bg-[var(--surface-card)] p-8 text-center text-[var(--text-tertiary)]">
          Loading…
        </div>
      }
    >
      <LoginFormInner />
    </Suspense>
  );
}
