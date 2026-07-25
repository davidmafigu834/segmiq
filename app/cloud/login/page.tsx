"use client";

import { Suspense, useEffect, useState } from "react";
import { signIn, useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Camera, CloudUpload, Eye, EyeOff, FolderOpen, Loader2, Share2 } from "lucide-react";

function LoginForm() {
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

  if (status === "loading" || session?.user) {
    return (
      <div className="cloud-auth flex min-h-[100dvh] items-center justify-center bg-[var(--cloud-bg)]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--cloud-border)] border-t-[var(--cloud-ink)]" />
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
      setError("Invalid email or password.");
    } else {
      router.push(callbackUrl.startsWith("/cloud") ? callbackUrl : "/cloud/dashboard");
    }
  }

  return (
    <div className="cloud-auth flex min-h-[100dvh] bg-[var(--cloud-bg)] font-cloud-body text-[var(--cloud-text-primary)]">
      {/* Brand panel */}
      <aside className="cloud-auth-brand relative hidden w-1/2 flex-col justify-between overflow-hidden px-10 py-10 lg:flex xl:px-14">
        <div className="cloud-auth-brand-glow" aria-hidden />
        <div className="cloud-auth-brand-grid" aria-hidden />

        <Link href="/cloud" className="relative z-10 flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-[12px] bg-[var(--cloud-ink)] shadow-[0_8px_24px_rgba(11,13,18,0.28)]">
            <CloudUpload className="h-[18px] w-[18px] text-[var(--cloud-accent)]" strokeWidth={2.4} />
          </span>
          <span className="text-[15px] font-semibold tracking-[-0.02em] text-white">
            SegmiQ Cloud
          </span>
        </Link>

        <div className="relative z-10 max-w-md">
          <p className="mb-4 text-[11px] font-bold uppercase tracking-[0.14em] text-white/45">
            Field documentation platform
          </p>
          <h1 className="font-cloud-display text-[clamp(36px,4vw,48px)] leading-[1.05] tracking-[-0.03em] text-white">
            Your projects.
            <br />
            <span className="text-[var(--cloud-accent)]">In the cloud.</span>
          </h1>
          <p className="mt-5 max-w-sm text-[15px] leading-relaxed text-white/60">
            Upload job photos from site, organize by project, and share polished galleries with clients in one link.
          </p>

          <ul className="mt-10 space-y-4">
            {[
              { Icon: Camera, label: "Upload from phone or desktop" },
              { Icon: FolderOpen, label: "Organized project workspaces" },
              { Icon: Share2, label: "Client-ready share links" },
            ].map(({ Icon, label }) => (
              <li key={label} className="flex items-center gap-3 text-[13px] font-medium text-white/75">
                <span className="flex h-9 w-9 items-center justify-center rounded-[10px] border border-white/10 bg-white/5">
                  <Icon className="h-4 w-4 text-[var(--cloud-accent)]" strokeWidth={1.9} />
                </span>
                {label}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative z-10 text-[12px] text-white/35">
          Secure workspace for construction & field teams
        </p>
      </aside>

      {/* Form panel */}
      <main className="relative flex min-h-[100dvh] w-full flex-1 flex-col lg:w-1/2 lg:flex-none">
        <div className="cloud-auth-form-bg absolute inset-0" aria-hidden />

        <div className="relative z-10 flex flex-1 flex-col px-5 py-6 sm:px-8 lg:px-12">
          {/* Mobile brand */}
          <div className="mb-8 flex items-center justify-between lg:mb-0 lg:justify-end">
            <Link href="/cloud" className="flex items-center gap-2.5 lg:hidden">
              <span className="flex h-9 w-9 items-center justify-center rounded-[11px] bg-[var(--cloud-ink)]">
                <CloudUpload className="h-4 w-4 text-[var(--cloud-accent)]" strokeWidth={2.4} />
              </span>
              <span className="text-[14px] font-semibold tracking-[-0.01em]">SegmiQ Cloud</span>
            </Link>
            <Link
              href="/cloud/signup"
              className="text-[13px] font-medium text-[var(--cloud-text-secondary)] transition-colors hover:text-[var(--cloud-text-primary)]"
            >
              Create account
            </Link>
          </div>

          <div className="flex w-full max-w-[400px] flex-1 flex-col justify-center py-6 text-left lg:py-10">
            <div className="cloud-auth-enter w-full text-left">
              <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--cloud-text-tertiary)] lg:hidden">
                Welcome back
              </p>
              <h2 className="font-cloud-display text-[clamp(28px,5vw,36px)] leading-[1.1] tracking-[-0.03em] text-[var(--cloud-text-primary)]">
                Sign in
              </h2>
              <p className="mt-2 text-[14px] text-[var(--cloud-text-secondary)]">
                Access your SegmiQ Cloud workspace
              </p>

              <form onSubmit={handleSubmit} className="mt-8 space-y-4">
                <div>
                  <label htmlFor="cloud-email" className="mb-1.5 block text-[12px] font-semibold text-[var(--cloud-text-secondary)]">
                    Email
                  </label>
                  <input
                    id="cloud-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                    required
                    autoFocus
                    placeholder="you@company.com"
                    className="cloud-auth-input"
                  />
                </div>

                <div>
                  <div className="mb-1.5 flex items-center justify-between gap-3">
                    <label htmlFor="cloud-password" className="text-[12px] font-semibold text-[var(--cloud-text-secondary)]">
                      Password
                    </label>
                    <Link
                      href="/cloud/forgot-password"
                      className="text-[12px] font-medium text-[var(--cloud-text-tertiary)] transition-colors hover:text-[var(--cloud-text-primary)]"
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
                      placeholder="Enter your password"
                      className="cloud-auth-input pr-12"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPw((v) => !v)}
                      className="absolute right-2 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-lg text-[var(--cloud-text-tertiary)] transition-colors hover:bg-[var(--cloud-surface-muted)] hover:text-[var(--cloud-text-primary)]"
                      aria-label={showPw ? "Hide password" : "Show password"}
                    >
                      {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {error ? (
                  <p className="rounded-[12px] border border-red-200 bg-red-50 px-4 py-3 text-[13px] font-medium text-red-600" role="alert">
                    {error}
                  </p>
                ) : null}

                <button
                  type="submit"
                  disabled={loading}
                  className="cloud-auth-submit"
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {loading ? "Signing in…" : "Sign in to workspace"}
                </button>
              </form>

              <div className="mt-8 space-y-3 border-t border-[var(--cloud-border)] pt-6">
                <p className="text-[13px] text-[var(--cloud-text-secondary)]">
                  New to SegmiQ Cloud?{" "}
                  <Link href="/cloud/signup" className="font-semibold text-[var(--cloud-text-primary)] underline-offset-2 hover:underline">
                    Start free
                  </Link>
                </p>
                <p className="text-[12px] text-[var(--cloud-text-tertiary)]">
                  Agency admin?{" "}
                  <Link href="/login" className="font-medium text-[var(--cloud-text-secondary)] transition-colors hover:text-[var(--cloud-text-primary)]">
                    Agency login
                  </Link>
                </p>
              </div>
            </div>
          </div>

          <p className="relative z-10 pb-[env(safe-area-inset-bottom,0px)] text-left text-[11px] text-[var(--cloud-text-tertiary)]">
            © {new Date().getFullYear()} SegmiQ · Protected by secure authentication
          </p>
        </div>
      </main>
    </div>
  );
}

export default function CloudLoginPage() {
  return (
    <Suspense
      fallback={
        <div className="cloud-auth flex min-h-[100dvh] items-center justify-center bg-[var(--cloud-bg)]">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--cloud-border)] border-t-[var(--cloud-ink)]" />
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
