"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { signIn, signOut, useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff, Loader2, AlertCircle, ShieldCheck } from "lucide-react";
import { sanitizeCallbackPath } from "@/lib/auth/post-login-redirect";
import SegmiQPreloader, {
  type SegmiQPreloaderState,
} from "@/components/loading/SegmiQPreloader";

function reasonBanner(reason: string | null): { message: string; tone: "warning" | "danger" } | null {
  if (reason === "session") {
    return { message: "Your session expired. Sign in again to continue.", tone: "warning" };
  }
  if (reason === "no_client") {
    return {
      message:
        "Your account is not linked to a client workspace. Ask your manager or Segmiq support to fix your user setup.",
      tone: "danger",
    };
  }
  return null;
}

const inputClass =
  "auth-input h-12 w-full rounded-[9px] border border-[var(--marketing-border-strong)] bg-[var(--marketing-bg)] px-3.5 text-[15px] text-[var(--marketing-text)] placeholder:text-[var(--marketing-text-muted)] transition-[border-color,box-shadow] focus:border-[#A8D52C] focus:outline-none focus:ring-2 focus:ring-[rgba(212,255,79,0.14)] disabled:opacity-60";

function LoginFormInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { status } = useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [workspaceState, setWorkspaceState] = useState<SegmiQPreloaderState | "idle">("idle");
  const resolvingWorkspace = useRef(false);

  const reason = searchParams.get("reason");
  const banner = reasonBanner(reason);
  const callbackUrl = searchParams.get("callbackUrl");

  const resolveWorkspace = useCallback(async () => {
    if (resolvingWorkspace.current) return;
    resolvingWorkspace.current = true;
    setWorkspaceState("loading");
    setError(null);

    const safeCallback = sanitizeCallbackPath(callbackUrl);
    const qs = safeCallback ? `?callbackUrl=${encodeURIComponent(safeCallback)}` : "";
    try {
      const res = await fetch(`/api/auth/home${qs}`, { cache: "no-store" });
      if (res.status === 403) {
        await signOut({ redirect: false });
        resolvingWorkspace.current = false;
        window.location.replace("/login?reason=no_client");
        return;
      }
      if (res.status === 401) {
        await signOut({ redirect: false });
        resolvingWorkspace.current = false;
        window.location.replace("/login?reason=session");
        return;
      }
      if (!res.ok) throw new Error("Workspace resolution failed");

      const data = (await res.json()) as { home?: string };
      if (!data.home) throw new Error("Workspace route missing");

      // A document navigation keeps the real workspace preloader visible while
      // middleware and the destination Server Component finish their auth/scope gates.
      window.location.assign(data.home);
    } catch {
      resolvingWorkspace.current = false;
      setWorkspaceState(navigator.onLine ? "error" : "offline");
    }
  }, [callbackUrl]);

  useEffect(() => {
    if (status === "authenticated") void resolveWorkspace();
  }, [resolveWorkspace, status]);

  async function retryWorkspace() {
    resolvingWorkspace.current = false;
    await resolveWorkspace();
  }

  async function leaveWorkspace() {
    resolvingWorkspace.current = false;
    await signOut({ redirect: false });
    setWorkspaceState("idle");
    setLoading(false);
    router.replace("/login");
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
        setError("Email or password is incorrect.");
        return;
      }
      await resolveWorkspace();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <SegmiQPreloader
        active={status === "loading" || status === "authenticated" || workspaceState !== "idle"}
        state={workspaceState === "idle" ? "loading" : workspaceState}
        onRetry={retryWorkspace}
        onSignOut={leaveWorkspace}
      />

      <div
        className={`w-full ${
          status !== "unauthenticated" || workspaceState !== "idle"
            ? "pointer-events-none invisible"
            : ""
        }`}
        aria-hidden={status !== "unauthenticated" || workspaceState !== "idle"}
      >
      <div>
        <h1
          className="text-[28px] font-semibold leading-tight tracking-[-0.03em] text-[var(--marketing-text-heading)] sm:text-[30px]"
          style={{ fontWeight: 650 }}
        >
          Welcome back
        </h1>
        <p className="mt-2 text-[14px] leading-relaxed text-[var(--marketing-text-secondary)]">
          Sign in to your SegmiQ account.
        </p>
      </div>

      {banner ? (
        <div
          role="status"
          className={`mt-7 flex items-start gap-2.5 rounded-[9px] border px-3.5 py-3 text-[13px] ${
            banner.tone === "warning"
              ? "border-[rgba(245,158,11,0.35)] bg-[rgba(245,158,11,0.08)] text-[var(--marketing-text)]"
              : "border-[rgba(239,68,68,0.35)] bg-[#FEF2F2] text-[#991B1B] dark:bg-[rgba(127,29,29,0.35)] dark:text-[#FECACA]"
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

      <form className="mt-6 space-y-4" onSubmit={onSubmit} noValidate>
        <div>
          <label
            className="mb-1.5 block text-[13px] font-medium text-[var(--marketing-text-label)]"
            htmlFor="email"
          >
            Email address
          </label>
          <input
            id="email"
            type="email"
            inputMode="email"
            autoCapitalize="off"
            autoComplete="email"
            placeholder="you@company.com"
            required
            disabled={loading}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? "login-error" : undefined}
            className={inputClass}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between gap-3">
            <label
              className="text-[13px] font-medium text-[var(--marketing-text-label)]"
              htmlFor="password"
            >
              Password
            </label>
            <Link
              href="/forgot-password"
              className="text-[12px] font-semibold text-[var(--marketing-link)] transition-colors hover:text-[var(--marketing-link-hover)]"
            >
              Forgot password?
            </Link>
          </div>
          <div className="relative">
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              placeholder="Enter your password"
              required
              disabled={loading}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? "login-error" : undefined}
              className={`${inputClass} pr-12`}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              className="absolute right-1.5 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-lg text-[var(--marketing-text-muted)] transition-colors hover:text-[var(--marketing-text)]"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {error ? (
          <div
            id="login-error"
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
          className="mt-1 inline-flex h-12 w-full items-center justify-center gap-2 rounded-[9px] bg-[var(--marketing-brand)] text-[14px] font-semibold text-[var(--marketing-brand-ink)] transition-colors hover:bg-[var(--marketing-brand-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--marketing-brand)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--marketing-surface)] disabled:cursor-not-allowed disabled:opacity-60"
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

      <p className="mt-6 text-[13px] leading-relaxed text-[var(--marketing-text-secondary)]">
        Accounts are provisioned by SegmiQ.{" "}
        <Link
          href="/contact"
          className="font-semibold text-[var(--marketing-link)] hover:text-[var(--marketing-link-hover)]"
        >
          Need access?
        </Link>
      </p>
      </div>
    </>
  );
}

export function LoginForm() {
  return (
    <Suspense fallback={<SegmiQPreloader />}>
      <LoginFormInner />
    </Suspense>
  );
}
