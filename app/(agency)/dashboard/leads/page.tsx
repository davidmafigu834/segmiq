import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { AgencyLayout } from "@/components/layouts/AgencyLayout";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  buildFilterDescription,
  fetchFilteredLeads,
  getStatusCounts,
  parseLeadFilters,
  type LeadListClient,
} from "@/lib/leads/all-leads";
import { AllLeadsView } from "@/components/agency/AllLeadsView";

function flattenSearchParams(searchParams: Record<string, string | string[] | undefined>): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(searchParams)) {
    out[k] = Array.isArray(v) ? v[0] : v;
  }
  return out;
}

export default async function AllLeadsPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.userId || session.role !== "SUPER_ADMIN") {
    redirect("/login");
  }

  const sp = flattenSearchParams(searchParams);
  const filters = parseLeadFilters(sp);

  const supabase = createAdminClient();
  const [leadsResult, clientsRes, salesRes, counts] = await Promise.all([
    fetchFilteredLeads(filters),
    supabase.from("clients").select("id, name, slug, logo_url, response_time_limit_hours").order("name"),
    supabase.from("users").select("id, name, client_id, avatar_url").eq("role", "SALESPERSON").eq("is_active", true),
    getStatusCounts(filters),
  ]);

  const clients = (clientsRes.data ?? []) as LeadListClient[];
  const clientNames = new Map(clients.map((c) => [c.id, c.name]));
  const filterDescription = buildFilterDescription(filters, clientNames);

  return (
    <AgencyLayout breadcrumb="PLATFORM / LEADS" pageTitle="All leads" hideShellHeader>
      <AllLeadsView
        initialRows={leadsResult.rows}
        totalCount={leadsResult.totalCount}
        clients={clients}
        salespeople={(salesRes.data ?? []) as { id: string; name: string; client_id: string | null; avatar_url: string | null }[]}
        counts={counts}
        filters={filters}
        filterDescription={filterDescription}
      />
    </AgencyLayout>
  );
}
