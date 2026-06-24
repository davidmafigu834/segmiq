import { Suspense } from "react";
import Link from "next/link";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { ClientManagerLayout } from "@/components/layouts/ClientManagerLayout";
import { ClientTeamDashboard } from "@/components/client-team/ClientTeamDashboard";
import { TeamMembersManager } from "@/components/client-team/TeamMembersManager";

export default async function ClientTeamPage({
  searchParams,
}: {
  searchParams: { clientId?: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) redirect("/login");

  const role = session.role;
  const previewClientId = searchParams.clientId;

  if (role === "AGENCY_ADMIN") {
    if (!previewClientId) {
      redirect("/dashboard");
    }
  } else if (role === "CLIENT_MANAGER") {
    if (!session.clientId) redirect("/login");
  } else {
    redirect("/sales/leads");
  }

  const supabase = createAdminClient();
  const targetClientId = role === "AGENCY_ADMIN" ? previewClientId! : session.clientId!;
  const { data: clientRow } = await supabase
    .from("clients")
    .select("name, round_robin_index")
    .eq("id", targetClientId)
    .maybeSingle();
  const clientName = (clientRow?.name as string) ?? "Your company";
  const roundRobinIndex = Number((clientRow as { round_robin_index?: number } | null)?.round_robin_index ?? 0);

  return (
    <ClientManagerLayout
      hideShellHeader
      navClientId={targetClientId}
      breadcrumbOverride={`${clientName} / TEAM`}
      pageTitle="Your team"
    >
      {role === "AGENCY_ADMIN" ? (
        <p className="mb-6 rounded-md border border-border bg-surface-card-alt px-3 py-2 font-mono text-[11px] text-ink-secondary">
          Previewing client team ·{" "}
          <Link href="/dashboard" className="text-[var(--accent)] underline-offset-2 hover:underline">
            Back to agency
          </Link>
        </p>
      ) : null}
      <Suspense fallback={<div className="shimmer h-[min(480px,70vh)] rounded-lg" />}>
        <ClientTeamDashboard
          clientName={clientName}
          previewClientId={role === "AGENCY_ADMIN" ? previewClientId : undefined}
        />
      </Suspense>
      {role === "CLIENT_MANAGER" ? (
        <TeamMembersManager clientId={targetClientId} roundRobinIndex={roundRobinIndex} />
      ) : null}
    </ClientManagerLayout>
  );
}
