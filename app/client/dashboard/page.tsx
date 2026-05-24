import { Suspense } from "react";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { fetchClientManagerDashboardData } from "@/lib/dashboard-data";
import { ClientManagerLayout } from "@/components/layouts/ClientManagerLayout";
import ClientDashboardMain from "./ClientDashboardMain";
import ClientDashboardSkeleton from "./ClientDashboardSkeleton";

export default async function ClientDashboardPage() {
  const session = await getServerSession(authOptions);

  if (!session?.clientId) redirect("/login");
  if (!["CLIENT_MANAGER", "AGENCY_ADMIN"].includes(session.role)) redirect("/login");

  const clientId = session.clientId;
  const data = await fetchClientManagerDashboardData(clientId);

  return (
    <ClientManagerLayout breadcrumbPage="DASHBOARD" pageTitle="Dashboard">
      <Suspense fallback={<ClientDashboardSkeleton />}>
        <ClientDashboardMain data={data} session={session} />
      </Suspense>
    </ClientManagerLayout>
  );
}
