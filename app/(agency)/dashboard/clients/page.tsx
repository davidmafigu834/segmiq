import { AgencyLayout } from "@/components/layouts/AgencyLayout";
import { createAdminClient } from "@/lib/supabase/admin";
import { ClientsPageClient } from "@/components/dashboard/ClientsPageClient";
import { ClientsPageHeaderAction } from "@/components/dashboard/ClientsPageHeaderAction";

export const dynamic = "force-dynamic";

function isPendingSetup(name: string) {
  return name.trim().toLowerCase() === "pending setup";
}

export default async function ClientsPage() {
  const supabase = createAdminClient();
  const { data: clients, error } = await supabase
    .from("clients")
    .select("id, name, industry, agency_managed, is_active, created_at")
    .or("is_archived.is.null,is_archived.eq.false")
    .order("name");

  if (error) {
    console.error("[ClientsPage] failed to load clients:", error.message);
  }

  const rows =
    clients
      ?.map((c) => ({
        id: c.id as string,
        name: c.name as string,
        industry: (c.industry as string) ?? "",
        agency_managed: Boolean((c as { agency_managed?: boolean | null }).agency_managed ?? true),
        is_active: (c as { is_active?: boolean | null }).is_active !== false,
        created_at: ((c as { created_at?: string | null }).created_at as string | null) ?? null,
      }))
      .sort((a, b) => {
        const aPending = isPendingSetup(a.name) ? 1 : 0;
        const bPending = isPendingSetup(b.name) ? 1 : 0;
        if (aPending !== bPending) return aPending - bPending;
        return a.name.localeCompare(b.name);
      }) ?? [];

  return (
    <AgencyLayout
      breadcrumb="Organisations"
      pageTitle="Organisations"
      actions={<ClientsPageHeaderAction />}
    >
      <ClientsPageClient clients={rows} loadError={error?.message ?? null} />
    </AgencyLayout>
  );
}
