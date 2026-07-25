"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Loader2 } from "lucide-react";
import { isCloudAdminRole } from "@/lib/auth/roles";

/** Redirects users without Cloud admin access away from settings, team, billing, etc. */
export function CloudAdminGate({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const allowed = isCloudAdminRole(session?.role);

  useEffect(() => {
    if (status === "loading") return;
    if (!allowed) router.replace("/cloud/dashboard");
  }, [allowed, router, status]);

  if (status === "loading") {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-5 w-5 animate-spin text-[var(--cloud-text-disabled)]" />
      </div>
    );
  }

  if (!allowed) return null;

  return <>{children}</>;
}
