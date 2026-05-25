import { Suspense } from "react";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { fetchSalespersonDashboardData } from "@/lib/dashboard-data";
import { SalesLayout } from "@/components/layouts/SalesLayout";
import SalesDashboardMain from "./SalesDashboardMain";
import SalesDashboardSkeleton from "./SalesDashboardSkeleton";

export default async function SalesDashboardPage() {
  const session = await getServerSession(authOptions);

  if (!session || session.role !== "SALESPERSON") {
    redirect("/login");
  }

  const data = await fetchSalespersonDashboardData(session.userId);

  return (
    <SalesLayout breadcrumb="SALES / DASHBOARD" pageTitle="Dashboard">
      <Suspense fallback={<SalesDashboardSkeleton />}>
        <SalesDashboardMain data={data} session={session} />
      </Suspense>
    </SalesLayout>
  );
}
