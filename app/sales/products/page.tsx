import { Head, RegisterList } from "@/components/sales/solar/desk";
import { SolarSalesFrame } from "@/components/sales/solar/SolarSalesFrame";
import { listProducts } from "@/lib/products/service";
import { loadSolarSalesPage } from "@/lib/sales/solar-workflow/salesperson-page";

export const dynamic = "force-dynamic";

function price(currency: string | null | undefined, amount: number | null | undefined) {
  if (amount == null || Number.isNaN(Number(amount))) return "No price";
  const formatted = Number(amount).toLocaleString("en-US", { maximumFractionDigits: 0 });
  return !currency || currency === "USD" ? `US$${formatted}` : `${currency} ${formatted}`;
}

export default async function SalesProductsPage() {
  const { shell, clientId } = await loadSolarSalesPage();
  const result = await listProducts({ clientId, status: "ACTIVE", limit: 80, canSeeCost: false });
  const items = "items" in result ? result.items : [];
  const rows = items.map((item) => {
    const row = item as {
      id: string;
      name?: string | null;
      sku?: string | null;
      brand?: string | null;
      selling_price?: number | null;
      currency?: string | null;
    };
    return {
      id: String(row.id),
      name: row.name || "Product",
      meta: [row.brand, row.sku].filter(Boolean).join(" · ") || "No code",
      fact: price(row.currency, row.selling_price),
    };
  });

  return (
    <SolarSalesFrame shell={shell} title="Products" breadcrumb="Sales / Products">
      <div className="space-y-8">
        <Head
          kicker="Products & stock"
          title="Products"
          detail="Panels, inverters, batteries, and services you can put on a quotation."
        />
        <RegisterList
          title="Catalogue"
          rows={rows}
          emptyTitle="No products yet"
          emptyDetail="Active products for this company show here."
        />
      </div>
    </SolarSalesFrame>
  );
}
