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
      <div className="px-4 py-4 pb-[calc(var(--sales-mobile-nav-height,64px)+28px)] md:px-6 md:pb-6">
        <HandoverWorkspace clientId={session.clientId} />
      </div>
    </ClientManagerLayout>
  );
}
