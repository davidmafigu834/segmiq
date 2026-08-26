import { commercialContext, jsonErr, jsonOk } from "@/lib/commercial/api";
import { listProductActivity } from "@/lib/products/service";

export async function GET(req: Request, { params }: { params: { clientId: string; productId: string } }) {
  const ctx = await commercialContext(req, params.clientId, "products.view");
  if ("error" in ctx) return ctx.error;
  const limit = Number(new URL(req.url).searchParams.get("limit") || 80);
  const result = await listProductActivity(params.clientId, params.productId, limit);
  if (result.error) return jsonErr(result.error, 500);
  return jsonOk(result);
}
