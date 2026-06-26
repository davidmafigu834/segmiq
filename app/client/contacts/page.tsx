import { Suspense } from "react";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { ClientManagerLayout } from "@/components/layouts/ClientManagerLayout";
import { HubTabs } from "@/components/client-contacts/HubTabs";
import { CustomerHubContactsShell } from "@/components/customer-hub/CustomerHubContactsShell";

export const dynamic = "force-dynamic";

export default async function ClientContactsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.clientId) redirect("/login");
  if (session.role !== "CLIENT_MANAGER" && session.role !== "AGENCY_ADMIN") redirect("/login");

  const supabase = createAdminClient();
  const { data: clientRow } = await supabase
    .from("clients")
    .select("assignment_mode")
    .eq("id", session.clientId)
    .maybeSingle();

  const assignmentMode =
    (clientRow?.assignment_mode as "direct" | "pool" | "round_robin" | null) ?? "direct";

  return (
    <ClientManagerLayout breadcrumbPage="CONTACTS" pageTitle="Customer Hub" hideShellHeader>
      <Suspense fallback={<div className="shimmer h-64 rounded-xl" />}>
        <div className="px-0">
          <HubTabs />
          <CustomerHubContactsShell
            clientId={session.clientId}
            assignmentMode={assignmentMode}
            showDashboard={false}
            showLifecycleFilter
            heading="Contacts"
            subheading="everyone you've dealt with — leads and customers"
          />
        </div>
      </Suspense>
    </ClientManagerLayout>
  );
}
