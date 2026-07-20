import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { ClientManagerLayout } from "@/components/layouts/ClientManagerLayout";
import { JourneysManager } from "@/components/marketing/JourneysManager";

export default async function MarketingJourneysPage() {
  const session = await getServerSession(authOptions);
  if (!session?.clientId) redirect("/login");
  if (session.role !== "CLIENT_MANAGER") redirect("/login");

  return (
    <ClientManagerLayout breadcrumbPage="Journeys" pageTitle="Marketing Hub" hideShellHeader>
      <JourneysManager clientId={session.clientId} />
    </ClientManagerLayout>
  );
}
