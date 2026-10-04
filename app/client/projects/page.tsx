import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { ClientManagerLayout } from "@/components/layouts/ClientManagerLayout";
import { ProjectListClient } from "@/components/work-projects/ProjectListClient";
import { companyOwners, loadProjectList, tradesProjectActor } from "@/lib/work-projects/page-data";
import { loadCommercialOperations } from "@/lib/work-projects/commercial-service";
import { procurementGroups } from "@/lib/work-projects/commercial-rules";
import { loadOperationsSummary } from "@/lib/work-projects/field-service";
import { loadInstallationOperations } from "@/lib/work-projects/installation-service";

export const dynamic = "force-dynamic";

export default async function ClientProjectsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.userId) redirect("/login");
  if (session.role === "SALESPERSON") redirect("/sales/projects");
  if (!["CLIENT_MANAGER", "SUPER_ADMIN"].includes(session.role)) redirect("/login");
  const actor = await tradesProjectActor();
  const [items, owners, operations, commercial, installationOps] = await Promise.all([
    loadProjectList(actor),
    companyOwners(actor.clientId),
    loadOperationsSummary(actor.clientId),
    loadCommercialOperations(actor.clientId),
    loadInstallationOperations(actor.clientId),
  ]);
  const operationsView = operations
    ? {
        ...operations,
        awaitingDeposit: commercial.awaitingDeposit,
        partiallyPaid: commercial.partiallyPaid,
        readyForEquipment: commercial.readyForEquipment,
        missingStock: commercial.missingStock,
        fullyReserved: commercial.fullyReserved,
        outstandingTotal: commercial.outstandingTotal,
        procurement: procurementGroups(commercial.procurement),
        installationsToday: installationOps.installationsToday,
        installationsInProgress: installationOps.inProgress,
        qaPending: installationOps.qaPending,
        commissioningPending: installationOps.commissioningPending,
        handoverPending: installationOps.handoverPending,
        readyToComplete: installationOps.readyToComplete,
        installationsBlocked: installationOps.blocked,
      }
    : null;

  return (
    <ClientManagerLayout
      breadcrumbPage="PROJECTS"
      pageTitle="Projects"
      workspaceShell
      workspaceTitle="Projects"
      workspaceDescription="Track delivery after a deal is won."
    >
      <ProjectListClient initialItems={items} basePath="/client/projects" canCreate owners={owners} operations={operationsView} />
    </ClientManagerLayout>
  );
}
