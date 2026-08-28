import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { ClientManagerLayout } from "@/components/layouts/ClientManagerLayout";
import { CampaignWizard } from "@/components/marketing/CampaignWizard";

export default async function NewCampaignPage() {
  const session = await getServerSession(authOptions);
  if (!session?.clientId) redirect("/login");
  if (session.role !== "CLIENT_MANAGER") redirect("/login");

  return (
    <ClientManagerLayout breadcrumbPage="New campaign" pageTitle="Marketing Hub" workspaceShell>
      <CampaignWizard clientId={session.clientId} />
    </ClientManagerLayout>
  );
}
