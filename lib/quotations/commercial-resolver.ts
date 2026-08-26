import { createAdminClient } from "@/lib/supabase/admin";
import { getAvailability } from "@/lib/inventory/service";
import { expandCommercialPackage } from "@/lib/packages/service";
import type { QuotationLineItemInput } from "@/types";
import type { QuoteSourceType } from "@/lib/commercial/types";

export type ResolveItemInput = {
  clientId: string;
  sourceType: QuoteSourceType;
  productId?: string | null;
  variantId?: string | null;
  packageId?: string | null;
  quantity?: number;
  scale?: number;
  sectionId?: string | null;
  custom?: Partial<QuotationLineItemInput>;
};

export async function resolveQuoteItems(input: ResolveItemInput): Promise<{
  lines: QuotationLineItemInput[];
  warnings: string[];
  error?: string;
}> {
  const warnings: string[] = [];
  if (input.sourceType === "CUSTOM") {
    const c = input.custom ?? {};
    return {
      lines: [
        {
          catalog_item_id: null,
          item_name: c.item_name ?? "Custom item",
          description: c.description ?? null,
          unit_price: Number(c.unit_price) || 0,
          quantity: input.quantity ?? c.quantity ?? 1,
          unit: c.unit ?? "Each",
          sku: c.sku ?? null,
          source_type: "CUSTOM",
          price_override: true,
        } as QuotationLineItemInput,
      ],
      warnings,
    };
  }

  if (input.sourceType === "PACKAGE" && input.packageId) {
    const expanded = await expandCommercialPackage({
      clientId: input.clientId,
      packageId: input.packageId,
      scale: input.scale ?? input.quantity ?? 1,
      sectionId: input.sectionId,
    });
    if (expanded.error) return { lines: [], warnings, error: expanded.error };
    return { lines: expanded.lines, warnings };
  }

  if (!input.productId) return { lines: [], warnings, error: "Product is required" };
  const supabase = createAdminClient();
  const { data: product } = await supabase
    .from("products")
    .select("*")
    .eq("client_id", input.clientId)
    .eq("id", input.productId)
    .maybeSingle();
  if (!product) return { lines: [], warnings, error: "Product not found" };
  if (product.status !== "ACTIVE" || !product.can_be_quoted) {
    return { lines: [], warnings, error: "This item cannot be quoted" };
  }

  let variant: Record<string, unknown> | null = null;
  const { data: variants } = await supabase
    .from("product_variants")
    .select("*")
    .eq("product_id", product.id)
    .eq("status", "ACTIVE");
  if ((variants ?? []).length && !input.variantId) {
    return { lines: [], warnings, error: "Select a variant" };
  }
  if (input.variantId) {
    variant = (variants ?? []).find((v) => v.id === input.variantId) ?? null;
    if (!variant) return { lines: [], warnings, error: "Variant not found" };
  }

  const unitPrice =
    variant?.selling_price_override != null
      ? Number(variant.selling_price_override)
      : Number(product.selling_price) || 0;
  const cost =
    variant?.cost_price_override != null ? Number(variant.cost_price_override) : product.cost_price != null ? Number(product.cost_price) : null;
  const name = variant ? `${product.name} · ${variant.name}` : product.name;
  const sku = (variant?.sku as string | null) ?? (product.sku as string | null);

  if (product.track_inventory) {
    const avail = await getAvailability({
      clientId: input.clientId,
      productId: product.id as string,
      variantId: input.variantId,
    });
    const qty = input.quantity ?? 1;
    if (avail.trackInventory && qty > avail.available) {
      warnings.push(`Available: ${avail.available}. Requested: ${qty}.`);
    }
  }

  const line: QuotationLineItemInput = {
    catalog_item_id: (product.legacy_catalog_item_id as string | null) ?? null,
    item_name: name,
    description: (product.quotation_description as string | null) ?? (product.description as string | null),
    unit_price: unitPrice,
    quantity: input.quantity ?? 1,
    unit: (product.unit as string) || "Each",
    sku,
    cost_price: cost,
    tax_rate: product.tax_rate != null ? Number(product.tax_rate) : null,
    image_url: (product.primary_image_url as string | null) ?? null,
    catalog_unit_price: unitPrice,
    price_override: false,
    source_type: product.item_type === "SERVICE" ? "SERVICE" : "PRODUCT",
    product_id: product.id as string,
    variant_id: input.variantId ?? null,
    warranty_snapshot: (product.warranty as string | null) ?? null,
    section_id: input.sectionId ?? null,
  };
  return { lines: [line], warnings };
}

export function priceFreshnessWarning(line: QuotationLineItemInput, currentPrice: number | null): string | null {
  if (currentPrice == null || line.catalog_unit_price == null) return null;
  if (Number(line.unit_price) === Number(currentPrice) && Number(line.catalog_unit_price) === Number(currentPrice)) {
    return null;
  }
  if (Number(line.catalog_unit_price) !== Number(currentPrice)) {
    return `Price changed since item was added. Current catalogue: ${currentPrice}. Quote line: ${line.unit_price}.`;
  }
  return null;
}

export async function quoteInventoryAndPriceWarnings(
  clientId: string,
  items: QuotationLineItemInput[]
): Promise<{
  inventoryShortages: Array<{ name: string; requested: number; available: number }>;
  priceFreshnessWarnings: string[];
}> {
  const inventoryShortages: Array<{ name: string; requested: number; available: number }> = [];
  const priceFreshnessWarnings: string[] = [];
  const priced = items.filter((it) => !it.is_optional && it.product_id);
  if (!priced.length) return { inventoryShortages, priceFreshnessWarnings };

  const supabase = createAdminClient();
  const productIds = [...new Set(priced.map((it) => it.product_id as string))];
  const { data: products } = await supabase
    .from("products")
    .select("id, selling_price")
    .eq("client_id", clientId)
    .in("id", productIds);
  const priceById = new Map((products ?? []).map((p) => [p.id as string, Number(p.selling_price) || 0]));

  for (const it of priced) {
    const productId = it.product_id as string;
    const avail = await getAvailability({
      clientId,
      productId,
      variantId: it.variant_id,
    });
    const requested = Number(it.quantity) || 0;
    if (avail.trackInventory && requested > avail.available) {
      inventoryShortages.push({
        name: it.item_name || "Item",
        requested,
        available: avail.available,
      });
    }
    const warn = priceFreshnessWarning(it, priceById.get(productId) ?? null);
    if (warn) priceFreshnessWarnings.push(warn);
  }
  return { inventoryShortages, priceFreshnessWarnings };
}

