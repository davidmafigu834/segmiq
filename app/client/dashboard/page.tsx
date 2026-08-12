import { Suspense } from "react";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCompanySalesDashboard } from "@/lib/sales/get-company-sales-dashboard-data";
import { ClientManagerLayout } from "@/components/layouts/ClientManagerLayout";
import {
  CompanyDashboard,
  CompanyDashboardSkeleton,
} from "@/components/dashboard/company";

export default async function ClientDashboardPage() {
  const session = await getServerSession(authOptions);

  if (!session?.clientId) redirect("/login");
  if (!["CLIENT_MANAGER", "SUPER_ADMIN"].includes(session.role)) redirect("/login");

  const clientId = session.clientId;
  const [data, unreadRes] = await Promise.all([
    getCompanySalesDashboard({
      clientId,
      alsoSells: Boolean(session.alsoSells),
    }),
    session.userId
      ? createAdminClient()
          .from("notifications")
          .select("*", { count: "exact", head: true })
          .eq("user_id", session.userId)
          .eq("read", false)
      : Promise.resolve({ count: 0 }),
  ]);

  return (
    <ClientManagerLayout
      breadcrumbPage="DASHBOARD"
      pageTitle="Company dashboard"
      hideShellHeader
    >
      <Suspense fallback={<CompanyDashboardSkeleton />}>
        <CompanyDashboard
          data={data}
          unreadNotifications={unreadRes.count ?? 0}
          notificationRole={session.role}
        />
      </Suspense>
    </ClientManagerLayout>
  );
}
