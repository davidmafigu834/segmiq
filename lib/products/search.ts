import { createAdminClient } from "@/lib/supabase/admin";
import { omitCostFields } from "@/lib/commercial/money";
import { packageAvailability } from "@/lib/packages/availability";
import { availableQty, stockStatus } from "@/lib/inventory/math";
import type { CommercialSearchResult, CommercialSearchType } from "@/lib/commercial/types";

export type CommercialSearchQuery = {
  clientId: string;
  q?: string;
  types?: CommercialSearchType[] | "ALL";
  limit?: number;
  canSeeCost: boolean;
  includeInactive?: boolean;
};

function likeTerm(q: string): string {
  return `%${q.replace(/[%_,]/g, "")}%`;
}

export async function searchCommercialItems(opts: CommercialSearchQuery): Promise<{
  results: CommercialSearchResult[];
}> {
  const supabase = createAdminClient();
  const limit = Math.min(24, Math.max(1, opts.limit ?? 12));
  const q = (opts.q ?? "").trim();
  const types = opts.types === "ALL" || !opts.types ? (["PRODUCT", "SERVICE", "PACKAGE"] as CommercialSearchType[]) : opts.types;
  const results: CommercialSearchResult[] = [];

  if (types.includes("PRODUCT") || types.includes("SERVICE")) {
    let query = supabase
      .from("products")
      .select(
        "id, name, sku, brand, item_type, selling_price, currency, status, primary_image_url, track_inventory, cost_price, can_be_quoted, description, quotation_description"
      )
      .eq("client_id", opts.clientId)
      .eq("can_be_quoted", true)
      .limit(limit);
    if (!opts.includeInactive) query = query.eq("status", "ACTIVE");
    if (!types.includes("PRODUCT")) query = query.eq("item_type", "SERVICE");
    else if (!types.includes("SERVICE")) query = query.eq("item_type", "PRODUCT");
    if (q) query = query.or(`name.ilike.${likeTerm(q)},sku.ilike.${likeTerm(q)},barcode.ilike.${likeTerm(q)},brand.ilike.${likeTerm(q)}`);
    const { data: products } = await query;
    const productIds = (products ?? []).map((p) => p.id as string);
    const variantCount = new Map<string, number>();
    const avail = new Map<string, number>();
    if (productIds.length) {
      const [{ data: variants }, { data: balances }] = await Promise.all([
        supabase.from("product_variants").select("product_id").eq("client_id", opts.clientId).in("product_id", productIds).eq("status", "ACTIVE"),
        supabase.from("inventory_balances").select("product_id, on_hand, reserved").eq("client_id", opts.clientId).in("product_id", productIds),
      ]);
      for (const v of variants ?? []) {
        const id = v.product_id as string;
        variantCount.set(id, (variantCount.get(id) ?? 0) + 1);
      }
      for (const b of balances ?? []) {
        const id = b.product_id as string;
        avail.set(id, (avail.get(id) ?? 0) + availableQty(Number(b.on_hand), Number(b.reserved)));
      }
    }
    for (const p of products ?? []) {
      const tracked = Boolean(p.track_inventory) && p.item_type === "PRODUCT";
      const qty = tracked ? avail.get(p.id as string) ?? 0 : null;
      results.push({
        type: p.item_type === "SERVICE" ? "SERVICE" : "PRODUCT",
        id: p.id as string,
        name: p.name as string,
        sku: (p.sku as string | null) ?? null,
        brand: (p.brand as string | null) ?? null,
        price: Number(p.selling_price) || 0,
        currency: (p.currency as string) ?? "USD",
        availability: stockStatus({
          trackInventory: tracked,
          available: qty ?? 0,
        }),
        availableQty: tracked ? qty : null,
        image: (p.primary_image_url as string | null) ?? null,
        status: p.status as string,
        hasVariants: (variantCount.get(p.id as string) ?? 0) > 0,
        description: (p.quotation_description as string | null) ?? (p.description as string | null) ?? null,
      });
    }
  }

  if (types.includes("PACKAGE")) {
    let query = supabase
      .from("commercial_packages")
      .select("id, name, status, pricing_mode, fixed_price, currency, image_url, can_be_quoted, description, customer_facing_description")
      .eq("client_id", opts.clientId)
      .eq("can_be_quoted", true)
      .limit(limit);
    if (!opts.includeInactive) query = query.eq("status", "ACTIVE");
    if (q) query = query.or(`name.ilike.${likeTerm(q)},code.ilike.${likeTerm(q)}`);
    const { data: packages } = await query;
    const packageIds = (packages ?? []).map((p) => p.id as string);
    const { data: items } = packageIds.length
      ? await supabase
          .from("commercial_package_items")
          .select("package_id, item_type, product_id, variant_id, quantity, optional, variant_mode")
          .in("package_id", packageIds)
      : { data: [] as Array<Record<string, unknown>> };

    const productIds = [...new Set((items ?? []).map((i) => i.product_id as string).filter(Boolean))];
    const productsById = new Map<string, Record<string, unknown>>();
    const availByKey = new Map<string, number>();
    if (productIds.length) {
      const { data: prods } = await supabase
        .from("products")
        .select("id, name, selling_price, track_inventory, item_type, status")
        .eq("client_id", opts.clientId)
        .in("id", productIds);
      for (const p of prods ?? []) productsById.set(p.id as string, p);
      const { data: balances } = await supabase
        .from("inventory_balances")
        .select("product_id, variant_id, on_hand, reserved")
        .eq("client_id", opts.clientId)
        .in("product_id", productIds);
      for (const b of balances ?? []) {
        const key = `${b.product_id}:${b.variant_id ?? ""}`;
        availByKey.set(key, (availByKey.get(key) ?? 0) + availableQty(Number(b.on_hand), Number(b.reserved)));
      }
    }

    for (const pkg of packages ?? []) {
      const pkgItems = (items ?? []).filter((i) => i.package_id === pkg.id);
      const avail = packageAvailability(
        pkgItems.map((i) => {
          const product = productsById.get(i.product_id as string);
          const isService = i.item_type === "SERVICE" || product?.item_type === "SERVICE";
          const tracked = Boolean(product?.track_inventory) && !isService;
          const unresolved =
            i.variant_mode !== "FIXED_VARIANT" && !i.variant_id && Boolean(product);
          const key = `${i.product_id}:${i.variant_id ?? ""}`;
          return {
            id: String(i.product_id ?? ""),
            name: String(product?.name ?? "Item"),
            requiredQty: Number(i.quantity) || 1,
            trackInventory: tracked,
            isService: Boolean(isService),
            optional: Boolean(i.optional),
            variantUnresolved: unresolved,
            available: tracked ? availByKey.get(key) ?? 0 : null,
            archived: product?.status === "ARCHIVED",
            missingPrice: product != null && !(Number(product.selling_price) > 0) && pkg.pricing_mode === "SUM_OF_ITEMS",
          };
        })
      );
      const price =
        pkg.pricing_mode === "FIXED_PRICE"
          ? Number(pkg.fixed_price) || 0
          : pkgItems.reduce((sum, i) => {
              const product = productsById.get(i.product_id as string);
              return sum + (Number(product?.selling_price) || 0) * (Number(i.quantity) || 0);
            }, 0);
      results.push({
        type: "PACKAGE",
        id: pkg.id as string,
        name: pkg.name as string,
        price,
        currency: (pkg.currency as string) ?? "USD",
        availability: avail.status,
        availableQty: avail.availableCount,
        image: (pkg.image_url as string | null) ?? null,
        status: pkg.status as string,
        itemCount: pkgItems.filter((i) => i.item_type !== "SERVICE").length,
        serviceCount: pkgItems.filter((i) => i.item_type === "SERVICE").length,
        description:
          (pkg.customer_facing_description as string | null) ?? (pkg.description as string | null) ?? null,
        pricingMode: (pkg.pricing_mode as CommercialSearchResult["pricingMode"]) ?? null,
      });
    }
  }

  return { results: omitCostFields(results.slice(0, limit), opts.canSeeCost) };
}
