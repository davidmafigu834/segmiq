import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { ClientManagerLayout } from "@/components/layouts/ClientManagerLayout";
import { MarketingOverview } from "@/components/marketing/MarketingOverview";
import { RealEstateMarketingWorkspace } from "@/components/real-estate/marketing/RealEstateMarketingWorkspace";

export const dynamic = "force-dynamic";

export default async function MarketingPage() {
  const session = await getServerSession(authOptions);
  if (!session?.clientId) redirect("/login");
  if (session.role !== "CLIENT_MANAGER") redirect("/login");

  const supabase = createAdminClient();
  const { data: client } = await supabase
    .from("clients")
    .select("id, name, business_type")
    .eq("id", session.clientId)
    .maybeSingle();
  if (!client) redirect("/login");

  if (client.business_type === "real_estate") {
    return (
      <ClientManagerLayout
        breadcrumbPage="Marketing"
        pageTitle="Marketing"
        workspaceShell
        workspaceTitle="Marketing"
        workspaceDescription="See which channels and campaigns are generating real property opportunities."
      >
        <RealEstateMarketingWorkspace
          clientId={session.clientId}
          clientName={(client.name as string | null) || "Company"}
        />
      </ClientManagerLayout>
    );
  }

  return (
    <ClientManagerLayout breadcrumbPage="Marketing" pageTitle="Marketing Hub" workspaceShell>
      <MarketingOverview clientId={session.clientId} />
    </ClientManagerLayout>
  );
}
