import { Suspense } from "react";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { canActAsSalesperson } from "@/lib/auth/sales-capabilities";
import { SalesLayout } from "@/components/layouts/SalesLayout";
import { SoloLayout } from "@/components/layouts/SoloLayout";
import { SalesAppShell } from "@/components/sales/shell/SalesAppShell";
import { SalesQuotesClient } from "@/components/sales/quotes/SalesQuotesClient";
import { Skeleton } from "@/components/sales/ui";
import { loadSalesShellProps } from "@/lib/sales/sales-shell-props";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

function QuotesFallback() {
  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Skeleton className="h-10 w-36 rounded-[10px]" />
      </div>
      <Skeleton className="h-10 w-full max-w-3xl rounded-sales-md" />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-[118px] rounded-sales-xl" />
        ))}
      </div>
      <div className="space-y-6">
        <Skeleton className="h-[420px] rounded-sales-xl" />
        <div className="space-y-3">
          <div className="space-y-2">
            <Skeleton className="h-5 w-36 rounded-[6px]" />
            <Skeleton className="h-4 w-80 max-w-full rounded-[6px]" />
          </div>
          <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
            <Skeleton className="h-[260px] rounded-sales-xl" />
            <Skeleton className="h-[260px] rounded-sales-xl" />
          </div>
        </div>
      </div>
    </div>
  );
}

export default async function SalesQuotesPage() {
  const session = await getServerSession(authOptions);
  if (!session?.userId || !canActAsSalesperson(session)) redirect("/login");

  const Layout = session.clientMode === "solo" ? SoloLayout : SalesLayout;
  const shell = await loadSalesShellProps(session);

  return (
    <Layout
      breadcrumb="Sales / QUOTATIONS"
      pageTitle="Quotations"
      hideShellHeader
      hideShellSidebar
      contentFlush
    >
      <SalesAppShell
        {...shell}
        dense
        breadcrumb="Sales / Quotations"
        title="Quotations"
        description="Create, send and follow up on commercial offers for active Deals."
        searchPlaceholder="Search leads, customers, quotes..."
      >
        <Suspense fallback={<QuotesFallback />}>
          <SalesQuotesClient />
        </Suspense>
      </SalesAppShell>
    </Layout>
  );
}
