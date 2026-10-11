import { Suspense } from "react";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { canActAsSalesperson } from "@/lib/auth/sales-capabilities";
import { SalesLayout } from "@/components/layouts/SalesLayout";
import { SoloLayout } from "@/components/layouts/SoloLayout";
import { SalesAppShell } from "@/components/sales/shell/SalesAppShell";
import { SalesTasksClient } from "@/components/sales/tasks/SalesTasksClient";
import { Skeleton } from "@/components/sales/ui";
import { loadSalesShellProps } from "@/lib/sales/sales-shell-props";

export const dynamic = "force-dynamic";

function TasksFallback() {
  return (
    <div className="space-y-3 px-4">
      <Skeleton className="h-10 w-full max-w-xl rounded-sales-md" />
      <div className="space-y-3 layout:hidden">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-28 w-full rounded-sales-md" />
        ))}
      </div>
      <Skeleton className="hidden h-[420px] rounded-sales-xl layout:block" />
    </div>
  );
}

export default async function SalesTasksPage() {
  const session = await getServerSession(authOptions);
  if (!session?.userId || !canActAsSalesperson(session)) redirect("/login");

  const Layout = session.clientMode === "solo" ? SoloLayout : SalesLayout;
  const shell = await loadSalesShellProps(session);

  return (
    <Layout
      breadcrumb="Sales / Tasks"
      pageTitle="Tasks"
      hideShellHeader
      hideShellSidebar
      contentFlush
    >
      <SalesAppShell
        {...shell}
        className="sales-tasks-page"
        breadcrumb="Sales / Tasks"
        title="Tasks"
        description="Know what needs attention now and keep every opportunity moving."
        searchPlaceholder="Search leads, customers, tasks..."
        mobileFullBleed
      >
        <Suspense fallback={<TasksFallback />}>
          <SalesTasksClient />
        </Suspense>
      </SalesAppShell>
    </Layout>
  );
}
