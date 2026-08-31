import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { ClientManagerLayout } from "@/components/layouts/ClientManagerLayout";
import { CommunicationPreferencesPage } from "@/components/marketing/ContactCommunicationPrefs";
import { CompanyMarketingChildPage } from "@/components/real-estate/marketing/CompanyMarketingChildPage";
import { loadRealEstateMarketingChildChrome } from "@/lib/real-estate/marketing-child-chrome";

export default async function MarketingPreferencesPage() {
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
      <ClientManagerLayout breadcrumbPage="Preferences" pageTitle="Marketing" hideShellHeader hideShellSidebar>
        <CompanyMarketingChildPage
          chrome={chrome}
          title="Preferences"
          description="Contact communication preferences for WhatsApp marketing."
        >
          <CommunicationPreferencesPage />
        </CompanyMarketingChildPage>
      </ClientManagerLayout>
    );
  }

  return (
    <ClientManagerLayout breadcrumbPage="Preferences" pageTitle="Marketing Hub" workspaceShell>
      <CommunicationPreferencesPage />
    </ClientManagerLayout>
  );
}
