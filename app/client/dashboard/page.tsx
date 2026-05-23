import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { addMonths, startOfMonth } from "date-fns";
import { authOptions } from "@/lib/auth";
import { computeClientReport } from "@/lib/client-report";
import { getActivePipelineLeads } from "@/lib/client-active-pipeline";
import { ClientManagerLayout } from "@/components/layouts/ClientManagerLayout";
import { ClientDashboardView } from "@/components/client-dashboard/ClientDashboardView";
import { StaleLeadsAlert } from "@/components/client-dashboard/StaleLeadsAlert";

export default async function ClientDashboardPage({
  searchParams,
}: {
  searchParams?: { lead?: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session?.clientId) redirect("/login");
  if (session.role !== "CLIENT_MANAGER") redirect("/login");
  if (searchParams?.lead) {
    redirect(`/client/leads?lead=${encodeURIComponent(searchParams.lead)}`);
  }

  const clientId = session.clientId;
  const from = startOfMonth(new Date());
  const to = addMonths(from, 1);

  const [report, activeLeads] = await Promise.all([
    computeClientReport(clientId, from, to, "This month"),
    getActivePipelineLeads(clientId, 50),
  ]);

  return (
    <ClientManagerLayout breadcrumbPage="DASHBOARD" pageTitle="Performance">
      <StaleLeadsAlert clientId={clientId} />
      <ClientDashboardView report={report} activeLeads={activeLeads} />
    </ClientManagerLayout>
  );
}
