import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { ClientManagerLayout } from "@/components/layouts/ClientManagerLayout";
import { MarketingReports } from "@/components/marketing/MarketingReports";

export default async function MarketingReportsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.clientId) redirect("/login");
  if (session.role !== "CLIENT_MANAGER") redirect("/login");

  return (
    <ClientManagerLayout breadcrumbPage="Reports" pageTitle="Marketing Hub" hideShellHeader>
      <MarketingReports clientId={session.clientId} />
    </ClientManagerLayout>
  );
}
