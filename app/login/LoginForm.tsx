"use client";

import { Suspense, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

function LoginFormInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
    <div className="w-full max-w-[420px] rounded-xl border border-border bg-surface-card p-6 shadow-sm sm:p-10">
      <div className="text-center">
        <div className="flex items-center justify-center">
          <div className="rounded-lg bg-[#0a0a0a] px-4 py-2">
            <img src="/segmiq-wordmark.png" alt="Segmiq" className="h-7 w-auto" />
          </div>
        </div>
        <h1 className="mt-6 font-display text-[26px] leading-tight tracking-tight text-ink-primary sm:text-[32px]">
          Welcome back
        </h1>
        <p className="mt-2 text-sm text-ink-secondary">Sign in to your account.</p>
      </div>
      <form className="mt-8 space-y-5" onSubmit={onSubmit}>
        <div>
          <label className="font-mono text-[11px] uppercase tracking-wide text-ink-secondary" htmlFor="email">
            Email
          </label>
          <input
            id="email"
            type="email"
            inputMode="email"
            autoCapitalize="off"
            autoComplete="email"
            required
            className="input-base mt-2 text-base"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div>
          <label className="font-mono text-[11px] uppercase tracking-wide text-ink-secondary" htmlFor="password">
            Password
          </label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            className="input-base mt-2 text-base"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <div className="text-right -mt-2 mb-1">
          <Link href="/forgot-password" className="text-xs text-ink-tertiary hover:text-ink-primary">
            Forgot password?
          </Link>
        </div>
        {error ? <div className="text-sm text-[var(--danger)]">{error}</div> : null}
        <button type="submit" disabled={loading} className="btn-primary h-11 w-full sm:h-9">
          {loading ? "Signing in…" : "Sign in"}
        </button>
      </form>
      <p className="mt-8 text-center text-xs text-ink-tertiary">Accounts are created by your agency admin.</p>
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
        <div className="w-full max-w-[420px] rounded-xl border border-border bg-surface-card p-8 text-center text-ink-tertiary">
          Loading…
        </div>
      }
    >
      <LoginFormInner />
    </Suspense>
  );
}
