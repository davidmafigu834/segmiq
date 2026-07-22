import { Suspense } from "react";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { canActAsSalesperson } from "@/lib/auth/sales-capabilities";
import { redirect } from "next/navigation";
import { fetchSalespersonDashboardData } from "@/lib/dashboard-data";
import { SalesLayout } from "@/components/layouts/SalesLayout";
import { RecoverClient } from "./RecoverClient";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export default async function RecoverPage() {
  const session = await getServerSession(authOptions);

  if (!session || !canActAsSalesperson(session)) {
    redirect("/login");
  }

  const data = await fetchSalespersonDashboardData(session.userId);

  return (
    <SalesLayout breadcrumb="SALES / RECOVER" pageTitle="Recover — slipped">
      <Suspense fallback={<div className="text-[13px] text-[var(--text-tertiary)]">Loading…</div>}>
        <RecoverClient
          leads={data.allActiveLeads}
          repName={session.user?.name ?? ""}
        />
      </Suspense>
    </SalesLayout>
  );
}
