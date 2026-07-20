import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { ClientManagerLayout } from "@/components/layouts/ClientManagerLayout";
import { CommunicationPreferencesPage } from "@/components/marketing/ContactCommunicationPrefs";

export default async function MarketingPreferencesPage() {
  const session = await getServerSession(authOptions);
  if (!session?.clientId) redirect("/login");
  if (session.role !== "CLIENT_MANAGER") redirect("/login");

  return (
    <ClientManagerLayout breadcrumbPage="Preferences" pageTitle="Marketing Hub" hideShellHeader>
      <CommunicationPreferencesPage clientId={session.clientId} />
    </ClientManagerLayout>
  );
}
