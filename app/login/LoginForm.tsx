"use client";

import { Suspense, useState } from "react";
import Image from "next/image";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Mail, Lock, Eye, EyeOff, ArrowRight, Loader2 } from "lucide-react";

function LoginFormInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await signIn("credentials", {
        redirect: false,
        email,
        password,
      });
      if (res?.error || !res?.ok) {
        setError("Invalid email or password.");
        return;
      }
      const dest = searchParams.get("callbackUrl");
      if (dest) {
        router.push(dest);
        router.refresh();
        return;
      }
      router.push("/");
      router.refresh();
    } catch {
      setError("Sign in failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-[400px]">
      {/* Mobile-only brand (desktop brand lives in the side panel) */}
      <div className="mb-8 flex justify-center lg:hidden">
        <div className="rounded-lg bg-[#0a0a0a] px-4 py-2">
          <Image
            src="/segmiq-wordmark.png"
            alt="Segmiq"
            width={150}
            height={26}
            className="h-6 w-auto"
            priority
          />
        </div>
      </div>

      <div className="rounded-[var(--radius-xl)] border border-border bg-surface-card p-6 shadow-[var(--shadow-lg)] sm:p-8">
        <div>
          <h1 className="font-display text-[28px] leading-tight tracking-tight text-ink-primary sm:text-[32px]">
            Welcome back
          </h1>
          <p className="mt-1.5 text-sm text-ink-secondary">Sign in to your Segmiq account.</p>
        </div>

        <form className="mt-7 space-y-4" onSubmit={onSubmit}>
          <div>
            <label className="font-mono text-[11px] uppercase tracking-wide text-ink-secondary" htmlFor="email">
              Email
            </label>
            <div className="relative mt-2">
              <Mail
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-tertiary"
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
                className="input-base h-11 pl-10 text-base"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="font-mono text-[11px] uppercase tracking-wide text-ink-secondary" htmlFor="password">
              Password
            </label>
            <div className="relative mt-2">
              <Lock
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-tertiary"
                aria-hidden
              />
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                placeholder="••••••••"
                required
                className="input-base h-11 pl-10 pr-10 text-base"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                className="absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-[var(--radius-md)] text-ink-tertiary transition-colors hover:text-ink-primary"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <div className="mt-2 text-right">
              <Link href="/forgot-password" className="text-xs text-ink-tertiary hover:text-ink-primary">
                Forgot password?
              </Link>
            </div>
          </div>

          {error ? (
            <div className="rounded-[var(--radius-md)] border border-[var(--danger-border)] bg-[var(--danger-bg)] px-3 py-2 text-sm text-[var(--danger-fg)]">
              {error}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={loading}
            className="btn-primary h-11 w-full text-[13px]"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Signing in…
              </>
            ) : (
              <>
                Sign in
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
        </form>
      </div>

      <p className="mt-6 text-center text-xs text-ink-tertiary">Accounts are created by your agency admin.</p>
      <div className="mt-3 flex justify-center gap-4 text-xs text-ink-tertiary">
        <a href="/legal/privacy" className="hover:text-ink-primary">Privacy Policy</a>
        <a href="/legal/terms" className="hover:text-ink-primary">Terms of Service</a>
      </div>
    </div>
  );
}

export function LoginForm() {
  return (
    <Suspense
      fallback={
        <div className="w-full max-w-[400px] rounded-[var(--radius-xl)] border border-border bg-surface-card p-8 text-center text-ink-tertiary">
          Loading…
        </div>
      }
    >
      <LoginFormInner />
    </Suspense>
  );
}
