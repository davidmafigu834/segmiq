import { Suspense } from "react";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { ClientManagerLayout } from "@/components/layouts/ClientManagerLayout";
import { HubTabs } from "@/components/client-contacts/HubTabs";
import { CustomerHubOverviewShell } from "@/components/customer-hub/CustomerHubOverviewShell";

export default async function ClientLeadsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.clientId) redirect("/login");
  if (session.role !== "CLIENT_MANAGER") redirect("/login");

  const supabase = createAdminClient();
  const clientId = session.clientId;

  const { data: clientRow } = await supabase
    .from("clients")
    .select("name, assignment_mode")
    .eq("id", clientId)
    .maybeSingle();

  const clientName = (clientRow?.name as string) ?? "Your company";
  const assignmentMode =
    (clientRow?.assignment_mode as "direct" | "pool" | "round_robin" | null) ?? "direct";

  return (
    <ClientManagerLayout breadcrumbPage="OVERVIEW" pageTitle="Customer Hub" hideShellHeader>
      <Suspense fallback={<div className="shimmer h-64 rounded-xl" />}>
        <div className="px-0">
          <HubTabs />
          <CustomerHubOverviewShell
            clientId={clientId}
            clientName={clientName}
            assignmentMode={assignmentMode}
          />
        </div>
      </Suspense>
    </ClientManagerLayout>
  );
}
