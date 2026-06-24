import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAgencySettings } from "@/lib/agency-settings";
import { ClientManagerLayout } from "@/components/layouts/ClientManagerLayout";
import { CompanyProfileManager } from "@/components/client-settings/CompanyProfileManager";

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

  return (
    <ClientManagerLayout breadcrumbPage="COMPANY" pageTitle="Company profile">
      <div className="mx-auto max-w-3xl pb-16">
        <header className="mb-10">
          <div className="mb-2 font-mono text-[11px] uppercase tracking-[0.1em] text-[--text-tertiary]">
            {client.name as string} / Company
          </div>
          <h1 className="font-serif text-4xl tracking-tight text-[--text-primary]">Company profile</h1>
          <p className="mt-2 text-sm text-[--text-secondary]">
            Update your business details, logo, and branding — the same settings your agency manages under client profile.
          </p>
        </header>

        <CompanyProfileManager
          clientId={session.clientId}
          agencyDefaultHours={agency.default_response_time_limit_hours}
        />
      </div>
    </ClientManagerLayout>
  );
}
