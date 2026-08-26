import { createAdminClient } from "@/lib/supabase/admin";
import { createProduct } from "@/lib/products/service";
import { createPackage, savePackageContents } from "@/lib/packages/service";

export type CatalogueMigrationReport = {
  productsCreated: number;
  servicesCreated: number;
  packagesCreated: number;
  skipped: number;
  duplicateSku: number;
  missingSku: number;
  conflicts: string[];
};

export async function migrateLegacyCatalogue(clientId: string, actorId: string): Promise<CatalogueMigrationReport> {
  const supabase = createAdminClient();
  const report: CatalogueMigrationReport = {
    productsCreated: 0,
    servicesCreated: 0,
    packagesCreated: 0,
    skipped: 0,
    duplicateSku: 0,
    missingSku: 0,
    conflicts: [],
  };

  const { data: existing } = await supabase
    .from("products")
    .select("legacy_catalog_item_id, sku")
    .eq("client_id", clientId);
  const migrated = new Set((existing ?? []).map((p) => p.legacy_catalog_item_id as string).filter(Boolean));
  const skuOwners = new Map<string, string>();
  for (const p of existing ?? []) {
    if (p.sku) skuOwners.set(String(p.sku).toLowerCase(), "existing");
  }

  const { data: catalog } = await supabase.from("product_catalog").select("*").eq("client_id", clientId);
  for (const row of catalog ?? []) {
    if (migrated.has(row.id as string)) {
      report.skipped += 1;
      continue;
    }
    const sku = row.sku ? String(row.sku).trim() : "";
    if (!sku) report.missingSku += 1;
    else if (skuOwners.has(sku.toLowerCase())) {
      report.duplicateSku += 1;
      report.conflicts.push(`SKU ${sku} already exists`);
    }
    const created = await createProduct(clientId, actorId, {
      name: row.name,
      sku: sku && skuOwners.has(sku.toLowerCase()) ? null : sku || null,
      description: row.description,
      quotation_description: row.description,
      selling_price: row.unit_price,
      currency: row.currency,
      unit: row.unit,
      cost_price: row.cost_price,
      tax_rate: row.tax_rate,
      warranty: row.warranty,
      item_type: row.item_kind === "service" ? "SERVICE" : "PRODUCT",
      min_selling_price: row.min_selling_price,
      track_inventory: false,
      status: row.is_active ? "ACTIVE" : "INACTIVE",
      primary_image_url: row.image_url,
      requires_technical_confirmation: row.requires_approval,
    });
    if (created.product) {
      await supabase
        .from("products")
        .update({ legacy_catalog_item_id: row.id })
        .eq("id", created.product.id as string);
      if (sku) skuOwners.set(sku.toLowerCase(), created.product.id as string);
      if (row.item_kind === "service") report.servicesCreated += 1;
      else report.productsCreated += 1;
    } else {
      report.skipped += 1;
      report.conflicts.push(created.error ?? "failed to create product");
    }
  }

  const { data: pkgs } = await supabase.from("quotation_packages").select("*").eq("client_id", clientId);
  const { data: existingPkgs } = await supabase
    .from("commercial_packages")
    .select("legacy_quotation_package_id")
    .eq("client_id", clientId);
  const pkgMigrated = new Set((existingPkgs ?? []).map((p) => p.legacy_quotation_package_id as string).filter(Boolean));
  const { data: products } = await supabase
    .from("products")
    .select("id, legacy_catalog_item_id")
    .eq("client_id", clientId);
  const byLegacy = new Map((products ?? []).map((p) => [p.legacy_catalog_item_id as string, p.id as string]));

  for (const pkg of pkgs ?? []) {
    if (pkgMigrated.has(pkg.id as string)) {
      report.skipped += 1;
      continue;
    }
    const created = await createPackage(clientId, actorId, {
      name: pkg.name,
      description: pkg.description,
      customer_facing_description: pkg.description,
      pricing_mode: pkg.pricing_model === "fixed" ? "FIXED_PRICE" : "SUM_OF_ITEMS",
      fixed_price: pkg.fixed_price,
      currency: pkg.currency,
      status: pkg.is_active ? "ACTIVE" : "INACTIVE",
      flexibility: pkg.flexibility,
      discount_percent: pkg.discount_percent,
    });
    if (!created.package) continue;
    await supabase
      .from("commercial_packages")
      .update({ legacy_quotation_package_id: pkg.id })
      .eq("id", created.package.id as string);
    const { data: comps } = await supabase
      .from("quotation_package_components")
      .select("*")
      .eq("package_id", pkg.id)
      .order("sort_order");
    await savePackageContents(clientId, created.package.id as string, actorId, {
      items: (comps ?? []).map((c, i) => ({
        product_id: c.catalog_item_id ? byLegacy.get(c.catalog_item_id as string) ?? null : null,
        item_type: "PRODUCT",
        quantity: c.quantity,
        optional: c.is_optional,
        sort_order: c.sort_order ?? i,
        snapshot_name: c.item_name,
        snapshot_sku: c.sku,
        snapshot_unit: c.unit,
        snapshot_unit_price: c.unit_price,
      })),
    });
    report.packagesCreated += 1;
  }

  return report;
}
