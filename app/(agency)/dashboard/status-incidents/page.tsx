import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { AgencyLayout } from "@/components/layouts/AgencyLayout";
import { StatusIncidentsManager } from "@/components/agency/StatusIncidentsManager";
import { RecordFrame } from "@/components/platform/workbench";
import { listIncidents } from "@/lib/status-admin";

export const dynamic = "force-dynamic";

export default async function StatusIncidentsPage() {
  const session = await getServerSession(authOptions);
  if (!session || session.role !== "SUPER_ADMIN") {
    redirect("/login");
  }

  let incidents: Awaited<ReturnType<typeof listIncidents>> = [];
  try {
    incidents = await listIncidents();
  } catch {
    incidents = [];
  }

  return (
    <AgencyLayout breadcrumb="Operations / Platform Health" pageTitle="Platform Health">
      <RecordFrame
        detail="An open incident is the decision. The register below is the record."
        fact={{
          name: incidents.find((incident) => !incident.resolved_at)?.title ?? "No incident is open.",
          detail: incidents.find((incident) => !incident.resolved_at)?.body ?? "Write one here when a component is degraded.",
          action: "Open organisations",
          href: "/dashboard/clients",
        }}
      >
        <StatusIncidentsManager initialIncidents={incidents} />
      </RecordFrame>
    </AgencyLayout>
  );
}
