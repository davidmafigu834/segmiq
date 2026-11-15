import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { AgencyLayout } from "@/components/layouts/AgencyLayout";
import { fetchCloudClientsForAdmin } from "@/lib/cloud-clients";
import { CloudClientsClient } from "./CloudClientsClient";
import { RecordFrame } from "@/components/platform/workbench";

export const dynamic = "force-dynamic";

export default async function CloudClientsPage() {
  const session = await getServerSession(authOptions);
  if (!session || session.role !== "SUPER_ADMIN") {
    redirect("/dashboard");
  }

  const { clients: cloudClients, queryError } = await fetchCloudClientsForAdmin();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  let projectRef = "";
  try {
    projectRef = new URL(supabaseUrl).hostname.split(".")[0];
  } catch {}
  const supabaseDashboardBase = projectRef
    ? `https://supabase.com/dashboard/project/${projectRef}/editor?table=clients`
    : "https://supabase.com/dashboard";

  return (
    <AgencyLayout breadcrumb="Customers / Users" pageTitle="Users">
      <RecordFrame
        detail="A user belongs to an organisation. Open the organisation when you need the tenant, not the person."
        fact={{
          name: cloudClients[0] ? `${cloudClients.length} users are on the register.` : "No user is on the register.",
          detail: queryError ? "The register could not be loaded." : "Suspend or reactivate from the row. The organisation is the record.",
          action: "Open organisations",
          href: "/dashboard/clients",
        }}
      >
      {queryError ? (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-700">
          Could not load cloud clients from the database.
          <span className="mt-1 block font-mono text-[11px] opacity-80">{queryError}</span>
        </div>
      ) : null}
      <CloudClientsClient
        initialClients={cloudClients}
        supabaseDashboardBase={supabaseDashboardBase}
      />
      </RecordFrame>
    </AgencyLayout>
  );
}
