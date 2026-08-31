import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { ClientManagerLayout } from "@/components/layouts/ClientManagerLayout";
import { CampaignWizard } from "@/components/marketing/CampaignWizard";
import { CompanyMarketingChildPage } from "@/components/real-estate/marketing/CompanyMarketingChildPage";
import { loadRealEstateMarketingChildChrome } from "@/lib/real-estate/marketing-child-chrome";

export default async function NewCampaignPage() {
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
      <ClientManagerLayout breadcrumbPage="New campaign" pageTitle="Marketing" hideShellHeader hideShellSidebar>
        <CompanyMarketingChildPage
          chrome={chrome}
          title="New campaign"
          description="Create a WhatsApp campaign for this company."
        >
          <CampaignWizard clientId={session.clientId} />
        </CompanyMarketingChildPage>
      </ClientManagerLayout>
    );
  }

  return (
    <ClientManagerLayout breadcrumbPage="New campaign" pageTitle="Marketing Hub" workspaceShell>
      <CampaignWizard clientId={session.clientId} />
    </ClientManagerLayout>
  );
}
