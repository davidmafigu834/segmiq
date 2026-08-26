import { createAdminClient } from "@/lib/supabase/admin";
import { searchCommercialItems } from "@/lib/products/search";
import { getProduct } from "@/lib/products/service";
import { getAvailability, getInventorySettings } from "@/lib/inventory/service";
import { getPackage } from "@/lib/packages/service";
import { discloseAvailability } from "@/lib/agent/disclosure";
import { omitCostFields } from "@/lib/commercial/money";
import {
  catalogSearchNote,
  isBuiltinQuoteTemplate,
  packageHasSellableComponents,
} from "./quotation";
import { toolFailure, toolSuccess, type ToolExecutionContext, type ToolResult } from "./context";

function readyToQuote(hit: {
  type: string;
  price?: number | null;
  availability?: string | null;
  status?: string;
}): boolean {
  if (hit.type !== "PACKAGE") return false;
  if (hit.status && hit.status !== "ACTIVE") return false;
  if (hit.availability === "UNAVAILABLE" || hit.availability === "NEEDS_REVIEW") return false;
  return (Number(hit.price) || 0) > 0;
}

export async function executeCatalogSearch(
  ctx: ToolExecutionContext,
  input: { query?: string; limit?: number }
): Promise<ToolResult> {
  const supabase = createAdminClient();
  const limit = input.limit ?? 8;
  const { results } = await searchCommercialItems({
    clientId: ctx.clientId,
    q: input.query,
    types: "ALL",
    limit,
    canSeeCost: false,
  });

  const productResults = results
    .filter((r) => r.type === "PRODUCT" || r.type === "SERVICE")
    .map((r) =>
      omitCostFields(
        {
          type: "product" as const,
          id: r.id,
          name: r.name,
          price: r.price ?? 0,
          sku: r.sku ?? null,
          kind: r.type === "SERVICE" ? "service" : "product",
        },
        false
      )
    );

  const packageResults = results
    .filter((r) => r.type === "PACKAGE")
    .map((r) => ({
      type: "package" as const,
      id: r.id,
      name: r.name,
      pricing_model: r.pricingMode === "FIXED_PRICE" ? "fixed" : "sum_of_items",
      fixed_price: r.price ?? null,
      currency: r.currency ?? "USD",
      description: r.description ?? null,
      ready_to_quote: readyToQuote(r),
    }));

  const { data: templates } = await supabase
    .from("quote_templates")
    .select("id, name, description, is_builtin, builtin_key")
    .eq("client_id", ctx.clientId)
    .limit(25);
  const terms = (input.query ?? "").trim().toLowerCase().split(/\s+/).filter(Boolean);
  const matches = (text: string | null | undefined): boolean => {
    if (!terms.length) return true;
    const haystack = (text ?? "").toLowerCase();
    return terms.some((t) => haystack.includes(t));
  };
  const templateResults = (templates ?? [])
    .filter((t) => !isBuiltinQuoteTemplate(t))
    .filter((t) => matches(`${t.name} ${t.description ?? ""}`))
    .slice(0, 5)
    .map((t) => ({ type: "template" as const, id: t.id, name: t.name, layout_only: true }));

  if (!results.length) {
    const { data: legacyPkgs } = await supabase
      .from("quotation_packages")
      .select("id, name, description, pricing_model, fixed_price, currency")
      .eq("client_id", ctx.clientId)
      .eq("is_active", true)
      .limit(50);
    const matched = (legacyPkgs ?? []).filter((p) => matches(`${p.name} ${p.description ?? ""}`)).slice(0, limit);
    const ids = matched.map((p) => p.id as string);
    const { data: comps } = ids.length
      ? await supabase.from("quotation_package_components").select("package_id, unit_price").in("package_id", ids)
      : { data: [] as Array<{ package_id: string; unit_price: number | null }> };
    const byPkg = new Map<string, Array<{ unit_price?: number | null }>>();
    for (const row of comps ?? []) {
      const list = byPkg.get(row.package_id) ?? [];
      list.push({ unit_price: row.unit_price });
      byPkg.set(row.package_id, list);
    }
    for (const p of matched) {
      const fixedPrice = p.fixed_price == null ? null : Number(p.fixed_price);
      packageResults.push({
        type: "package",
        id: p.id as string,
        name: p.name as string,
        pricing_model: String(p.pricing_model ?? ""),
        fixed_price: fixedPrice,
        currency: (p.currency as string) ?? "USD",
        description: (p.description as string | null) ?? null,
        ready_to_quote: packageHasSellableComponents(byPkg.get(p.id as string) ?? [], fixedPrice),
      });
    }
  }

  const readyPackageCount = packageResults.filter((p) => p.ready_to_quote).length;
  return toolSuccess({
    packages: packageResults,
    products: productResults,
    templates: templateResults,
    note: catalogSearchNote({
      readyPackageCount,
      packageCount: packageResults.length,
      productCount: productResults.length,
    }),
  });
}

