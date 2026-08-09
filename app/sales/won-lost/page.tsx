import { Suspense } from "react";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { canActAsSalesperson } from "@/lib/auth/sales-capabilities";
import { SalesLayout } from "@/components/layouts/SalesLayout";
import { SoloLayout } from "@/components/layouts/SoloLayout";
import { SalesAppShell } from "@/components/sales/shell/SalesAppShell";
import { WonLostClient } from "@/components/sales/won-lost/WonLostClient";
import { Skeleton } from "@/components/sales/ui";
import { loadSalesShellProps } from "@/lib/sales/sales-shell-props";

export const dynamic = "force-dynamic";

function WonLostFallback() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-10 w-full max-w-xl rounded-sales-md" />
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-[118px] rounded-sales-xl" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <Skeleton className="h-[420px] rounded-sales-xl" />
        <div className="space-y-4">
          <Skeleton className="h-[230px] rounded-sales-xl" />
          <Skeleton className="h-[200px] rounded-sales-xl" />
        </div>
      </div>
    </div>
  );
}

export default async function SalesWonLostPage() {
  const session = await getServerSession(authOptions);
  if (!session?.userId || !canActAsSalesperson(session)) redirect("/login");

  const Layout = session.clientMode === "solo" ? SoloLayout : SalesLayout;
  const shell = await loadSalesShellProps(session);

  return (
    <Layout
      breadcrumb="SALES / WON & LOST"
      pageTitle="Won & Lost"
      hideShellHeader
      hideShellSidebar
      contentFlush
    >
      <SalesAppShell
        {...shell}
        breadcrumb="Sales / Won & Lost"
        title="Won & Lost"
        description="Review closed deals, understand why deals are won or lost, and improve future performance."
        searchPlaceholder="Search leads, customers, deals..."
      >
        <Suspense fallback={<WonLostFallback />}>
          <WonLostClient />
        </Suspense>
      </SalesAppShell>
    </Layout>
  );
}
