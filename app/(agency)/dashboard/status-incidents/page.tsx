import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { AgencyLayout } from "@/components/layouts/AgencyLayout";
import { StatusIncidentsManager } from "@/components/agency/StatusIncidentsManager";
import { listIncidents } from "@/lib/status-admin";

export const dynamic = "force-dynamic";

export default async function StatusIncidentsPage() {
  const session = await getServerSession(authOptions);
  if (!session || session.role !== "AGENCY_ADMIN") {
    redirect("/login");
  }

  let incidents: Awaited<ReturnType<typeof listIncidents>> = [];
  try {
    incidents = await listIncidents();
  } catch {
    incidents = [];
  }

  return (
    <AgencyLayout breadcrumb="AGENCY / STATUS" pageTitle="Status incidents">
      <StatusIncidentsManager initialIncidents={incidents} />
    </AgencyLayout>
  );
}
