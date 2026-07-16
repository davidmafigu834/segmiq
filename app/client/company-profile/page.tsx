import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAgencySettings } from "@/lib/agency-settings";
import { ClientManagerLayout } from "@/components/layouts/ClientManagerLayout";
import { CompanyProfileManager } from "@/components/client-settings/CompanyProfileManager";
import { PageHeader } from "@/components/ui";

export default async function ClientCompanyProfilePage() {
  const session = await getServerSession(authOptions);
  if (!session?.userId || session.role !== "CLIENT_MANAGER" || !session.clientId) {
    redirect("/login");
  }

  const supabase = createAdminClient();
  const [agency, { data: client }] = await Promise.all([
    getAgencySettings(),
    supabase.from("clients").select("id, name").eq("id", session.clientId).single(),
  ]);

  if (!client) redirect("/login");

  const clientName = client.name as string;

  return (
    <ClientManagerLayout breadcrumbPage="COMPANY" pageTitle="Company profile" hideShellHeader>
      <div className="min-w-0 w-full max-w-full pb-16">
        <PageHeader
          className="mb-8"
          eyebrow={`${clientName} / Company`}
          title="Company profile"
          description="Update your business details, logo, and branding — the same settings your agency manages under client profile."
        />

        <CompanyProfileManager
          clientId={session.clientId}
          agencyDefaultHours={agency.default_response_time_limit_hours}
        />
      </div>
    </ClientManagerLayout>
  );
}
