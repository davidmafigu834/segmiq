import { commercialContext, jsonErr, jsonOk } from "@/lib/commercial/api";
import { createProduct, listBrands, listProducts } from "@/lib/products/service";

export async function GET(req: Request, { params }: { params: { clientId: string } }) {
  const ctx = await commercialContext(req, params.clientId, "products.view");
  if ("error" in ctx) return ctx.error;
  const url = new URL(req.url);
  const result = await listProducts({
    clientId: params.clientId,
    q: url.searchParams.get("q") ?? undefined,
    type: (url.searchParams.get("type") as "PRODUCT" | "SERVICE" | "ALL") || "ALL",
    categoryId: url.searchParams.get("categoryId"),
    brand: url.searchParams.get("brand"),
    status: (url.searchParams.get("status") as "ACTIVE" | "INACTIVE" | "ARCHIVED" | "ALL") || "ALL",
    inventoryStatus: (url.searchParams.get("inventory") as "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK" | "NOT_TRACKED" | "ALL") || "ALL",
    page: Number(url.searchParams.get("page") || 1),
    limit: Number(url.searchParams.get("limit") || 50),
    canSeeCost: ctx.canSeeCost,
  });
  if (url.searchParams.get("brands") === "1") {
    const brands = await listBrands(params.clientId);
    return jsonOk({ ...result, brands });
  }
  return jsonOk(result);
}

export async function POST(req: Request, { params }: { params: { clientId: string } }) {
  const ctx = await commercialContext(req, params.clientId, "products.create");
  if ("error" in ctx) return ctx.error;
  const body = (await req.json()) as Record<string, unknown>;
  if (!ctx.canSeeCost) {
    delete body.cost_price;
    delete body.cost_currency;
  }
  const result = await createProduct(params.clientId, ctx.actor.userId, body);
  if (result.error) return jsonErr(result.error, result.status ?? 400);
  return jsonOk({ product: result.product }, 201);
}
