import { Suspense } from "react";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { ClientManagerLayout } from "@/components/layouts/ClientManagerLayout";
import { HubTabs } from "@/components/client-contacts/HubTabs";
import { CustomerHubCustomersShell } from "@/components/customer-hub/CustomerHubCustomersShell";

export const dynamic = "force-dynamic";

export default async function ClientCustomersPage() {
  const session = await getServerSession(authOptions);
  if (!session?.clientId) redirect("/login");
  if (session.role !== "CLIENT_MANAGER" && session.role !== "SUPER_ADMIN") redirect("/login");

  const supabase = createAdminClient();
  const { data: clientRow } = await supabase
    .from("clients")
    .select("name, assignment_mode")
    .eq("id", session.clientId)
    .maybeSingle();

  const assignmentMode =
    (clientRow?.assignment_mode as "direct" | "pool" | "round_robin" | null) ?? "direct";
  const clientName = (clientRow?.name as string) ?? undefined;

  return (
    <ClientManagerLayout breadcrumbPage="CUSTOMERS" pageTitle="Customer Hub" hideShellHeader>
      <Suspense fallback={<div className="shimmer h-64 rounded-xl" />}>
        <div className="px-0">
          <HubTabs />
          <CustomerHubCustomersShell
            clientId={session.clientId}
            clientName={clientName}
            assignmentMode={assignmentMode}
          />
        </div>
      </Suspense>
    </ClientManagerLayout>
  );
}
