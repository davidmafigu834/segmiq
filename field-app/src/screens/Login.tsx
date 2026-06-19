import { useState, type FormEvent } from "react";
import { CloudUpload, Eye, EyeOff, Loader2 } from "lucide-react";
import { login } from "../lib/auth";

type Props = {
  onSuccess: () => void;
};

export function Login({ onSuccess }: Props) {
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
    <div className="flex min-h-full flex-col items-center justify-center bg-login px-6 py-12">
      <div className="mb-10 flex flex-col items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-lime">
          <CloudUpload className="h-5 w-5 text-black" strokeWidth={2.5} />
        </div>
        <span className="font-fw-body text-sm font-semibold text-white">Segmiq Cloud</span>
      </div>

      <div className="w-full max-w-sm flex-1 flex flex-col justify-center">
        <h1 className="mb-2 font-fw-body text-2xl font-semibold text-white">Welcome back</h1>
        <p className="mb-8 font-fw-body text-sm text-white/50">Sign in to your account</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1.5 block font-fw-body text-xs font-medium text-white/60">
              Email address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
              placeholder="you@company.com"
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 font-fw-body text-sm text-white placeholder-white/30 outline-none transition-colors focus:border-lime focus:bg-white/[0.08]"
            />
          </div>

          <div>
            <label className="mb-1.5 block font-fw-body text-xs font-medium text-white/60">
              Password
            </label>
            <div className="relative">
              <input
                type={showPw ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
                placeholder="••••••••"
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 pr-12 font-fw-body text-sm text-white placeholder-white/30 outline-none transition-colors focus:border-lime"
              />
              <button
                type="button"
                onClick={() => setShowPw((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60"
              >
                {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {error && (
            <p className="rounded-lg bg-red-500/10 px-4 py-2.5 font-fw-body text-sm text-red-400">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-lime py-3.5 font-fw-body text-sm font-semibold text-black transition-colors hover:bg-lime-hover disabled:opacity-60"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>

      <p className="mt-8 text-center font-fw-body text-xs text-white/30">
        Works offline once you&apos;re signed in
      </p>
    </div>
  );
}