export async function executeProductSearch(
  ctx: ToolExecutionContext,
  input: { query?: string; limit?: number }
): Promise<ToolResult> {
  const { results } = await searchCommercialItems({
    clientId: ctx.clientId,
    q: input.query,
    types: ["PRODUCT", "SERVICE"],
    limit: input.limit ?? 8,
    canSeeCost: false,
  });
  return toolSuccess({
    products: results.map((r) => ({
      id: r.id,
      name: r.name,
      sku: r.sku ?? null,
      type: r.type,
      price: r.price ?? 0,
      currency: r.currency ?? "USD",
    })),
  });
}

export async function executeProductGet(
  ctx: ToolExecutionContext,
  input: { product_id: string }
): Promise<ToolResult> {
  const loaded = await getProduct(ctx.clientId, input.product_id, false);
  if ("error" in loaded && loaded.error) return toolFailure(loaded.error);
  const p = loaded.product as Record<string, unknown>;
  return toolSuccess({
    product: {
      id: p.id,
      name: p.name,
      sku: p.sku ?? null,
      type: p.item_type,
      price: p.selling_price,
      currency: p.currency,
      unit: p.unit,
      warranty: p.warranty ?? null,
      description: p.quotation_description ?? p.description ?? null,
    },
  });
}

export async function executeInventoryGetAvailability(
  ctx: ToolExecutionContext,
  input: { product_id: string; variant_id?: string }
): Promise<ToolResult> {
  const settings = await getInventorySettings(ctx.clientId);
  const avail = await getAvailability({
    clientId: ctx.clientId,
    productId: input.product_id,
    variantId: input.variant_id,
  });
  return toolSuccess({
    product_id: input.product_id,
    ...discloseAvailability(avail, settings.agentDisclosure),
  });
}

export async function executePackageSearch(
  ctx: ToolExecutionContext,
  input: { query?: string; limit?: number }
): Promise<ToolResult> {
  const { results } = await searchCommercialItems({
    clientId: ctx.clientId,
    q: input.query,
    types: ["PACKAGE"],
    limit: input.limit ?? 8,
    canSeeCost: false,
  });
  return toolSuccess({
    packages: results.map((r) => ({
      id: r.id,
      name: r.name,
      price: r.price ?? 0,
      currency: r.currency ?? "USD",
      description: r.description ?? null,
      pricing_mode: r.pricingMode ?? null,
      availability: r.availability,
      ready_to_quote: readyToQuote(r),
    })),
  });
}

export async function executePackageGet(
  ctx: ToolExecutionContext,
  input: { package_id: string }
): Promise<ToolResult> {
  const loaded = await getPackage(ctx.clientId, input.package_id, false);
  if ("error" in loaded && loaded.error) return toolFailure(loaded.error);
  const pkg = loaded.package as Record<string, unknown>;
  return toolSuccess({
    package: {
      id: pkg.id,
      name: pkg.name,
      status: pkg.status,
      pricing_mode: pkg.pricing_mode,
      fixed_price: pkg.fixed_price,
      currency: pkg.currency,
      description: pkg.customer_facing_description ?? pkg.description ?? null,
      capability_guidance: pkg.description ?? null,
      availability: pkg.availability,
      items: ((pkg.items as Array<Record<string, unknown>>) ?? []).map((i) => ({
        name: i.snapshot_name ?? (i.product as { name?: string } | undefined)?.name,
        quantity: i.quantity,
        optional: i.optional,
        type: i.item_type,
      })),
    },
  });
}

export async function executePackageCheckAvailability(
  ctx: ToolExecutionContext,
  input: { package_id: string; scale?: number }
): Promise<ToolResult> {
  const loaded = await getPackage(ctx.clientId, input.package_id, false);
  if ("error" in loaded && loaded.error) return toolFailure(loaded.error);
  const pkg = loaded.package as Record<string, unknown>;
  const availability = pkg.availability as { status?: string; availableCount?: number | null } | undefined;
  const settings = await getInventorySettings(ctx.clientId);
  const count =
    settings.agentDisclosure === "EXACT" && availability?.availableCount != null
      ? Math.floor((availability.availableCount ?? 0) / Math.max(1, input.scale ?? 1))
      : null;
  if (settings.agentDisclosure === "HIDDEN") {
    return toolSuccess({ package_id: input.package_id });
  }
  if (settings.agentDisclosure === "GENERAL" || count == null) {
    const status = availability?.status;
    const general =
      status === "UNAVAILABLE" ? "unavailable" : status === "LIMITED" ? "limited" : status === "READY" ? "in_stock" : "unknown";
    return toolSuccess({ package_id: input.package_id, availability: general });
  }
  return toolSuccess({
    package_id: input.package_id,
    available_count: count,
    status: availability?.status ?? null,
  });
}
