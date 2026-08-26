import { commercialContext, jsonErr, jsonOk } from "@/lib/commercial/api";
import { cloneProduct, getProduct, updateProduct } from "@/lib/products/service";
import { hasCommercialPermission } from "@/lib/commercial/permissions";

export async function GET(_req: Request, { params }: { params: { clientId: string; productId: string } }) {
  const ctx = await commercialContext(_req, params.clientId, "products.view");
  if ("error" in ctx) return ctx.error;
  const result = await getProduct(params.clientId, params.productId, ctx.canSeeCost);
  if ("error" in result && result.error) return jsonErr(result.error, result.status ?? 500);
  return jsonOk(result);
}

export async function PATCH(req: Request, { params }: { params: { clientId: string; productId: string } }) {
  const ctx = await commercialContext(req, params.clientId, "products.edit");
  if ("error" in ctx) return ctx.error;
  const body = (await req.json()) as Record<string, unknown>;
  const canEditCost = hasCommercialPermission(ctx.actor, "cost.edit", { quotationSettings: ctx.quotationSettings });
  if (!canEditCost) {
    delete body.cost_price;
    delete body.cost_currency;
  }
  const result = await updateProduct(params.clientId, params.productId, ctx.actor.userId, body, canEditCost);
  if ("error" in result && result.error) return jsonErr(result.error, result.status ?? 400);
  return jsonOk(result);
}

export async function POST(req: Request, { params }: { params: { clientId: string; productId: string } }) {
  const ctx = await commercialContext(req, params.clientId, "products.create");
  if ("error" in ctx) return ctx.error;
  const url = new URL(req.url);
  if (url.searchParams.get("clone") === "1") {
    const result = await cloneProduct(params.clientId, params.productId, ctx.actor.userId);
    if ("error" in result && result.error) return jsonErr(String(result.error), 400);
    return jsonOk(result, 201);
  }
  return jsonErr("Unknown action", 400);
}
