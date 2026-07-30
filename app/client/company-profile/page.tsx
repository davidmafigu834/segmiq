import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAgencySettings } from "@/lib/agency-settings";
import { ClientManagerLayout } from "@/components/layouts/ClientManagerLayout";
import { CompanyProfileManager } from "@/components/client-settings/CompanyProfileManager";
import { WebsiteIntegrationPanel } from "@/components/real-estate/WebsiteIntegrationPanel";
import { PageHeader } from "@/components/ui";
import { isRealEstate } from "@/lib/terminology";

export default async function ClientCompanyProfilePage() {
  const session = await getServerSession(authOptions);
  if (!session?.userId || session.role !== "CLIENT_MANAGER" || !session.clientId) {
    redirect("/login");
  }

  const supabase = createAdminClient();
  const [agency, { data: client }] = await Promise.all([
    getAgencySettings(),
    supabase.from("clients").select("id, name, business_type").eq("id", session.clientId).single(),
  ]);

  if (!client) redirect("/login");

  const clientName = client.name as string;
  const showIntegration = isRealEstate(client.business_type);

  return (
    <ClientManagerLayout breadcrumbPage="COMPANY" pageTitle="Company profile" hideShellHeader>
      <div className="min-w-0 w-full max-w-full pb-16">
        <PageHeader
          className="mb-8"
          eyebrow={`${clientName} / Company`}
          title="Company profile"
          description="Update your business details, logo, and branding — the same settings available under company profile."
        />

        <CompanyProfileManager
          clientId={session.clientId}
          agencyDefaultHours={agency.default_response_time_limit_hours}
        />

        {showIntegration ? (
          <div className="mt-10">
            <WebsiteIntegrationPanel clientId={session.clientId} />
          </div>
        ) : null}
      </div>
    </ClientManagerLayout>
  );
}
