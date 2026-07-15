"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2, ShieldAlert } from "lucide-react";
import { roleLabel } from "@/lib/auth/impersonation";
import type { UserRole } from "@/types";

export function ImpersonationBanner({
  userName,
  userRole,
  realUserName,
}: {
  userName: string;
  userRole: UserRole;
  realUserName?: string | null;
}) {
  const router = useRouter();
  const [stopping, setStopping] = useState(false);

  async function stopImpersonating() {
    if (stopping) return;
    setStopping(true);
    try {
      const res = await fetch("/api/agency/impersonate/stop", { method: "POST" });
      const data = (await res.json()) as { redirectTo?: string };
      router.push(data.redirectTo ?? "/dashboard");
      router.refresh();
    } catch {
      setStopping(false);
    }
  }

  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-md border border-amber-300/60 bg-amber-50 px-3 py-2 text-amber-950">
      <div className="flex items-start gap-2">
        <ShieldAlert className="mt-0.5 h-4 w-4 flex-shrink-0" />
        <p className="font-mono text-[11px] leading-relaxed">
          Impersonating <span className="font-semibold">{userName}</span> ({roleLabel(userRole)})
          {realUserName ? (
            <>
              {" "}
              as agency admin <span className="font-semibold">{realUserName}</span>
            </>
          ) : null}
          . You see exactly what this team member sees.
        </p>
      </div>
      <button
        type="button"
        onClick={() => void stopImpersonating()}
        disabled={stopping}
        className="inline-flex items-center gap-1.5 rounded-md border border-amber-400/70 bg-white px-2.5 py-1 font-mono text-[11px] font-semibold text-amber-950 hover:bg-amber-100 disabled:opacity-60"
      >
        {stopping ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
        {stopping ? "Returning…" : "Exit impersonation"}
      </button>
    </div>
  );
}
