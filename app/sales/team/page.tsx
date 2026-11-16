import { createAdminClient } from "@/lib/supabase/admin";
import { Head, RegisterList } from "@/components/sales/solar/desk";
import { SolarSalesFrame } from "@/components/sales/solar/SolarSalesFrame";
import { loadSolarSalesPage } from "@/lib/sales/solar-workflow/salesperson-page";

export const dynamic = "force-dynamic";

const ROLE: Record<string, string> = {
  CLIENT_MANAGER: "Manager",
  SALESPERSON: "Sales",
};

export default async function SalesTeamPage() {
  const { shell, clientId } = await loadSolarSalesPage();
  const { data } = await createAdminClient()
    .from("users")
    .select("id, name, role, is_active")
    .eq("client_id", clientId)
    .order("name", { ascending: true });
  const rows = (data ?? []).map((member) => ({
    id: String(member.id),
    name: member.name || "Teammate",
    meta: ROLE[String(member.role)] || String(member.role || "Team"),
    fact: member.is_active === false ? "Inactive" : "Active",
  }));

  return (
    <SolarSalesFrame shell={shell} title="Team" breadcrumb="Sales / Team">
      <div className="space-y-8">
        <Head kicker="Management" title="Team" detail="Everyone on this solar company." />
        <RegisterList title="People" rows={rows} emptyTitle="No teammates yet" emptyDetail="People invited to the company show here." />
      </div>
    </SolarSalesFrame>
  );
}
