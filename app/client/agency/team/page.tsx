import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { ClientManagerLayout } from "@/components/layouts/ClientManagerLayout";
import { HandoverWorkspace } from "@/components/real-estate/agency/HandoverWorkspace";
import { redirectIfNotRealEstate } from "@/lib/real-estate/gating";

export const dynamic = "force-dynamic";

export default async function Page() {
  const session = await getServerSession(authOptions);
  if (!session?.userId || session.role !== "CLIENT_MANAGER" || !session.clientId) redirect("/login");
  const supabase = createAdminClient();
  const { data: client } = await supabase.from("clients").select("business_type").eq("id", session.clientId).single();
  if (!client) redirect("/login");
  redirectIfNotRealEstate(client.business_type);
  return (
    <ClientManagerLayout breadcrumbPage="TEAM" pageTitle="Team management" hideShellHeader hideShellSidebar>
      <div className="space-y-4 px-4 py-4 md:px-6">
        <h1 className="text-lg font-semibold">Team management</h1>
        <p className="text-sm text-sales-text-secondary">Review current work and hand it over without rewriting history. Account deactivation stays in the team directory.</p>
        <HandoverWorkspace clientId={session.clientId} />
      </div>
    </ClientManagerLayout>
  );
}
