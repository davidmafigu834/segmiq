import { Suspense } from "react";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { ClientManagerLayout } from "@/components/layouts/ClientManagerLayout";
import { AcquisitionWorkspace } from "@/components/real-estate/acquisition/AcquisitionWorkspace";
import { CompanyReShell } from "@/components/real-estate/company/CompanyReShell";
import { redirectIfNotRealEstate } from "@/lib/real-estate/gating";

export default async function Page() {
  const session = await getServerSession(authOptions);
  if (!session?.userId || session.role !== "CLIENT_MANAGER" || !session.clientId) redirect("/login");
  const supabase = createAdminClient();
  const { data: client } = await supabase.from("clients").select("business_type").eq("id", session.clientId).single();
  if (!client) redirect("/login");
  redirectIfNotRealEstate(client.business_type);
  return (
    <ClientManagerLayout breadcrumbPage="OPPORTUNITIES" pageTitle="Property Opportunities" hideShellHeader hideShellSidebar>
      <CompanyReShell
        userId={session.userId}
        clientId={session.clientId}
        userName={session.user?.name ?? "User"}
        role={session.role}
        breadcrumb="Company / Opportunities"
        title="Property opportunities"
        description="Track potential properties from first contact to approved listing."
      >
        <Suspense fallback={null}>
          <AcquisitionWorkspace clientId={session.clientId} basePath="/client/acquisitions" framed />
        </Suspense>
      </CompanyReShell>
    </ClientManagerLayout>
  );
}
