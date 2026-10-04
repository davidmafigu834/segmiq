import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { canActAsSalesperson } from "@/lib/auth/sales-capabilities";
import { SalesLayout } from "@/components/layouts/SalesLayout";
import { SoloLayout } from "@/components/layouts/SoloLayout";
import { SalesAppShell } from "@/components/sales/shell/SalesAppShell";
import { AssessmentForm } from "@/components/work-projects/AssessmentForm";
import { loadSalesShellProps } from "@/lib/sales/sales-shell-props";
import { documentsEnabledFor, loadProjectOrNotFound, tradesProjectActor } from "@/lib/work-projects/page-data";
import { emptySolarAssessment } from "@/lib/work-projects/field-rules";
import { loadProjectField } from "@/lib/work-projects/field-service";

export const dynamic = "force-dynamic";

export default async function SalesVisitPage({ params }: { params: { projectId: string; visitId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.userId || !canActAsSalesperson(session)) redirect("/login");
  const actor = await tradesProjectActor();
  const [workspace, field, documentsEnabled, shell] = await Promise.all([
    loadProjectOrNotFound(actor, params.projectId),
    loadProjectField(actor, params.projectId),
    documentsEnabledFor(actor.clientId),
    loadSalesShellProps(session),
  ]);
  const visit = field.ok ? field.data.visits.find((item) => item.id === params.visitId) : null;
  if (!visit) redirect(`/sales/projects/${params.projectId}`);
  const assessment = field.ok ? field.data.assessments.find((item) => item.visitId === visit.id) : null;
  const blank = emptySolarAssessment();
  const Layout = session.clientMode === "solo" ? SoloLayout : SalesLayout;
  return (
    <Layout breadcrumb="Sales / VISIT" pageTitle="Site assessment" hideShellHeader hideShellSidebar contentFlush>
      <SalesAppShell {...shell} dense breadcrumb="Sales / Projects" title={workspace.project.project_number} description={visit.title}>
        <AssessmentForm
          projectId={params.projectId}
          visitId={visit.id}
          clientId={actor.clientId}
          basePath="/sales/projects"
          initial={assessment?.data ?? { ...blank, site: { ...blank.site, address: visit.siteAddress } }}
          canEdit={visit.canEditAssessment && assessment?.status !== "COMPLETED"}
          documentsEnabled={documentsEnabled}
          projectStatus={workspace.project.status}
        />
      </SalesAppShell>
    </Layout>
  );
}
