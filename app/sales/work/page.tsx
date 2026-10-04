import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { canActAsSalesperson } from "@/lib/auth/sales-capabilities";
import { SalesLayout } from "@/components/layouts/SalesLayout";
import { SoloLayout } from "@/components/layouts/SoloLayout";
import { SalesAppShell } from "@/components/sales/shell/SalesAppShell";
import { MyWorkClient } from "@/components/work-projects/MyWorkClient";
import { listMyWork } from "@/lib/work-projects/field-service";
import { tradesProjectActor } from "@/lib/work-projects/page-data";
import { loadSalesShellProps } from "@/lib/sales/sales-shell-props";

export const dynamic = "force-dynamic";

export default async function SalesMyWorkPage() {
  const session = await getServerSession(authOptions);
  if (!session?.userId || !canActAsSalesperson(session)) redirect("/login");
  const actor = await tradesProjectActor();
  const [work, shell] = await Promise.all([listMyWork(actor), loadSalesShellProps(session)]);
  const data = work.ok ? work.data : { tasks: [], visits: [] };
  const Layout = session.clientMode === "solo" ? SoloLayout : SalesLayout;
  return (
    <Layout breadcrumb="Sales / MY WORK" pageTitle="My work" hideShellHeader hideShellSidebar contentFlush>
      <SalesAppShell {...shell} dense breadcrumb="Sales / My work" title="My work" description="Visits and tasks assigned to you.">
        <MyWorkClient tasks={data.tasks} visits={data.visits} basePath="/sales/projects" />
      </SalesAppShell>
    </Layout>
  );
}
