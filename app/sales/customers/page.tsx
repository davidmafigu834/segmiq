import { Head, RegisterList } from "@/components/sales/solar/desk";
import { SolarSalesFrame } from "@/components/sales/solar/SolarSalesFrame";
import { getCompanyCustomersPageData } from "@/lib/sales/get-company-customers-page-data";
import { loadSolarSalesPage } from "@/lib/sales/solar-workflow/salesperson-page";

export const dynamic = "force-dynamic";

export default async function SalesCustomersPage() {
  const { shell, clientId } = await loadSolarSalesPage();
  const data = await getCompanyCustomersPageData({ clientId }).catch(() => null);
  const rows = (data?.rows ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    meta: [row.phone, row.location].filter(Boolean).join(" · ") || "No phone yet",
    fact: row.wonDeals > 0 ? `${row.wonDeals} won` : row.activeDeals > 0 ? `${row.activeDeals} open` : row.customerTypeLabel,
  }));

  return (
    <SolarSalesFrame shell={shell} title="Customers" breadcrumb="Sales / Customers">
      <div className="space-y-8">
        <Head
          kicker="Customers"
          title="Customers"
          detail="People who already bought, or whose deal is still open. Open a lead from Sales when you need the stage, the visit, or the quotation."
        />
        <RegisterList
          title="Customers"
          rows={rows}
          emptyTitle="No customers yet"
          emptyDetail="A lead becomes a customer when the deal is won."
        />
      </div>
    </SolarSalesFrame>
  );
}
