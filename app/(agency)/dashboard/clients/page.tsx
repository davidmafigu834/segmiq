import { AgencyLayout } from "@/components/layouts/AgencyLayout";
import { createAdminClient } from "@/lib/supabase/admin";
import { ClientsPageClient } from "@/components/dashboard/ClientsPageClient";
import { ClientsPageHeaderAction } from "@/components/dashboard/ClientsPageHeaderAction";

export const dynamic = "force-dynamic";

export default async function ClientsPage() {
  const supabase = createAdminClient();
  const { data: clients } = await supabase
    .from("clients")
    .select("id, name, industry, agency_managed")
    .or("is_archived.is.null,is_archived.eq.false")
    .order("name");

  const rows =
    clients?.map((c) => ({
      id: c.id as string,
      name: c.name as string,
      industry: (c.industry as string) ?? "",
      agency_managed: Boolean((c as { agency_managed?: boolean | null }).agency_managed ?? true),
    })) ?? [];

  return (
    <AgencyLayout
      breadcrumb="PLATFORM / CLIENTS"
      pageTitle="Clients"
      titleSize="hero"
      actions={<ClientsPageHeaderAction />}
    >
      <ClientsPageClient clients={rows} />
    </AgencyLayout>
  );
}
