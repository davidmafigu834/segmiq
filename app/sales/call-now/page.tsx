import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { canActAsSalesperson } from "@/lib/auth/sales-capabilities";
import { redirect } from "next/navigation";
import { fetchSalespersonDashboardData } from "@/lib/dashboard-data";
import { SalesLayout } from "@/components/layouts/SalesLayout";
import { CallNowClient } from "./CallNowClient";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export default async function CallNowPage() {
  const session = await getServerSession(authOptions);

  if (!session || !canActAsSalesperson(session)) {
    redirect("/login");
  }

  const data = await fetchSalespersonDashboardData(session.userId);

  return (
    <SalesLayout breadcrumb="SALES / CALL NOW" pageTitle="Call now">
      <CallNowClient
        leads={data.allActiveLeads}
        repName={session.user?.name ?? ""}
      />
    </SalesLayout>
  );
}
