import { Suspense } from "react";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { fetchSalespersonDashboardData } from "@/lib/dashboard-data";
import { SalesLayout } from "@/components/layouts/SalesLayout";
import { SalesAppDownloadButton } from "@/components/sales/SalesAppDownloadButton";
import SalesDashboardMain from "./SalesDashboardMain";
import SalesDashboardSkeleton from "./SalesDashboardSkeleton";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export default async function SalesDashboardPage() {
  const session = await getServerSession(authOptions);

  if (!session || session.role !== "SALESPERSON") {
    redirect("/login");
  }

  const data = await fetchSalespersonDashboardData(session.userId);

  return (
    <SalesLayout
      breadcrumb="SALES / DASHBOARD"
      pageTitle="Dashboard"
      actions={<SalesAppDownloadButton />}
    >
      <Suspense fallback={<SalesDashboardSkeleton />}>
        <SalesDashboardMain data={data} session={session} />
      </Suspense>
    </SalesLayout>
  );
}
