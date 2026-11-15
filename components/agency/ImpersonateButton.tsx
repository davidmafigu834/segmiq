"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2 } from "lucide-react";
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
  variant?: "button" | "link" | "row";
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
    variant === "row"
      ? "inline-flex h-9 items-center rounded-[8px] bg-[var(--text-primary)] px-3 text-[13px] font-semibold text-[var(--bg-primary)] disabled:opacity-60"
      : variant === "link"
        ? "inline-flex h-9 items-center text-[13px] font-semibold text-[var(--text-primary)] underline decoration-[var(--border)] underline-offset-4 disabled:opacity-60"
        : "inline-flex h-9 items-center rounded-[8px] border border-[var(--border)] px-3 text-[13px] font-semibold text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] disabled:opacity-60";

  return (
    <span className="inline-flex flex-col items-end gap-1">
      <button type="button" onClick={() => void handleClick()} disabled={loading} className={className}>
        {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
        {label}
      </button>
      {error ? (
        <span className="max-w-[240px] text-right text-[10px] text-[var(--error)]">{error}</span>
      ) : null}
    </span>
  );
}
