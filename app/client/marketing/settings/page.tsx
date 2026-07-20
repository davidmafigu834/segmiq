import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { ClientManagerLayout } from "@/components/layouts/ClientManagerLayout";
import { MarketingSettingsPage } from "@/components/marketing/MarketingSettings";

export default async function MarketingSettingsRoute() {
  const session = await getServerSession(authOptions);
  if (!session?.clientId) redirect("/login");
  if (session.role !== "CLIENT_MANAGER") redirect("/login");

  return (
    <ClientManagerLayout breadcrumbPage="Settings" pageTitle="Marketing Hub" hideShellHeader>
      <MarketingSettingsPage clientId={session.clientId} />
    </ClientManagerLayout>
  );
}
