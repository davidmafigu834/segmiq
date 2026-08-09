import { Suspense } from "react";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { canActAsSalesperson } from "@/lib/auth/sales-capabilities";
import { SalesLayout } from "@/components/layouts/SalesLayout";
import { SoloLayout } from "@/components/layouts/SoloLayout";
import { SalesAppShell } from "@/components/sales/shell/SalesAppShell";
import { SalesGoalsClient } from "@/components/sales/goals/SalesGoalsClient";
import { Skeleton } from "@/components/sales/ui";
import { loadSalesShellProps } from "@/lib/sales/sales-shell-props";

export const dynamic = "force-dynamic";

function GoalsFallback() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-10 w-48 rounded-sales-md" />
      <div className="grid gap-4 xl:grid-cols-12">
        <Skeleton className="h-[300px] rounded-sales-xl xl:col-span-9" />
        <Skeleton className="h-[300px] rounded-sales-xl xl:col-span-3" />
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <Skeleton className="h-[260px] rounded-sales-xl" />
        <Skeleton className="h-[260px] rounded-sales-xl" />
        <Skeleton className="h-[260px] rounded-sales-xl" />
      </div>
    </div>
  );
}

export default async function SalesGoalsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.userId || !canActAsSalesperson(session)) redirect("/login");

  const Layout = session.clientMode === "solo" ? SoloLayout : SalesLayout;
  const shell = await loadSalesShellProps(session);

  return (
    <Layout
      breadcrumb="SALES / GOALS"
      pageTitle="My goal"
      hideShellHeader
      hideShellSidebar
      contentFlush
    >
      <SalesAppShell
        {...shell}
        breadcrumb="Sales / Goals"
        title="My goal"
        description="Track your progress, stay focused, and achieve your sales targets."
        searchPlaceholder="Search leads, customers, goals..."
      >
        <Suspense fallback={<GoalsFallback />}>
          <SalesGoalsClient />
        </Suspense>
      </SalesAppShell>
    </Layout>
  );
}
