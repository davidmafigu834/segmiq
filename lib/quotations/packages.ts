import type { QuotationLineItemInput } from "@/types";

export type PackagePricingModel = "component_total" | "fixed" | "discounted_bundle";
export type PackageFlexibility = "locked" | "flexible" | "quantity_adjustable";

export type PackageComponentInput = {
  catalog_item_id: string | null;
  item_name: string;
  description: string | null;
  quantity: number;
  unit: string;
  unit_price: number;
  cost_price: number | null;
  sku: string | null;
  is_optional: boolean;
};

export function expandPackageToLineItems(opts: {
  packageId: string;
  packageName: string;
  pricingModel: PackagePricingModel | string;
  flexibility: PackageFlexibility | string;
  fixedPrice: number | null;
  discountPercent: number;
  components: PackageComponentInput[];
  sectionId?: string | null;
  scale?: number;
}): QuotationLineItemInput[] {
  const scale = Math.max(0.0001, Number(opts.scale) || 1);
  const locked = opts.flexibility === "locked";
  const qtyAdjustable = opts.flexibility === "quantity_adjustable";
  const components = opts.components.filter((c) => (c.item_name ?? "").trim().length > 0);
  const componentTotal = components.reduce(
    (sum, c) => sum + (Number(c.unit_price) || 0) * (Number(c.quantity) || 0) * scale,
    0
  );
  const fixedPrice = opts.fixedPrice == null ? null : Number(opts.fixedPrice);
  const included = components
    .filter((c) => !c.is_optional)
    .map((c) => `${Number(c.quantity) || 1} × ${c.item_name}`)
    .join("; ");

  // FIXED_PRICE packages may have unpriced components (selling_price default 0).
  // Do not invent component catalogue prices; snapshot the published package price.
  if (opts.pricingModel === "fixed" && fixedPrice != null && fixedPrice > 0 && componentTotal <= 0) {
    return [
      {
        catalog_item_id: null,
        item_name: opts.packageName,
        description: included ? `Includes: ${included}.` : null,
        unit_price: Math.round((fixedPrice + Number.EPSILON) * 100) / 100,
        quantity: scale,
        unit: "Package",
        sku: null,
        cost_price: null,
        is_optional: false,
        catalog_unit_price: 0,
        package_id: opts.packageId,
        package_locked: locked,
        section_id: opts.sectionId ?? null,
        option_group: opts.packageName,
      },
    ];
  }

  return components.map((c) => {
    const baseQty = Number(c.quantity) || 1;
    const qty = baseQty * scale;
    let unitPrice = Number(c.unit_price) || 0;
    if (opts.pricingModel === "discounted_bundle" && opts.discountPercent > 0) {
      unitPrice = unitPrice * (1 - Number(opts.discountPercent) / 100);
    }
    if (opts.pricingModel === "fixed" && fixedPrice != null && componentTotal > 0) {
      const share = ((Number(c.unit_price) || 0) * baseQty * (qtyAdjustable ? scale : 1)) / componentTotal;
      const lineTarget = fixedPrice * share;
      unitPrice = qty > 0 ? lineTarget / qty : 0;
    }
    return {
      catalog_item_id: c.catalog_item_id,
      item_name: c.item_name,
      description: c.description,
      unit_price: Math.round((unitPrice + Number.EPSILON) * 100) / 100,
      quantity: qty,
      unit: c.unit || "Each",
      sku: c.sku,
      cost_price: c.cost_price,
      is_optional: Boolean(c.is_optional),
      catalog_unit_price: Number(c.unit_price) || 0,
      package_id: opts.packageId,
      package_locked: locked,
      section_id: opts.sectionId ?? null,
      option_group: opts.packageName,
    };
  });
}
