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
    <div className="space-y-4">
      <Skeleton className="h-10 w-full max-w-xl rounded-sales-md" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-[110px] rounded-sales-xl" />
        ))}
      </div>
      <Skeleton className="h-[420px] rounded-sales-xl" />
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
      breadcrumb="SALES / TASKS"
      pageTitle="Tasks"
      hideShellHeader
      hideShellSidebar
      contentFlush
    >
      <SalesAppShell
        {...shell}
        breadcrumb="Sales / Tasks"
        title="Tasks"
        description="Manage your tasks, follow-ups, and daily activities."
        searchPlaceholder="Search leads, customers, tasks..."
      >
        <Suspense fallback={<TasksFallback />}>
          <SalesTasksClient />
        </Suspense>
      </SalesAppShell>
    </Layout>
  );
}
