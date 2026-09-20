"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2, UserRoundSearch } from "lucide-react";
import { DEFAULT_IMPERSONATION_REASON } from "@/lib/auth/impersonation";

/**
 * One-click support impersonation. SUPER_ADMIN + PLATFORM_IMPERSONATE is
 * enough — no Support Access grant, step-up, or reason prompt. Sessions stay
 * audited and the impersonation banner can exit at any time.
 */
export function ImpersonateButton({
  userId,
  userName,
  variant = "button",
}: {
  userId: string;
  userName: string;
  organisationId?: string;
  organisationName?: string;
  variant?: "button" | "link";
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleClick() {
    if (loading) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/agency/impersonate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, reason: DEFAULT_IMPERSONATION_REASON }),
      });
      const data = (await res.json()) as { redirectTo?: string; error?: string };
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Could not impersonate");
        return;
      }
      router.push(data.redirectTo ?? "/client/dashboard");
      router.refresh();
    } catch {
      setError("Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  const label = loading ? "Starting…" : `View as ${userName}`;
  const className =
    variant === "link"
      ? "inline-flex items-center gap-1.5 font-mono text-[11px] text-[var(--accent)] underline-offset-2 hover:underline disabled:opacity-60"
      : "inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1 font-mono text-[11px] text-ink-secondary transition-colors hover:bg-surface-card-alt disabled:opacity-60";

  return (
    <span className="inline-flex flex-col items-end gap-1">
      <button type="button" onClick={() => void handleClick()} disabled={loading} className={className}>
        {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <UserRoundSearch className="h-3 w-3" />}
        {label}
      </button>
      {error ? (
        <span className="max-w-[240px] text-right text-[10px] text-[var(--error)]">{error}</span>
      ) : null}
    </span>
  );
}
