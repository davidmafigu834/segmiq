import { Head, RegisterList } from "@/components/sales/solar/desk";
import { SolarSalesFrame } from "@/components/sales/solar/SolarSalesFrame";
import { listPackages } from "@/lib/packages/service";
import { loadSolarSalesPage } from "@/lib/sales/solar-workflow/salesperson-page";

export const dynamic = "force-dynamic";

export default async function SalesPackagesPage() {
  const { shell, clientId } = await loadSolarSalesPage();
  const result = await listPackages({ clientId, canSeeCost: false });
  const rows = (result.packages ?? []).map((item) => {
    const row = item as { id?: string; name?: string | null; status?: string | null; item_count?: number; service_count?: number };
    const parts = [
      row.item_count ? `${row.item_count} products` : null,
      row.service_count ? `${row.service_count} services` : null,
    ].filter(Boolean);
    return {
      id: String(row.id),
      name: row.name || "Package",
      meta: parts.join(" · ") || "No lines yet",
      fact: row.status ? String(row.status).replace(/_/g, " ").toLowerCase() : null,
    };
  });

  return (
    <SolarSalesFrame shell={shell} title="Packages" breadcrumb="Sales / Packages">
      <div className="space-y-8">
        <Head
          kicker="Products & stock"
          title="Packages"
          detail="Ready-made systems you can drop onto a quotation."
        />
        <RegisterList
          title="Packages"
          rows={rows}
          emptyTitle="No packages yet"
          emptyDetail="A package groups products and services into one system."
        />
      </div>
    </SolarSalesFrame>
  );
}
