import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { ClientManagerLayout } from "@/components/layouts/ClientManagerLayout";
import { MarketingOverview } from "@/components/marketing/MarketingOverview";

export default async function MarketingPage() {
  const session = await getServerSession(authOptions);
  if (!session?.clientId) redirect("/login");
  if (session.role !== "CLIENT_MANAGER") redirect("/login");

  return (
    <ClientManagerLayout breadcrumbPage="Marketing" pageTitle="Marketing Hub" hideShellHeader>
      <MarketingOverview clientId={session.clientId} />
    </ClientManagerLayout>
  );
}
