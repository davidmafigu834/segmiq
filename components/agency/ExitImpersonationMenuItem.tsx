"use client";

import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useState } from "react";
import { Loader2, Undo2 } from "lucide-react";

export function useStopImpersonation() {
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

  return { stopping, stopImpersonating };
}

export function ExitImpersonationMenuItem({
  className,
  onSelect,
}: {
  className: string;
  onSelect?: () => void;
}) {
  const { data: session, status } = useSession();
  const { stopping, stopImpersonating } = useStopImpersonation();
  if (status !== "authenticated" || !session?.isImpersonating) return null;

  return (
    <button
      type="button"
      role="menuitem"
      className={className}
      disabled={stopping}
      onClick={() => {
        onSelect?.();
        void stopImpersonating();
      }}
    >
      {stopping ? (
        <Loader2 size={16} strokeWidth={1.8} className="animate-spin" aria-hidden />
      ) : (
        <Undo2 size={16} strokeWidth={1.8} aria-hidden />
      )}
      {stopping ? "Returning…" : "Exit impersonating"}
    </button>
  );
}
