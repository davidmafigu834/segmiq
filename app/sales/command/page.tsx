import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { authOptions } from "@/lib/auth";
import { canActAsSalesperson } from "@/lib/auth/sales-capabilities";
import { SalesLayout } from "@/components/layouts/SalesLayout";
import { SoloLayout } from "@/components/layouts/SoloLayout";
import { SalesAppShell } from "@/components/sales/shell/SalesAppShell";
import { SalesCommandWorkspace } from "@/components/sales/command/SalesCommandWorkspace";
import { loadSalesShellProps } from "@/lib/sales/sales-shell-props";

export const dynamic = "force-dynamic";

export default async function SalesCommandPage() {
  const session = await getServerSession(authOptions);
  if (!session?.userId || !canActAsSalesperson(session)) redirect("/login");

  const Layout = session.clientMode === "solo" ? SoloLayout : SalesLayout;
  const shell = await loadSalesShellProps(session);

  return (
    <Layout
      breadcrumb="Sales / COMMAND"
      pageTitle="Sales Command Center"
      hideShellHeader
      hideShellSidebar
      contentFlush
    >
      <SalesAppShell
        {...shell}
        breadcrumb="Sales / Command"
        title="Sales Command Center"
        description="Tell SegmiQ what you need done."
        searchPlaceholder="Search leads, customers, quotes..."
      >
        <div className="px-4 py-4 sm:px-6 layout:px-8">
          <Suspense fallback={<div className="shimmer h-40 rounded-[12px]" />}>
            <SalesCommandWorkspace />
          </Suspense>
        </div>
      </SalesAppShell>
    </Layout>
  );
}
