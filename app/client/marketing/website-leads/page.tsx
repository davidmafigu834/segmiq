import { Suspense } from "react";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { ClientManagerLayout } from "@/components/layouts/ClientManagerLayout";
import { CompanyWebsiteLeadsPage } from "@/components/real-estate/website-leads/CompanyWebsiteLeadsPage";
import { CompanyWebsiteLeadsPageSkeleton } from "@/components/real-estate/website-leads/CompanyWebsiteLeadsPageSkeleton";
import { redirectIfNotRealEstate } from "@/lib/real-estate/gating";
import { getWebsiteLeadMetrics } from "@/lib/real-estate/marketing-service";
import { loadCompanyPageChrome } from "@/lib/real-estate/company-page-chrome";

export const dynamic = "force-dynamic";

export default async function ClientWebsiteLeadsPage() {
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

  const [metrics, chrome] = await Promise.all([
    getWebsiteLeadMetrics(session.clientId),
    loadCompanyPageChrome({
      userId: session.userId,
      clientId: session.clientId,
      userName: session.user?.name ?? "User",
      role: session.role,
    }),
  ]);

  return (
    <ClientManagerLayout
      breadcrumbPage="WEBSITE LEADS"
      pageTitle="Website Leads"
      hideShellHeader
      hideShellSidebar
    >
      <Suspense fallback={<CompanyWebsiteLeadsPageSkeleton />}>
        <CompanyWebsiteLeadsPage
          chrome={chrome}
          clientId={session.clientId}
          month={metrics.month}
          latest={metrics.latest}
        />
      </Suspense>
    </ClientManagerLayout>
  );
}
