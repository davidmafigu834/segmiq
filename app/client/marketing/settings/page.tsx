import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { ClientManagerLayout } from "@/components/layouts/ClientManagerLayout";
import { MarketingSettingsPage } from "@/components/marketing/MarketingSettings";
import { CompanyMarketingChildPage } from "@/components/real-estate/marketing/CompanyMarketingChildPage";
import { loadRealEstateMarketingChildChrome } from "@/lib/real-estate/marketing-child-chrome";

export default async function MarketingSettingsRoute() {
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
      <ClientManagerLayout breadcrumbPage="Settings" pageTitle="Marketing" hideShellHeader hideShellSidebar>
        <CompanyMarketingChildPage
          chrome={chrome}
          title="Marketing settings"
          description="WhatsApp marketing defaults for this company."
        >
          <MarketingSettingsPage clientId={session.clientId} />
        </CompanyMarketingChildPage>
      </ClientManagerLayout>
    );
  }

  return (
    <ClientManagerLayout breadcrumbPage="Settings" pageTitle="Marketing Hub" workspaceShell>
      <MarketingSettingsPage clientId={session.clientId} />
    </ClientManagerLayout>
  );
}
