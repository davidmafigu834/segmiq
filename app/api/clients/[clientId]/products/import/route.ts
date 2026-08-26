import { commercialContext, jsonErr, jsonOk } from "@/lib/commercial/api";
import { createAdminClient } from "@/lib/supabase/admin";
import { createProduct } from "@/lib/products/service";
import { adjustStock, getInventorySettings, listLocations, upsertLocation } from "@/lib/inventory/service";
import { importSummary, parseCsvText, validateImportRows, type ImportDecision } from "@/lib/commercial/import";

export async function POST(req: Request, { params }: { params: { clientId: string } }) {
  const ctx = await commercialContext(req, params.clientId, "products.import");
  if ("error" in ctx) return ctx.error;

  const form = await req.formData();
  const file = form.get("file") as File | null;
  const duplicateMode = (String(form.get("duplicateMode") || "SKIP") as ImportDecision) || "SKIP";
  const dryRun = String(form.get("dryRun") || "") === "1";
  if (!file) return jsonErr("file is required");

  const name = file.name.toLowerCase();
  let text = "";
  if (name.endsWith(".xlsx")) {
    return jsonErr("XLSX import requires saving as CSV for this upload, or use the mapping wizard with CSV. XLSX parsing is accepted when exceljs is available.", 415);
  }
  text = await file.text();
  const parsed = parseCsvText(text);
  if (!parsed.rows.length) return jsonErr("No data rows");

  const supabase = createAdminClient();
  const { data: existing } = await supabase.from("products").select("id, sku").eq("client_id", params.clientId);
  const skuMap = new Map<string, { id: string }>();
  for (const p of existing ?? []) {
    if (p.sku) skuMap.set(String(p.sku).toLowerCase(), { id: p.id as string });
  }
  const mapped = parsed.rows.map((row) => {
    const out: Record<string, string> = { ...row };
    if (!out.name && out.product_name) out.name = out.product_name;
    if (!out.selling_price && out.price) out.selling_price = out.price;
    return out;
  });
  const validated = validateImportRows(mapped, { existingSkus: skuMap, duplicateMode });
  const summary = importSummary(validated);
  if (dryRun) return jsonOk({ summary, rows: validated.slice(0, 100), headers: parsed.headers });

  let created = 0;
  let updated = 0;
  let skipped = 0;
  let failed = 0;
  const errors: Array<{ row: number; reason: string }> = [];
  const settings = await getInventorySettings(params.clientId);
  let locationId = settings.defaultLocationId;
  if (!locationId) {
    const locs = await listLocations(params.clientId);
    locationId = (locs.locations[0] as { id?: string } | undefined)?.id ?? null;
    if (!locationId) {
      const createdLoc = await upsertLocation(params.clientId, { name: "Main warehouse", is_default: true, location_type: "WAREHOUSE" });
      locationId = (createdLoc.location as { id?: string } | undefined)?.id ?? null;
    }
  }

  for (const row of validated) {
    if (row.errors.length) {
      failed += 1;
      errors.push({ row: row.rowNumber, reason: row.errors.join("; ") });
      continue;
    }
    if (row.decision === "SKIP") {
      skipped += 1;
      continue;
    }
    try {
      if (row.decision === "UPDATE" && row.sku) {
        const id = skuMap.get(row.sku.toLowerCase())?.id;
        if (id) {
          await supabase
            .from("products")
            .update({
              name: row.name,
              selling_price: row.sellingPrice ?? 0,
              unit: row.unit,
              updated_at: new Date().toISOString(),
            })
            .eq("id", id)
            .eq("client_id", params.clientId);
          updated += 1;
        }
      } else {
        const createdP = await createProduct(params.clientId, ctx.actor.userId, {
          name: row.name,
          sku: row.sku,
          item_type: row.itemType,
          selling_price: row.sellingPrice ?? 0,
          unit: row.unit,
          cost_price: ctx.canSeeCost ? row.costPrice : null,
          track_inventory: row.itemType === "PRODUCT" && row.onHand != null,
          allow_fractional_qty: row.allowFractional,
          status: "ACTIVE",
        });
        if (!createdP.product) {
          failed += 1;
          errors.push({ row: row.rowNumber, reason: createdP.error ?? "create failed" });
          continue;
        }
        created += 1;
        if (row.onHand != null && row.onHand > 0 && locationId && createdP.product.id) {
          await adjustStock({
            clientId: params.clientId,
            locationId,
            productId: createdP.product.id as string,
            delta: row.onHand,
            reason: "New delivery",
            actorId: ctx.actor.userId,
            source: "IMPORT",
            movementType: "IMPORT",
          });
        }
      }
    } catch (err) {
      failed += 1;
      errors.push({ row: row.rowNumber, reason: err instanceof Error ? err.message : "failed" });
    }
  }

  return jsonOk({
    summary: { ...summary, created, updated, skipped, failed },
    errors: errors.slice(0, 200),
  });
}

export async function GET(req: Request, { params }: { params: { clientId: string } }) {
  const ctx = await commercialContext(req, params.clientId, "products.export");
  if ("error" in ctx) return ctx.error;
  const supabase = createAdminClient();
  const kind = new URL(req.url).searchParams.get("kind") || "products";
  if (kind === "inventory") {
    const { data } = await supabase
      .from("inventory_balances")
      .select("product_id, variant_id, location_id, on_hand, reserved, reorder_level")
      .eq("client_id", params.clientId)
      .limit(20000);
    const { data: products } = await supabase.from("products").select("id, name, sku").eq("client_id", params.clientId);
    const { data: locations } = await supabase.from("inventory_locations").select("id, name").eq("client_id", params.clientId);
    const pMap = new Map((products ?? []).map((p) => [p.id as string, p]));
    const lMap = new Map((locations ?? []).map((l) => [l.id as string, l]));
    const header = "SKU,Product,Location,On Hand,Reserved,Available,Reorder Level";
    const lines = (data ?? []).map((b) => {
      const p = pMap.get(b.product_id as string);
      const loc = lMap.get(b.location_id as string);
      const avail = (Number(b.on_hand) || 0) - (Number(b.reserved) || 0);
      return [p?.sku ?? "", p?.name ?? "", loc?.name ?? "", b.on_hand, b.reserved, avail, b.reorder_level ?? ""].join(",");
    });
    return new Response([header, ...lines].join("\n"), {
      headers: { "Content-Type": "text/csv", "Content-Disposition": "attachment; filename=inventory.csv" },
    });
  }
  const { data } = await supabase
    .from("products")
    .select("name, sku, barcode, brand, item_type, selling_price, cost_price, currency, unit, status")
    .eq("client_id", params.clientId)
    .limit(50000);
  const header = "Name,SKU,Barcode,Brand,Type,Selling Price,Cost Price,Currency,Unit,Status";
  const lines = (data ?? []).map((p) => {
    const cost = ctx.canSeeCost ? p.cost_price ?? "" : "";
    return [p.name, p.sku ?? "", p.barcode ?? "", p.brand ?? "", p.item_type, p.selling_price, cost, p.currency, p.unit, p.status]
      .map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`)
      .join(",");
  });
  return new Response([header, ...lines].join("\n"), {
    headers: { "Content-Type": "text/csv", "Content-Disposition": "attachment; filename=products.csv" },
  });
}
