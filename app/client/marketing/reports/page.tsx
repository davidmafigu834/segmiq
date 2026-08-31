import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { ClientManagerLayout } from "@/components/layouts/ClientManagerLayout";
import { MarketingReports } from "@/components/marketing/MarketingReports";
import { CompanyMarketingChildPage } from "@/components/real-estate/marketing/CompanyMarketingChildPage";
import { loadRealEstateMarketingChildChrome } from "@/lib/real-estate/marketing-child-chrome";

export default async function MarketingReportsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.userId || !session.clientId) redirect("/login");
  if (session.role !== "CLIENT_MANAGER") redirect("/login");

  const chrome = await loadRealEstateMarketingChildChrome({
    userId: session.userId,
    clientId: session.clientId,
    userName: session.user?.name ?? "User",
    role: session.role,
  });

  if (chrome) {
    return (
      <ClientManagerLayout breadcrumbPage="Reports" pageTitle="Marketing" hideShellHeader hideShellSidebar>
        <CompanyMarketingChildPage
          chrome={chrome}
          title="Marketing reports"
          description="WhatsApp campaign performance for this company."
        >
          <MarketingReports clientId={session.clientId} />
        </CompanyMarketingChildPage>
      </ClientManagerLayout>
    );
  }

  return (
    <ClientManagerLayout breadcrumbPage="Reports" pageTitle="Marketing Hub" workspaceShell>
      <MarketingReports clientId={session.clientId} />
    </ClientManagerLayout>
  );
}
