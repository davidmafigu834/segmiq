import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { SalesLayout } from "@/components/layouts/SalesLayout";
import { AssessmentForm } from "@/components/work-projects/AssessmentForm";
import { loadSalesSiteVisit } from "@/lib/sales/solar-workflow/service";

export const dynamic = "force-dynamic";

export default async function SalesSiteVisitPage({ params }: { params: { visitId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.userId || !session.clientId || !session.role) redirect("/login");
  const loaded = await loadSalesSiteVisit(
    { userId: session.userId, role: session.role, clientId: session.clientId },
    params.visitId
  );
  if (!loaded.ok) redirect("/sales/pipeline");
  return (
    <SalesLayout breadcrumb="Sales / SITE VISIT" pageTitle="Site visit">
      <div className="mx-auto max-w-3xl px-4 py-6">
        <AssessmentForm
          projectId={params.visitId}
          visitId={params.visitId}
          clientId={session.clientId}
          basePath="/sales/pipeline"
          initial={loaded.data.assessment}
          canEdit={loaded.data.canEdit}
          documentsEnabled
          projectStatus="PLANNING"
          links={{
            backHref: "/sales/pipeline",
            backLabel: "Back to pipeline",
            savePath: `/api/sales/site-visits/${params.visitId}/assessment`,
            photoPath: `/api/sales/site-visits/${params.visitId}/photos`,
          }}
        />
      </div>
    </SalesLayout>
  );
}
