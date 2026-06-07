import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { Lock } from "lucide-react";
import { authOptions } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export default async function SalesBlockedPage() {
  const session = await getServerSession(authOptions);
  if (!session?.clientId) redirect("/login");
  if (session.role !== "SALESPERSON") redirect("/login");

  const supabase = createAdminClient();
  const { data: sub } = await supabase
    .from("subscriptions")
    .select("status")
    .eq("client_id", session.clientId)
    .eq("product", "crm")
    .limit(1)
    .maybeSingle();

  // Only suspended accounts see the lock screen.
  if ((sub as { status?: string } | null)?.status !== "suspended") redirect("/sales/dashboard");

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--bg-primary)] px-4">
      <div className="w-full max-w-md rounded-xl border border-[var(--border)] bg-[var(--surface-card)] p-8 text-center">
        <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-full border border-[var(--warning-border)] bg-[var(--warning-muted)]">
          <Lock className="h-5 w-5 text-[var(--warning)]" />
        </div>
        <h1 className="text-lg font-semibold text-[var(--text-primary)]">Account suspended</h1>
        <p className="mt-2 text-sm leading-relaxed text-[var(--text-secondary)]">
          Your workspace is temporarily unavailable. Please contact your manager to restore access.
        </p>
        <a
          href="/api/auth/signout?callbackUrl=/login"
          className="mt-6 inline-flex items-center justify-center rounded-md border border-[var(--border)] px-4 py-2 text-sm text-[var(--text-primary)] hover:bg-white/[0.03]"
        >
          Sign out
        </a>
      </div>
    </div>
  );
}
