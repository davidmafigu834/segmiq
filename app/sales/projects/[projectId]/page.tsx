import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { canActAsSalesperson } from "@/lib/auth/sales-capabilities";
import { SalesLayout } from "@/components/layouts/SalesLayout";
import { SoloLayout } from "@/components/layouts/SoloLayout";
import { SalesAppShell } from "@/components/sales/shell/SalesAppShell";
import { ProjectWorkspaceClient } from "@/components/work-projects/ProjectWorkspaceClient";
import { loadSalesShellProps } from "@/lib/sales/sales-shell-props";
import {
  companyOwners,
  documentsEnabledFor,
  loadProjectOrNotFound,
  tradesProjectActor,
} from "@/lib/work-projects/page-data";
import { loadProjectCommercial, type ProjectCommercialSnapshot } from "@/lib/work-projects/commercial-service";
import { loadProjectField, type ProjectFieldSnapshot } from "@/lib/work-projects/field-service";
import { emptyInstallationSnapshot, loadProjectInstallation } from "@/lib/work-projects/installation-service";

function emptyField(): ProjectFieldSnapshot {
  return { members: [], tasks: [], visits: [], assessments: [], attention: [], canManageTeam: false };
}

function emptyCommercial(): ProjectCommercialSnapshot {
  return {
    canManage: false,
    currency: "USD",
    projectValue: null,
    paymentRequired: true,
    received: 0,
    outstanding: null,
    paymentStatus: "NOT_REQUIRED",
    gate: { configured: false, required: 0, received: 0, satisfied: true },
    terms: [],
    payments: [],
    equipment: [],
    readiness: { commercial: "Deposit requirement open", technical: "Site assessment open", equipment: "Not required", scheduling: "Not ready", nextStep: "Ready for installation planning." },
    attention: [],
    quoteDiffers: false,
    locations: [],
    assessmentCompleted: false,
  };
}

export const dynamic = "force-dynamic";

export default async function SalesProjectPage({
  params,
  searchParams,
}: {
  params: { projectId: string };
  searchParams?: { tab?: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session?.userId || !canActAsSalesperson(session)) redirect("/login");
  const actor = await tradesProjectActor();
  const [workspace, owners, documentsEnabled, shell, fieldResult, commercialResult, installationResult] = await Promise.all([
    loadProjectOrNotFound(actor, params.projectId),
    companyOwners(actor.clientId),
    documentsEnabledFor(actor.clientId),
    loadSalesShellProps(session),
    loadProjectField(actor, params.projectId),
    loadProjectCommercial(actor, params.projectId),
    loadProjectInstallation(actor, params.projectId),
  ]);
  const Layout = session.clientMode === "solo" ? SoloLayout : SalesLayout;
  const canManage = session.role === "CLIENT_MANAGER" || session.role === "SUPER_ADMIN";

  return (
    <Layout breadcrumb="Sales / PROJECT" pageTitle={workspace.project.title} hideShellHeader hideShellSidebar contentFlush>
      <SalesAppShell {...shell} dense breadcrumb="Sales / Projects" title={workspace.project.project_number} description={workspace.project.title}>
        <ProjectWorkspaceClient
          workspace={workspace}
          basePath="/sales/projects"
          salesBase="sales"
          canManage={canManage}
          documentsEnabled={documentsEnabled}
          clientId={actor.clientId}
          owners={owners}
          field={fieldResult.ok ? fieldResult.data : emptyField()}
          commercial={commercialResult.ok ? commercialResult.data : emptyCommercial()}
          installation={installationResult.ok ? installationResult.data : emptyInstallationSnapshot()}
          initialTab={searchParams?.tab === "visits" ? "Visits" : searchParams?.tab === "tasks" ? "Tasks" : searchParams?.tab === "payments" ? "Payments" : searchParams?.tab === "equipment" ? "Equipment" : searchParams?.tab === "installation" ? "Installation" : searchParams?.tab === "assets" ? "Assets" : "Overview"}
        />
      </SalesAppShell>
    </Layout>
  );
}
