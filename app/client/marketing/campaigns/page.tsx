import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { ClientManagerLayout } from "@/components/layouts/ClientManagerLayout";
import { CampaignList } from "@/components/marketing/CampaignList";

export default async function CampaignsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.clientId) redirect("/login");
  if (session.role !== "CLIENT_MANAGER") redirect("/login");

  return (
    <ClientManagerLayout breadcrumbPage="Campaigns" pageTitle="Marketing Hub" hideShellHeader>
      <CampaignList clientId={session.clientId} />
    </ClientManagerLayout>
  );
}
