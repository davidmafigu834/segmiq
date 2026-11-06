import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { ClientManagerLayout } from "@/components/layouts/ClientManagerLayout";
import { CompanyReShell } from "@/components/real-estate/company/CompanyReShell";
import { RealEstateLinkDirectory } from "@/components/real-estate/navigation/RealEstateLinkDirectory";
import { redirectIfNotRealEstate } from "@/lib/real-estate/gating";
import { MANAGER_PEOPLE_LINKS } from "@/lib/real-estate/workspace-links";

export const dynamic = "force-dynamic";

export default async function Page() {
  const session = await getServerSession(authOptions);
  if (!session?.userId || session.role !== "CLIENT_MANAGER" || !session.clientId) redirect("/login");
  const supabase = createAdminClient();
  const { data: client } = await supabase.from("clients").select("business_type").eq("id", session.clientId).single();
  if (!client) redirect("/login");
  redirectIfNotRealEstate(client.business_type);
  return (
    <ClientManagerLayout breadcrumbPage="PEOPLE" pageTitle="People" hideShellHeader hideShellSidebar>
      <CompanyReShell
        userId={session.userId}
        clientId={session.clientId}
        userName={session.user?.name ?? "User"}
        role={session.role}
        breadcrumb="Company / People"
        title="People"
        description="Sellers, buyers, contacts, and customers."
      >
        <RealEstateLinkDirectory
          title="People"
          description="Sellers, buyers and tenants, introductions, contacts, and customers."
          links={MANAGER_PEOPLE_LINKS}
        />
      </CompanyReShell>
    </ClientManagerLayout>
  );
}
