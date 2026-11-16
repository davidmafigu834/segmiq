import { loadWorkspacePlanBadge } from "@/lib/billing/workspace-plan";
import { Head, RegisterList } from "@/components/sales/solar/desk";
import { SolarSalesFrame } from "@/components/sales/solar/SolarSalesFrame";
import { loadSolarSalesPage } from "@/lib/sales/solar-workflow/salesperson-page";

export const dynamic = "force-dynamic";

export default async function SalesBillingPage() {
  const { shell, clientId } = await loadSolarSalesPage();
  const badge = await loadWorkspacePlanBadge(clientId);
  const rows = badge
    ? [{ id: "plan", name: badge.label, meta: badge.overdue ? "Payment needs attention" : "Current plan", fact: null }]
    : [];

  return (
    <SolarSalesFrame shell={shell} title="Billing" breadcrumb="Sales / Billing">
      <div className="space-y-8">
        <Head
          kicker="Management"
          title="Billing"
          detail="The company plan. Payment and invoices stay with the company owner."
        />
        <RegisterList
          title="Plan"
          rows={rows}
          emptyTitle="No plan on the account"
          emptyDetail="A subscription shows here once the company is on a plan."
        />
      </div>
    </SolarSalesFrame>
  );
}
