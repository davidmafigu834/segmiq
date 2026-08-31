import { Suspense } from "react";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { ClientManagerLayout } from "@/components/layouts/ClientManagerLayout";
import { CompanyAgentPerformancePage } from "@/components/real-estate/agent-performance/CompanyAgentPerformancePage";
import { CompanyAgentPerformancePageSkeleton } from "@/components/real-estate/agent-performance/CompanyAgentPerformancePageSkeleton";
import { redirectIfNotRealEstate } from "@/lib/real-estate/gating";
import { getAgentSupervision } from "@/lib/real-estate/agent-supervision";
import { loadCompanyPageChrome } from "@/lib/real-estate/company-page-chrome";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export default async function ClientAgentPerformancePage() {
  const session = await getServerSession(authOptions);
  if (!session?.userId || session.role !== "CLIENT_MANAGER" || !session.clientId) {
    redirect("/login");
  }

  const supabase = createAdminClient();
  const { data: client } = await supabase
    .from("clients")
    .select("id, name, business_type")
    .eq("id", session.clientId)
    .maybeSingle();
  if (!client) redirect("/login");
  redirectIfNotRealEstate(client.business_type);

  const [agents, chrome] = await Promise.all([
    getAgentSupervision(session.clientId),
    loadCompanyPageChrome({
      userId: session.userId,
      clientId: session.clientId,
      userName: session.user?.name ?? "User",
      role: session.role,
    }),
  ]);

  return (
    <ClientManagerLayout
      breadcrumbPage="AGENT PERFORMANCE"
      pageTitle="Agent Performance"
      hideShellHeader
      hideShellSidebar
    >
      <Suspense fallback={<CompanyAgentPerformancePageSkeleton />}>
        <CompanyAgentPerformancePage chrome={chrome} agents={agents} />
      </Suspense>
    </ClientManagerLayout>
  );
}
