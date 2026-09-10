"use client";

import { useSession } from "next-auth/react";
import Link from "next/link";

/**
 * Visible whenever a SUPER_ADMIN is viewing as another user.
 */
export function ImpersonationBanner() {
  const { data } = useSession();
  if (!data?.isImpersonating) return null;

  const who = data.user?.name || data.user?.email || "another user";
  const admin = data.realUserName || "SegmiQ admin";

  return (
    <div
      role="status"
      className="sticky top-0 z-[100] border-b border-amber-500/40 bg-amber-500/15 px-4 py-2 text-[13px] text-sales-text-primary backdrop-blur-sm"
    >
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2">
        <p>
          You are viewing SegmiQ as <strong>{who}</strong>
          {data.clientId ? " (customer workspace)" : ""}. Signed in as {admin}.
        </p>
        <Link
          href="/api/agency/impersonate/stop"
          className="rounded-md bg-sales-text-primary px-3 py-1 text-[12px] font-semibold text-sales-surface"
          onClick={async (e) => {
            e.preventDefault();
            await fetch("/api/agency/impersonate/stop", { method: "POST" });
            window.location.assign("/dashboard");
          }}
        >
          Exit impersonation
        </Link>
      </div>
    </div>
  );
}
