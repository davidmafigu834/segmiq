import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { ClientManagerLayout } from "@/components/layouts/ClientManagerLayout";
import { CampaignDetail } from "@/components/marketing/CampaignDetail";

export default async function CampaignDetailPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.clientId) redirect("/login");
  if (session.role !== "CLIENT_MANAGER") redirect("/login");

  return (
    <ClientManagerLayout breadcrumbPage="Campaign" pageTitle="Marketing Hub" hideShellHeader>
      <CampaignDetail clientId={session.clientId} campaignId={params.id} />
    </ClientManagerLayout>
  );
}
