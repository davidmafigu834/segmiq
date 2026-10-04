import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { ClientManagerLayout } from "@/components/layouts/ClientManagerLayout";
import { AssessmentForm } from "@/components/work-projects/AssessmentForm";
import { documentsEnabledFor, loadProjectOrNotFound, tradesProjectActor } from "@/lib/work-projects/page-data";
import { emptySolarAssessment } from "@/lib/work-projects/field-rules";
import { loadProjectField } from "@/lib/work-projects/field-service";

export const dynamic = "force-dynamic";

export default async function ClientVisitPage({ params }: { params: { projectId: string; visitId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) redirect("/login");
  if (session.role === "SALESPERSON") redirect(`/sales/projects/${params.projectId}/visits/${params.visitId}`);
  const actor = await tradesProjectActor();
  const [workspace, field, documentsEnabled] = await Promise.all([
    loadProjectOrNotFound(actor, params.projectId),
    loadProjectField(actor, params.projectId),
    documentsEnabledFor(actor.clientId),
  ]);
  const visit = field.ok ? field.data.visits.find((item) => item.id === params.visitId) : null;
  if (!visit) redirect(`/client/projects/${params.projectId}`);
  const assessment = field.ok ? field.data.assessments.find((item) => item.visitId === visit.id) : null;
  return (
    <ClientManagerLayout breadcrumbPage="VISIT" pageTitle="Site assessment" workspaceShell workspaceTitle={workspace.project.project_number} workspaceDescription={visit.title}>
      <AssessmentForm
        projectId={params.projectId}
        visitId={visit.id}
        clientId={actor.clientId}
        basePath="/client/projects"
        initial={assessment?.data ?? { ...emptySolarAssessment(), site: { ...emptySolarAssessment().site, address: visit.siteAddress } }}
        canEdit={visit.canEditAssessment && assessment?.status !== "COMPLETED"}
        documentsEnabled={documentsEnabled}
        projectStatus={workspace.project.status}
      />
    </ClientManagerLayout>
  );
}
