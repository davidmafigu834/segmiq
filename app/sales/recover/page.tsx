import { Suspense } from "react";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { canActAsSalesperson } from "@/lib/auth/sales-capabilities";
import { redirect } from "next/navigation";
import { fetchSalespersonDashboardData } from "@/lib/dashboard-data";
import { SalesLayout } from "@/components/layouts/SalesLayout";
import { SalesAppShell } from "@/components/sales/shell/SalesAppShell";
import { loadSalesShellProps } from "@/lib/sales/sales-shell-props";
import { RecoverClient } from "./RecoverClient";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export default async function RecoverPage() {
  const session = await getServerSession(authOptions);

  if (!session || !canActAsSalesperson(session)) {
    redirect("/login");
  }

  const [data, shell] = await Promise.all([
    fetchSalespersonDashboardData(session.userId),
    loadSalesShellProps(session),
  ]);

  return (
    <SalesLayout
      breadcrumb="Sales / RECOVER"
      pageTitle="Recover"
      hideShellHeader
      hideShellSidebar
      contentFlush
    >
      <SalesAppShell
        {...shell}
        breadcrumb="Sales / Recover"
        title="Recover"
        description="Slipped leads that need attention before they go cold."
      >
        <Suspense
          fallback={<div className="text-[13px] text-sales-text-muted">Loading…</div>}
        >
          <RecoverClient leads={data.allActiveLeads} repName={session.user?.name ?? ""} />
        </Suspense>
      </SalesAppShell>
    </SalesLayout>
  );
}
