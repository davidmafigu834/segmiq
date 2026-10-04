import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { canActAsSalesperson } from "@/lib/auth/sales-capabilities";
import { SalesLayout } from "@/components/layouts/SalesLayout";
import { SoloLayout } from "@/components/layouts/SoloLayout";
import { SalesAppShell } from "@/components/sales/shell/SalesAppShell";
import { ProjectListClient } from "@/components/work-projects/ProjectListClient";
import { loadSalesShellProps } from "@/lib/sales/sales-shell-props";
import { companyOwners, loadProjectList, tradesProjectActor } from "@/lib/work-projects/page-data";

export const dynamic = "force-dynamic";

export default async function SalesProjectsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.userId || !canActAsSalesperson(session)) redirect("/login");
  const actor = await tradesProjectActor();
  const [items, owners, shell] = await Promise.all([
    loadProjectList(actor),
    companyOwners(actor.clientId),
    loadSalesShellProps(session),
  ]);
  const Layout = session.clientMode === "solo" ? SoloLayout : SalesLayout;

  return (
    <Layout breadcrumb="Sales / PROJECTS" pageTitle="Projects" hideShellHeader hideShellSidebar contentFlush>
      <SalesAppShell
        {...shell}
        dense
        breadcrumb="Sales / Projects"
        title="Projects"
        description="Delivery work on deals you own or are assigned to."
      >
        <ProjectListClient
          initialItems={items}
          basePath="/sales/projects"
          canCreate={session.role === "CLIENT_MANAGER" || session.role === "SUPER_ADMIN"}
          owners={owners}
        />
      </SalesAppShell>
    </Layout>
  );
}
