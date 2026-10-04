import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { ClientManagerLayout } from "@/components/layouts/ClientManagerLayout";
import { ProjectWorkspaceClient } from "@/components/work-projects/ProjectWorkspaceClient";
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

export default async function ClientProjectPage({
  params,
  searchParams,
}: {
  params: { projectId: string };
  searchParams?: { tab?: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) redirect("/login");
  if (session.role === "SALESPERSON") redirect(`/sales/projects/${params.projectId}`);
  const actor = await tradesProjectActor();
  const [workspace, owners, documentsEnabled, fieldResult, commercialResult, installationResult] = await Promise.all([
    loadProjectOrNotFound(actor, params.projectId),
    companyOwners(actor.clientId),
    documentsEnabledFor(actor.clientId),
    loadProjectField(actor, params.projectId),
    loadProjectCommercial(actor, params.projectId),
    loadProjectInstallation(actor, params.projectId),
  ]);

  return (
    <ClientManagerLayout
      breadcrumbPage="PROJECT"
      pageTitle={workspace.project.title}
      workspaceShell
      workspaceTitle={workspace.project.project_number}
      workspaceDescription={workspace.project.title}
    >
      <ProjectWorkspaceClient
        workspace={workspace}
        basePath="/client/projects"
        salesBase="client"
        canManage
        documentsEnabled={documentsEnabled}
        clientId={actor.clientId}
          owners={owners}
          field={fieldResult.ok ? fieldResult.data : emptyField()}
          commercial={commercialResult.ok ? commercialResult.data : emptyCommercial()}
          installation={installationResult.ok ? installationResult.data : emptyInstallationSnapshot()}
          initialTab={searchParams?.tab === "visits" ? "Visits" : searchParams?.tab === "tasks" ? "Tasks" : searchParams?.tab === "payments" ? "Payments" : searchParams?.tab === "equipment" ? "Equipment" : searchParams?.tab === "installation" ? "Installation" : searchParams?.tab === "assets" ? "Assets" : "Overview"}
        />
    </ClientManagerLayout>
  );
}
