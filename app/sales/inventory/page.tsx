import { Head, RegisterList } from "@/components/sales/solar/desk";
import { SolarSalesFrame } from "@/components/sales/solar/SolarSalesFrame";
import { inventoryOverview } from "@/lib/inventory/service";
import { listProducts } from "@/lib/products/service";
import { loadSolarSalesPage } from "@/lib/sales/solar-workflow/salesperson-page";

export const dynamic = "force-dynamic";

const STOCK: Record<string, string> = {
  IN_STOCK: "In stock",
  LOW_STOCK: "Low stock",
  OUT_OF_STOCK: "Out of stock",
  NOT_TRACKED: "Not tracked",
};

export default async function SalesInventoryPage() {
  const { shell, clientId } = await loadSolarSalesPage();
  const [overview, result] = await Promise.all([
    inventoryOverview(clientId).catch(() => null),
    listProducts({ clientId, status: "ACTIVE", limit: 80, canSeeCost: false }),
  ]);
  const items = "items" in result ? result.items : [];
  const rows = items
    .map((item) => item as {
      id: string;
      name?: string | null;
      sku?: string | null;
      available_qty?: number | null;
      inventory_status?: string | null;
      track_inventory?: boolean | null;
    })
    .filter((item) => item.track_inventory || (item.inventory_status && item.inventory_status !== "NOT_TRACKED"))
    .map((item) => ({
      id: String(item.id),
      name: item.name || "Item",
      meta: item.sku || "No code",
      fact: `${item.available_qty ?? 0} available · ${STOCK[item.inventory_status || ""] || "Stock"}`,
    }));
  const summary = overview
    ? `${overview.stockedSkus} stocked, ${overview.lowStock} low, ${overview.outOfStock} out of stock, ${overview.locations} locations.`
    : "Stock the company is tracking.";

  return (
    <SolarSalesFrame shell={shell} title="Inventory" breadcrumb="Sales / Inventory">
      <div className="space-y-8">
        <Head kicker="Products & stock" title="Inventory" detail={summary} />
        <RegisterList
          title="Stock"
          rows={rows}
          emptyTitle="Nothing is tracked"
          emptyDetail="Products with stock tracking show their available quantity here."
        />
      </div>
    </SolarSalesFrame>
  );
}
