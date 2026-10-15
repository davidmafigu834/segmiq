import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getOperationalSession } from "@/lib/auth/operational-session";
import { canActAsSalesperson } from "@/lib/auth/sales-capabilities";
import { SalesLayout } from "@/components/layouts/SalesLayout";
import { SoloLayout } from "@/components/layouts/SoloLayout";
import { SalesAppShell } from "@/components/sales/shell/SalesAppShell";
import { SalesReportsClient } from "@/components/sales/SalesReportsClient";
import { Skeleton } from "@/components/sales/ui";
import { loadSalesShellProps } from "@/lib/sales/sales-shell-props";

export const dynamic = "force-dynamic";

export default async function SalesReportsPage() {
  const session = await getOperationalSession();
  if (!session?.userId || !canActAsSalesperson(session)) redirect("/login");

  const Layout = session.clientMode === "solo" ? SoloLayout : SalesLayout;
  const shell = await loadSalesShellProps(session);

  return (
    <Layout
      breadcrumb="Sales / Reports"
      pageTitle="Reports"
      hideShellHeader
      hideShellSidebar
      contentFlush
    >
      <SalesAppShell
        {...shell}
        breadcrumb="Sales / Reports"
        title="Reports"
        description="Track your performance, pipeline health, conversions, and sales activity."
      >
        <Suspense fallback={<Skeleton className="h-[420px] w-full rounded-sales-xl" />}>
          <SalesReportsClient />
        </Suspense>
      </SalesAppShell>
    </Layout>
  );
}
