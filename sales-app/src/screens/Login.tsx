import { useState, type FormEvent } from "react";
import { Loader2, Phone, Eye, EyeOff } from "lucide-react";
import { login } from "../lib/auth";
import { CrmButton } from "../components/crm";

type Props = {
  onSuccess: () => void;
  expiredMessage?: string;
};

export function Login({ onSuccess, expiredMessage }: Props) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await login(email, password);
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign in failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-full flex-col bg-bg-primary px-6 py-12 safe-top safe-bottom">
      <div className="mb-10 flex flex-col items-center gap-3 pt-8">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent">
          <Phone className="h-6 w-6 text-accent-ink" strokeWidth={2.5} />
        </div>
        <span className="font-display text-xl text-ink-primary">Segmiq Sales</span>
      </div>

      <div className="mx-auto w-full max-w-sm flex-1">
        <h1 className="mb-2 font-display text-3xl text-ink-primary">Welcome back</h1>
        <p className="mb-8 text-[15px] text-ink-secondary">Sign in with your salesperson account</p>

        {expiredMessage ? (
          <div className="mb-4 rounded-xl border border-[var(--warning)]/30 bg-[var(--warning)]/10 px-4 py-3 text-sm text-[var(--warning)]">
            {expiredMessage}
          </div>
        ) : null}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-[13px] font-medium text-ink-secondary">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
              className="w-full rounded-lg border border-border bg-bg-secondary px-4 py-3.5 text-[16px] text-ink-primary outline-none focus:border-border-focus"
              placeholder="you@company.com"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-[13px] font-medium text-ink-secondary">Password</label>
            <div className="relative">
              <input
                type={showPw ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
                className="w-full rounded-lg border border-border bg-bg-secondary px-4 py-3.5 pr-12 text-[16px] text-ink-primary outline-none focus:border-border-focus"
              />
              <button
                type="button"
                onClick={() => setShowPw((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-tertiary"
              >
                {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {error ? (
            <p className="rounded-lg bg-[var(--error)]/10 px-4 py-2.5 text-sm text-[var(--error)]">{error}</p>
          ) : null}

          <CrmButton type="submit" disabled={loading} className="w-full">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {loading ? "Signing in…" : "Sign in"}
          </CrmButton>
        </form>
      </div>

      <p className="mt-8 text-center text-xs text-ink-tertiary">Call logs work offline once signed in</p>
    </div>
  );
}
